"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getStoredLocale } from "@/lib/locale";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function JoinRoomPage() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<any>(null);

  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("home.joinRoom")}</h1>
        <LanguageToggle compact />
      </div>

      <label className="block mt-4 text-sm">{t("home.nickname")}</label>
      <input
        className="w-full border rounded-md px-3 py-2"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t("home.nickname")}
      />

      <label className="block mt-4 text-sm">{t("home.roomId")}</label>
      <input
        className="w-full border rounded-md px-3 py-2"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder={t("home.roomId")}
      />

      <button
        className="mt-4 w-full bg-black text-white rounded-md py-3 disabled:opacity-50"
        disabled={!nickname || !roomId}
        onClick={() => {
          const qs = new URLSearchParams({ nickname });
          window.location.href = `/room/${roomId}?${qs.toString()}`;
        }}
      >
        {t("home.start")}
      </button>

      <p className="mt-6 text-sm text-gray-600">Locale: {locale}</p>
    </main>
  );
}
