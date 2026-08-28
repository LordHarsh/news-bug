import { AnyBulkWriteOperation, Db, Document, ObjectId } from 'mongodb';
import {
  Analyser,
  ArticleForAnalysis,
  consoleLogger,
  Geocoder,
  KeywordEntry,
  Logger,
} from './types';

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

export interface AnalyseSummary {
  processed: number;
  failed: number;
  batches: number;
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
      { $group: { _id: '$sourceId', articles: { $push: '$$ROOT' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $project: { articles: { $slice: ['$articles', BATCH_SIZE] } } },
    ])
    .toArray();

  const batch: Document[] = groups[0]?.articles ?? [];
  if (batch.length === 0) return null;

  const batchIds = batch.map((a) => a._id as ObjectId);
  const categoryId = batch[0].categoryId as string;

  const category = await categories.findOne({ _id: new ObjectId(categoryId) });
  const keywords: string[] = category?.keywords ?? [];
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

    const ops: AnyBulkWriteOperation<Document>[] = analyses.map((result) => {
      const keywordEntries: KeywordEntry[] = result.mentions.map((m) => {
        const geo = coords.get(m.location) ?? { latitude: 0, longitude: 0 };
        return {
          keyword: m.keyword,
          location: m.location,
          caseCount: m.caseCount,
          latitude: geo.latitude,
          longitude: geo.longitude,
        };
      });
      return {
        updateOne: {
          filter: { _id: new ObjectId(result.articleId) },
          update: {
            $set: {
              status: 'completed',
              isArticleValid: result.isValidArticle,
              keywords: keywordEntries,
              updatedAt: new Date(),
            },
          },
        },
      };
    });
    if (ops.length > 0) await articles.bulkWrite(ops);
    return { processed: analyses.length, failed: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Batch analysis failed: ${message}`);
    // Count the attempt; after MAX_ATTEMPTS the batch is parked below.
    await articles.updateMany(
      { _id: { $in: batchIds } },
      { $inc: { analysisAttempts: 1 }, $set: { updatedAt: new Date() } }
    );
    await articles.updateMany(
      { status: 'data_extracted', analysisAttempts: { $gte: MAX_ATTEMPTS } },
      { $set: { status: 'analysis_failed', updatedAt: new Date() } }
    );
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
