import { Db, ObjectId } from 'mongodb';
import { CronExpressionParser } from 'cron-parser';
import {
  fetchHtml as defaultFetchHtml,
  extractArticle as defaultExtractArticle,
  extractDomainLinks as defaultExtractDomainLinks,
} from './extract';
import {
  consoleLogger,
  CrawlProgress,
  JobMetadata,
  Logger,
} from './types';

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
  const job = await jobs.findOne({ _id: new ObjectId(jobId) });
  if (!job) {
    return { jobId, completed: true, processed: 0, error: `Job not found: ${jobId}` };
  }

  const metadata: JobMetadata = job.metadata ?? {
    crawl_progress: {
      visited: [],
      to_visit: [[job.sourceUrl, 0]],
      total_processed: 0,
      is_completed: false,
    },
    articleIds: [],
    last_execution_duration: 0,
    total_executions: 0,
  };

  const progress: CrawlProgress = metadata.crawl_progress;
  const visited = new Set<string>(progress.visited ?? []);
  const toVisit: Array<[string, number]> = (progress.to_visit ?? [[job.sourceUrl, 0]]).map(
    (entry) => [entry[0], entry[1]] as [string, number]
  );
  const totalProcessed = progress.total_processed ?? 0;
  const remainingPages = maxPages - totalProcessed;
  const processedIds: string[] = [];

  let domain: string;
  try {
    domain = new URL(job.sourceUrl).hostname;
  } catch {
    domain = '';
  }

  try {
    while (toVisit.length > 0 && processedIds.length < remainingPages) {
      if (Date.now() >= deadline) {
        log.info(`Job ${jobId}: time budget reached, saving progress`);
        break;
      }

      const [currentUrl, depth] = toVisit.shift() as [string, number];
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      const isSourceUrl = currentUrl === job.sourceUrl;
      const existing = await articles.findOne(
        { url: currentUrl, categoryId: job.categoryId },
        { projection: { _id: 1 } }
      );
      if (!isSourceUrl && existing) continue;

      const html = await deps.fetchHtml(currentUrl);
      if (!html) continue;

      // Enqueue same-domain links from every fetched page within the depth
      // limit (the old version only followed links when article extraction
      // succeeded, which killed crawls whose landing page isn't an article).
      if (depth < maxDepth && domain && toVisit.length < MAX_QUEUE) {
        for (const link of deps.extractDomainLinks(html, currentUrl, domain)) {
          if (!visited.has(link)) toVisit.push([link, depth + 1]);
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
        await articles.updateOne(
          { url: currentUrl, categoryId: job.categoryId },
          { $set: { ...doc, status: 'data_extracted' } }
        );
      }
    }

    const newTotal = totalProcessed + processedIds.length;
    const isCompleted = toVisit.length === 0 || newTotal >= maxPages;
    const durationSec = (Date.now() - startTime) / 1000;

    const newMetadata: JobMetadata = {
      crawl_progress: {
        visited: [...visited],
        to_visit: toVisit,
        total_processed: newTotal,
        is_completed: isCompleted,
        max_pages: maxPages,
        max_depth: maxDepth,
      },
      articleIds: [...(metadata.articleIds ?? []), ...processedIds],
      last_execution_duration: durationSec,
      total_executions: (metadata.total_executions ?? 0) + 1,
    };

    const now = new Date();
    await jobs.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          status: isCompleted ? 'completed' : 'in_progress',
          metadata: newMetadata,
          updatedAt: now,
          ...(isCompleted ? { completedAt: now, duration: durationSec } : {}),
        },
      }
    );

    if (isCompleted) {
      const source = await sources.findOne({ _id: new ObjectId(job.sourceId) });
      const nextRunAt = source?.cronSchedule
        ? nextRunFromCron(source.cronSchedule, now)
        : null;
      await sources.updateOne(
        { _id: new ObjectId(job.sourceId) },
        {
          $set: {
            status: 'idle',
            nextRunAt,
            lastError: null,
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
    await jobs.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          status: 'error',
          error: message,
          completedAt: now,
          duration: (Date.now() - startTime) / 1000,
          updatedAt: now,
        },
      }
    );
    // Free the source so the next scheduled run can retry (the old version
    // left it stuck in "running" forever after a crash).
    const source = await sources.findOne({ _id: new ObjectId(job.sourceId) });
    await sources.updateOne(
      { _id: new ObjectId(job.sourceId) },
      {
        $set: {
          status: 'error',
          lastError: message,
          nextRunAt: source?.cronSchedule ? nextRunFromCron(source.cronSchedule, now) : now,
          updatedAt: now,
        },
      }
    );
    return { jobId, completed: false, processed: processedIds.length, error: message };
  }
}
