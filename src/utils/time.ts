/**
 * Normalize the many publish-time formats returned by different platforms into ISO 8601 (UTC).
 *
 * Handles:
 *  - Unix timestamps in seconds or milliseconds (number or numeric string)
 *  - ISO 8601 / RFC 2822 strings that carry their own timezone
 *  - Chinese-site wall-clock strings without timezone, interpreted as Beijing time (UTC+8):
 *      "2026-10-14 18:50", "2026/10/14 18:50:15", "2026.10.14", "2026年10月14日 18:50"
 *  - Year-less "10-14 18:50" / "10月14日" (current year)
 *  - Relative forms: "刚刚", "5分钟前", "3小时前", "2天前", "今天 08:00", "昨天 12:30", "前天 09:00"
 *
 * Returns undefined when the input cannot be parsed confidently.
 */
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

function fromTimestamp(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const ms = n < 1e11 ? n * 1000 : n; // 10-digit seconds vs 13-digit ms
  const d = new Date(ms);
  return isValid(d) ? d.toISOString() : undefined;
}

function isValid(d: Date): boolean {
  const t = d.getTime();
  // Sanity window: 1995-01-01 .. now + 2 days
  return Number.isFinite(t) && t > 788918400000 && t < Date.now() + 2 * 86400000;
}

/** Build a UTC Date from Beijing wall-clock components. */
function fromCnWallClock(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s) - CN_OFFSET_MS);
  return isValid(date) ? date.toISOString() : undefined;
}

/** Current Beijing date components. */
function cnToday(now: Date): { y: number; mo: number; d: number } {
  const cn = new Date(now.getTime() + CN_OFFSET_MS);
  return { y: cn.getUTCFullYear(), mo: cn.getUTCMonth() + 1, d: cn.getUTCDate() };
}

export function normalizePublishTime(input: unknown, now: Date = new Date()): string | undefined {
  if (input === null || input === undefined || input === '') return undefined;

  if (typeof input === 'number') return fromTimestamp(input);
  if (input instanceof Date) return isValid(input) ? input.toISOString() : undefined;
  if (typeof input !== 'string') return undefined;

  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return undefined;

  // Pure numeric timestamp
  if (/^\d{10}(\d{3})?$/.test(s)) return fromTimestamp(Number(s));

  // Relative time
  if (/^刚刚$/.test(s)) return new Date(now.getTime()).toISOString();
  const rel = s.match(/^(\d+)\s*(秒|分钟|小时|天)前$/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = { 秒: 1e3, 分钟: 6e4, 小时: 36e5, 天: 864e5 }[rel[2] as '秒' | '分钟' | '小时' | '天'];
    return new Date(now.getTime() - n * unit).toISOString();
  }
  const dayWord = s.match(/^(今天|昨天|前天)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dayWord) {
    const back = { 今天: 0, 昨天: 1, 前天: 2 }[dayWord[1] as '今天' | '昨天' | '前天'];
    const t = cnToday(new Date(now.getTime() - back * 864e5));
    return fromCnWallClock(t.y, t.mo, t.d, Number(dayWord[2]), Number(dayWord[3]), Number(dayWord[4] || 0));
  }

  // Strings with an explicit timezone (ISO with Z/offset, RFC 2822 with GMT/+0800)
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(s) || /^[A-Za-z]{3},/.test(s);
  if (hasZone) {
    const d = new Date(s);
    if (isValid(d)) return d.toISOString();
  }

  // Full date (optionally with time) without timezone -> Beijing time
  const full = s.match(
    /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:[ T]+(\d{1,2})[:时](\d{1,2})(?:[:分](\d{1,2}))?秒?)?(?:\.\d+)?$/
  );
  if (full) {
    return fromCnWallClock(
      Number(full[1]), Number(full[2]), Number(full[3]),
      Number(full[4] || 0), Number(full[5] || 0), Number(full[6] || 0),
    );
  }

  // Year-less date "10-14 18:50" / "10月14日 18:50"
  const short = s.match(/^(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (short) {
    const { y } = cnToday(now);
    const args = [Number(short[1]), Number(short[2]), Number(short[3] || 0), Number(short[4] || 0)] as const;
    // A year-less date later than today belongs to last year (e.g. "12-20" seen in November)
    return fromCnWallClock(y, ...args) ?? fromCnWallClock(y - 1, ...args);
  }

  // Anything else is ambiguous (no timezone, unknown layout): don't guess.
  return undefined;
}

/** Format an ISO timestamp as Beijing wall-clock time for display, e.g. "2026-10-14 18:50". */
export function formatCnDateTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return undefined;
  const cn = new Date(t + CN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${cn.getUTCFullYear()}-${pad(cn.getUTCMonth() + 1)}-${pad(cn.getUTCDate())} ${pad(cn.getUTCHours())}:${pad(cn.getUTCMinutes())}`;
}
