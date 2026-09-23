"use client";
import { useSyncExternalStore } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getStoredLocale, setStoredLocale } from "@/lib/locale";
import vi from "@/i18n/messages/game-vi.json";
const dictionary: Record<string, string> = vi;
function subscribe(notify: () => void) {
  window.addEventListener("baichan-language", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("baichan-language", notify);
    window.removeEventListener("storage", notify);
  };
}
export function translate(text: string, locale: Locale): string {
  if (locale !== "vi") return text;
  if (dictionary[text]) return dictionary[text];
  const patterns: [RegExp, (...parts: string[]) => string][] = [
    [/^(\d+) people \+ (\d+) bots$/, (people, bots) => `${people} người + ${bots} máy`],
    [/^(.+) returned (.+)\.$/, (name, tile) => `${name} đã trả ${tile}.`],
    [/^(.+) passed\.$/, (name) => `${name} đã bỏ qua.`],
    [/^Return a card to (.+)$/, (name) => `Trả một quân cho ${name}`],
    [/^Hand (\d+) · You \+ 3 bots$/, (n) => `Ván ${n} · Bạn và 3 máy`],
    [/^Table (\d+)$/, (n) => `Bàn ${n}`],
    [/^Seat (\d+)$/, (n) => `Chỗ ${n}`],
    [/^(.+)’s turn$/, (name) => `Lượt ${name === "You" ? "bạn" : name}`],
    [/^(.+) declared Ù(?: and won the hand\.|!|\.)?$/, (name) => `${name === "You" ? "Bạn" : name} đã ù!`],
    [/^(.+) drew (?:from the wall|a tile)\.$/, (name) => `${name === "You" ? "Bạn" : name} đã bốc.`],
    [/^(.+) discarded (.+)\.$/, (name, tile) => `${name === "You" ? "Bạn" : name} đã đánh ${tile}.`],
    [/^(.+) formed a (chắn|cạ)\.$/, (name, kind) => `${name === "You" ? "Bạn" : name} đã ăn ${kind}.`],
    [/^(.+) claimed chíu\.$/, (name) => `${name === "You" ? "Bạn" : name} đã chíu.`],
    [/^(.+) claimed (.*) · (.+)\.$/, (name, tile, kind) => `${name} đã ăn ${tile} · ${kind}.`],
    [/^(.+) · (\d+) tiles$/, (name, n) => `${name} · ${n} quân`],
    [/^(\d+) tiles$/, (n) => `${n} quân`],
    [/^Highlight (.+)$/, (tile) => `Đánh dấu ${tile}`],
    [/^Select (.+), tile (\d+)$/, (tile, n) => `Chọn ${tile}, quân ${n}`],
    [/^(.+): (\d+) sets\. View tiles and discards$/, (name, n) => `${name}: ${n} bộ. Xem bài đã hạ và đã đánh`],
    [/^(.+)’s discards$/, (name) => `Bài ${name} đã đánh`],
    [/^(.+)’s exposed sets$/, (name) => `Bài ${name} đã hạ`],
  ];
  for (const [pattern, format] of patterns) {
    const match = text.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return text;
}
export function useLanguage() {
  const locale = useSyncExternalStore(subscribe, getStoredLocale, () => defaultLocale);
  return { locale, t: (text: string) => translate(text, locale), setLocale: (next: Locale) => {
    setStoredLocale(next);
    window.dispatchEvent(new Event("baichan-language"));
  } };
}
