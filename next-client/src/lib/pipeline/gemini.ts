import { GoogleGenAI, Type } from '@google/genai';
import {
  Analyser,
  ArticleAnalysis,
  ArticleForAnalysis,
  DiseaseMention,
  TransientAnalysisError,
} from './types';

// gemini-2.5-* models shut down Oct 2026; 3.5-flash-lite is the current
// stable cost-effective tier. Override with GEMINI_MODEL (e.g. gemini-3.7-flash).
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

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

/**
 * Truncate on a sentence boundary where possible so a mention isn't cut in
 * half mid-number ("cases rose to 1," -> 1).
 */
function clipArticle(content: string): string {
  if (content.length <= MAX_CHARS_PER_ARTICLE) return content.trim();
  const slice = content.slice(0, MAX_CHARS_PER_ARTICLE);
  const lastStop = slice.lastIndexOf('. ');
  return (lastStop > MAX_CHARS_PER_ARTICLE * 0.6 ? slice.slice(0, lastStop + 1) : slice).trim();
}

function buildPrompt(articles: ArticleForAnalysis[], keywords: string[]): string {
  const keywordList = keywords.map((k) => `"${k}"`).join(', ');
  const articleBlocks = articles
    .map((a, i) => `<article index="${i}">\n${clipArticle(a.content)}\n</article>`)
    .join('\n\n');

  return `You are an epidemiological surveillance assistant. You monitor news coverage for disease outbreaks.

Monitored terms for this category: ${keywordList}

Analyze each article below and report every mention of NEW or ACTIVE cases, outbreaks, or deaths related to the monitored terms.

Rules:
1. is_valid_article: true only for genuine news/report content. Advertisements, navigation pages, link lists, cookie notices, and boilerplate are invalid (mentions: []).
2. Report a monitored term ONLY when the article uses it to describe an actual illness affecting people. The monitored list is user-supplied and may contain words that are not diseases, or ordinary words with everyday meanings ("test", "lord", "hello"). Never force a match: if a term appears only in an unrelated sense (e.g. "tested positive for a job", "computer virus", a person's name), omit it. If a term is not a disease or symptom at all, never report it.
3. keyword: copy the matching term exactly as it appears in the monitored list above. Never report a disease that is not on the list, however newsworthy.
4. location: the most specific place associated with that mention (city/district preferred, then state/province, then country). It must be a real, named geographic place. Use "unknown" when no place is stated or clearly implied — never invent one and never use an institution name (a hospital, school, or company) as the location; use the place it is in, or "unknown".
5. case_count: the number of people reported for that mention. Use the exact number when stated ("47 cases" -> 47), convert words to digits ("a dozen" -> 12), and use 1 when a case is reported without a number. Prefer the total the article attributes to that place. Do not report vaccination counts, test counts, historical retrospectives, or general awareness content as cases.
6. If the same term is reported in several distinct locations, emit one mention per location. Do not emit the same (term, location) pair twice for one article.
7. Report every article, including invalid ones and ones with no relevant mentions (mentions: []). Use the exact article_index shown in the tag.

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

/**
 * Parse the model's reply. Only articles the model actually reported on are
 * returned — a missing index means "not analysed", never "analysed and found
 * invalid", so the caller can retry instead of silently discarding an article.
 */
export function parseAnalysisResponse(
  text: string,
  articles: ArticleForAnalysis[],
  keywords: string[] = []
): ArticleAnalysis[] {
  const parsed = JSON.parse(text) as RawResponseItem[];
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array from the model, got ${typeof parsed}`);
  }

  // Map lowercased term -> canonical spelling, so a case-only mismatch is
  // repaired rather than discarded, and off-list keywords are dropped.
  const canonical = new Map(keywords.map((k) => [k.toLowerCase().trim(), k]));

  const results = new Map<number, ArticleAnalysis>();
  for (const item of parsed) {
    const idx = item.article_index;
    if (idx === undefined || !Number.isInteger(idx) || idx < 0 || idx >= articles.length) {
      continue;
    }
    if (results.has(idx)) continue; // duplicate index — keep the first

    const seen = new Set<string>();
    const mentions: DiseaseMention[] = [];
    for (const m of item.mentions ?? []) {
      if (!m.keyword || !m.location) continue;

      let keyword = m.keyword.trim();
      if (canonical.size > 0) {
        const match = canonical.get(keyword.toLowerCase());
        if (!match) continue; // hallucinated / off-list term
        keyword = match;
      }

      const location = m.location.trim();
      let caseCount =
        typeof m.case_count === 'number' ? m.case_count : parseInt(String(m.case_count), 10);
      if (!Number.isFinite(caseCount) || caseCount < 1) caseCount = 1;

      const dedupKey = `${keyword.toLowerCase()}|${location.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      mentions.push({ keyword, location, caseCount });
    }

    results.set(idx, {
      articleId: articles[idx].articleId,
      isValidArticle: item.is_valid_article ?? false,
      mentions,
    });
  }

  return [...results.values()];
}

/** 429/503 and friends are worth retrying; they must not burn retry budget. */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|504)\b|rate.?limit|quota|overloaded|unavailable|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(
    msg
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

    let response;
    try {
      response = await ai.models.generateContent({
        model,
        contents: buildPrompt(articles, keywords),
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
    } catch (err) {
      if (isTransient(err)) {
        throw new TransientAnalysisError(
          err instanceof Error ? err.message : String(err)
        );
      }
      throw err;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      // MAX_TOKENS / SAFETY leave the JSON truncated or empty; retrying with a
      // smaller batch is the right response, not marking articles invalid.
      throw new TransientAnalysisError(`Gemini stopped early: ${finishReason}`);
    }

    const text = response.text;
    if (!text) {
      throw new TransientAnalysisError('Empty response from Gemini');
    }
    return parseAnalysisResponse(text, articles, keywords);
  };
}
