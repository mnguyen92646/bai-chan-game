// 4-player bot runner for Bai Chan (Socket.IO)
// Generates organic gameplay traffic and attempts to detect/unstick stalled games.
//
// Usage:
//   node bots.mjs            # runs ~15 minutes
//   DURATION_MIN=30 node bots.mjs
//   BAI_CHAN_SERVER_URL=http://localhost:3001 node bots.mjs

import { io } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BAI_CHAN_SERVER_URL || 'http://localhost:3001';
let roomId = process.env.ROOM_ID || '000000';
let createdFreshRoom = false;
const durationMin = Number(process.env.DURATION_MIN || 15);
const durationMs = durationMin * 60_000;
const stopAt = Date.now() + durationMs;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const botsLogPath = process.env.BOTS_LOG_PATH || path.join(process.cwd(), `bots-${roomId}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
function log(line, obj) {
  const ts = new Date().toISOString();
  const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
  const s = `${ts} ${line}${suffix}`;
  console.log(s);
  try { fs.appendFileSync(botsLogPath, s + '\n'); } catch {}
}

function groupKey(tile) {
  // mirror server logic for special groups (minimal: NHAT/YEU detection only)
  if (typeof tile !== 'string') return null;
  const t = tile.toLowerCase();
  if (t.includes('nhat')) return 'NHAT';
  if (t.includes('yeu')) return 'YEU';
  return null;
}

class Bot {
  constructor(index) {
    this.index = index;
    this.nickname = `bot-${index}`;
    this.token = null;
    this.playerId = null;
    this.seat = null;
    this.isHost = false;
    this.private = null;
    this.publicGame = null;
    this.players = [];
    this.lastProgress = { at: Date.now(), sig: '' };

    this.socket = io(base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 500,
    });

    this.socket.on('connect', () => this.join());
    this.socket.on('room:state', (st) => this.onRoomState(st));
    this.socket.on('game:private', (st) => (this.private = st));
    this.socket.on('game:ended', (st) => this.onGameEnded(st));
    this.socket.on('game:restarted', (st) => log(`[bot${this.index}] game:restarted`, st));
    this.socket.on('disconnect', (reason) => log(`[bot${this.index}] disconnect`, { reason }));
  }

  emitAsync(event, payload) {
    return new Promise((resolve) => {
      try {
        this.socket.emit(event, payload, (resp) => resolve(resp));
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  async emitChecked(event, payload) {
    const resp = await this.emitAsync(event, payload);
    if (!resp?.ok) {
      log(`[bot${this.index}] ${event} !ok`, { payload, resp });
    }
    return resp;
  }

  async waitConnected(timeoutMs = 8000) {
    if (this.socket.connected) return true;
    const start = Date.now();
    while (!this.socket.connected && Date.now() - start < timeoutMs) {
      await sleep(100);
    }
    return this.socket.connected;
  }

  async join() {
    await this.waitConnected();
    const resp = await this.emitChecked('room:join', {
      roomId,
      nickname: this.nickname,
      token: this.token || undefined,
    });
    if (resp?.ok) {
      this.token = resp.token;
      this.playerId = resp.playerId;
      this.seat = resp.seat;
      this.isHost = Boolean(resp.isHost);
      log(`[bot${this.index}] joined`, { playerId: this.playerId, seat: this.seat, isHost: this.isHost });
    }
  }

  onRoomState(st) {
    this.players = st.players || [];
    this.publicGame = st.publicGame;

    const pg = this.publicGame;
    const sig = pg
      ? `${pg.phase}|${pg.turnSeat}|${pg.awaiting}|${pg.wallCount}|${pg.lastDiscard ? pg.lastDiscard.tile + ':' + pg.lastDiscard.fromSeat : '-'}`
      : `lobby|${(st.phase || 'lobby')}`;

    if (sig !== this.lastProgress.sig) {
      this.lastProgress = { at: Date.now(), sig };
    }
  }

  async hostResetRoom() {
    if (!this.isHost) return;
    // room:reset kicks everyone else and returns room to lobby.
    const resp = await this.emitChecked('room:reset', {});
    if (resp?.ok) {
      // Update token/seat might change
      if (resp.token) this.token = resp.token;
      if (resp.seat) this.seat = resp.seat;
      if (resp.playerId) this.playerId = resp.playerId;
      log(`[bot${this.index}] room reset ok`, { seat: this.seat, playerId: this.playerId });
    }
  }

  async maybeStartIfHost() {
    if (!this.isHost) return;
    if (!this.players || this.players.length < 4) return;
    const pg = this.publicGame;
    if (!pg || pg.phase !== 'playing') {
      await this.emitChecked('game:start', {});
    }
  }

  async maybePlayTurn() {
    const pg = this.publicGame;
    if (!pg || pg.phase !== 'playing') return;
    if (!this.private || !this.seat) return;

    // opportunistic CHIU (can be done any time while lastDiscard exists)
    if (pg.lastDiscard && pg.lastDiscard.tile) {
      const tile = pg.lastDiscard.tile;
      const hand = this.private.hand || [];
      const exactCount = hand.filter((t) => t === tile).length;
      const eligible = exactCount >= 3;
      if (eligible) {
        await this.emitChecked('game:chiu', {});
      }
    }

    // Only act on our turn
    if (pg.turnSeat !== this.seat) return;

    if (pg.awaiting === 'draw') {
      if (this.private.canAn && Math.random() < 0.35) {
        await this.emitChecked('game:an', {});
      } else {
        await this.emitChecked('game:draw', {});
      }
      return;
    }

    if (pg.awaiting === 'discard') {
      if (this.private.canU) {
        await this.emitChecked('game:u', {});
        return;
      }

      const hand = Array.isArray(this.private.hand) ? this.private.hand.slice() : [];
      if (!hand.length) return;

      const last = this.private.lastDrawnTile;
      let choices = hand;
      if (last && hand.length > 1 && Math.random() < 0.7) {
        choices = hand.filter((t) => t !== last);
        if (!choices.length) choices = hand;
      }
      const tile = choices[Math.floor(Math.random() * choices.length)];
      await this.emitChecked('game:discard', { tile });
    }
  }

  async onGameEnded(st) {
    log(`[bot${this.index}] game ended`, st);
  }
}

async function waitForSeats(bots, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const seats = bots.map((b) => b.seat).filter(Boolean);
    if (seats.length === 4 && new Set(seats).size === 4) return true;
    await sleep(150);
  }
  return false;
}

async function ensureRoom() {
  if (process.env.ROOM_ID) return;
  // Create a fresh room so we never collide with an already-full shared room.
  try {
    const r = await fetch(`${base}/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = await r.json();
    if (j?.roomId) {
      roomId = j.roomId;
      createdFreshRoom = true;
    }
  } catch {
    // ignore
  }
}

async function main() {
  await ensureRoom();
  log(`[bots] base=${base} room=${roomId} durationMin=${durationMin}`, { botsLogPath });

  const bots = [1, 2, 3, 4].map((i) => new Bot(i));

  // Give time to connect + join
  await sleep(1200);

  // Ensure host is bot1. If not host, rejoin without token until host.
  for (let tries = 0; tries < 5; tries++) {
    if (bots[0].isHost) break;
    bots[0].token = null;
    await bots[0].join();
    await sleep(300);
  }

  // If user forced a shared ROOM_ID (e.g. 000000), reset to kick stray clients.
  // If we created a fresh room, skip reset (it would server-disconnect and prevent auto-reconnect).
  if (!createdFreshRoom) {
    await bots[0].hostResetRoom();

    for (let i = 1; i < bots.length; i++) bots[i].token = null;
    await sleep(500);
    for (let i = 1; i < bots.length; i++) {
      // server disconnect disables auto-reconnect; force reconnect
      if (bots[i].socket.disconnected) bots[i].socket.connect();
      await bots[i].join();
      await sleep(250);
    }
  }

  const seated = await waitForSeats(bots, 25_000);
  log('[bots] seats ready', { seated, seats: bots.map((b) => b.seat) });

  // main loop
  while (Date.now() < stopAt) {
    await bots[0].maybeStartIfHost();

    for (const b of bots) {
      await b.maybePlayTurn();
      await sleep(60);
    }

    // stall detection: if no progress for 20s while playing, host restarts
    const pg = bots[0].publicGame;
    if (pg && pg.phase === 'playing') {
      const mostRecent = Math.max(...bots.map((b) => b.lastProgress.at));
      if (Date.now() - mostRecent > 20_000) {
        log('[bots] detected stall; host restarting game');
        await bots[0].emitChecked('game:restart', {});
      }
    }

    await sleep(120);
  }

  log('[bots] stopping');
  for (const b of bots) b.socket.close();
}

main().catch((e) => {
  log('[bots] fatal', { error: String(e), stack: e?.stack });
  process.exit(1);
});
