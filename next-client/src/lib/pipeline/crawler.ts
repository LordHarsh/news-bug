import { Db, ObjectId } from 'mongodb';
import { CronExpressionParser } from 'cron-parser';
import {
  fetchHtml as defaultFetchHtml,
  extractArticle as defaultExtractArticle,
  extractDomainLinks as defaultExtractDomainLinks,
} from './extract';
import { consoleLogger, CrawlProgress, JobMetadata, Logger } from './types';

export interface CrawlDeps {
  fetchHtml: typeof defaultFetchHtml;
  extractArticle: typeof defaultExtractArticle;
  extractDomainLinks: typeof defaultExtractDomainLinks;
}

const DEFAULT_DEPS: CrawlDeps = {
  fetchHtml: defaultFetchHtml,
  extractArticle: defaultExtractArticle,
  extractDomainLinks: defaultExtractDomainLinks,
};

const MAX_QUEUE = 5_000;
/** Pages we may dequeue per job, as a multiple of maxPages. */
const DEQUEUE_BUDGET_FACTOR = 10;
/** Failed slices tolerated before a job is declared dead. */
const MAX_CONSECUTIVE_ERRORS = 3;
/** How long a slice holds a job; must exceed one invocation's budget. */
const LEASE_MS = 10 * 60 * 1000;

function intFromEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function nextRunFromCron(schedule: string, from = new Date()): Date {
  try {
    return CronExpressionParser.parse(schedule, { currentDate: from })
      .next()
      .toDate();
  } catch {
    // Broken cron expression on the source — retry in 24h instead of never.
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

export interface CrawlResult {
  jobId: string;
  completed: boolean;
  processed: number;
  skipped?: boolean;
  error?: string;
}

/**
 * Run one time-boxed slice of a crawl job. Progress is persisted in the job's
 * metadata, so a job that doesn't finish inside the budget resumes on the next
 * cron tick. Port of the Appwrite process-source function, with the
 * previously-unfinished resume/status logic completed.
 */
export async function crawlJob(
  db: Db,
  jobId: string,
  deadline: number,
  deps: CrawlDeps = DEFAULT_DEPS,
  log: Logger = consoleLogger
): Promise<CrawlResult> {
  const jobs = db.collection('job-executions');
  const sources = db.collection('sources');
  const articles = db.collection('articles');

  const maxDepth = intFromEnv('PIPELINE_MAX_DEPTH', 2);
  const maxPages = intFromEnv('PIPELINE_MAX_PAGES', 200);

  const startTime = Date.now();
  const jobOid = new ObjectId(jobId);

  // Take a lease so two overlapping cron invocations cannot crawl the same job
  // concurrently and clobber each other's progress.
  const now0 = new Date();
  const leased = await jobs.findOneAndUpdate(
    {
      _id: jobOid,
      status: { $in: ['running', 'in_progress'] },
      $or: [{ leaseUntil: { $lt: now0 } }, { leaseUntil: null }, { leaseUntil: { $exists: false } }],
    },
    { $set: { leaseUntil: new Date(now0.getTime() + LEASE_MS), updatedAt: now0 } },
    { returnDocument: 'after' }
  );
  if (!leased) {
    return { jobId, completed: false, processed: 0, skipped: true };
  }
  const job = leased;

  const legacy = job.metadata?.crawl_progress;
  const metadata: JobMetadata = job.metadata ?? {
    crawl_progress: {
      enqueued: [job.sourceUrl],
      to_visit: [[job.sourceUrl, 0]],
      dequeued: 0,
      total_processed: 0,
      is_completed: false,
    },
    articleIds: [],
    last_execution_duration: 0,
    total_executions: 0,
  };

  const progress: CrawlProgress = metadata.crawl_progress;
  const toVisit: Array<[string, number]> = (progress.to_visit ?? [[job.sourceUrl, 0]]).map(
    (entry) => [entry[0], entry[1]] as [string, number]
  );
  // `enqueued` supersedes the older `visited` array: tracking every URL ever
  // queued (not just dequeued ones) stops site-wide nav links being pushed
  // once per crawled page.
  const enqueued = new Set<string>(
    progress.enqueued ?? legacy?.visited ?? [job.sourceUrl]
  );
  for (const [url] of toVisit) enqueued.add(url);

  const totalProcessed = progress.total_processed ?? 0;
  const remainingPages = maxPages - totalProcessed;
  let dequeued = progress.dequeued ?? 0;
  const dequeueBudget = maxPages * DEQUEUE_BUDGET_FACTOR;
  const processedIds: string[] = [];

  let domain: string;
  try {
    domain = new URL(job.sourceUrl).hostname;
  } catch {
    domain = '';
  }

  /** Persist progress; shared by the success and failure paths. */
  const buildMetadata = (isCompleted: boolean): JobMetadata => ({
    crawl_progress: {
      enqueued: [...enqueued],
      to_visit: toVisit,
      dequeued,
      total_processed: totalProcessed + processedIds.length,
      is_completed: isCompleted,
      max_pages: maxPages,
      max_depth: maxDepth,
    },
    articleIds: [...(metadata.articleIds ?? []), ...processedIds],
    last_execution_duration: (Date.now() - startTime) / 1000,
    total_executions: (metadata.total_executions ?? 0) + 1,
  });

  try {
    while (toVisit.length > 0 && processedIds.length < remainingPages) {
      if (Date.now() >= deadline) {
        log.info(`Job ${jobId}: time budget reached, saving progress`);
        break;
      }
      // Pages that yield no article (index pages, short pages) don't advance
      // processedIds, so bound the crawl by dequeues too or a link-rich site
      // never terminates.
      if (dequeued >= dequeueBudget) {
        log.info(`Job ${jobId}: dequeue budget (${dequeueBudget}) reached`);
        break;
      }

      const [currentUrl, depth] = toVisit.shift() as [string, number];
      dequeued += 1;

      const isSourceUrl = currentUrl === job.sourceUrl;
      const existing = await articles.findOne(
        { url: currentUrl, categoryId: job.categoryId },
        { projection: { _id: 1, content: 1 } }
      );
      if (!isSourceUrl && existing) continue;

      const html = await deps.fetchHtml(currentUrl);
      if (!html) continue;

      // Enqueue same-domain links from every fetched page within the depth
      // limit (the old version only followed links when article extraction
      // succeeded, which killed crawls whose landing page isn't an article).
      if (depth < maxDepth && domain) {
        for (const link of deps.extractDomainLinks(html, currentUrl, domain)) {
          if (toVisit.length >= MAX_QUEUE) break;
          if (enqueued.has(link)) continue;
          enqueued.add(link);
          toVisit.push([link, depth + 1]);
        }
      }

      const article = await deps.extractArticle(currentUrl, html);
      if (!article) continue;

      const now = new Date();
      const doc = {
        title: article.title,
        sourceId: job.sourceId,
        categoryId: job.categoryId,
        jobId,
        url: currentUrl,
        publishDate: article.publishDate,
        content: article.content,
        metadata: { authors: article.authors },
        updatedAt: now,
      };

      if (!existing) {
        const inserted = await articles.insertOne({
          ...doc,
          status: 'data_extracted',
          createdAt: now,
        });
        processedIds.push(inserted.insertedId.toString());
      } else if (isSourceUrl) {
        // Only re-queue for analysis when the text actually changed. A source
        // pointing at a single article would otherwise pay for Gemini and
        // Mapbox on every cycle, forever, and overwrite its own keywords.
        const changed = existing.content !== article.content;
        await articles.updateOne(
          { _id: existing._id },
          {
            $set: changed
              ? { ...doc, status: 'data_extracted', analysisAttempts: 0 }
              : doc,
          }
        );
      }
    }

    const newTotal = totalProcessed + processedIds.length;
    const isCompleted =
      toVisit.length === 0 || newTotal >= maxPages || dequeued >= dequeueBudget;
    const durationSec = (Date.now() - startTime) / 1000;
    const now = new Date();

    await jobs.updateOne(
      { _id: jobOid },
      {
        $set: {
          status: isCompleted ? 'completed' : 'in_progress',
          metadata: { ...buildMetadata(isCompleted), consecutiveErrors: 0 },
          leaseUntil: null,
          updatedAt: now,
          ...(isCompleted ? { completedAt: now, duration: durationSec } : {}),
        },
      }
    );

    if (isCompleted) {
      const sourceOid = new ObjectId(String(job.sourceId));
      const source = await sources.findOne({ _id: sourceOid });
      const nextRunAt = source?.cronSchedule
        ? nextRunFromCron(source.cronSchedule, now)
        : null;
      // Fenced: only the source's *current* job may release it. An old job
      // finishing must not free a source another job is actively crawling.
      await sources.updateOne(
        { _id: sourceOid, currentJobId: jobId },
        {
          $set: {
            status: 'idle',
            nextRunAt,
            lastError: null,
            currentJobId: null,
            updatedAt: now,
          },
        }
      );
      log.info(`Job ${jobId} completed: ${newTotal} pages processed in total`);
    }

    return { jobId, completed: isCompleted, processed: processedIds.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Job ${jobId} failed: ${message}`);
    const now = new Date();
    const consecutiveErrors = (metadata.consecutiveErrors ?? 0) + 1;
    const terminal = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS;

    // The recovery writes can themselves fail if the connection is what broke.
    // Leaving the job leased-but-live is safely resumable, so never let this
    // path throw and abort the rest of the tick's crawls.
    try {
      await jobs.updateOne(
        { _id: jobOid },
        {
          $set: {
            // Keep the slice's progress: a transient DB blip should not throw
            // away minutes of crawling.
            metadata: { ...buildMetadata(false), consecutiveErrors },
            status: terminal ? 'error' : 'in_progress',
            error: message,
            leaseUntil: null,
            updatedAt: now,
            ...(terminal ? { completedAt: now, duration: (Date.now() - startTime) / 1000 } : {}),
          },
        }
      );

      const sourceOid = new ObjectId(String(job.sourceId));
      if (terminal) {
        const source = await sources.findOne({ _id: sourceOid });
        await sources.updateOne(
          { _id: sourceOid, currentJobId: jobId },
          {
            $set: {
              status: 'error',
              lastError: message,
              currentJobId: null,
              nextRunAt: source?.cronSchedule
                ? nextRunFromCron(source.cronSchedule, now)
                : now,
              updatedAt: now,
            },
          }
        );
      } else {
        // Job lives on: keep the source "running" so the poller doesn't create
        // a duplicate job alongside the one still making progress.
        await sources.updateOne(
          { _id: sourceOid, currentJobId: jobId },
          { $set: { lastError: message, updatedAt: now } }
        );
      }
    } catch (writeErr) {
      log.error(
        `Job ${jobId}: failed to persist error state: ${
          writeErr instanceof Error ? writeErr.message : String(writeErr)
        }`
      );
    }

    return { jobId, completed: false, processed: processedIds.length, error: message };
  }
}
