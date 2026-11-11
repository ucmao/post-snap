/**
 * Safe URL matching helpers for extractor routing.
 * Matches against the parsed hostname instead of substring-matching the whole URL,
 * so `https://evil.com/?x=mp.weixin.qq.com` is NOT routed to the WeChat extractor.
 */
export function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True if the URL's hostname equals one of `domains` or is a subdomain of one. */
export function hostMatches(url: string | URL | null, ...domains: string[]): boolean {
  const parsed = typeof url === 'string' ? parseUrl(url) : url;
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return domains.some(d => host === d || host.endsWith(`.${d}`));
}
