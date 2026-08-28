/**
 * End-to-end smoke test for the crawl → analyse pipeline.
 * Needs NO external services or API keys:
 *   - MongoDB runs in-memory (mongodb-memory-server)
 *   - a tiny fake news site is served on localhost
 *   - the Gemini analyser and Mapbox geocoder are stubbed
 *
 * Run with: npm run smoke
 */
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { pollSources } from '../src/lib/pipeline/poller';
import { crawlJob } from '../src/lib/pipeline/crawler';
import { analyseLoop } from '../src/lib/pipeline/analyser';
import type { Analyser, Geocoder } from '../src/lib/pipeline/types';

const PORT = 8787;

const page = (title: string, body: string, links: string[] = []) => `<!doctype html>
<html><head><title>${title}</title><meta property="article:published_time" content="2026-08-01T10:00:00Z"></head>
<body>
<nav>${links.map((l) => `<a href="${l}">${l}</a>`).join(' ')}</nav>
<main><article><h1>${title}</h1>${body}</article></main>
</body></html>`;

const longPara = (text: string) =>
  `<p>${text} ${'Additional reporting context sentence to satisfy minimum article length requirements. '.repeat(6)}</p>`;

const SITE: Record<string, string> = {
  '/': page('Daily Health Tribune', longPara('Front page of the Daily Health Tribune with the latest public health coverage from around the region.'), [
    '/news/measles-outbreak',
    '/news/flu-season',
    '/about.css',
    'https://other-domain.example/x',
  ]),
  '/news/measles-outbreak': page(
    'Measles outbreak reported in Springfield',
    longPara('Health officials confirmed 12 measles cases in Springfield this week, prompting a vaccination drive.'),
    ['/', '/news/flu-season']
  ),
  '/news/flu-season': page(
    'Flu season arrives early',
    longPara('Hospitals report a sharp rise in influenza admissions, with 40 cases recorded across the county.'),
    ['/']
  ),
};

function startSite(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const body = SITE[req.url ?? '/'];
      if (!body) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' }).end(body);
    });
    server.listen(PORT, () => resolve(server));
  });
}

const stubAnalyser: Analyser = async (articles, keywords) => {
  console.log(`  [stub-llm] analysing ${articles.length} article(s) against [${keywords.join(', ')}]`);
  return articles.map((a) => {
    const content = a.content.toLowerCase();
    const mentions = [];
    if (content.includes('measles')) {
      mentions.push({ keyword: 'Measles', location: 'Springfield', caseCount: 12 });
    }
    if (content.includes('influenza') || content.includes('flu')) {
      mentions.push({ keyword: 'Flu', location: 'County General', caseCount: 40 });
    }
    return { articleId: a.articleId, isValidArticle: mentions.length > 0, mentions };
  });
};

const stubGeocoder: Geocoder = async (locations) => {
  const out = new Map<string, { latitude: number; longitude: number }>();
  for (const l of new Set(locations)) out.set(l, { latitude: 39.78, longitude: -89.65 });
  return out;
};

async function main() {
  let failed = false;
  const assert = (cond: boolean, label: string) => {
    console.log(`  ${cond ? '✔' : '✘'} ${label}`);
    if (!cond) failed = true;
  };

  console.log('Starting in-memory MongoDB + fake news site...');
  const mongod = await MongoMemoryServer.create();
  const client = await new MongoClient(mongod.getUri()).connect();
  const db = client.db('disease-data');
  const site = await startSite();

  try {
    // Seed a category and a due source, exactly as the dashboard would.
    const category = await db.collection('categories').insertOne({
      name: 'Respiratory diseases',
      keywords: ['Measles', 'Flu'],
      createdAt: new Date(),
    });
    await db.collection('sources').insertOne({
      title: 'Daily Health Tribune',
      url: `http://localhost:${PORT}/`,
      categoryId: category.insertedId.toString(),
      cronSchedule: '0 * * * *',
      isActive: true,
      status: 'idle',
      jobExecutionIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRunAt: null,
      nextRunAt: new Date(Date.now() - 1000),
      lastError: null,
    });

    console.log('\n1. Poll (job-pooler port)');
    const poll = await pollSources(db);
    assert(poll.createdJobIds.length === 1, 'one job created for the due source');
    assert(poll.runnableJobIds.length === 1, 'job reported as runnable');

    console.log('\n2. Crawl (process-source port)');
    const crawl = await crawlJob(db, poll.runnableJobIds[0], Date.now() + 60_000);
    assert(crawl.completed, 'crawl completed within budget');
    assert(crawl.processed >= 2, `>=2 articles extracted (got ${crawl.processed})`);

    const pending = await db.collection('articles').find({ status: 'data_extracted' }).toArray();
    assert(pending.length >= 2, `articles stored as data_extracted (got ${pending.length})`);
    const source = await db.collection('sources').findOne({});
    assert(source?.status === 'idle', 'source returned to idle');
    assert(source!.nextRunAt > new Date(), 'nextRunAt advanced by cron schedule');
    const job = await db.collection('job-executions').findOne({});
    assert(job?.status === 'completed', 'job marked completed');

    console.log('\n3. Analyse (analyse-article port, stubbed LLM + geocoder)');
    const summary = await analyseLoop(db, Date.now() + 60_000, stubAnalyser, stubGeocoder);
    assert(summary.processed >= 2, `articles analysed (got ${summary.processed})`);

    const completed = await db
      .collection('articles')
      .find({ status: 'completed', isArticleValid: true })
      .toArray();
    assert(completed.length >= 2, `valid analysed articles (got ${completed.length})`);
    const withKeywords = completed.filter(
      (a) =>
        Array.isArray(a.keywords) &&
        a.keywords.length > 0 &&
        a.keywords.every(
          (k: Record<string, unknown>) =>
            typeof k.keyword === 'string' &&
            typeof k.location === 'string' &&
            typeof k.caseCount === 'number' &&
            typeof k.latitude === 'number' &&
            typeof k.longitude === 'number'
        )
    );
    assert(withKeywords.length >= 2, 'keyword entries have the dashboard shape');
    const leftover = await db.collection('articles').countDocuments({ status: 'data_extracted' });
    assert(leftover === 0, 'no pending articles left');

    console.log(failed ? '\nSMOKE TEST FAILED' : '\nSMOKE TEST PASSED');
    process.exitCode = failed ? 1 : 0;
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
