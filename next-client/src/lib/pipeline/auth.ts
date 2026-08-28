/**
 * Cron/manual-trigger auth. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * automatically when the CRON_SECRET env var is set on the project.
 * Manual runs: curl -H "Authorization: Bearer $CRON_SECRET" <url>
 */
export function isPipelineRequestAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Local development convenience; production must set CRON_SECRET.
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Soft time budget for one invocation, kept under the route's maxDuration. */
export function invocationDeadline(startedAt = Date.now()): number {
  const budget = parseInt(process.env.PIPELINE_TIME_BUDGET_MS ?? '', 10);
  return startedAt + (Number.isFinite(budget) && budget > 0 ? budget : 240_000);
}
