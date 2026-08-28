import { timingSafeEqual } from 'node:crypto';

/**
 * Cron/manual-trigger auth. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * automatically when the CRON_SECRET env var is set on the project.
 * Manual runs: curl -H "Authorization: Bearer $CRON_SECRET" <url>
 *
 * With no secret configured the endpoints are open only on an explicit local
 * opt-in — never implicitly, so a deploy that forgets CRON_SECRET fails closed
 * instead of exposing crawl triggers and paid API quota.
 */
export function isPipelineRequestAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_UNAUTH_CRON === 'true'
    );
  }

  const header = req.headers.get('authorization');
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Soft time budget for one invocation, kept under the route's maxDuration. */
export function invocationDeadline(startedAt = Date.now()): number {
  const budget = parseInt(process.env.PIPELINE_TIME_BUDGET_MS ?? '', 10);
  return startedAt + (Number.isFinite(budget) && budget > 0 ? budget : 240_000);
}
