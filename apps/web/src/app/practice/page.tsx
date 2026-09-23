"use client";
import { useLanguage } from "@/lib/useLanguage";
import { useEffect, useState } from "react";
import { GameTable } from "@/components/GameTable";
import {
  botAction,
  restorePracticeWinner,
  nextActor,
  names,
  newPractice,
  play,
  toPrivateGameState,
  toPublicGameState,
  type Practice,
} from "@/lib/game";
const KEY = "baichan-practice-v2";
const BOT_VOICES = { 2: "female", 3: "male", 4: "female" } as const;
export default function PracticePage() {
  const { t: tr } = useLanguage();
  const [state, setState] = useState<Practice | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let saved: Practice | null = null;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (
        raw?.version === 2 &&
        raw.game?.players?.["0"] &&
        Array.isArray(raw.wall) &&
        Array.isArray(raw.log)
      )
        saved = restorePracticeWinner(raw);
    } catch {}
    // Browser storage is read only after hydration; a fresh deal is client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(saved ?? newPractice());
  }, []);
  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {}
    }
  }, [state]);
  useEffect(() => {
    if (
      !state ||
      state.result ||
      nextActor(state) === "0" ||
      paused
    )
      return;
    const timer = setTimeout(() => {
      setState((current) =>
        current
          ? play(current, nextActor(current), botAction(current))
          : current,
      );
    }, 1100);
    return () => clearTimeout(timer);
  }, [state, paused]);
  if (!state)
    return (
      <main className="entry-shell">
        <p className="eyebrow">{tr("PRACTICE")}</p>
        <h1>{tr("Dealing your hand…")}</h1>
      </main>
    );
  const game = toPublicGameState({
    game: state.game,
    nicknamesById: new Map(names.map((n, i) => [String(i), i === 0 ? tr("You") : n])),
    connectedById: new Map(names.map((_, i) => [String(i), true])),
  });
  return (
    <>
      <GameTable
        voices={BOT_VOICES}
        key={state.round}
        game={game}
        privateState={
          toPrivateGameState({
            game: state.game,
            playerId: "0",
            lastDrawnTile: state.lastDrawn,
          })!
        }
        seat={1}
        title={tr("Practice")}
        subtitle={tr(`Hand ${state.round} · You + 3 bots`)}
        log={state.log}
        result={state.result}
        onAction={(a) => {
          setState((s) => (s ? play(s, "0", a) : s));
        }}
        onNew={() => {
          setState(newPractice(state.round + 1, state));
          setPaused(false);
        }}
        extra={
          <div className="practice-tools">
            <button className="text-button" onClick={() => setPaused(!paused)}>
              {paused ? tr("Resume bots") : tr("Pause bots")}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setState(newPractice(state.round + 1, state));
                setPaused(false);
                    }}
            >{tr("New hand")}</button>
          </div>
        }
      />
      {paused && (
        <div className="claim-notice">{tr("Bots paused.")}<button onClick={() => setPaused(false)}>{tr("Resume")}</button>
        </div>
      )}
    </>
  );
}
