"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicGameState } from "./game";
import { TableAudio } from "./tableAudio";
import { defaultSoundPreferences, readSoundPreferences, tableSoundEvent, voicedEvent, type SoundPreferences, type TableSoundEvent, type TableVoice } from "./tableSoundEvents";

const KEY = "baichan-table-audio-v1";
const DEFAULT_VOICES: Partial<Record<number, TableVoice>> = {};
export function useTableAudio(game: PublicGameState, disabled: boolean, voices: Partial<Record<number, TableVoice>> = DEFAULT_VOICES) {
  const [preferences, setPreferences] = useState(defaultSoundPreferences);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  const current = useRef(preferences);
  const audio = useRef<TableAudio | undefined>(undefined);
  const previous = useRef<PublicGameState | undefined>(undefined);

  useEffect(() => {
    let saved = defaultSoundPreferences;
    try { saved = readSoundPreferences(localStorage.getItem(KEY)); } catch {}
    current.current = saved;
    // Browser preference is loaded after hydration, preserving identical initial HTML.
    setPreferences(saved);
    const silence = () => {
      // Do not replay anything missed while backgrounded. Resume only a context
      // already activated by this player; a new join still needs their own tap.
      previous.current = undefined;
      if (document.hidden) audio.current?.stop();
      else if (audio.current && current.current.mode !== "off") {
        void audio.current.unlock(current.current.volume).then(() => setUnavailable(false)).catch(() => setUnavailable(true));
      }
    };
    document.addEventListener("visibilitychange", silence);
    return () => { document.removeEventListener("visibilitychange", silence); audio.current?.dispose(); audio.current = undefined; };
  }, []);

  const unlock = useCallback(() => {
    if (current.current.mode === "off") return;
    audio.current ??= new TableAudio(setReady);
    void audio.current.unlock(current.current.volume).then(() => setUnavailable(false)).catch(() => setUnavailable(true));
  }, []);

  const change = useCallback((next: SoundPreferences) => {
    current.current = next;
    setPreferences(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    audio.current?.stop();
    if (next.mode !== "off") unlock();
  }, [unlock]);

  const preview = useCallback((event: TableSoundEvent) => {
    const preference = current.current;
    if (preference.mode === "off") return;
    audio.current ??= new TableAudio(setReady);
    const player = audio.current;
    player.stop();
    void player.unlock(preference.volume).then(() => { setUnavailable(false); return player.play(event, current.current); }).catch(() => setUnavailable(true));
  }, []);

  useEffect(() => {
    const before = previous.current;
    previous.current = game;
    if (disabled || document.hidden) { audio.current?.stop(); previous.current = undefined; return; }
    if (before && before.handId !== game.handId) audio.current?.stop();
    const event = tableSoundEvent(before, game);
    if (event) void audio.current?.play(voicedEvent(event, voices), current.current);
  }, [game, disabled, voices]);

  return { preferences, change, preview, unlock, unavailable, ready };
}
