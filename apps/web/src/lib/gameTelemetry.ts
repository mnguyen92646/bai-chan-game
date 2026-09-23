"use client";

import type { Action } from "@/lib/game";

type ActionName = Action["type"];
type ActionOutcome = "ok" | "rejected" | "timeout";

type NewRelicBrowser = {
  addPageAction(name: string, attributes: Record<string, string | number | boolean>): void;
};

declare global {
  interface Window {
    newrelic?: NewRelicBrowser;
  }
}

/** Report only the move kind and transport result; room IDs and tiles stay private. */
export function recordGameAction(action: ActionName, outcome: ActionOutcome, durationMs: number): void {
  if (typeof window === "undefined") return;
  window.newrelic?.addPageAction("BaiChanMove", {
    move: action,
    outcome,
    latencyMs: Math.round(durationMs),
  });
}
