"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getStoredLocale } from "@/lib/locale";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function CreateRoomPage() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const l = getStoredLocale();
    setLocale(l);
    getMessages(l).then(setMessages);
  }, []);

  const t = useMemo(() => {
    const m = messages ?? {};
    return (key: string) => m[key] ?? key;
  }, [messages]);

  async function createRoom() {
    setError("");
    const { getServerUrl } = await import("@/lib/serverUrl");
    const base = getServerUrl();
    const res = await fetch(`${base}/rooms`, { method: "POST" });
    if (!res.ok) {
      setError(`Failed to create room: ${res.status}`);
      return;
    }
    const data = await res.json();
    // Send to room with a nickname prompt (room page can handle nickname empty too)
    window.location.href = `/room/${data.roomId}`;
  }

  if (!messages) return <div className="p-4">Loading…</div>;

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("home.createRoom")}</h1>
        <LanguageToggle compact />
      </div>
      <button
        className="mt-4 w-full bg-black text-white rounded-md py-3"
        onClick={createRoom}
      >
        {t("home.createRoom")}
      </button>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <p className="mt-6 text-sm text-gray-600">Locale: {locale}</p>
    </main>
  );
}
