"use client";
import { useState } from "react";
import { useLanguage } from "@/lib/useLanguage";
import type { useTableAudio } from "@/lib/useTableAudio";
import type { SoundMode, TableVoice, VoicePack } from "@/lib/tableSoundEvents";

export function SpeakerIcon({ muted = false }: { muted?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4Z" />
    {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
  </svg>;
}

export function TableSoundSettings({ sound }: { sound: ReturnType<typeof useTableAudio> }) {
  const [voice, setVoice] = useState<TableVoice>("male");
  const { locale } = useLanguage();
  const copy = (en: string, vi: string) => locale === "vi" ? vi : en;
  const modes: { value: SoundMode; title: string; description: string }[] = [
    { value: "calls", title: copy("Vietnamese calls", "Tiếng hô"), description: "Bốc! · Ăn! · Chíu! · Ù rồi!" },
    { value: "cards", title: copy("Calls + card names", "Tiếng hô + tên quân"), description: copy("Ăn! Tam Văn. · Chíu! Ngũ Sách.", "Ăn! Tam Văn. · Chíu! Ngũ Sách.") },
    { value: "effects", title: copy("Effects only", "Chỉ tiếng động"), description: copy("Tiles, claims and celebrations", "Tiếng quân bài, ăn bài và mừng ù") },
    { value: "off", title: copy("Off", "Tắt âm thanh"), description: copy("Play quietly", "Chơi không có âm thanh") },
  ];
  return <div className="sound-settings">
    <p>{copy("Soft paper sounds when drawing and discarding. Short calls for Bốc, Ăn, Chíu and Ù.", "Tiếng giấy nhẹ khi bốc và đánh bài. Tiếng hô Bốc, Ăn, Chíu và Ù.")}</p>
    <fieldset className="sound-modes">
      <legend className="sr-only">{copy("Sound mode", "Kiểu âm thanh")}</legend>
      {modes.map(mode => <label key={mode.value} className={`sound-mode ${sound.preferences.mode === mode.value ? "selected" : ""}`}>
        <input type="radio" name="table-sound" value={mode.value} checked={sound.preferences.mode === mode.value} onChange={() => sound.change({ ...sound.preferences, mode: mode.value })} />
        <span><strong>{mode.title}</strong><small>{mode.description}</small></span>
      </label>)}
    </fieldset>
    <label className="sound-volume" htmlFor="table-volume"><span>{copy("Volume", "Âm lượng")}</span><output>{Math.round(sound.preferences.volume * 100)}%</output>
      <input id="table-volume" type="range" min="0" max="100" step="5" disabled={sound.preferences.mode === "off"} value={Math.round(sound.preferences.volume * 100)} onChange={event => sound.change({ ...sound.preferences, volume: Number(event.target.value) / 100 })} />
    </label>
    {sound.preferences.mode !== "off" && !sound.ready && <button type="button" className="secondary-button" onClick={sound.unlock}>{copy("Tap to enable sound", "Chạm để bật âm thanh")}</button>}
    <label className="sound-provider">{copy("Voice source", "Nguồn giọng đọc")}
      <select value={sound.preferences.voicePack ?? "edge"} onChange={event => sound.change({ ...sound.preferences, voicePack: event.target.value as VoicePack })}>
        <option value="edge">Microsoft · Nam Minh / Hoài My</option>
        <option value="google">Google Translate</option>
        <option value="mac">{copy("Original Mac · Linh", "Giọng Mac ban đầu · Linh")}</option>
        <option value="previous">{copy("Previous AI voices", "Giọng AI trước đây")}</option>
      </select>
    </label>
    <p className="sound-note">{copy("Google and Mac use one voice for all players. These voices are not verified as Bắc 54.", "Google và Mac dùng một giọng cho mọi người chơi. Chưa xác nhận giọng nào đúng chất Bắc 54.")}</p>
    <h3>{copy("Try the sounds", "Nghe thử")}</h3>
    {!["google", "mac"].includes(sound.preferences.voicePack ?? "edge") && <fieldset className="voice-previews"><legend>{copy("Voice", "Giọng")}</legend>{(["male", "female"] as const).map(value => <label key={value}><input type="radio" name="preview-voice" checked={voice === value} onChange={() => setVoice(value)} />{value === "male" ? copy("Male · Minh", "Nam · Minh") : copy("Female · Lan, Mai", "Nữ · Lan, Mai")}</label>)}</fieldset>}
    <div className="sound-previews">{([
      { kind: "draw", label: "Bốc!" },
      { kind: "an", tile: "3_vanh", label: "Ăn!" },
      { kind: "chiu", tile: "5_sach", label: "Chíu!" },
      { kind: "win", label: "Ù rồi!" },
      { kind: "chiu-win", label: "Chíu-Ù!" },
    ] as const).map(sample => <button key={sample.kind} type="button" disabled={sound.preferences.mode === "off"} onClick={() => sound.preview({ ...sample, seat: 1, voice })} aria-label={copy(`Preview ${sample.label}`, `Nghe thử ${sample.label}`)}><span aria-hidden="true">▶</span>{sample.label}</button>)}</div>
    {sound.unavailable && <p role="status">{copy("Sound could not start. Try tapping a preview again.", "Chưa bật được âm thanh. Hãy chạm Nghe thử một lần nữa.")}</p>}
    <p className="sound-note">{copy("No sound on iPhone? Try a preview, check media volume, Silent Mode, and whether audio is going to Bluetooth headphones.", "iPhone không có tiếng? Chạm Nghe thử, kiểm tra âm lượng phương tiện, chế độ im lặng và tai nghe Bluetooth.")}</p>
    <p className="sound-note">{copy("Vietnamese synthetic voice · Settings are saved on this device.", "Giọng Việt tổng hợp · Cài đặt được lưu trên thiết bị này.")}</p>
  </div>;
}
