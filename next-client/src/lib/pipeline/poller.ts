import { Db, Document, ObjectId, UpdateFilter } from 'mongodb';
import { consoleLogger, Logger } from './types';

// A "running" job untouched for this long is assumed crashed and is resumed.
const STALE_SOURCE_MS = 2 * 60 * 60 * 1000;

export interface PollResult {
  createdJobIds: string[];
  runnableJobIds: string[];
  healedSources: number;
}

/**
 * Port of the Appwrite job-pooler function. Finds sources due for a crawl,
 * creates job-execution records for them, and returns every unfinished job so
 * the caller can run crawl slices inside its own time budget.
 */
export async function pollSources(
  db: Db,
  log: Logger = consoleLogger
): Promise<PollResult> {
  const sources = db.collection('sources');
  const categories = db.collection('categories');
  const jobs = db.collection('job-executions');
  const now = new Date();

  // Self-heal: a source stuck "running" with no live job (e.g. a crashed
  // invocation) would otherwise never be scheduled again.
  const staleCutoff = new Date(now.getTime() - STALE_SOURCE_MS);
  let healedSources = 0;
  const stuck = await sources
    .find({ status: 'running', updatedAt: { $lt: staleCutoff } })
    .toArray();
  for (const source of stuck) {
    const liveJob = await jobs.findOne({
      sourceId: source._id.toString(),
      status: { $in: ['running', 'in_progress'] },
    });
    if (!liveJob) {
      await sources.updateOne(
        { _id: source._id },
        {
          $set: {
            status: 'error',
            lastError: 'Crawl stalled and was auto-reset',
            updatedAt: now,
          },
        }
      );
      healedSources += 1;
    }
  }

  // Sources due for a new crawl.
  const due = await sources
    .find({
      isActive: true,
      status: { $in: ['idle', 'error'] },
      cronSchedule: { $exists: true },
      nextRunAt: { $lte: now },
    })
    .toArray();
  log.info(`Found ${due.length} due source(s)`);

  const createdJobIds: string[] = [];
  for (const source of due) {
    const sourceId = source._id.toString();
    const category = await categories.findOne({ _id: new ObjectId(source.categoryId) });
    if (!category) {
      log.error(`Category not found for source ${sourceId}; skipping`);
      continue;
    }

    // Claim the source; a concurrent poller invocation loses this race safely.
    const claim = await sources.updateOne(
      { _id: source._id, status: { $ne: 'running' } },
      { $set: { status: 'running', lastRunAt: now, updatedAt: now } }
    );
    if (claim.modifiedCount === 0) continue;

    const jobId = new ObjectId();
    await jobs.insertOne({
      _id: jobId,
      sourceId,
      categoryId: category._id.toString(),
      sourceUrl: source.url,
      categoryKeywords: category.keywords ?? [],
      status: 'running',
      startedAt: now,
      completedAt: null,
      duration: null,
      error: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    });
    await sources.updateOne({ _id: source._id }, {
      $push: { jobExecutionIds: jobId.toString() },
    } as unknown as UpdateFilter<Document>);
    createdJobIds.push(jobId.toString());
    log.info(`Created job ${jobId} for source ${sourceId} (${source.url})`);
  }

  // Everything unfinished — fresh jobs plus partially-crawled ones — is
  // runnable now. Oldest first so no job starves.
  const runnable = await jobs
    .find({ status: { $in: ['running', 'in_progress'] } })
    .sort({ updatedAt: 1 })
    .limit(20)
    .project({ _id: 1 })
    .toArray();

  return {
    createdJobIds,
    runnableJobIds: runnable.map((j) => j._id.toString()),
    healedSources,
  };
}
