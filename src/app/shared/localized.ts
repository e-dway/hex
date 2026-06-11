// Some text fields (notably `description`) are stored EITHER as a plain Italian
// string OR as a JSON-encoded string `{"it": "...", "en": "..."}`. These helpers
// read either shape and write the right one back (the field stays a string).

export interface Localized {
  it?: string;
  en?: string;
  [k: string]: string | undefined;
}

export function parseLocalized(v: unknown): Localized {
  if (v == null) return {};
  if (typeof v === 'object') return v as Localized;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const o = JSON.parse(s);
        if (o && typeof o === 'object' && ('it' in o || 'en' in o)) return o as Localized;
      } catch {
        /* not JSON — treat as plain text */
      }
    }
    return { it: v };
  }
  return {};
}

/** Best display string for a language, falling back it → en → raw. */
export function pickLocalized(v: unknown, lang: 'it' | 'en' = 'it'): string {
  const o = parseLocalized(v);
  return o[lang] || o.it || o.en || (typeof v === 'string' ? v : '') || '';
}

/**
 * Produce the stored value: a plain Italian string when there is no English,
 * a JSON-encoded `{it,en}` string when both are present, or null when empty.
 */
export function serializeLocalized(it: string, en: string): string | null {
  const i = (it || '').trim();
  const e = (en || '').trim();
  if (!i && !e) return null;
  if (e) return JSON.stringify({ it: i, en: e });
  return i;
}
