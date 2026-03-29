"use client";

import { useMemo } from "react";
import { BuildStamp } from "@/components/BuildStamp";

type PlayerPublic = {
  playerId: string;
  seat: number;
  nickname: string;
  connected: boolean;
  handCount: number;
  discards: string[];
  melds: Array<
    | { type: "chiu"; tile: string }
    | { type: "an"; kind: "chan" | "ca"; tiles: [string, string]; fromSeat: number }
  >;
  hand?: string[];
};

type PublicGame = {
  phase: "lobby" | "playing";
  dealerSeat: number;
  turnSeat: number;
  awaiting: "draw" | "discard";
  wallCount: number;
  lastDiscard: null | { tile: string; fromSeat: number };
  revealHands?: boolean;
  players: PlayerPublic[];
};

export function TableBoard(props: {
  publicGame: PublicGame;
  youSeat: number | null;
  focusDiscard: string;
  setFocusDiscard: (t: string) => void;
}) {
  const { publicGame, youSeat } = props;

  const playersSorted = useMemo(() => {
    return (publicGame.players ?? []).slice().sort((a, b) => a.seat - b.seat);
  }, [publicGame.players]);

  const total = playersSorted.length;

  function relIndex(seat: number) {
    if (!youSeat) return playersSorted.findIndex(p => p.seat === seat);
    // relative position around the table, with you at bottom (0)
    return (seat - youSeat + total) % total;
  }

  function posClass(rel: number) {
    // Layout positions around a felt table.
    // 4p: 0 bottom, 1 left, 2 top, 3 right
    // 5p: 0 bottom, 1 bottom-left, 2 left/top-left, 3 top, 4 right
    if (total <= 4) {
      if (rel === 0) return "left-1/2 bottom-4 -translate-x-1/2";
      if (rel === 1) return "left-4 top-1/2 -translate-y-1/2";
      if (rel === 2) return "left-1/2 top-4 -translate-x-1/2";
      return "right-4 top-1/2 -translate-y-1/2";
    }
    // 5 players
    if (rel === 0) return "left-1/2 bottom-4 -translate-x-1/2";
    if (rel === 1) return "left-16 bottom-24";
    if (rel === 2) return "left-4 top-1/2 -translate-y-1/2";
    if (rel === 3) return "left-1/2 top-4 -translate-x-1/2";
    return "right-4 top-1/2 -translate-y-1/2";
  }

  function discardDockClass(rel: number) {
    if (total <= 4) {
      if (rel === 0) return "left-1/2 bottom-36 -translate-x-1/2";
      if (rel === 1) return "left-40 top-1/2 -translate-y-1/2";
      if (rel === 2) return "left-1/2 top-28 -translate-x-1/2";
      return "right-40 top-1/2 -translate-y-1/2";
    }
    if (rel === 0) return "left-1/2 bottom-36 -translate-x-1/2";
    if (rel === 1) return "left-64 bottom-44";
    if (rel === 2) return "left-40 top-1/2 -translate-y-1/2";
    if (rel === 3) return "left-1/2 top-28 -translate-x-1/2";
    return "right-40 top-1/2 -translate-y-1/2";
  }

  const lastDiscard = publicGame.lastDiscard?.tile ?? "";

  return (
    <div className="relative w-full h-[62vh] min-h-[520px] overflow-hidden rounded-2xl border border-black/20 shadow-sm">
      {/* felt background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.06)_35%,rgba(0,0,0,0.15)_100%)] bg-[#6b5b1a]" />
      {/* noise layer removed */}

      {/* center area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[56%] h-[56%] rounded-[36px] border border-white/10 bg-black/5" />
      </div>

      {/* draw pile + status (center-left) */}
      <div className="absolute left-6 top-6 text-white/90 text-xs">
        <div className="font-semibold tracking-wide">Wall</div>
        <div className="mt-1 text-white/80">{publicGame.wallCount} left</div>
        <div className="mt-2">
          <BuildStamp />
        </div>
      </div>

      {/* last discard (center) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="text-center text-[11px] text-white/70 mb-2">Last discard</div>
        <div className="w-14 h-44 rounded-lg border border-white/20 bg-white/90 overflow-hidden shadow-sm">
          {lastDiscard ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={require("@/lib/tileSrc").tilePngSrc(lastDiscard)}
              className="w-full h-full object-fill"
              alt={lastDiscard}
              draggable={false}
            />
          ) : null}
        </div>
        <button
          className={`mt-2 w-full text-[11px] rounded-md px-2 py-1 border ${props.focusDiscard ? "bg-amber-200 text-amber-950 border-amber-300" : "bg-white/10 text-white/70 border-white/20"}`}
          onClick={() => {
            if (!lastDiscard) return;
            props.setFocusDiscard(props.focusDiscard === lastDiscard ? "" : lastDiscard);
          }}
          disabled={!lastDiscard}
        >
          {props.focusDiscard ? "Unhighlight" : "Highlight"}
        </button>
      </div>

      {/* players */}
      {playersSorted.map((p) => {
        const rel = relIndex(p.seat);
        const isTurn = publicGame.turnSeat === p.seat;
        const isDealer = publicGame.dealerSeat === p.seat;

        const meldTiles: string[] = [];
        for (const m of p.melds ?? []) {
          if (m.type === "an") meldTiles.push(m.tiles[0], m.tiles[1]);
          if (m.type === "chiu") meldTiles.push(m.tile, m.tile, m.tile, m.tile);
        }

        return (
          <div key={p.playerId} className={`absolute ${posClass(rel)} max-w-[220px]`}>
            <div
              className={`rounded-xl px-3 py-2 backdrop-blur border shadow-sm ${
                isTurn
                  ? "bg-emerald-200/90 border-emerald-300"
                  : "bg-black/30 border-white/15"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${isTurn ? "text-emerald-950" : "text-white"}`}>
                    {p.nickname}
                  </div>
                  <div className={`text-[11px] ${isTurn ? "text-emerald-900/80" : "text-white/70"}`}>
                    Seat {p.seat}
                    {isDealer ? " • Dealer" : ""}
                    {!p.connected ? " • Offline" : ""}
                  </div>
                </div>
                <div className={`text-lg font-extrabold tabular-nums ${isTurn ? "text-emerald-950" : "text-white"}`}>
                  {p.handCount}
                </div>
              </div>

              {/* visible melds next to avatar area */}
              {meldTiles.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {meldTiles.slice(-10).map((t, idx) => (
                    <div
                      key={idx}
                      className={`w-6 h-20 border rounded bg-white/90 overflow-hidden shadow-sm ${
                        props.focusDiscard === t ? "ring-2 ring-amber-300" : "border-white/30"
                      }`}
                      title={t}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={require("@/lib/tileSrc").tilePngSrc(t)}
                        className="w-full h-full object-fill"
                        alt={t}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* discards strip near player */}
            <div className={`absolute ${discardDockClass(rel)} w-[260px]`}>
              <div className="flex gap-1.5 items-center">
                {(p.discards ?? []).slice(-6).map((t, idx) => (
                  <div
                    key={idx}
                    className={`w-7 h-24 sm:w-8 sm:h-28 border rounded bg-white/90 overflow-hidden shadow-sm ${
                      props.focusDiscard === t ? "ring-2 ring-amber-300" : "border-white/30"
                    }`}
                    title={t}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={require("@/lib/tileSrc").tilePngSrc(t)}
                      className="w-full h-full object-fill"
                      alt={t}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* footer turn text */}
      <div className="absolute left-1/2 bottom-3 -translate-x-1/2 text-[11px] text-white/70">
        Turn: Seat {publicGame.turnSeat} ({publicGame.awaiting})
      </div>
    </div>
  );
}
