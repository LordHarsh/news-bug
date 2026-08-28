import { AnyBulkWriteOperation, Db, Document, ObjectId } from 'mongodb';
import {
  Analyser,
  ArticleForAnalysis,
  consoleLogger,
  Geocoder,
  GeocoderConfigError,
  KeywordEntry,
  Logger,
  TransientAnalysisError,
} from './types';

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

export interface AnalyseSummary {
  processed: number;
  failed: number;
  batches: number;
}

/** Park articles that have burned their retry budget so the loop can drain. */
async function parkExhausted(db: Db, log: Logger): Promise<void> {
  const parked = await db.collection('articles').updateMany(
    { status: 'data_extracted', analysisAttempts: { $gte: MAX_ATTEMPTS } },
    { $set: { status: 'analysis_failed', updatedAt: new Date() } }
  );
  if (parked.modifiedCount > 0) {
    log.error(`Parked ${parked.modifiedCount} article(s) as analysis_failed`);
  }
}

/**
 * Analyse one batch: up to 10 pending articles from the source with the
 * largest backlog (same grouping the Appwrite analyse-article function used).
 * Returns null when there is nothing left to analyse.
 */
export async function analyseBatch(
  db: Db,
  analyser: Analyser,
  geocoder: Geocoder,
  log: Logger = consoleLogger
): Promise<{ processed: number; failed: number } | null> {
  const articles = db.collection('articles');
  const categories = db.collection('categories');

  // Group on ids only. Pushing whole documents ($$ROOT) built a group doc out
  // of every pending article's full text, which blows the 16MB BSON limit once
  // a backlog forms and then fails on every tick forever.
  const groups = await articles
    .aggregate([
      {
        $match: {
          status: 'data_extracted',
          $or: [
            { analysisAttempts: { $exists: false } },
            { analysisAttempts: { $lt: MAX_ATTEMPTS } },
          ],
        },
      },
      { $sort: { _id: 1 } },
      { $group: { _id: '$sourceId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $project: { ids: { $slice: ['$ids', BATCH_SIZE] } } },
    ])
    .toArray();

  const batchIds: ObjectId[] = groups[0]?.ids ?? [];
  if (batchIds.length === 0) return null;

  const batch = await articles
    .find({ _id: { $in: batchIds } })
    .sort({ _id: 1 })
    .toArray();
  if (batch.length === 0) return null;

  const categoryId = String(batch[0].categoryId);
  let category: Document | null = null;
  try {
    category = await categories.findOne({ _id: new ObjectId(categoryId) });
  } catch {
    category = null;
  }
  const keywords: string[] = (category?.keywords ?? []).filter(
    (k: unknown): k is string => typeof k === 'string' && k.trim().length > 0
  );
  if (keywords.length === 0) {
    // Without keywords these articles can never be analysed — park them so
    // they don't loop forever.
    await articles.updateMany(
      { _id: { $in: batchIds } },
      { $set: { status: 'analysis_failed', updatedAt: new Date() } }
    );
    log.error(
      `Category ${categoryId} missing or has no keywords; marked ${batch.length} article(s) analysis_failed`
    );
    return { processed: 0, failed: batch.length };
  }

  const requests: ArticleForAnalysis[] = batch.map((a) => ({
    articleId: (a._id as ObjectId).toString(),
    content: (a.content as string) ?? '',
  }));

  try {
    log.info(`Analysing ${batch.length} article(s) for category ${categoryId}`);
    const analyses = await analyser(requests, keywords);

    const locations = analyses.flatMap((r) => r.mentions.map((m) => m.location));
    const coords = await geocoder(locations);

    const now = new Date();
    const ops: AnyBulkWriteOperation<Document>[] = analyses.map((result) => {
      const keywordEntries: KeywordEntry[] = result.mentions.map((m) => {
        const entry: KeywordEntry = {
          keyword: m.keyword,
          location: m.location,
          caseCount: m.caseCount,
        };
        if (coords.has(m.location)) {
          const geo = coords.get(m.location);
          // null = the geocoder is sure there is no such place; leave it
          // without coordinates so the map simply skips it.
          if (geo) {
            entry.latitude = geo.latitude;
            entry.longitude = geo.longitude;
          }
        } else {
          // Absent = transient failure; a later sweep can resolve it.
          entry.needsGeocode = true;
        }
        return entry;
      });
      return {
        updateOne: {
          filter: { _id: new ObjectId(result.articleId) },
          update: {
            $set: {
              status: 'completed',
              isArticleValid: result.isValidArticle,
              keywords: keywordEntries,
              analysisAttempts: 0,
              updatedAt: now,
            },
          },
        },
      };
    });
    if (ops.length > 0) await articles.bulkWrite(ops);

    // Articles the model skipped stay pending and are retried; silently
    // recording them as "invalid" would lose real outbreak reports.
    const answered = new Set(analyses.map((a) => a.articleId));
    const missing = batchIds.filter((id) => !answered.has(id.toString()));
    if (missing.length > 0) {
      log.error(`Gemini omitted ${missing.length} article(s); will retry`);
      await articles.updateMany(
        { _id: { $in: missing } },
        { $inc: { analysisAttempts: 1 }, $set: { updatedAt: now } }
      );
      await parkExhausted(db, log);
    }

    return { processed: analyses.length, failed: missing.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof GeocoderConfigError) {
      // Bad Mapbox token: nothing will succeed, and it is not the articles'
      // fault. Fail loudly without consuming their retry budget.
      log.error(`Geocoder configuration error: ${message}`);
      throw err;
    }

    if (err instanceof TransientAnalysisError) {
      // Rate limits and 5xx must not permanently park real articles.
      log.error(`Transient analysis failure (not counted): ${message}`);
      return { processed: 0, failed: batch.length };
    }

    log.error(`Batch analysis failed: ${message}`);
    await articles.updateMany(
      { _id: { $in: batchIds } },
      { $inc: { analysisAttempts: 1 }, $set: { updatedAt: new Date() } }
    );
    await parkExhausted(db, log);
    return { processed: 0, failed: batch.length };
  }
}

/** Keep analysing batches until the backlog is empty or the deadline passes. */
export async function analyseLoop(
  db: Db,
  deadline: number,
  analyser: Analyser,
  geocoder: Geocoder,
  log: Logger = consoleLogger
): Promise<AnalyseSummary> {
  const summary: AnalyseSummary = { processed: 0, failed: 0, batches: 0 };
  while (Date.now() < deadline) {
    const result = await analyseBatch(db, analyser, geocoder, log);
    if (!result) break;
    summary.processed += result.processed;
    summary.failed += result.failed;
    summary.batches += 1;
    // A fully-failed batch that stays pending would spin the loop; stop and
    // let the next cron tick retry.
    if (result.processed === 0) break;
  }
  return summary;
}
