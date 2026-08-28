import type { ParamField, ParamColumn } from '@/lib/types';

// Working form state. Every leaf is a raw input string (coerced to number on save).
// Mirrors the JSONB shape: scalar -> string, array -> string[], rows -> array of
// column-keyed string maps.
export type RecipeDraft = Record<string, string | string[] | Record<string, string>[]>;

// Build editable form state from an existing recipe's params (or blanks for a new recipe).
export function initDraft(fields: ParamField[], params?: Record<string, unknown> | null): RecipeDraft {
  const draft: RecipeDraft = {};
  for (const f of fields) {
    if (f.kind === 'scalar') {
      const v = params?.[f.key];
      draft[f.key] = v === undefined || v === null ? '' : String(v);
    } else if (f.kind === 'array') {
      const arr = Array.isArray(params?.[f.key]) ? (params![f.key] as unknown[]) : [];
      draft[f.key] = Array.from({ length: f.length }, (_, i) => {
        const v = arr[i];
        return v === undefined || v === null ? '' : String(v);
      });
    } else {
      const rows = Array.isArray(params?.[f.key]) ? (params![f.key] as Record<string, unknown>[]) : [];
      draft[f.key] = rows.map(row => {
        const out: Record<string, string> = {};
        for (const c of f.columns) {
          const v = row?.[c.key];
          out[c.key] = v === undefined || v === null ? '' : String(v);
        }
        return out;
      });
    }
  }
  return draft;
}

// A blank row with every column key present and empty.
export function emptyRow(columns: ParamColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) out[c.key] = '';
  return out;
}

// Assemble the JSONB params object to persist, coercing numbers (text columns stay strings).
export function buildParams(fields: ParamField[], draft: RecipeDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.kind === 'scalar') {
      out[f.key] = Number(draft[f.key] as string);
    } else if (f.kind === 'array') {
      out[f.key] = (draft[f.key] as string[]).map(Number);
    } else {
      out[f.key] = (draft[f.key] as Record<string, string>[]).map(row => {
        const o: Record<string, unknown> = {};
        for (const c of f.columns) {
          o[c.key] = c.type === 'text' ? row[c.key] : Number(row[c.key]);
        }
        return o;
      });
    }
  }
  return out;
}

// True when every field has a complete value (so Save can be enabled).
export function isDraftValid(fields: ParamField[], draft: RecipeDraft): boolean {
  for (const f of fields) {
    if (f.kind === 'scalar') {
      if ((draft[f.key] as string).trim() === '') return false;
    } else if (f.kind === 'array') {
      if ((draft[f.key] as string[]).some(v => v.trim() === '')) return false;
    } else {
      const rows = draft[f.key] as Record<string, string>[];
      if (rows.length === 0) return false;
      for (const row of rows) {
        for (const c of f.columns) {
          if ((row[c.key] ?? '').trim() === '') return false;
        }
      }
    }
  }
  return true;
}
