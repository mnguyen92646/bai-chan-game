"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getStoredLocale } from "@/lib/locale";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    const l = getStoredLocale();
    setLocale(l);
    getMessages(l).then(setMessages);
  }, []);

  const t = useMemo(() => {
    const m = messages ?? {};
    return (key: string) => m[key] ?? key;
  }, [messages]);

  if (!messages) return <div className="p-4">Loading…</div>;

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("app.title")}</h1>
        <LanguageToggle compact />
      </header>

      <div className="mt-6 space-y-3">
        <a className="block w-full text-center bg-black text-white rounded-md py-3" href="/table">
          Join table
        </a>
        <a className="block w-full text-center border rounded-md py-3" href="/labeler">
          Tile labeler (debug)
        </a>
        <a className="block w-full text-center border rounded-md py-3" href="/tile-test">
          Tile test (debug)
        </a>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        Single-table mode (shared room).
      </p>
    </main>
  );
}
