// ISO 8601 duration helpers — wraps `iso8601-duration` for parsing and rolls
// a tiny formatter for the serialisation side (the lib doesn't ship one).
//
//   "PT1H30M"   ↔   { d: 0, h: 1, m: 30 }
//   "P2DT45M"   ↔   { d: 2, h: 0, m: 45 }
//
// Years / months / weeks aren't surfaced in the UI (tour durations don't use
// them) but we accept them on parse and roll them into days.

import { parse as parseISO } from 'iso8601-duration';

export interface DurationParts {
  d: number | null;
  h: number | null;
  m: number | null;
}

export const EMPTY_PARTS: DurationParts = { d: null, h: null, m: null };

export function fromIso(v: string | null | undefined): DurationParts {
  if (!v || typeof v !== 'string') return { ...EMPTY_PARTS };
  try {
    const p = parseISO(v);
    const days =
      (p.years || 0) * 365 +
      (p.months || 0) * 30 +
      (p.weeks || 0) * 7 +
      (p.days || 0);
    return {
      d: days || null,
      h: p.hours || null,
      m: p.minutes || null,
    };
  } catch {
    return { ...EMPTY_PARTS };
  }
}

export function toIso(p: DurationParts): string | null {
  const d = Math.max(0, +(p.d || 0));
  const h = Math.max(0, +(p.h || 0));
  const m = Math.max(0, +(p.m || 0));
  if (!d && !h && !m) return null;
  let s = 'P';
  if (d) s += `${d}D`;
  let t = '';
  if (h) t += `${h}H`;
  if (m) t += `${m}M`;
  if (t) s += 'T' + t;
  return s;
}

/** Human-readable rendering, e.g. "2d 1h 30m" or "—". */
export function humanise(v: string | null | undefined): string {
  const p = fromIso(v);
  const bits: string[] = [];
  if (p.d) bits.push(`${p.d}d`);
  if (p.h) bits.push(`${p.h}h`);
  if (p.m) bits.push(`${p.m}m`);
  return bits.length ? bits.join(' ') : '—';
}
