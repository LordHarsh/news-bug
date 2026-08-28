import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { pollSources } from '@/lib/pipeline/poller';
import { crawlJob, CrawlResult } from '@/lib/pipeline/crawler';
import { isPipelineRequestAuthorized, invocationDeadline } from '@/lib/pipeline/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scheduler tick (replaces the Appwrite job-pooler + process-source pair).
 * Creates jobs for due sources, then runs crawl slices until the time budget
 * is spent. Unfinished crawls resume on the next tick.
 */
async function handle(req: Request): Promise<NextResponse> {
  if (!isPipelineRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deadline = invocationDeadline();
  try {
    const db = await getDb();
    const poll = await pollSources(db);

    const crawls: CrawlResult[] = [];
    for (const jobId of poll.runnableJobIds) {
      if (Date.now() >= deadline) break;
      crawls.push(await crawlJob(db, jobId, deadline));
    }

    return NextResponse.json({
      success: true,
      createdJobs: poll.createdJobIds,
      healedSources: poll.healedSources,
      cancelledJobs: poll.cancelledJobs,
      crawls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] poll failed: ${message}`);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
