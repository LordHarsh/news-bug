import { extractFromHtml } from '@extractus/article-extractor';
import * as cheerio from 'cheerio';

const USER_AGENT =
  'NewsBugBot/1.0 (+https://github.com/LordHarsh/news-bug; disease outbreak monitoring)';

const SKIP_EXTENSIONS =
  /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|json|xml|rss|pdf|zip|gz|tar|mp3|mp4|avi|mov|webm|woff2?|ttf|eot)(\?|#|$)/i;

// Roughly one article page of HTML; anything bigger is truncated before parsing.
const MAX_HTML_BYTES = 3_000_000;
const MIN_ARTICLE_CHARS = 300;

export interface ExtractedArticle {
  title: string;
  content: string;
  publishDate: Date | null;
  authors: string[];
}

/** Fetch a page as HTML. Returns null for non-HTML, non-200, or timeouts. */
export async function fetchHtml(
  url: string,
  timeoutMs = 10_000
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('html')) return null;
    const text = await res.text();
    return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
  } catch {
    return null;
  }
}

/** Same-domain links on a page: absolute http(s) URLs, fragments stripped. */
export function extractDomainLinks(
  html: string,
  baseUrl: string,
  domain: string
): string[] {
  const links = new Set<string>();
  try {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
        const host = resolved.hostname;
        if (host !== domain && !host.endsWith(`.${domain}`)) return;
        if (SKIP_EXTENSIONS.test(resolved.pathname)) return;
        resolved.hash = '';
        links.add(resolved.toString());
      } catch {
        // unparsable href — ignore
      }
    });
  } catch {
    return [];
  }
  return [...links];
}

/**
 * Extract readable article content from already-fetched HTML
 * (replaces newspaper3k from the old Appwrite function).
 */
export async function extractArticle(
  url: string,
  html: string
): Promise<ExtractedArticle | null> {
  try {
    const result = await extractFromHtml(html, url);
    if (!result?.content) return null;

    const $ = cheerio.load(result.content);
    const text = $.root().text().replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    if (!result.title || text.length < MIN_ARTICLE_CHARS) return null;

    let publishDate: Date | null = null;
    if (result.published) {
      const parsed = new Date(result.published);
      if (!Number.isNaN(parsed.getTime())) publishDate = parsed;
    }

    return {
      title: result.title,
      content: text,
      publishDate,
      authors: result.author ? [result.author] : [],
    };
  } catch {
    return null;
  }
}
