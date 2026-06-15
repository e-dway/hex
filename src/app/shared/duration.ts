// ISO 8601 duration helpers — hours + minutes only.
//
//   "PT1H30M"  ↔  { h: 1, m: 30 }
//   "PT45M"    ↔  { h: null, m: 45 }
//   "P2DT3H"   →  { h: 51, m: null }      (days folded into hours on parse)
//   empty      ↔  null
//
// `iso8601-duration` does the parsing; the formatter below is ours. Tour
// durations don't use days/weeks/years, but if they slip into legacy data
// we fold them into hours on read so nothing is dropped silently.

import { parse as parseISO } from 'iso8601-duration';

export interface DurationParts {
  h: number | null;
  m: number | null;
}

export const EMPTY_PARTS: DurationParts = { h: null, m: null };

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export function fromIso(v: string | null | undefined): DurationParts {
  if (!v || typeof v !== 'string') return { ...EMPTY_PARTS };
  try {
    const p = parseISO(v);
    const totalDays =
      (p.years || 0) * DAYS_PER_YEAR +
      (p.months || 0) * DAYS_PER_MONTH +
      (p.weeks || 0) * DAYS_PER_WEEK +
      (p.days || 0);
    const totalHours = totalDays * HOURS_PER_DAY + (p.hours || 0);
    return {
      h: totalHours || null,
      m: p.minutes || null,
    };
  } catch {
    return { ...EMPTY_PARTS };
  }
}

export function toIso(p: DurationParts): string | null {
  const h = Math.max(0, +(p.h || 0));
  const m = Math.max(0, +(p.m || 0));
  if (!h && !m) return null;
  let t = '';
  if (h) t += `${h}H`;
  if (m) t += `${m}M`;
  return 'PT' + t;
}

/** Human-readable rendering, e.g. "1h 30m" or "—". */
export function humanise(v: string | null | undefined): string {
  const p = fromIso(v);
  const bits: string[] = [];
  if (p.h) bits.push(`${p.h}h`);
  if (p.m) bits.push(`${p.m}m`);
  return bits.length ? bits.join(' ') : '—';
}
