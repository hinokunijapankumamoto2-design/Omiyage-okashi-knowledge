import { ja } from "./ja.js";
import { en } from "./en.js";
import { ko } from "./ko.js";
import { zh } from "./zh.js";

export type Locale = "ja" | "en" | "ko" | "zh";
export type Dictionary = typeof ja;

const DICTIONARIES: Record<Locale, Dictionary> = { ja, en, ko, zh };

export const LOCALES: Array<{ code: Locale; label: string }> = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
];

export function detectLocale(): Locale {
  const stored = localStorage.getItem("ag.locale") as Locale | null;
  if (stored && stored in DICTIONARIES) return stored;
  const tag = navigator.language.slice(0, 2).toLowerCase();
  if (tag === "ja" || tag === "ko" || tag === "zh") return tag;
  return "en";
}

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

/** Picks a localised staff/department name, falling back to the English one. */
export function localName(
  locale: Locale,
  names: { nameEn?: string; displayName?: string; nameJa?: string; nameKo?: string; nameZh?: string },
): string {
  const base = names.nameEn ?? names.displayName ?? "";
  const localized = locale === "ja" ? names.nameJa : locale === "ko" ? names.nameKo : locale === "zh" ? names.nameZh : "";
  return localized && localized.trim() ? localized : base;
}
