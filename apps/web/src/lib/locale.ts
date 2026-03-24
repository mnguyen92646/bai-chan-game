"use client";

import { defaultLocale, type Locale, locales } from "@/i18n/config";

const KEY = "bai-chan-locale";

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const v = window.localStorage.getItem(KEY);
  if (v && (locales as readonly string[]).includes(v)) return v as Locale;
  return defaultLocale;
}

export function setStoredLocale(locale: Locale) {
  window.localStorage.setItem(KEY, locale);
}
