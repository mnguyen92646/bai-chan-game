"use client";

import { useEffect } from "react";
import { getServerUrl } from "@/lib/serverUrl";

export default function TablePage() {
  useEffect(() => {
    (async () => {
      const base = getServerUrl();
      const res = await fetch(`${base}/room/default`);
      const data = await res.json();
      window.location.href = `/room/${data.roomId}`;
    })();
  }, []);

  return <main className="min-h-screen p-4">Loading table…</main>;
}
