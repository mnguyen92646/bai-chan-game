"use client";
import { useSyncExternalStore } from "react";
export type TileSize = 1 | 1.5 | 2;
const KEY = "baichan-tile-size-v1";
const EVENT = "baichan-tile-size";
let fallback: TileSize = 1;
function read(): TileSize {
  try {
    const value = Number(localStorage.getItem(KEY));
    return value === 1.5 || value === 2 ? value : 1;
  } catch { return fallback; }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(EVENT, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(EVENT, notify); };
}
export function useTileSize() {
  const size = useSyncExternalStore(subscribe, read, () => 1 as TileSize);
  function change(next: TileSize) {
    fallback = next;
    try { localStorage.setItem(KEY, String(next)); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }
  return { size, change };
}
