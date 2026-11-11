import dns from 'node:dns';
import net from 'node:net';
import { config } from '../config.js';

/**
 * Thrown when a URL is rejected by the SSRF guard (bad scheme, private address, ...).
 */
export class UnsafeUrlError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

// Private, loopback, link-local, CGNAT, multicast and other reserved ranges.
const blockList = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockList.addSubnet(addr, prefix, 'ipv4');
}
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockList.addSubnet(addr, prefix, 'ipv6');
}

/** Returns true when the IP address belongs to a private / reserved range. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.trim().replace(/^\[|\]$/g, '');
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1];
  const family = net.isIP(ip);
  if (family === 4) return blockList.check(ip, 'ipv4');
  if (family === 6) return blockList.check(ip, 'ipv6');
  return true; // not an IP at all -> treat as unsafe
}

/**
 * Validate that a URL is http(s) and that its host does not resolve to a private address.
 * Throws UnsafeUrlError otherwise. Returns the parsed URL.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(`Unsupported protocol: ${parsed.protocol}`);
  }

  if (config.allowPrivateNetwork) return parsed;

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new UnsafeUrlError('URL has no host');

  let addresses: dns.LookupAddress[];
  try {
    addresses = net.isIP(host)
      ? [{ address: host, family: net.isIP(host) }]
      : await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError(`Cannot resolve host: ${host}`);
  }

  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError(`Access to private or reserved address is not allowed: ${host}`);
  }

  return parsed;
}

/**
 * got `beforeRedirect` hook: re-validate every redirect target.
 */
export async function guardRedirect(options: { url?: URL | string }): Promise<void> {
  if (options.url) await assertSafeUrl(options.url.toString());
}

/**
 * Drop-in replacement for dns.lookup that refuses private addresses at connect time.
 * Closes the DNS-rebinding gap between assertSafeUrl() and the real connection.
 */
export function safeLookup(hostname: string, options: any, callback?: any): void {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const opts = typeof options === 'number' ? { family: options } : { ...(options || {}) };
  const wantAll = Boolean(opts.all);

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as unknown as dns.LookupAddress[];
    if (!config.allowPrivateNetwork && list.some(a => isPrivateAddress(a.address))) {
      const e: any = new UnsafeUrlError(`Access to private or reserved address is not allowed: ${hostname}`);
      e.code = 'EPRIVATEADDR';
      return callback(e);
    }
    if (wantAll) return callback(null, list);
    const first = list[0];
    if (!first) return callback(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
    return callback(null, first.address, first.family);
  });
}
