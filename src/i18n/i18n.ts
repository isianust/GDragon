import type { LocaleId } from "./localeId.ts";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "./localeId.ts";
import en from "./messages/en.ts";
import zhHans from "./messages/zhHans.ts";
import zhHant from "./messages/zhHant.ts";

const TABLES: Record<LocaleId, Record<string, string>> = {
  "zh-Hant": { ...zhHant },
  "zh-Hans": { ...zhHans },
  en: { ...en },
};

function readStoredLocale(): LocaleId {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "zh-Hant" || v === "zh-Hans" || v === "en") return v;
  } catch {
    /* private mode */
  }
  return DEFAULT_LOCALE;
}

let current: LocaleId = readStoredLocale();
const listeners = new Set<() => void>();

export function getLocale(): LocaleId {
  return current;
}

export function setLocale(id: LocaleId): void {
  current = id;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn();
}

export function subscribeLocale(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const table = TABLES[current];
  let s = table[key] ?? TABLES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
