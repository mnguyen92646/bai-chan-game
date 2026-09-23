"use client";
import { useLanguage } from "@/lib/useLanguage";
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  return <select className={`language-toggle ${compact ? "compact" : ""}`} value={locale}
    aria-label="Ngôn ngữ / Language" onChange={(e) => setLocale(e.target.value === "en" ? "en" : "vi")}>
    <option value="vi">Tiếng Việt</option><option value="en">English</option>
  </select>;
}
