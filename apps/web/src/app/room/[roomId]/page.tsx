"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getStoredLocale } from "@/lib/locale";
import { getSocket } from "@/lib/socket";
import { getToken, setToken } from "@/lib/playerToken";
import { SortableHand } from "@/components/SortableHand";
import { LanguageToggle } from "@/components/LanguageToggle";

type PublicGame = {
  phase: "lobby" | "playing";
  dealerSeat: number;
  turnSeat: number;
  awaiting: "draw" | "discard";
  wallCount: number;
  lastDiscard: null | { tile: string; fromSeat: number };
  revealHands?: boolean;
  players: Array<{
    playerId: string;
    seat: number;
    nickname: string;
    connected: boolean;
    handCount: number;
    hand?: string[];
    discards: string[];
    melds: Array<
      | { type: "chiu"; tile: string }
      | { type: "an"; kind: "chan" | "ca"; tiles: [string, string]; fromSeat: number }
    >;
  }>;
};

type RoomState = {
  roomId: string;
  phase: "lobby" | "playing";
  hostPlayerId: string | null;
  players: Array<{ playerId: string; seat: number; nickname: string; connected: boolean }>;
  publicGame: PublicGame | null;
};

type PrivateState = {
  hand: string[];
  lastDrawnTile?: string;
  canU?: boolean;
  canAn?: boolean;
  an?:
    | {
        eligible: false;
        reason: string;
      }
    | {
        eligible: true;
        canChan: boolean;
        caTiles: string[];
        mustPreferChan: boolean;
      };
};


export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = params.roomId;

  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<any>(null);

  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<string>("connecting");
  const [seat, setSeat] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomState | null>(null);

  useEffect(() => {
    const l = getStoredLocale();
    setLocale(l);
    getMessages(l).then(setMessages);

    const { guessDeviceName } = require("@/lib/deviceName") as typeof import("@/lib/deviceName");
    const nick = search.get("nickname") ?? guessDeviceName();
    setNickname(nick);
  }, [search]);

  const t = useMemo(() => {
    const m = messages ?? {};
    return (key: string, vars?: Record<string, any>) => {
      let s = m[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
  }, [messages]);

  const [hand, setHand] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [lastDrawnTile, setLastDrawnTile] = useState<string>("");
  const [canU, setCanU] = useState<boolean>(false);
  const [canAn, setCanAn] = useState<boolean>(false);
  const [an, setAn] = useState<PrivateState["an"] | null>(null);
  const [selectedCaTile, setSelectedCaTile] = useState<string>("");
  const [revealHands, setRevealHands] = useState<boolean>(false);
  const [focusDiscard, setFocusDiscard] = useState<string>("");
  const [logsOpen, setLogsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    const socket = getSocket();

    function onRoomState(state: RoomState) {
      setRoom(state);
      if (typeof state?.publicGame?.revealHands === "boolean") {
        setRevealHands(Boolean(state.publicGame.revealHands));
      }
    }

    function onPrivateState(state: any) {
      const ps = state as PrivateState;
      if (Array.isArray(ps.hand)) setHand(ps.hand);
      if (ps.lastDrawnTile) setLastDrawnTile(ps.lastDrawnTile);
      if (typeof ps.canU === "boolean") setCanU(ps.canU);
      if (typeof ps.canAn === "boolean") setCanAn(ps.canAn);
      if (ps.an) {
        setAn(ps.an);
        if (ps.an.eligible) {
          const tiles = ps.an.caTiles ?? [];
          setSelectedCaTile((prev) => (prev && tiles.includes(prev) ? prev : (tiles[0] ?? "")));
        } else {
          setSelectedCaTile("");
        }
      } else {
        setAn(null);
        setSelectedCaTile("");
      }
    }

    function onLog(payload: any) {
      const lines = (payload?.lines ?? []) as string[];
      if (Array.isArray(lines)) setLogs(lines.slice(-200));
    }

    function onRestarted(payload: any) {
      const bySeat = payload?.bySeat;
      const byNickname = payload?.byNickname;
      const who = byNickname ? `${byNickname}${bySeat ? ` (Seat ${bySeat})` : ""}` : (bySeat ? `Seat ${bySeat}` : "Host");
      setNotice(`${t("game.restartedNotice")}: ${who}`);
      setTimeout(() => setNotice(""), 8000);
    }

    function onRoomReset(payload: any) {
      const bySeat = payload?.bySeat;
      const byNickname = payload?.byNickname;
      const who = byNickname ? `${byNickname}${bySeat ? ` (Seat ${bySeat})` : ""}` : (bySeat ? `Seat ${bySeat}` : "Host");
      setNotice(`${t("room.resetNotice")}: ${who}`);
      setTimeout(() => setNotice(""), 8000);
    }

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("room:state", onRoomState);
    socket.on("game:private", onPrivateState);
    socket.on("game:log", onLog);
    socket.on("game:restarted", onRestarted);
    socket.on("room:reset", onRoomReset);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("game:private", onPrivateState);
      socket.off("game:log", onLog);
      socket.off("game:restarted", onRestarted);
      socket.off("room:reset", onRoomReset);
    };
  }, []);

  async function join() {
    const socket = getSocket();
    const token = getToken(roomId);
    const nick = nickname || "Player";

    socket.emit(
      "room:join",
      { roomId, nickname: nick, token: token || undefined },
      (resp: any) => {
        if (!resp?.ok) {
          alert(resp?.error ?? "Join failed");
          return;
        }
        if (resp.token) setToken(roomId, resp.token);
        setSeat(resp.seat ?? null);
        setPlayerId(resp.playerId ?? null);
        setIsHost(Boolean(resp.isHost));
      }
    );
  }

  async function startGame() {
    const socket = getSocket();
    socket.emit("game:start", {}, (resp: any) => {
      if (!resp?.ok) alert(resp?.error ?? "Start failed");
    });
  }

  async function restartGame() {
    if (!isHost) return;
    if (!confirm(t("game.restartConfirm"))) return;
    const socket = getSocket();
    socket.emit("game:restart", {}, (resp: any) => {
      if (!resp?.ok) alert(resp?.error ?? "Restart failed");
    });
  }

  async function resetRoom() {
    if (!isHost) return;
    if (!confirm(t("room.resetConfirm"))) return;
    const socket = getSocket();
    socket.emit("room:reset", {}, (resp: any) => {
      if (!resp?.ok) alert(resp?.error ?? "Reset failed");
      if (resp?.token) setToken(roomId, resp.token);
      if (resp?.seat) setSeat(resp.seat);
      if (resp?.playerId) setPlayerId(resp.playerId);
      setIsHost(true);
    });
  }

  function discard() {
    if (!selected) return;
    const socket = getSocket();
    socket.emit("game:discard", { tile: selected }, (resp: any) => {
      if (!resp?.ok) alert(resp?.error ?? "Discard failed");
      else setSelected("");
    });
  }

  if (!messages) return <div className="p-4">Loading…</div>;

  const inviteLink = typeof window === "undefined" ? "" : window.location.origin + `/room/${roomId}`;

  const hostConnected = Boolean(room?.hostPlayerId && room?.players?.find((p: any) => p.playerId === room.hostPlayerId)?.connected);
  const canAdmin = Boolean(isHost || (playerId && !hostConnected));

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("room.title", { roomId })}</h1>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <div className="text-xs text-gray-600">{status}</div>
        </div>
      </div>

      {notice ? (
        <div className="mt-3 text-sm border rounded-md px-3 py-2 bg-amber-50 text-amber-900 border-amber-200">
          {notice}
        </div>
      ) : null}

      <div className="mt-3 text-sm text-gray-700">
        <div><span className="font-medium">Room ID:</span> {roomId}</div>
        <div className="mt-2 flex gap-2">
          <input data-room-link="1" className="flex-1 border rounded-md px-3 py-2 text-xs" readOnly value={inviteLink} />
          <button
            className="border rounded-md px-3"
            onClick={async () => {
              // iOS Safari / in-app browsers can block navigator.clipboard.
              // Fallback: select the input text and attempt execCommand('copy').
              try {
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(inviteLink);
                  setNotice("Copied link to clipboard");
                  setTimeout(() => setNotice(""), 2500);
                  return;
                }
              } catch {
                // continue to fallback
              }

              try {
                const el = document.querySelector<HTMLInputElement>("input[data-room-link='1']");
                if (el) {
                  el.focus();
                  el.select();
                  document.execCommand("copy");
                  setNotice("Copied link to clipboard");
                  setTimeout(() => setNotice(""), 2500);
                  return;
                }
              } catch {
                // ignore
              }

              alert(inviteLink);
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm">{t("home.nickname")}</label>
        <input
          className="w-full border rounded-md px-3 py-2"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("home.nickname")}
        />
        <button className="mt-3 w-full bg-black text-white rounded-md py-3" onClick={join}>
          Join
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {room?.phase === "playing" ? (
          <div className="space-y-2">
            <div className="text-sm text-green-700 font-medium">Game started</div>
            {canAdmin ? (
              <div className="space-y-2">
                <button className="w-full border rounded-md py-3" onClick={restartGame}>
                  {t("game.restart")}
                </button>
                <button className="w-full border rounded-md py-3" onClick={resetRoom}>
                  {t("room.reset")}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            className="w-full border rounded-md py-3 disabled:opacity-50"
            disabled={!canAdmin}
            onClick={startGame}
          >
            Start game
          </button>
        )}
        {!canAdmin && room?.phase !== "playing" ? (
          <div className="text-xs text-gray-500">Only the room host can start (unless host disconnected).</div>
        ) : null}

        {room?.publicGame?.phase === "playing" ? (
          <div className="border rounded-md p-3 text-sm">
            <div>
              <span className="font-medium">Dealer:</span> Seat {room.publicGame.dealerSeat}
            </div>
            <div>
              <span className="font-medium">Turn:</span> Seat {room.publicGame.turnSeat} ({room.publicGame.awaiting})
            </div>
            <div>
              <span className="font-medium">Wall:</span> {room.publicGame.wallCount}
            </div>
          </div>
        ) : null}

        {room?.publicGame?.phase === "playing" ? (
          <div className="border rounded-md p-3 text-sm">
            <div className="font-medium mb-2">{t("table.title")}</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">{t("table.drawPile")}</div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40 border rounded overflow-hidden bg-white">
                    <img src={require("@/lib/tileSrc").backPngSrc()} className="w-full h-full object-fill" alt="draw" />
                  </div>
                  <div className="text-xs text-gray-700">{room.publicGame.wallCount} {t("table.wallLeft")}</div>
                </div>
              </div>

              <div className="flex-1">
                <div className="text-xs text-gray-600 mb-1">{t("table.lastDiscard")} {t("table.tapToHighlight")}</div>
                {room.publicGame.lastDiscard?.tile ? (() => {
                  const { tileInfo } = require("@/lib/tileMeta") as typeof import("@/lib/tileMeta");
                  const info = tileInfo(room.publicGame.lastDiscard!.tile);
                  return (
                    <div className="text-[11px] text-gray-700 mb-2">
                      <span className="font-medium">{t("table.discardLabel")}:</span> {info.labelEn} / {info.labelVi} <span className="text-gray-500">[{info.id}]</span>
                    </div>
                  );
                })() : null}
                <div className="flex items-center gap-3">
                  {room.publicGame.lastDiscard?.tile ? (
                    <button
                      className={`w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40 border rounded overflow-hidden bg-white ${focusDiscard ? "ring-2 ring-amber-300" : ""}`}
                      onClick={() => {
                        const t = room.publicGame!.lastDiscard!.tile;
                        setFocusDiscard((cur) => (cur === t ? "" : t));
                      }}
                      aria-label="Last discard"
                    >
                      <img
                        src={require("@/lib/tileSrc").tilePngSrc(room.publicGame.lastDiscard.tile)}
                        className="w-full h-full object-fill"
                        alt={room.publicGame.lastDiscard.tile}
                        draggable={false}
                      />
                    </button>
                  ) : (
                    <div className="w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40 border rounded bg-gray-50" />
                  )}

                  <button
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition shadow-sm border ${(() => {
                      const d = room?.publicGame?.lastDiscard?.tile;
                      if (!d) return "bg-zinc-100 text-zinc-400 border-zinc-200";
                      const exact = hand.filter(t => t === d).length;
                      const isYeu = (x: string) => x === "lao" || x === "chi" || x === "thang";
                      const isNhat = (x: string) => /^1_(van|vanh|sach)$/.test(x);
                      const inSpecial6 = (x: string) => isYeu(x) || isNhat(x);
                      const eligible = exact >= 3 || (inSpecial6(d) && hand.filter(inSpecial6).length >= 3);
                      return eligible
                        ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                        : "bg-emerald-50 text-emerald-300 border-emerald-100";
                    })()}`}
                    disabled={(() => {
                      const d = room?.publicGame?.lastDiscard?.tile;
                      if (!d) return true;
                      const exact = hand.filter(t => t === d).length;
                      if (exact >= 3) return false;
                      const isYeu = (x: string) => x === "lao" || x === "chi" || x === "thang";
                      const isNhat = (x: string) => /^1_(van|vanh|sach)$/.test(x);
                      const inSpecial6 = (x: string) => isYeu(x) || isNhat(x);
                      if (inSpecial6(d)) {
                        const cnt = hand.filter(inSpecial6).length;
                        return cnt < 3;
                      }
                      return true;
                    })()}
                    onClick={() => {
                      const socket = getSocket();
                      socket.emit("game:chiu", {}, (resp: any) => {
                        if (!resp?.ok) alert(resp?.error ?? "Chiu failed");
                      });
                    }}
                  >
                    {t("table.chiu")}
                  </button>

                  {(() => {
                    const d = room.publicGame.lastDiscard?.tile;
                    if (!d) return null;
                    const exact = hand.filter(t => t === d).length;
                    const isYeu = (x: string) => x === "lao" || x === "chi" || x === "thang";
                    const isNhat = (x: string) => /^1_(van|vanh|sach)$/.test(x);
                    const inSpecial6 = (x: string) => isYeu(x) || isNhat(x);
                    const eligible = exact >= 3 || (inSpecial6(d) && hand.filter(inSpecial6).length >= 3);
                    return (
                      <div className={`text-xs ${eligible ? "text-emerald-700" : "text-gray-500"}`}>
                        {eligible ? t("table.youCanChiu") : t("table.need3")}
                      </div>
                    );
                  })()}
                </div>

                <div className="text-xs text-gray-600 mt-3 mb-1">{t("table.discardsLast5")}</div>
                <div className="space-y-2">
                  {room.publicGame.players
                    .slice()
                    .sort((a, b) => a.seat - b.seat)
                    .map((p) => {
                      const last5 = (p.discards ?? []).slice(-5);
                      return (
                        <div key={p.seat} className="flex items-center gap-2 border rounded px-2 py-1">
                          <div className="text-xs w-7">S{p.seat}</div>
                          <div className="flex gap-1 flex-wrap">
                            {last5.length ? (
                              last5.map((t, idx) => (
                                <div key={idx} className="w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40 border rounded overflow-hidden bg-white">
                                  <img src={require("@/lib/tileSrc").tilePngSrc(t)} className="w-full h-full object-fill" alt={t} />
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500">(none)</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-2">
        {(room?.players ?? []).length === 0 ? (
          <div className="text-sm text-gray-600">No players yet.</div>
        ) : (
          room?.players.map((p) => {
            const gp = room?.publicGame?.players?.find((x) => x.seat === p.seat);
            return (
              <div key={p.seat} className="border rounded-md p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {t("room.seat", { seat: p.seat })} {seat === p.seat ? `(${t("room.you")})` : ""}
                    </div>
                    <div className="text-sm text-gray-700">{p.nickname}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm ${p.connected ? "text-green-700" : "text-gray-500"}`}>
                      {p.connected ? t("room.connected") : t("room.disconnected")}
                    </div>
                  </div>
                </div>

                {room?.publicGame?.revealHands && gp?.hand ? (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 mb-1">Hand ({gp.hand.length})</div>
                    <div className="flex gap-1 flex-wrap">
                      {gp.hand.map((tid, idx) => (
                        <div key={idx} className="w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40 border rounded overflow-hidden bg-white">
                          <img src={require("@/lib/tileSrc").tilePngSrc(tid)} className="w-full h-full object-fill" alt={tid} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {room?.publicGame?.phase === "playing" ? (() => {
        const myTurn = room.publicGame.turnSeat === seat;
        const canDraw = myTurn && room.publicGame.awaiting === "draw";
        const canDiscard = myTurn && room.publicGame.awaiting === "discard";
        const mustAn = false;

        function tileKey(t: string) {
          // Sorting heuristic aligned with Chắn identities: chi first, then rank 2-9, then suit.
          if (t === "chi") return `0_0`;
          const m = t.match(/^(\d)_(van|vanh|sach)$/);
          if (!m) return `9_9_${t}`;
          const r = Number(m[1]);
          const suit = m[2];
          const suitOrder = suit === "van" ? 0 : suit === "vanh" ? 1 : 2;
          return `1_${String(r).padStart(2, "0")}_${suitOrder}`;
        }

        return (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Your hand ({hand.length})</div>
              <div className="text-xs text-gray-600">
                {myTurn ? (mustAn ? t("table.mustAn") : "Your turn") : `Waiting for seat ${room.publicGame.turnSeat}`}
              </div>
            </div>

            <div className="mt-2">
              <SortableHand
                hand={hand}
                setHand={setHand}
                selected={selected}
                setSelected={setSelected}
                lastDrawnTile={lastDrawnTile}
                highlightLike={focusDiscard}
              />
            </div>

            <div className="text-xs text-gray-600 mt-2">
              {(() => {
                const { tileInfo } = require("@/lib/tileMeta") as typeof import("@/lib/tileMeta");
                const sel = selected ? tileInfo(selected) : null;
                const drawn = lastDrawnTile ? tileInfo(lastDrawnTile) : null;
                return (
                  <div className="space-y-1">
                    <div>
                      <span className="font-medium">Selected:</span>{" "}
                      {sel ? (
                        <span className="text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">{sel.labelEn} / {sel.labelVi}</span>
                      ) : (
                        "(none)"
                      )}
                      {sel ? <span className="text-gray-500 ml-2">[{sel.id}]</span> : null}
                    </div>
                    <div>
                      <span className="font-medium">Last drawn:</span>{" "}
                      {drawn ? (
                        <span className="text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">{drawn.labelEn} / {drawn.labelVi}</span>
                      ) : (
                        "(none)"
                      )}
                      {drawn ? <span className="text-gray-500 ml-2">[{drawn.id}]</span> : null}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Controls BELOW the hand (mobile-friendly) */}
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-md py-3 font-semibold transition shadow-sm bg-emerald-600 text-white border border-emerald-700 active:scale-[0.99]"
                onClick={() => {
                  setHand((prev) => prev.slice().sort((a, b) => tileKey(a).localeCompare(tileKey(b))));
                }}
              >
                Auto-sort
              </button>

              {(() => {
                const canAnChan = Boolean(an && (an as any).eligible && (an as any).canChan);
                const caTiles = (an && (an as any).eligible ? ((an as any).caTiles as string[]) : []) ?? [];
                const mustPreferChan = Boolean(an && (an as any).eligible && (an as any).mustPreferChan);
                const canAnCa = caTiles.length > 0 && !mustPreferChan;

                return (
                  <>
                    <button
                      className={`flex-1 rounded-md py-3 font-semibold transition shadow-sm border active:scale-[0.99] ${
                        canAnChan
                          ? "bg-orange-600 text-white border-orange-700"
                          : "bg-orange-50 text-orange-200 border-orange-100"
                      }`}
                      disabled={!canAnChan}
                      onClick={() => {
                        const socket = getSocket();
                        socket.emit("game:an", { kind: "chan" }, (resp: any) => {
                          if (!resp?.ok) alert(resp?.error ?? "Ăn chắn failed");
                        });
                      }}
                      title={mustPreferChan ? "Ưu tiên ăn chắn" : undefined}
                    >
                      Ăn chắn
                    </button>

                    <div className="flex-1 flex flex-col gap-1">
                      {caTiles.length > 1 ? (
                        <select
                          className="border rounded-md px-2 py-1 text-xs"
                          value={selectedCaTile}
                          onChange={(e) => setSelectedCaTile(e.target.value)}
                          disabled={!canAnCa}
                        >
                          {caTiles.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <button
                        className={`w-full rounded-md py-3 font-semibold transition shadow-sm border active:scale-[0.99] ${
                          canAnCa
                            ? "bg-orange-500 text-white border-orange-600"
                            : mustPreferChan
                              ? "bg-orange-50 text-orange-200 border-orange-100"
                              : "bg-orange-50 text-orange-200 border-orange-100"
                        }`}
                        disabled={!canAnCa}
                        onClick={() => {
                          const socket = getSocket();
                          socket.emit(
                            "game:an",
                            { kind: "ca", withTile: selectedCaTile || caTiles[0] },
                            (resp: any) => {
                              if (!resp?.ok) alert(resp?.error ?? "Ăn cạ failed");
                            }
                          );
                        }}
                        title={mustPreferChan ? "Không được ăn cạ khi có chắn" : undefined}
                      >
                        Ăn cạ
                      </button>
                    </div>
                  </>
                );
              })()}

              <button
                className={`flex-1 rounded-md py-3 font-semibold transition shadow-sm border active:scale-[0.99] ${
                  canDraw
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-blue-50 text-blue-200 border-blue-100"
                }`}
                disabled={!canDraw}
                onClick={() => {
                  const socket = getSocket();
                  socket.emit("game:draw", {}, (resp: any) => {
                    if (!resp?.ok) alert(resp?.error ?? "Draw failed");
                  });
                }}
              >
                Draw
              </button>

              <button
                className={`flex-1 rounded-md py-3 font-extrabold transition shadow-sm border active:scale-[0.99] ${
                  canU
                    ? "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-amber-950 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.35)]"
                    : "bg-amber-50 text-amber-200 border-amber-100"
                }`}
                disabled={!canU}
                onClick={() => {
                  const socket = getSocket();
                  socket.emit("game:u", {}, (resp: any) => {
                    if (!resp?.ok) alert(resp?.error ?? "Ù failed");
                  });
                }}
              >
                Ù
              </button>

              <button
                className={`flex-1 rounded-md py-3 font-semibold transition shadow-sm border active:scale-[0.99] ${
                  canDiscard && selected
                    ? "bg-zinc-900 text-white border-zinc-950"
                    : "bg-zinc-100 text-zinc-300 border-zinc-200"
                }`}
                disabled={!canDiscard || !selected}
                onClick={discard}
              >
                Discard
              </button>
            </div>
          </div>
        );
      })() : null}

      {room?.publicGame?.phase === "playing" ? (
        <div className="mt-6 border rounded-md p-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={revealHands}
              onChange={(e) => {
                const enabled = e.target.checked;
                setRevealHands(enabled);
                const socket = getSocket();
                socket.emit("debug:revealHands", { enabled }, (resp: any) => {
                  if (!resp?.ok) alert(resp?.error ?? "Toggle failed");
                });
              }}
            />
            {t("debug.revealHands")}
          </label>
        </div>
      ) : null}

      <div className="mt-6 border rounded-md">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-sm"
          onClick={() => setLogsOpen((v) => !v)}
        >
          <span className="font-medium">Game log</span>
          <span className="text-xs text-gray-600">{logsOpen ? "Hide" : "Show"}</span>
        </button>
        {logsOpen ? (
          <div className="max-h-48 overflow-auto border-t px-3 py-2 text-xs font-mono whitespace-pre-wrap bg-zinc-50 text-zinc-900">
            {(logs.length ? logs : ["(no logs yet)"]).slice(-200).join("\n")}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-gray-500 mt-6">
        Token is stored locally per room. Reopening this page should rejoin your seat.
      </p>
    </main>
  );
}
