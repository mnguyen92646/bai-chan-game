"use client";
import { useLanguage } from "@/lib/useLanguage";
import { recordGameAction } from "@/lib/gameTelemetry";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GameTable } from "@/components/GameTable";
import { getSocket } from "@/lib/socket";
import { getToken, setToken } from "@/lib/playerToken";
import type { Action, PrivateGameState, PublicGameState } from "@/lib/game";
type Room = {
  roomId: string;
  phase: "lobby" | "playing";
  hostPlayerId: string | null;
  players: {
    playerId: string;
    nickname: string;
    seat: number;
    connected: boolean;
    isBot?: boolean;
  }[];
  botOptions?: { fillBots: boolean; playerCount: 4 | 5 };
  publicGame: PublicGameState | null;
};
type Reply = {
  ok: boolean;
  error?: string;
  token?: string;
  playerId?: string;
  seat?: number;
};

async function copyInviteLink(link: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      // Clipboard API permissions vary; try selection-based copying below.
    }
  }

  // The Clipboard API may be unavailable on an HTTP development preview.
  const field = document.createElement("textarea");
  field.value = link;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, link.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export default function RoomPage() {
  const { t: tr } = useLanguage();
  const { roomId } = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const initialName = search.get("nickname");
  const [name, setName] = useState(initialName ?? "");
  const [room, setRoom] = useState<Room | null>(null);
  const [priv, setPriv] = useState<PrivateGameState | null>(null);
  const [id, setId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>();
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const manualLinkInput = useRef<HTMLInputElement>(null);
  const [fillBots, setFillBots] = useState(true);
  const [tableSize, setTableSize] = useState<4 | 5>(4);
  const joiningName = useRef(initialName ?? "");
  useEffect(() => {
    if (manualLink) {
      manualLinkInput.current?.focus();
      manualLinkInput.current?.select();
    }
  }, [manualLink]);
  useEffect(() => {
    const socket = getSocket();
    const savedName = initialName || localStorage.getItem("baichan-name") || "";
    joiningName.current = savedName;
    function join() {
      setConnected(true);
      setError("");
      if (!joiningName.current) return;
      socket
        .timeout(8000)
        .emit(
          "room:join",
          {
            roomId,
            nickname: joiningName.current,
            token: getToken(roomId) || undefined,
          },
          (err: Error | null, r: Reply) => {
            if (err || !r?.ok) {
              setError(
                err
                  ? "Joining timed out. Check your connection and try again."
                  : String(r.error),
              );
              return;
            }
            if (r.token) setToken(roomId, r.token);
            if (r.playerId) setId(r.playerId);
            localStorage.setItem("baichan-name", joiningName.current);
          },
        );
    }
    function onRoom(r: Room) {
      setRoom(r);
      if (r.phase === "playing") setResult(undefined);
      else if (r.publicGame?.endReason === "wall_empty") setResult("The wall is empty. This hand is a draw.");
      else if (r.publicGame?.winnerSeat !== undefined) {
        const winner = r.publicGame.players.find(p => p.seat === r.publicGame?.winnerSeat);
        setResult(`${winner?.nickname ?? "A player"} declared Ù!`);
      }
    }
    function onPrivate(p: PrivateGameState) {
      if (p) setPriv(p);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onError() {
      setConnected(false);
      setError(
        "Cannot reach the table server. We’ll retry automatically. Practice works without the table server.",
      );
    }
    function onEnd(e: { reason?: string; winnerName?: string }) {
      setResult(
        e.reason === "wall_empty"
          ? "The wall is empty. This hand is a draw."
          : `${e.winnerName || "A player"} declared Ù!`,
      );
    }
    function onLog(e: { lines: string[] }) {
      setLog(e.lines);
    }
    function onReset() {
      setId("");
      setPriv(null);
      setRoom(null);
      setError("The host reset the table. Rejoin to take a new seat.");
    }
    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.on("room:state", onRoom);
    socket.on("game:private", onPrivate);
    socket.on("game:ended", onEnd);
    socket.on("game:log", onLog);
    socket.on("room:reset", onReset);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("room:state", onRoom);
      socket.off("game:private", onPrivate);
      socket.off("game:ended", onEnd);
      socket.off("game:log", onLog);
      socket.off("room:reset", onReset);
      socket.disconnect();
    };
  }, [roomId, initialName]);
  function emit(event: string, payload: object = {}) {
    setError("");
    const startedAt = performance.now();
    const move = event === "game:action" && "action" in payload ? (payload.action as Action).type : undefined;
    getSocket()
      .timeout(8000)
      .emit(event, payload, (err: Error | null, r: Reply) => {
        if (move) recordGameAction(move, err ? "timeout" : r?.ok ? "ok" : "rejected", performance.now() - startedAt);
        if (err || !r?.ok)
          setError(
            err
              ? "No response from the table. Please reconnect."
              : String(r.error),
          );
      });
  }
  function act(a: Action) {
    const game = room?.publicGame;
    if (game) emit("game:action", { action: a, handId: game.handId, revision: game.revision });
  }
  const host = room?.players.find((p) => p.playerId === room.hostPlayerId);
  const canStart = id && (room?.hostPlayerId === id || !host?.connected);
  const humans = room?.players.filter(p => !p.isBot) ?? [];
  const targetSize = humans.length > tableSize ? 5 : tableSize;
  const botCount = fillBots ? Math.max(0, targetSize - humans.length) : 0;
  const ready = connected && humans.every(p => p.connected) && humans.length >= (fillBots ? 2 : 4);
  const voices = Object.fromEntries((room?.players ?? []).filter(p => p.isBot).map(p => [p.seat, p.nickname === "Minh" || p.nickname === "Nam" ? "male" as const : "female" as const]));
  if (room?.publicGame && priv && (room.phase === "playing" || result))
    return (
      <>
        <GameTable
          game={room.publicGame}
          voices={voices}
          privateState={priv}
          seat={priv.you.seat}
          title={tr(`Table ${roomId}`)}
          subtitle={
            connected
              ? tr("Connected · Private table")
              : tr("Connection lost · Retrying")
          }
          disabled={!connected}
          onAction={act}
          onNew={canStart ? () => emit("game:restart") : undefined}
          result={result}
          log={log}
        />
        {error && (
          <div className="claim-notice" role="alert">
            {tr(error)}
            <button onClick={() => setError("")}>{tr("Dismiss")}</button>
          </div>
        )}
      </>
    );
  return (
    <main className="entry-shell">
      <LanguageToggle />
      <Link className="back-link" href="/">{tr("← Home")}</Link>
      <p className="eyebrow">{tr("YOUR PRIVATE TABLE")}</p>
      <h1>{tr("Waiting for players")}</h1>
      <div className="room-code">
        <span>{tr("PRIVATE INVITE KEY")}</span>
        <strong>{roomId}</strong>
        <small>{tr("Anyone with this link can take an open seat. Share it privately.")}</small>
        <button
          className="text-button"
          onClick={async () => {
            const link = window.location.origin + "/room/" + encodeURIComponent(roomId);
            if (await copyInviteLink(link)) {
              setCopied(true);
              setManualLink("");
            } else {
              setCopied(false);
              setManualLink(link);
            }
          }}
        >
          {copied ? tr("Link copied ✓") : tr("Copy invite link ↗")}
        </button>
        {manualLink && (
          <label className="manual-invite-link">
            {tr("Select and copy this invite link:")}
            <input ref={manualLinkInput} readOnly value={manualLink} onClick={(event) => event.currentTarget.select()} />
          </label>
        )}
      </div>
      {!id ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joiningName.current = name.trim();
            getSocket().disconnect().connect();
          }}
        >
          <label htmlFor="nickname">{tr("Your name")}</label>
          <input
            id="nickname"
            required
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("Your name")}
          />
          <button className="primary-button" disabled={!name.trim()}>{tr("Take a seat ↗")}</button>
        </form>
      ) : (
        <>
          <div className="lobby-players">
            {room?.players.map((p) => (
              <div key={p.playerId}>
                <span className="avatar">{p.nickname[0]}</span>
                <strong>
                  {p.nickname}
                  {p.playerId === id ? tr(" (you)") : ""}
                </strong>
                <small>{p.isBot ? tr("Bot") : p.connected ? tr("Ready") : tr("Offline")}</small>
              </div>
            ))}
          </div>
          {canStart ? (
            <>
              <fieldset className="lobby-bot-options">
                <legend>{tr("Table setup")}</legend>
                <label className="lobby-bot-toggle">
                  <input type="checkbox" checked={fillBots} onChange={e => setFillBots(e.target.checked)} />
                  <span>{tr("Fill empty seats with bots")}</span>
                </label>
                {fillBots && <label className="lobby-table-size">{tr("Table size")}
                  <select value={targetSize} onChange={e => setTableSize(Number(e.target.value) as 4 | 5)}>
                    <option value={4} disabled={humans.length > 4}>{tr("4 players")}</option>
                    <option value={5}>{tr("5 players")}</option>
                  </select>
                </label>}
                <p>{fillBots ? tr(`${humans.length} people + ${botCount} bots`) : tr("Four or five people, no bots.")}</p>
                <small>{tr("People can replace bots between hands.")}</small>
              </fieldset>
              {!ready && <p>{tr(humans.some(p => !p.connected) ? "Wait for disconnected players to rejoin." : fillBots ? "Invite at least one other person to play with bots." : "Gather four or five players to start")}</p>}
              <button className="primary-button" disabled={!ready}
                onClick={() => emit("game:start", { fillBots, playerCount: targetSize })}
              >{tr("Deal the first hand ↗")}</button>
            </>
          ) : (
            <p>{tr("Waiting for the host to deal.")}</p>
          )}
        </>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {tr(error)}
        </p>
      )}
      <Link className="back-link" href="/practice">{tr("Try a practice hand →")}</Link>
    </main>
  );
}
