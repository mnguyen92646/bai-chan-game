import { test } from "node:test";
import assert from "node:assert/strict";
import { startGame, toPublicGameState } from "../../../../packages/game/src/engine";
import { readSoundPreferences, tableSoundEvent, voiceClips, voicedEvent } from "./tableSoundEvents";

function board() {
  const { game } = startGame({ players: [1, 2, 3, 4].map(seat => ({ seat, playerId: String(seat) })), dealerSeat: 1 });
  return toPublicGameState({ game, nicknamesById: new Map(), connectedById: new Map() });
}

test("practice actors route to their assigned voices without changing the public event", () => {
  const voices = { 2: "female", 3: "male", 4: "female" } as const;
  for (const seat of [1, 2, 3, 4]) {
    const event = { kind: "chiu" as const, seat, tile: "5_sach" };
    assert.deepEqual(voicedEvent(event, voices), { ...event, voice: seat === 2 || seat === 4 ? "female" : "male" });
    assert.equal("voice" in event, false);
  }
});

test("mount, duplicate snapshots, reconnect gaps and new hands are silent", () => {
  const before = board();
  assert.equal(tableSoundEvent(undefined, before), undefined);
  assert.equal(tableSoundEvent(before, { ...before }), undefined);
  assert.equal(tableSoundEvent(before, { ...before, revision: before.revision + 2 }), undefined);
  assert.equal(tableSoundEvent(before, { ...before, handId: "new", revision: before.revision + 1 }), undefined);
});

test("accepted discard and public draw get distinct small effects", () => {
  const before = board();
  const discard = { ...before, revision: 1, awaiting: "reactions" as const, lastDiscard: { tile: "3_vanh" as const, fromSeat: 1 } };
  assert.deepEqual(tableSoundEvent(before, discard), { kind: "discard", seat: 1, tile: "3_vanh" });
  const draw = { ...discard, revision: 2, wallCount: discard.wallCount - 1, source: "wall" as const };
  assert.equal(tableSoundEvent(discard, draw)?.kind, "draw");
});

test("eating and Chíu announce only the public claimed card", () => {
  const before = board(); before.awaiting = "reactions"; before.lastDiscard = { tile: "3_vanh", fromSeat: 1 };
  for (const kind of ["an", "chiu"] as const) {
    const after = structuredClone(before); after.revision++;
    after.players[1].melds.push(kind === "chiu" ? { type: "chiu", tile: "3_vanh" } : { type: "an", kind: "ca", tiles: ["3_vanh", "3_sach"], fromSeat: 1 });
    assert.deepEqual(tableSoundEvent(before, after), { kind, seat: 2, tile: "3_vanh" });
  }
});

test("claim opportunities, passing and network presence changes make no calls", () => {
  const before = board(); before.awaiting = "reactions";
  const after = structuredClone(before); after.revision++; after.responseSeat = 3; after.players[1].connected = false;
  assert.equal(tableSoundEvent(before, after), undefined);
});

test("accepted wins take precedence over meld sounds and support opening Ù", () => {
  const before = board(); const after = structuredClone(before); after.revision++; after.phase = "lobby"; after.endReason = "win"; after.winnerSeat = 1;
  assert.deepEqual(tableSoundEvent(before, after), { kind: "win", seat: 1 });
  after.players[0].melds.push({ type: "chiu", tile: "3_vanh" });
  assert.deepEqual(tableSoundEvent(before, after), { kind: "chiu-win", seat: 1 });
  after.endReason = "wall_empty"; after.winnerSeat = undefined; after.players[0].melds = [];
  assert.equal(tableSoundEvent(before, after), undefined);
});

test("voice modes announce Bốc, keep discards quiet and validate card identifiers", () => {
  const claim = { kind: "chiu" as const, seat: 2, tile: "3_vanh" };
  assert.deepEqual(voiceClips(claim, "off"), []);
  assert.deepEqual(voiceClips(claim, "effects"), []);
  assert.deepEqual(voiceClips(claim, "calls"), ["chiu"]);
  assert.deepEqual(voiceClips(claim, "cards"), ["chiu", "card-3_vanh"]);
  assert.deepEqual(voiceClips({ ...claim, tile: "../../private" }, "cards"), ["chiu"]);
  assert.deepEqual(voiceClips({ ...claim, kind: "draw" }, "cards"), ["boc"]);
  assert.deepEqual(voiceClips({ ...claim, kind: "draw" }, "calls"), ["boc"]);
  assert.deepEqual(voiceClips({ ...claim, kind: "draw" }, "effects"), []);
  assert.deepEqual(voiceClips({ ...claim, kind: "discard" }, "calls"), []);
});

test("calls are on by default, explicit mute persists and saved volume is bounded", () => {
  assert.deepEqual(readSoundPreferences(null), { mode: "calls", volume: 0.65 });
  assert.equal(readSoundPreferences("broken").mode, "calls");
  assert.equal(readSoundPreferences('{"mode":"off","volume":0.65}').mode, "off");
  assert.equal(readSoundPreferences('{"mode":"calls","volume":10}').volume, 1);
  assert.equal(readSoundPreferences('{"mode":"calls","volume":-1}').volume, 0);
  assert.equal(readSoundPreferences('{"mode":"cards","volume":"loud"}').volume, .65);
});
