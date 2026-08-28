import { Db, Document, ObjectId, UpdateFilter } from 'mongodb';
import { consoleLogger, Logger } from './types';

/** A source stuck "running" with no live job for this long is reset. */
const STALE_SOURCE_MS = 2 * 60 * 60 * 1000;
/** A job whose slice has not touched it in this long is abandoned. */
const STALE_JOB_MS = 24 * 60 * 60 * 1000;
/** Most recent job ids kept on a source; the collection holds the full history. */
const MAX_JOB_IDS_ON_SOURCE = 50;

export interface PollResult {
  createdJobIds: string[];
  runnableJobIds: string[];
  healedSources: number;
  cancelledJobs: number;
}

/**
 * Port of the Appwrite job-pooler function. Reconciles orphaned state, finds
 * sources due for a crawl, creates job-execution records for them, and returns
 * every live job so the caller can run crawl slices inside its own time budget.
 */
export async function pollSources(
  db: Db,
  log: Logger = consoleLogger
): Promise<PollResult> {
  const sources = db.collection('sources');
  const categories = db.collection('categories');
  const jobs = db.collection('job-executions');
  const now = new Date();

  // 1. Abandon jobs nothing has touched in a day. Without this, jobs orphaned
  //    by a dead deployment stay "runnable" forever, occupy the query window,
  //    and — on their eventual completion — stomp their source's current state.
  const jobStaleCutoff = new Date(now.getTime() - STALE_JOB_MS);
  const cancelled = await jobs.updateMany(
    {
      status: { $in: ['running', 'in_progress'] },
      $or: [
        { updatedAt: { $lt: jobStaleCutoff } },
        { updatedAt: { $exists: false } },
      ],
    },
    {
      $set: {
        status: 'cancelled',
        error: 'Abandoned: no progress within 24h',
        completedAt: now,
        updatedAt: now,
      },
    }
  );
  if (cancelled.modifiedCount > 0) {
    log.info(`Cancelled ${cancelled.modifiedCount} abandoned job(s)`);
  }

  // 2. Cancel jobs whose source no longer exists or was deactivated, so they
  //    stop consuming the runnable window.
  const liveJobs = await jobs
    .find({ status: { $in: ['running', 'in_progress'] } })
    .project({ _id: 1, sourceId: 1 })
    .toArray();
  let orphanCancelled = 0;
  for (const job of liveJobs) {
    let sourceOid: ObjectId;
    try {
      sourceOid = new ObjectId(String(job.sourceId));
    } catch {
      sourceOid = new ObjectId();
    }
    const source = await sources.findOne(
      { _id: sourceOid },
      { projection: { isActive: 1 } }
    );
    if (!source || source.isActive === false) {
      await jobs.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'cancelled',
            error: 'Source removed or deactivated',
            completedAt: now,
            updatedAt: now,
          },
        }
      );
      orphanCancelled += 1;
    }
  }

  // 3. Self-heal sources wedged in "running" with no live job. `$lt` alone
  //    never matches documents missing the field, and every source written by
  //    the old Python pipeline lacks updatedAt — without the $exists branch
  //    those sources can never be scheduled again.
  const staleCutoff = new Date(now.getTime() - STALE_SOURCE_MS);
  let healedSources = 0;
  const stuck = await sources
    .find({
      status: 'running',
      $or: [
        { updatedAt: { $lt: staleCutoff } },
        { updatedAt: { $exists: false } },
      ],
    })
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
            currentJobId: null,
            nextRunAt: source.nextRunAt ?? now,
            updatedAt: now,
          },
        }
      );
      healedSources += 1;
    }
  }
  if (healedSources > 0) log.info(`Reset ${healedSources} stalled source(s)`);

  // 4. Sources due for a new crawl.
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
    let category: Document | null = null;
    try {
      category = await categories.findOne({ _id: new ObjectId(String(source.categoryId)) });
    } catch {
      category = null;
    }
    if (!category) {
      log.error(`Category not found for source ${sourceId}; skipping`);
      continue;
    }

    // Claim the source; a concurrent poller invocation loses this race safely.
    const jobId = new ObjectId();
    const claim = await sources.updateOne(
      { _id: source._id, status: { $ne: 'running' } },
      {
        $set: {
          status: 'running',
          currentJobId: jobId.toString(),
          lastRunAt: now,
          updatedAt: now,
        },
      }
    );
    if (claim.modifiedCount === 0) continue;

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
      leaseUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    // Keep only the most recent ids: this array had grown past 1100 entries in
    // production, and every write rewrites the whole document.
    await sources.updateOne({ _id: source._id }, {
      $push: {
        jobExecutionIds: {
          $each: [jobId.toString()],
          $slice: -MAX_JOB_IDS_ON_SOURCE,
        },
      },
    } as unknown as UpdateFilter<Document>);
    createdJobIds.push(jobId.toString());
    log.info(`Created job ${jobId} for source ${sourceId} (${source.url})`);
  }

  // 5. Everything still live — fresh jobs plus partially-crawled ones — is
  //    runnable. Oldest first so no job starves.
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
    cancelledJobs: cancelled.modifiedCount + orphanCancelled,
  };
}
