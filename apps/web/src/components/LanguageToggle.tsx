"use client";

import { useEffect, useState } from "react";
import { type Locale, locales, defaultLocale } from "@/i18n/config";
import { getStoredLocale, setStoredLocale } from "@/lib/locale";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  return (
    <select
      className={
        compact
          ? "border rounded px-2 py-1 text-sm"
          : "border rounded px-2 py-1"
      }
      value={locale}
      onChange={(e) => {
        const l = e.target.value as Locale;
        if (!(locales as readonly string[]).includes(l)) return;
        setStoredLocale(l);
        setLocale(l);
        // Simple global approach: reload so whichever page you're on re-loads messages.
        window.location.reload();
      }}
      aria-label="Language"
    >
      <option value="vi">VI</option>
      <option value="en">EN</option>
    </select>
  );
}
