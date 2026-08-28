import { ObjectId } from 'mongodb';

/** Article persisted by the crawler, later enriched by the analyser. */
export interface ArticleDoc {
  _id?: ObjectId;
  title: string;
  sourceId: string;
  categoryId: string;
  jobId?: string;
  url: string;
  publishDate: Date | null;
  content: string;
  metadata?: { authors: string[] };
  status: 'data_extracted' | 'completed' | 'analysis_failed';
  analysisAttempts?: number;
  isArticleValid?: boolean;
  keywords?: KeywordEntry[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One geocoded disease mention, the shape the dashboard reads.
 * latitude/longitude are absent when geocoding could not resolve the place —
 * never 0,0, which would render as a real point off the coast of Africa.
 */
export interface KeywordEntry {
  keyword: string;
  location: string;
  caseCount: number;
  latitude?: number;
  longitude?: number;
  /** Set when a transient geocoder failure should be retried later. */
  needsGeocode?: boolean;
}

export interface CrawlProgress {
  /**
   * Every URL ever pushed onto the queue (visited ∪ pending). Checked before
   * enqueuing so a link shared by many pages is queued exactly once.
   */
  enqueued: string[];
  to_visit: Array<[string, number]>;
  /** Pages dequeued across all slices — bounds jobs on link-heavy sites. */
  dequeued: number;
  total_processed: number;
  is_completed: boolean;
  max_pages?: number;
  max_depth?: number;
  /** Legacy field from the pre-`enqueued` format; read once, then migrated. */
  visited?: string[];
}

export interface JobMetadata {
  crawl_progress: CrawlProgress;
  articleIds: string[];
  last_execution_duration: number;
  total_executions: number;
  /** Consecutive failed slices; a job is only terminal after several. */
  consecutiveErrors?: number;
}

export interface JobExecutionDoc {
  _id?: ObjectId;
  sourceId: string;
  categoryId: string;
  sourceUrl: string;
  categoryKeywords: string[];
  status: 'running' | 'in_progress' | 'completed' | 'error' | 'cancelled';
  startedAt: Date;
  completedAt?: Date | null;
  duration?: number | null;
  error?: string | null;
  metadata?: JobMetadata | null;
  /** Held by the invocation currently crawling this job; prevents overlap. */
  leaseUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiseaseMention {
  keyword: string;
  location: string;
  caseCount: number;
}

export interface ArticleAnalysis {
  articleId: string;
  isValidArticle: boolean;
  mentions: DiseaseMention[];
}

export interface ArticleForAnalysis {
  articleId: string;
  content: string;
}

/**
 * Analyses a batch of articles against a keyword list (LLM behind it).
 * Returns only the articles the model actually reported on — callers must
 * treat missing ids as "not analysed yet" and retry them.
 */
export type Analyser = (
  articles: ArticleForAnalysis[],
  keywords: string[]
) => Promise<ArticleAnalysis[]>;

/** A resolved place. `null` means "no such place" (a definitive answer). */
export type GeoPoint = { latitude: number; longitude: number };

/**
 * Resolves location names to coordinates. A name maps to `null` when the
 * geocoder definitively found nothing; names that failed transiently are
 * absent from the map entirely so the caller can retry them later.
 */
export type Geocoder = (locations: string[]) => Promise<Map<string, GeoPoint | null>>;

/** Thrown for configuration errors (bad token) that must fail the batch loudly. */
export class GeocoderConfigError extends Error {}

export type Logger = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

export const consoleLogger: Logger = {
  info: (msg) => console.log(`[pipeline] ${msg}`),
  error: (msg) => console.error(`[pipeline] ${msg}`),
};

/** Transient upstream failures should not burn an article's retry budget. */
export class TransientAnalysisError extends Error {}
