import { GoogleGenAI, Type } from '@google/genai';
import {
  Analyser,
  ArticleAnalysis,
  ArticleForAnalysis,
  DiseaseMention,
} from './types';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Keeps a 10-article batch well inside the context window.
const MAX_CHARS_PER_ARTICLE = 8_000;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      article_index: { type: Type.INTEGER },
      is_valid_article: { type: Type.BOOLEAN },
      mentions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            keyword: { type: Type.STRING },
            location: { type: Type.STRING },
            case_count: { type: Type.INTEGER },
          },
          required: ['keyword', 'location', 'case_count'],
        },
      },
    },
    required: ['article_index', 'is_valid_article', 'mentions'],
  },
};

function buildPrompt(articles: ArticleForAnalysis[], keywords: string[]): string {
  const keywordList = keywords.join(', ');
  const articleBlocks = articles
    .map(
      (a, i) =>
        `<article index="${i}">\n${a.content.slice(0, MAX_CHARS_PER_ARTICLE).trim()}\n</article>`
    )
    .join('\n\n');

  return `You are an epidemiological surveillance assistant. You monitor news coverage for disease outbreaks.

Monitored diseases and symptoms: ${keywordList}

Analyze each article below and report every mention of NEW or ACTIVE cases, outbreaks, or deaths related to the monitored diseases/symptoms.

Rules:
1. is_valid_article: true only for genuine news/report content. Advertisements, navigation pages, link lists, cookie notices, and boilerplate are invalid (empty mentions).
2. Only report diseases/symptoms from the monitored list. If an article names a symptom of a listed disease, report it under the listed term.
3. keyword: the matching term exactly as written in the monitored list.
4. location: the most specific place associated with that mention (city/district preferred, then state/province, then country). Use "unknown" only when no location is stated or clearly implied.
5. case_count: the number of cases stated for that mention. Use the exact number when given ("47 cases" -> 47). Convert words to numbers ("a dozen" -> 12). Use 1 when a case is reported without a number. Do not report vaccination drives, historical retrospectives, or general awareness content as cases.
6. If the same disease is reported in several distinct locations, emit one mention per location.
7. Report every article, including invalid ones and ones with no relevant mentions (mentions: []).

Articles:
${articleBlocks}`;
}

interface RawResponseItem {
  article_index?: number;
  is_valid_article?: boolean;
  mentions?: Array<{
    keyword?: string;
    location?: string;
    case_count?: number | string;
  }>;
}

export function parseAnalysisResponse(
  text: string,
  articles: ArticleForAnalysis[]
): ArticleAnalysis[] {
  const parsed = JSON.parse(text) as RawResponseItem[];
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array from the model, got ${typeof parsed}`);
  }

  const results = new Map<number, ArticleAnalysis>();
  for (const item of parsed) {
    const idx = item.article_index;
    if (idx === undefined || idx < 0 || idx >= articles.length) continue;

    const mentions: DiseaseMention[] = [];
    for (const m of item.mentions ?? []) {
      if (!m.keyword || !m.location) continue;
      let caseCount =
        typeof m.case_count === 'number' ? m.case_count : parseInt(String(m.case_count), 10);
      if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 1;
      mentions.push({ keyword: m.keyword, location: m.location, caseCount });
    }

    results.set(idx, {
      articleId: articles[idx].articleId,
      isValidArticle: item.is_valid_article ?? false,
      mentions,
    });
  }

  // Any article the model skipped is treated as invalid so it doesn't loop forever.
  return articles.map(
    (a, i) =>
      results.get(i) ?? { articleId: a.articleId, isValidArticle: false, mentions: [] }
  );
}

export function createGeminiAnalyser(
  apiKey: string,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
): Analyser {
  const ai = new GoogleGenAI({ apiKey });

  return async (articles, keywords) => {
    if (articles.length === 0) return [];
    if (keywords.length === 0) {
      throw new Error('No keywords provided for analysis');
    }

    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(articles, keywords),
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    return parseAnalysisResponse(text, articles);
  };
}
