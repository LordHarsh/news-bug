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

/** One geocoded disease mention, the shape the dashboard reads. */
export interface KeywordEntry {
  keyword: string;
  location: string;
  caseCount: number;
  latitude: number;
  longitude: number;
}

export interface CrawlProgress {
  visited: string[];
  to_visit: Array<[string, number]>;
  total_processed: number;
  is_completed: boolean;
  max_pages?: number;
  max_depth?: number;
}

export interface JobMetadata {
  crawl_progress: CrawlProgress;
  articleIds: string[];
  last_execution_duration: number;
  total_executions: number;
}

export interface JobExecutionDoc {
  _id?: ObjectId;
  sourceId: string;
  categoryId: string;
  sourceUrl: string;
  categoryKeywords: string[];
  status: 'running' | 'in_progress' | 'completed' | 'error';
  startedAt: Date;
  completedAt?: Date | null;
  duration?: number | null;
  error?: string | null;
  metadata?: JobMetadata | null;
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

/** Analyses a batch of articles against a keyword list (LLM behind it). */
export type Analyser = (
  articles: ArticleForAnalysis[],
  keywords: string[]
) => Promise<ArticleAnalysis[]>;

/** Resolves location names to coordinates. Unknown locations map to 0,0. */
export type Geocoder = (
  locations: string[]
) => Promise<Map<string, { latitude: number; longitude: number }>>;

export type Logger = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

export const consoleLogger: Logger = {
  info: (msg) => console.log(`[pipeline] ${msg}`),
  error: (msg) => console.error(`[pipeline] ${msg}`),
};
