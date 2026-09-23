"use client";
import { useLanguage } from "@/lib/useLanguage";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getServerUrl } from "@/lib/serverUrl";
export function RoomEntry({ create }: { create: boolean }) {
  const { t: tr } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  function inviteRoomId(value: string) {
    const input = value.trim();
    if (!input) throw new Error("Missing invite");
    const room = /^https?:\/\//i.test(input)
      ? new URL(input).pathname.match(/^\/room\/([^/]+)\/?$/)?.[1]
      : input;
    const privateInvite = /^room_[A-Za-z0-9_-]{22}$/.test(room ?? "");
    const localCode = process.env.NEXT_PUBLIC_TABLE_TRANSPORT !== "worker" && /^\d{6}$/.test(room ?? "");
    if (!room || (!privateInvite && !localCode)) throw new Error("Invalid invite");
    return room;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let room = create ? "" : inviteRoomId(code);
      if (create) {
        const res = await fetch(`${getServerUrl()}/rooms`, {
          method: "POST",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error("Server unavailable");
        room = (await res.json()).roomId;
      }
      localStorage.setItem("baichan-name", name.trim());
      router.push(
        `/room/${encodeURIComponent(room)}?nickname=${encodeURIComponent(name.trim())}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error && (cause.message === "Missing invite" || cause.message === "Invalid invite")
          ? "Enter a valid invite link or key."
          : "The table server is unavailable. Try again, or play a practice hand.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="entry-shell">
      <LanguageToggle />
      <Link className="back-link" href="/">{tr("← Home")}</Link>
      <p className="eyebrow">{tr("MULTIPLAYER")}</p>
      <h1>{create ? tr("Create a table") : tr("Join a table")}</h1>
      <p>
        {create
          ? tr("Create a private table, then share its invite link with your players. Two or more people can play with bots filling empty seats.")
          : tr("Paste the private invite link or key shared by your host. The six-digit table number is only for checking that you are in the same room.")}
      </p>
      <form onSubmit={submit}>
        <label htmlFor="name">{tr("Your name")}</label>
        <input
          id="name"
          autoComplete="nickname"
          required
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("Your name")}
        />
        {!create && (
          <>
            <label htmlFor="code">{tr("Invite link or key")}</label>
            <input
              id="code"
              required
              maxLength={256}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="https://…/room/…"
            />
          </>
        )}
        <button
          className="primary-button"
          disabled={busy || !name.trim() || (!create && !code.trim())}
        >
          {busy
            ? tr("Opening your table…")
            : create
              ? tr("Create a table ↗")
              : tr("Join the table ↗")}
        </button>
      </form>
      {error && (
        <p className="error-notice" role="alert">
          {tr(error)}
        </p>
      )}
      <Link className="back-link" href="/practice">{tr("Play solo while you wait →")}</Link>
    </main>
  );
}
