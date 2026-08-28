/**
 * Regression tests for the pipeline defects found in review.
 * No external services or API keys: in-memory MongoDB, a local fake site,
 * and stubbed LLM/geocoder.
 *
 * Run with: npm run test:pipeline
 */
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { pollSources } from '../src/lib/pipeline/poller';
import { crawlJob } from '../src/lib/pipeline/crawler';
import { analyseBatch } from '../src/lib/pipeline/analyser';
import { isFetchableUrl } from '../src/lib/pipeline/extract';
import { parseAnalysisResponse } from '../src/lib/pipeline/gemini';
import type { Analyser, Geocoder } from '../src/lib/pipeline/types';
import { TransientAnalysisError } from '../src/lib/pipeline/types';

process.env.PIPELINE_ALLOW_PRIVATE_HOSTS = 'true';

const PORT = 8791;
const SITE_URL = `http://localhost:${PORT}/`;

const quiet = { info: () => {}, error: () => {} };

let failures = 0;
let checks = 0;
function assert(cond: boolean, label: string) {
  checks++;
  console.log(`  ${cond ? '✔' : '✘'} ${label}`);
  if (!cond) failures++;
}
function section(name: string) {
  console.log(`\n── ${name}`);
}

const body = (extra = '') => `<!doctype html><html><head><title>Outbreak report</title></head>
<body><main><article><h1>Measles outbreak reported in Springfield</h1>
<p>Health officials confirmed 12 measles cases in Springfield this week. ${extra}
${'Officials continue to monitor the situation and urge vaccination across the county. '.repeat(8)}</p>
</article></main></body></html>`;

let pageExtra = '';
function startSite(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' }).end(body(pageExtra));
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function seed(db: Db, sourceOverrides: Record<string, unknown> = {}) {
  const category = await db.collection('categories').insertOne({
    title: 'Respiratory',
    keywords: ['Measles', 'Flu'],
  });
  const source = await db.collection('sources').insertOne({
    title: 'Test source',
    url: SITE_URL,
    categoryId: category.insertedId.toString(),
    cronSchedule: '0 * * * *',
    isActive: true,
    status: 'idle',
    jobExecutionIds: [],
    nextRunAt: new Date(Date.now() - 1000),
    lastRunAt: null,
    lastError: null,
    ...sourceOverrides,
  });
  return { categoryId: category.insertedId, sourceId: source.insertedId };
}

const okAnalyser: Analyser = async (articles) =>
  articles.map((a) => ({
    articleId: a.articleId,
    isValidArticle: true,
    mentions: [{ keyword: 'Measles', location: 'Springfield', caseCount: 12 }],
  }));

const okGeocoder: Geocoder = async (locations) => {
  const m = new Map();
  for (const l of new Set(locations)) m.set(l, { latitude: 39.78, longitude: -89.65 });
  return m;
};

async function main() {
  const mongod = await MongoMemoryServer.create();
  const client = await new MongoClient(mongod.getUri()).connect();
  const site = await startSite();

  try {
    // ---------------------------------------------------------------
    section('SSRF guard (unit)');
    const blocked = [
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/',
      'http://10.0.0.5/admin',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://127.0.0.1:5432/',
      'http://[::1]/',
      'http://::ffff:169.254.169.254/',
      'file:///etc/passwd',
      'http://100.64.0.1/',
    ];
    // The env opt-in must not mask the unit check.
    delete process.env.PIPELINE_ALLOW_PRIVATE_HOSTS;
    assert(blocked.every((u) => !isFetchableUrl(u)), 'private/metadata/loopback URLs rejected');
    assert(isFetchableUrl('https://edition.cnn.com/health'), 'public URL still allowed');
    process.env.PIPELINE_ALLOW_PRIVATE_HOSTS = 'true';

    // ---------------------------------------------------------------
    section('Legacy source with no updatedAt is healed (was: pipeline dead on deploy)');
    {
      const db = client.db('t-heal');
      const { sourceId } = await seed(db, { status: 'running' });
      // Reproduce the production shape exactly: no updatedAt field at all.
      await db.collection('sources').updateOne({ _id: sourceId }, { $unset: { updatedAt: '' } });
      // Its jobs are all long dead, like the 1084 error jobs in production.
      await db.collection('job-executions').insertOne({
        sourceId: sourceId.toString(),
        status: 'error',
        updatedAt: new Date('2025-03-01'),
      });

      const first = await pollSources(db, quiet);
      assert(first.healedSources === 1, 'stuck legacy source detected and reset');
      assert(
        first.createdJobIds.length === 1,
        'healed source is scheduled in the same poll (was: never again)'
      );
    }

    // ---------------------------------------------------------------
    section('Ancient zombie jobs are cancelled, not resurrected');
    {
      const db = client.db('t-zombie');
      const { sourceId } = await seed(db, { status: 'running' });
      const old = new Date('2025-03-10');
      await db.collection('job-executions').insertMany([
        { sourceId: sourceId.toString(), sourceUrl: SITE_URL, status: 'running', updatedAt: old, metadata: null },
        { sourceId: sourceId.toString(), sourceUrl: SITE_URL, status: 'in_progress', updatedAt: old, metadata: null },
      ]);

      const poll = await pollSources(db, quiet);
      assert(poll.cancelledJobs >= 2, 'stale jobs cancelled');

      const ancientStillLive = await db
        .collection('job-executions')
        .countDocuments({
          updatedAt: old,
          status: { $in: ['running', 'in_progress'] },
        });
      assert(ancientStillLive === 0, 'no ancient job is left runnable');

      // The source is freed and rescheduled in the same pass, so exactly one
      // fresh job replaces the zombies.
      assert(poll.createdJobIds.length === 1, 'a single fresh job replaces them');
      assert(
        poll.runnableJobIds.length === 1 &&
          poll.runnableJobIds[0] === poll.createdJobIds[0],
        'only the fresh job is scheduled to run'
      );
    }

    // ---------------------------------------------------------------
    section('Jobs for deactivated sources are cancelled');
    {
      const db = client.db('t-orphan');
      const { sourceId } = await seed(db, { status: 'running', isActive: false });
      await db.collection('job-executions').insertOne({
        sourceId: sourceId.toString(),
        sourceUrl: SITE_URL,
        status: 'running',
        updatedAt: new Date(),
        metadata: null,
      });
      const poll = await pollSources(db, quiet);
      assert(poll.cancelledJobs === 1, 'job for a deactivated source cancelled');
      assert(poll.runnableJobIds.length === 0, 'it is not run');
    }

    // ---------------------------------------------------------------
    section('Job lease prevents overlapping invocations crawling the same job');
    {
      const db = client.db('t-lease');
      await seed(db);
      const poll = await pollSources(db, quiet);
      const jobId = poll.runnableJobIds[0];

      const [a, b] = await Promise.all([
        crawlJob(db, jobId, Date.now() + 30_000, undefined, quiet),
        crawlJob(db, jobId, Date.now() + 30_000, undefined, quiet),
      ]);
      const skipped = [a, b].filter((r) => r.skipped).length;
      assert(skipped === 1, 'exactly one concurrent slice is admitted, the other backs off');

      const articles = await db.collection('articles').countDocuments();
      assert(articles === 1, `the page is stored once, not duplicated (got ${articles})`);
    }

    // ---------------------------------------------------------------
    section('Source-URL article is not re-analysed while its content is unchanged');
    {
      const db = client.db('t-recrawl');
      const { sourceId } = await seed(db);
      const p1 = await pollSources(db, quiet);
      await crawlJob(db, p1.runnableJobIds[0], Date.now() + 30_000, undefined, quiet);

      // Analyse it, as the analyse cron would.
      await analyseBatch(db, okAnalyser, okGeocoder, quiet);
      const afterFirst = await db.collection('articles').findOne({});
      assert(afterFirst?.status === 'completed', 'article analysed once');

      // Second crawl of the same unchanged page.
      await db.collection('sources').updateOne(
        { _id: sourceId },
        { $set: { status: 'idle', nextRunAt: new Date(Date.now() - 1000), currentJobId: null } }
      );
      const p2 = await pollSources(db, quiet);
      await crawlJob(db, p2.runnableJobIds[0], Date.now() + 30_000, undefined, quiet);
      const afterSecond = await db.collection('articles').findOne({});
      assert(
        afterSecond?.status === 'completed',
        'unchanged article stays completed (no repeat Gemini/Mapbox spend)'
      );

      // Now the page genuinely changes.
      pageExtra = 'Cases have since risen sharply across the district.';
      await db.collection('sources').updateOne(
        { _id: sourceId },
        { $set: { status: 'idle', nextRunAt: new Date(Date.now() - 1000), currentJobId: null } }
      );
      const p3 = await pollSources(db, quiet);
      await crawlJob(db, p3.runnableJobIds[0], Date.now() + 30_000, undefined, quiet);
      const afterChange = await db.collection('articles').findOne({});
      assert(afterChange?.status === 'data_extracted', 'changed article is re-queued for analysis');
      pageExtra = '';
    }

    // ---------------------------------------------------------------
    section('Transient Gemini failures do not burn the retry budget');
    {
      const db = client.db('t-transient');
      const { categoryId, sourceId } = await seed(db);
      await db.collection('articles').insertOne({
        title: 'x',
        content: 'Measles cases in Springfield.',
        categoryId: categoryId.toString(),
        sourceId: sourceId.toString(),
        url: 'https://example.com/a',
        status: 'data_extracted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const rateLimited: Analyser = async () => {
        throw new TransientAnalysisError('429 rate limit exceeded');
      };
      for (let i = 0; i < 4; i++) await analyseBatch(db, rateLimited, okGeocoder, quiet);

      const art = await db.collection('articles').findOne({});
      assert(art?.status === 'data_extracted', 'article still pending after 4 rate-limit failures');
      assert(!art?.analysisAttempts, 'no retry budget consumed by transient errors');

      // A real, permanent failure still parks it.
      const broken: Analyser = async () => {
        throw new Error('malformed response');
      };
      for (let i = 0; i < 3; i++) await analyseBatch(db, broken, okGeocoder, quiet);
      const parked = await db.collection('articles').findOne({});
      assert(parked?.status === 'analysis_failed', 'permanent failures still park the article');
    }

    // ---------------------------------------------------------------
    section('Unresolvable locations are never written as 0,0 (Null Island)');
    {
      const db = client.db('t-geo');
      const { categoryId, sourceId } = await seed(db);
      await db.collection('articles').insertOne({
        title: 'x',
        content: 'Measles cases.',
        categoryId: categoryId.toString(),
        sourceId: sourceId.toString(),
        url: 'https://example.com/b',
        status: 'data_extracted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const noResultGeocoder: Geocoder = async (locations) => {
        const m = new Map();
        for (const l of new Set(locations)) m.set(l, null); // definitively no such place
        return m;
      };
      await analyseBatch(db, okAnalyser, noResultGeocoder, quiet);
      const art = await db.collection('articles').findOne({});
      const kw = art?.keywords?.[0];
      assert(kw !== undefined, 'mention is still recorded');
      assert(
        kw?.latitude === undefined && kw?.longitude === undefined,
        'no coordinates written for an unresolvable place'
      );

      // A transient geocoder failure flags the mention for a later sweep.
      const db2 = client.db('t-geo2');
      const s2 = await seed(db2);
      await db2.collection('articles').insertOne({
        title: 'x',
        content: 'Measles cases.',
        categoryId: s2.categoryId.toString(),
        sourceId: s2.sourceId.toString(),
        url: 'https://example.com/c',
        status: 'data_extracted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const outageGeocoder: Geocoder = async () => new Map(); // nothing resolved
      await analyseBatch(db2, okAnalyser, outageGeocoder, quiet);
      const art2 = await db2.collection('articles').findOne({});
      assert(art2?.keywords?.[0]?.needsGeocode === true, 'transient failure marked for retry');
    }

    // ---------------------------------------------------------------
    section('Model output is sanitised (off-list keywords, gaps, duplicates)');
    {
      const articles = [
        { articleId: 'a1', content: '' },
        { articleId: 'a2', content: '' },
        { articleId: 'a3', content: '' },
      ];
      const keywords = ['Measles', 'Flu'];
      const reply = JSON.stringify([
        {
          article_index: 0,
          is_valid_article: true,
          mentions: [
            { keyword: 'measles', location: 'Pune', case_count: 5 }, // case-only mismatch
            { keyword: 'Dengue', location: 'Pune', case_count: 9 }, // off-list
            { keyword: 'Measles', location: 'Pune', case_count: 5 }, // duplicate
          ],
        },
        { article_index: 99, is_valid_article: true, mentions: [] }, // out of range
        // index 1 and 2 omitted entirely
      ]);
      const parsed = parseAnalysisResponse(reply, articles, keywords);
      assert(parsed.length === 1, 'omitted articles are NOT reported as analysed-and-invalid');
      assert(parsed[0].articleId === 'a1', 'the reported article is the right one');
      assert(parsed[0].mentions.length === 1, 'off-list and duplicate mentions dropped');
      assert(parsed[0].mentions[0].keyword === 'Measles', 'keyword normalised to list spelling');
    }

    // ---------------------------------------------------------------
    section('Omitted articles are retried, not silently completed');
    {
      const db = client.db('t-gap');
      const { categoryId, sourceId } = await seed(db);
      await db.collection('articles').insertMany(
        ['d1', 'd2'].map((u) => ({
          title: u,
          content: 'Measles cases in Springfield.',
          categoryId: categoryId.toString(),
          sourceId: sourceId.toString(),
          url: `https://example.com/${u}`,
          status: 'data_extracted',
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
      // Model answers about only the first article.
      const partial: Analyser = async (arts) => [
        {
          articleId: arts[0].articleId,
          isValidArticle: true,
          mentions: [{ keyword: 'Measles', location: 'Springfield', caseCount: 3 }],
        },
      ];
      await analyseBatch(db, partial, okGeocoder, quiet);
      const done = await db.collection('articles').countDocuments({ status: 'completed' });
      const pending = await db.collection('articles').countDocuments({ status: 'data_extracted' });
      assert(done === 1, 'only the answered article is completed');
      assert(pending === 1, 'the omitted article stays pending for retry');
    }

    // ---------------------------------------------------------------
    section('jobExecutionIds stays bounded');
    {
      const db = client.db('t-bound');
      const { sourceId } = await seed(db);
      await db
        .collection('sources')
        .updateOne(
          { _id: sourceId },
          { $set: { jobExecutionIds: Array.from({ length: 1135 }, (_, i) => `old${i}`) } }
        );
      await pollSources(db, quiet);
      const src = await db.collection('sources').findOne({ _id: sourceId });
      assert(
        (src?.jobExecutionIds?.length ?? 0) <= 50,
        `array trimmed to the cap (got ${src?.jobExecutionIds?.length})`
      );
    }

    console.log(
      `\n${failures === 0 ? 'ALL PIPELINE FIX TESTS PASSED' : 'FAILURES: ' + failures}  (${checks} checks)`
    );
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    site.close();
    await client.close();
    await mongod.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
