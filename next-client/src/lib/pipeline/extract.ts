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

const MAX_REDIRECTS = 5;

/** Hostnames that must never be fetched, whatever they resolve to. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function isBlockedIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true; // private, loopback, this-host
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback, unspecified
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local
  if (h.startsWith('fe80')) return true; // link-local
  // IPv4-mapped (::ffff:169.254.169.254) inherits the IPv4 rules.
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

/**
 * Reject URLs that point at the deployment's own network. Source URLs are
 * user-supplied, so without this the crawler is a confused deputy that can be
 * aimed at cloud metadata endpoints or internal services.
 */
export function isFetchableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  // Explicit opt-in for crawling an intranet source (and for the test suite).
  if (process.env.PIPELINE_ALLOW_PRIVATE_HOSTS === 'true') return true;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return false;
  }
  if (isBlockedIPv4(host)) return false;
  if (host.includes(':') && isBlockedIPv6(host)) return false;
  return true;
}

/** Read at most `limit` bytes, aborting a hostile or huge response early. */
async function readCapped(res: Response, limit: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let out = '';
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (total >= limit) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out;
}

/**
 * Fetch a page as HTML. Returns null for non-HTML, non-200, blocked hosts, or
 * timeouts. Redirects are followed manually so every hop is re-validated —
 * `redirect: 'follow'` would let an allowed host bounce us to a private one.
 */
export async function fetchHtml(
  url: string,
  timeoutMs = 10_000
): Promise<string | null> {
  let target = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isFetchableUrl(target)) return null;

      const res = await fetch(target, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        target = new URL(location, target).toString();
        continue;
      }
      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType && !contentType.includes('html')) return null;

      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > MAX_HTML_BYTES) return null;

      const text = await readCapped(res, MAX_HTML_BYTES);
      return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
    }
    return null;
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
