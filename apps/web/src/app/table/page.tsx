"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/useLanguage";
import { LanguageToggle } from "@/components/LanguageToggle";
import Link from "next/link";
import { getServerUrl } from "@/lib/serverUrl";
export default function TablePage() {
  const { t: tr } = useLanguage();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch(`${getServerUrl()}/room/default`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Unavailable");
        return res.json();
      })
      .then((data) => {
        window.location.href = `/room/${data.roomId}`;
      })
      .catch(() => setError(true))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  return (
    <main className="entry-shell">
      <LanguageToggle />
      <h1>
        {error ? tr("The table is unavailable.") : tr("Opening table…")}
      </h1>
      {error && (
        <>
          <p>{tr("Check your connection or try a practice hand.")}</p>
          <Link className="back-link" href="/practice">
            {tr("Play practice →")}
          </Link>
        </>
      )}
    </main>
  );
}
