import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

import type { GameState } from "./game/types";
import { startGame, toPrivateGameState, toPublicGameState } from "./game/engine";
import type { TileId } from "./game/chanDeck";
import { groupKey } from "./game/win";

import { newLogger, logLine, type GameLogger } from "./game/logger";
import { newPrivateLog, logJsonl, type PrivateGameLog } from "./game/privateLog";

type Room = {
  roomId: string;
  createdAt: number;
  lastActiveAt: number;
  hostPlayerId?: string;
  phase: "lobby" | "playing";
  playersById: Map<
    string,
    {
      playerId: string;
      nickname: string;
      seat: number;
      connected: boolean;
      socketId?: string;
    }
  >;

  game?: {
    wall: TileId[];
    state: GameState;
    pending?: NodeJS.Timeout;
    logger?: GameLogger; // player-visible rolling log (NO hands)
    privateLog?: PrivateGameLog; // server-only JSONL (includes hands)
    gameId?: string;
    revealHands?: boolean;
  };
};

const rooms = new Map<string, Room>();

function snapshotGameForLog(room: Room) {
  const g = room.game?.state;
  if (!g) return null;
  return {
    phase: g.phase,
    dealerSeat: g.dealerSeat,
    turnSeat: g.turnSeat,
    awaiting: g.awaiting,
    wallCount: g.wallCount,
    lastDiscard: g.lastDiscard,
    players: Object.values(g.players)
      .map(p => ({
        playerId: p.playerId,
        seat: p.seat,
        hand: p.hand,
        discards: p.discards,
        melds: p.melds
      }))
      .sort((a, b) => a.seat - b.seat)
  };
}

function audit(room: Room, event: string, data: any = {}) {
  const plog = room.game?.privateLog;
  if (!plog) return;
  logJsonl(plog, {
    event,
    roomId: room.roomId,
    gameId: room.game?.gameId,
    ...data,
    snapshot: snapshotGameForLog(room)
  });
}

function computeChiuEligibility(params: { hand: TileId[]; discardTile: TileId }) {
  // Vinagames: Chíu requires 3 identical tiles in hand (no special group chíu).
  const exactCount = params.hand.filter(t => t === params.discardTile).length;
  if (exactCount >= 3) return { eligible: true, need: 3 } as const;
  return { eligible: false, reason: "need_3_exact", have: exactCount } as const;
}

type AnEligibility =
  | { eligible: false; reason: string }
  | {
      eligible: true;
      canChan: boolean;
      caTiles: TileId[];
      mustPreferChan: boolean;
    };

function computeAnEligibility(params: {
  meHand: TileId[];
  discardTile: TileId;
  cannotEatTiles?: TileId[];
  noCaGroups?: string[];
}) {
  const discardTile = params.discardTile;

  // Vinagames: if you previously discarded this tile, you may not eat it later.
  if (params.cannotEatTiles?.includes(discardTile)) {
    return { eligible: false, reason: "cannot_eat_tile_you_discarded" } as const;
  }

  const canChan = params.meHand.includes(discardTile);

  const k = groupKey(discardTile);

  // Vinagames: "ăn chọn cạ" — if you already have a cạ in this rank-group, you may not ăn cạ in the same group.
  const distinctInGroup = Array.from(new Set(params.meHand.filter(t => groupKey(t) === k)));
  const alreadyHasCaInGroup = distinctInGroup.length >= 2;

  // Vinagames: if you've discarded both sides of a cạ in this rank-group, you may not ăn cạ in this group later.
  const caBannedByHistory = params.noCaGroups?.includes(k) ?? false;

  const caTiles = alreadyHasCaInGroup || caBannedByHistory
    ? ([] as TileId[])
    : (Array.from(new Set(params.meHand.filter(t => groupKey(t) === k && t !== discardTile))) as TileId[]);

  const eligible = canChan || caTiles.length > 0;
  if (!eligible) {
    return {
      eligible: false,
      reason: alreadyHasCaInGroup
        ? "already_has_ca_in_group"
        : caBannedByHistory
          ? "ca_banned_by_discard_history"
          : "no_matching_for_chan_or_ca"
    } as const;
  }

  return {
    eligible: true,
    canChan,
    caTiles,
    mustPreferChan: canChan && caTiles.length > 0
  } as const;
}

function computeLegalDiscardTiles(params: {
  hand: TileId[];
  rules: {
    forbiddenDiscardTiles: TileId[];
    hasEatenCaEver: boolean;
    discardedByGroup: Record<string, TileId[]>;
  };
  allowDiscardChan?: boolean;
  allowSecondTileInGroupAfterEatingCa?: boolean;
}): TileId[] {
  const uniq = Array.from(new Set(params.hand));
  const out: TileId[] = [];

  for (const tile of uniq) {
    if (params.rules.forbiddenDiscardTiles.includes(tile)) continue;

    // Vinagames: cấm đánh chắn (cannot discard a tile while still holding its identical pair).
    // For MVP safety, we optionally allow breaking this rule if it would otherwise deadlock a turn.
    const sameCount = params.hand.filter(t => t === tile).length;
    if (!params.allowDiscardChan && sameCount >= 2) continue;

    // Track discards by groupKey for "ăn/đánh cạ" rules.
    const gk = groupKey(tile);
    const existing = params.rules.discardedByGroup[gk] ?? [];

    // Vinagames: If you've ever eaten a cạ, you may not discard both sides of a cạ as trash.
    // (I.e., disallow discarding a 2nd distinct tile in the same rank-group.)
    if (
      params.rules.hasEatenCaEver &&
      !params.allowSecondTileInGroupAfterEatingCa &&
      existing.some(t => t !== tile)
    ) {
      continue;
    }

    out.push(tile);
  }

  return out;
}

function auditClaimOptions(room: Room, context: { when: string }) {
  const g = room.game?.state;
  if (!room.game?.privateLog || !g?.lastDiscard) return;

  const discardTile = g.lastDiscard.tile;
  const options = Object.values(g.players)
    .map(p => {
      const chiu = computeChiuEligibility({ hand: p.hand, discardTile });

      // Vinagames: only the next player (turnSeat), while awaiting draw, can attempt ăn.
      const canAttemptAn = g.awaiting === "draw" && g.turnSeat === p.seat && g.lastDiscard?.fromPlayerId !== p.playerId;
      const an: AnEligibility = canAttemptAn
        ? computeAnEligibility({
            meHand: p.hand,
            discardTile,
            cannotEatTiles: p.rules?.cannotEatTiles,
            noCaGroups: p.rules?.noCaGroups
          })
        : { eligible: false, reason: "not_turn_or_not_awaiting_draw" };

      const legal = {
        anChan: canAttemptAn && an.eligible === true && an.canChan,
        anCa: canAttemptAn && an.eligible === true && !an.mustPreferChan && an.caTiles.length > 0,
        chiu: chiu.eligible === true
      };

      return {
        playerId: p.playerId,
        seat: p.seat,
        canAttemptAn,
        an,
        chiu,
        legal
      };
    })
    .sort((a, b) => a.seat - b.seat);

  audit(room, "CLAIM_OPTIONS", { ...context, discardTile, fromPlayerId: g.lastDiscard.fromPlayerId, options });
}

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeRoomCode6(): string {
  // 6-digit numeric room code, leading zeros allowed.
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

function getOrCreateRoom(roomId?: string): Room {
  let id = roomId;
  if (!id) {
    // Generate a unique 6-digit room code
    for (let i = 0; i < 25; i++) {
      const candidate = makeRoomCode6();
      if (!rooms.has(candidate)) {
        id = candidate;
        break;
      }
    }
    if (!id) id = makeId("room"); // extremely unlikely fallback
  }

  const existing = rooms.get(id);
  if (existing) return existing;

  const r: Room = {
    roomId: id,
    createdAt: now(),
    lastActiveAt: now(),
    phase: "lobby",
    playersById: new Map()
  };
  rooms.set(id, r);
  return r;
}

function touch(room: Room) {
  room.lastActiveAt = now();
}

function pruneRooms() {
  const t = now();
  for (const [roomId, room] of rooms) {
    if (t - room.lastActiveAt > ROOM_TTL_MS) rooms.delete(roomId);
  }
}
setInterval(pruneRooms, 60_000).unref();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/rooms", (_req, res) => {
  const room = getOrCreateRoom();
  res.json({ roomId: room.roomId });
});

// Single-table mode: always use one shared room.
const DEFAULT_ROOM_ID = process.env.DEFAULT_ROOM_ID ?? "000000";
app.get("/room/default", (_req, res) => {
  const room = getOrCreateRoom(DEFAULT_ROOM_ID);
  res.json({ roomId: room.roomId });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const JoinSchema = z.object({
  roomId: z.string().min(1),
  nickname: z.string().min(1).max(32),
  token: z.string().optional()
});

type PlayerToken = {
  roomId: string;
  playerId: string;
  seat: number;
  nickname: string;
};

function signToken(payload: PlayerToken) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

function verifyToken(token: string): PlayerToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PlayerToken;
  } catch {
    return null;
  }
}

function nextAvailableSeat(room: Room) {
  const used = new Set(Array.from(room.playersById.values()).map(p => p.seat));
  // Family table supports up to 5 players; still works for 4 when one seat is empty.
  for (let i = 1; i <= 5; i++) if (!used.has(i)) return i;
  return null;
}

io.on("connection", (socket) => {
  socket.on("room:join", (raw, cb) => {
    const parsed = JoinSchema.safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: parsed.error.flatten() });

    const { roomId, nickname, token } = parsed.data;
    const room = getOrCreateRoom(roomId);
    touch(room);

    // Rejoin path
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.roomId === roomId) {
        const existing = room.playersById.get(payload.playerId);
        if (existing) {
          // Takeover semantics: if the same player re-joins from another device/tab,
          // disconnect the previous socket and attach this socket to the seat.
          if (existing.socketId && existing.socketId !== socket.id) {
            const prior = io.sockets.sockets.get(existing.socketId);
            prior?.disconnect(true);
          }

          existing.connected = true;
          existing.socketId = socket.id;
          existing.nickname = nickname; // allow nickname update on rejoin

          socket.data.playerId = payload.playerId;
          socket.data.roomId = roomId;
          socket.join(roomId);

          io.to(roomId).emit("room:state", serializeRoom(room));
          room.game?.logger && logLine(room.game.logger, `REJOIN player=${payload.playerId} nick=${nickname} seat=${existing.seat}`);
          room.game?.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });

          // If game already started, push private state for this player on rejoin.
          if (room.game) {
            const priv = toPrivateGameState({ game: room.game.state, playerId: payload.playerId });
            if (priv) socket.emit("game:private", priv);
          }

          return cb?.({
            ok: true,
            token,
            roomId,
            playerId: payload.playerId,
            seat: existing.seat,
            rejoined: true,
            tookOver: true,
            isHost: room.hostPlayerId === payload.playerId
          });
        }
      }
    }

    // New join path
    const seat = nextAvailableSeat(room);
    if (!seat) return cb?.({ ok: false, error: "Room full" });

    const playerId = makeId("p");
    room.playersById.set(playerId, { playerId, nickname, seat, connected: true, socketId: socket.id });

    // First player to join becomes host (room creator typically joins first)
    if (!room.hostPlayerId) room.hostPlayerId = playerId;

    const newToken = signToken({ roomId, playerId, seat, nickname });

    socket.data.playerId = playerId;
    socket.data.roomId = roomId;
    socket.join(roomId);

    io.to(roomId).emit("room:state", serializeRoom(room));
    room.game?.logger && logLine(room.game.logger, `JOIN player=${playerId} nick=${nickname} seat=${seat}`);
    room.game?.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });
    return cb?.({ ok: true, token: newToken, roomId, playerId, seat, rejoined: false, isHost: room.hostPlayerId === playerId });
  });

  socket.on("game:start", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });

    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    const host = room.hostPlayerId ? room.playersById.get(room.hostPlayerId) : undefined;
    const hostConnected = Boolean(host?.connected);
    // If host is gone (e.g. incognito closed), allow any connected player to start.
    if (room.hostPlayerId !== playerId && hostConnected) return cb?.({ ok: false, error: "Only host can start" });
    if (!hostConnected) room.hostPlayerId = playerId;
    if (room.phase !== "lobby") return cb?.({ ok: false, error: "Game already started" });

    // MVP playable loop: shuffle + deal + first turn.
    const players = Array.from(room.playersById.values()).map(p => ({ playerId: p.playerId, seat: p.seat }));
    // For now: dealer = host seat (simple + predictable).
    const dealerSeat = room.playersById.get(room.hostPlayerId!)?.seat ?? 1;

    const { game, wall } = startGame({ players, dealerSeat });
    room.phase = "playing";

    // Rotate per-game log
    const gameId = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = "/Users/michaelnguyen/.openclaw/workspace/bai-chan-web/apps/server/logs";
    const logger = newLogger({ logsDir, roomId, gameId });
    const privateLog = newPrivateLog({ logsDir, roomId, gameId });
    logLine(logger, `GAME_START room=${roomId} players=${players.length} dealerSeat=${dealerSeat}`);

    room.game = { state: game, wall, logger, privateLog, gameId };
    audit(room, "GAME_START", { playersCount: players.length, dealerSeat });
    touch(room);

    // Broadcast public + send each player their private hand.
    io.to(roomId).emit("room:state", serializeRoom(room));
    for (const p of players) {
      const socketId = room.playersById.get(p.playerId)?.socketId;
      if (!socketId) continue;
      const s = io.sockets.sockets.get(socketId);
      const priv = toPrivateGameState({ game: room.game.state, playerId: p.playerId });
      if (priv) s?.emit("game:private", priv);
    }

    return cb?.({ ok: true });
  });

  socket.on("game:restart", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });

    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    const host = room.hostPlayerId ? room.playersById.get(room.hostPlayerId) : undefined;
    const hostConnected = Boolean(host?.connected);
    // If host is gone (e.g. incognito closed), allow any connected player to restart.
    if (room.hostPlayerId !== playerId && hostConnected) return cb?.({ ok: false, error: "Only host can restart" });
    if (!hostConnected) room.hostPlayerId = playerId;

    // Start a fresh game immediately with the same currently-seated players.
    const players = Array.from(room.playersById.values()).map(p => ({ playerId: p.playerId, seat: p.seat }));
    const dealerSeat = room.playersById.get(room.hostPlayerId!)?.seat ?? 1;

    const { game, wall } = startGame({ players, dealerSeat });
    room.phase = "playing";

    // Rotate per-game log
    const gameId = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = "/Users/michaelnguyen/.openclaw/workspace/bai-chan-web/apps/server/logs";
    const logger = newLogger({ logsDir, roomId, gameId });
    const privateLog = newPrivateLog({ logsDir, roomId, gameId });
    logLine(logger, `GAME_RESTART room=${roomId} players=${players.length} dealerSeat=${dealerSeat}`);

    room.game = { state: game, wall, logger, privateLog, gameId };
    audit(room, "GAME_RESTART", { playersCount: players.length, dealerSeat });
    touch(room);

    const hostNick = room.playersById.get(playerId)?.nickname ?? "Host";
    const hostSeat = room.playersById.get(playerId)?.seat ?? 0;

    io.to(roomId).emit("game:restarted", { byPlayerId: playerId, byNickname: hostNick, bySeat: hostSeat });
    io.to(roomId).emit("room:state", serializeRoom(room));
    io.to(roomId).emit("game:log", { lines: logger.buffer });

    for (const p of players) {
      const socketId = room.playersById.get(p.playerId)?.socketId;
      if (!socketId) continue;
      const s = io.sockets.sockets.get(socketId);
      const priv = toPrivateGameState({ game: room.game.state, playerId: p.playerId });
      if (priv) s?.emit("game:private", priv);
    }

    return cb?.({ ok: true });
  });

  socket.on("room:reset", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });

    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    const host = room.hostPlayerId ? room.playersById.get(room.hostPlayerId) : undefined;
    const hostConnected = Boolean(host?.connected);
    // If host is gone (e.g. incognito closed), allow any connected player to reset.
    if (room.hostPlayerId !== playerId && hostConnected) return cb?.({ ok: false, error: "Only host can reset" });
    if (!hostConnected) room.hostPlayerId = playerId;

    const me = room.playersById.get(playerId);
    if (!me) return cb?.({ ok: false, error: "Not a player" });

    // Kick everyone else and return room to lobby.
    for (const [pid, p] of Array.from(room.playersById.entries())) {
      if (pid === playerId) continue;
      if (p.socketId) {
        const s = io.sockets.sockets.get(p.socketId);
        s?.leave(roomId);
        s?.disconnect(true);
      }
      room.playersById.delete(pid);
    }

    // Reset host to seat 1 for predictability
    me.seat = 1;
    me.connected = true;
    me.socketId = socket.id;
    room.hostPlayerId = playerId;
    room.phase = "lobby";
    room.game = undefined;
    touch(room);

    const newToken = signToken({ roomId, playerId, seat: me.seat, nickname: me.nickname });

    io.to(roomId).emit("room:state", serializeRoom(room));
    io.to(roomId).emit("room:reset", { byPlayerId: playerId, byNickname: me.nickname, bySeat: me.seat });

    return cb?.({ ok: true, token: newToken, seat: me.seat, playerId });
  });

  // Manual draw (required after a discard unless the player chíu's).
  socket.on("debug:revealHands", (raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const schema = z.object({ enabled: z.boolean() });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: parsed.error.flatten() });

    // Allow any connected player to toggle (training mode)
    room.game.revealHands = parsed.data.enabled;
    room.game.logger && logLine(room.game.logger, `REVEAL_HANDS enabled=${room.game.revealHands}`);
    io.to(roomId).emit("room:state", serializeRoom(room));
    room.game.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });

    return cb?.({ ok: true });
  });

  socket.on("game:an", (raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const schema = z
      .object({
        kind: z.enum(["chan", "ca"]).optional(),
        withTile: z.string().optional()
      })
      .optional();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: parsed.error.flatten() });

    const requestedKind = parsed.data?.kind;
    const requestedWithTile = parsed.data?.withTile as TileId | undefined;

    const game = room.game.state;
    const me = game.players[playerId];
    if (!me) return cb?.({ ok: false, error: "Not a player" });
    if (game.phase !== "playing") return cb?.({ ok: false, error: "Not playing" });
    if (game.awaiting !== "draw") return cb?.({ ok: false, error: "Not awaiting draw" });
    if (me.seat !== game.turnSeat) return cb?.({ ok: false, error: "Not your turn" });
    if (!game.lastDiscard) return cb?.({ ok: false, error: "No last discard" });
    if (game.lastDiscard.fromPlayerId === playerId) return cb?.({ ok: false, error: "Cannot ăn your own discard" });

    const discardTile = game.lastDiscard.tile;
    const fromId = game.lastDiscard.fromPlayerId;
    const fromSeat = game.players[fromId]?.seat ?? -1;

    const elig = computeAnEligibility({
      meHand: me.hand,
      discardTile,
      cannotEatTiles: me.rules?.cannotEatTiles,
      noCaGroups: me.rules?.noCaGroups
    });
    if (elig.eligible !== true) {
      audit(room, "AN_REJECT", {
        byPlayerId: playerId,
        bySeat: me.seat,
        tile: discardTile,
        reason: "not_eligible",
        details: elig
      });
      return cb?.({ ok: false, error: "Not eligible to ăn" });
    }

    // Default behavior (back-compat): if UI didn't specify, auto-take chan if possible; otherwise first ca option.
    const kind: "chan" | "ca" =
      requestedKind ?? (elig.canChan ? "chan" : (elig.caTiles.length ? "ca" : "chan"));

    if (kind === "ca" && elig.mustPreferChan) {
      audit(room, "AN_REJECT", {
        byPlayerId: playerId,
        bySeat: me.seat,
        tile: discardTile,
        reason: "must_prefer_chan"
      });
      return cb?.({ ok: false, error: "Must ăn chắn (cannot choose cạ when chắn is available)" });
    }

    if (kind === "chan") {
      const idx = me.hand.indexOf(discardTile);
      if (idx < 0) {
        audit(room, "AN_REJECT", {
          byPlayerId: playerId,
          bySeat: me.seat,
          tile: discardTile,
          reason: "missing_matching_tile_for_chan"
        });
        return cb?.({ ok: false, error: "Cannot ăn chắn: missing matching tile" });
      }

      me.hand.splice(idx, 1);
      me.melds.push({ type: "an", kind: "chan", tiles: [discardTile, discardTile], fromSeat });

      // Vinagames "bỏ ăn" rule: once you eat a tile, you may not discard that tile later.
      me.rules.forbiddenDiscardTiles.push(discardTile);
    } else {
      const withTile = requestedWithTile ?? elig.caTiles[0];
      if (!withTile) {
        audit(room, "AN_REJECT", {
          byPlayerId: playerId,
          bySeat: me.seat,
          tile: discardTile,
          reason: "missing_withTile"
        });
        return cb?.({ ok: false, error: "Cannot ăn cạ: no withTile provided" });
      }
      if (withTile === discardTile) {
        audit(room, "AN_REJECT", {
          byPlayerId: playerId,
          bySeat: me.seat,
          tile: discardTile,
          withTile,
          reason: "withTile_equals_discard"
        });
        return cb?.({ ok: false, error: "Cannot ăn cạ using identical tile" });
      }
      const k = groupKey(discardTile);
      if (groupKey(withTile) !== k) {
        audit(room, "AN_REJECT", {
          byPlayerId: playerId,
          bySeat: me.seat,
          tile: discardTile,
          withTile,
          reason: "withTile_not_compatible"
        });
        return cb?.({ ok: false, error: "Cannot ăn cạ: withTile not compatible" });
      }
      const idx = me.hand.indexOf(withTile);
      if (idx < 0) {
        audit(room, "AN_REJECT", {
          byPlayerId: playerId,
          bySeat: me.seat,
          tile: discardTile,
          withTile,
          reason: "withTile_not_in_hand"
        });
        return cb?.({ ok: false, error: "Cannot ăn cạ: tile not in hand" });
      }

      me.hand.splice(idx, 1);
      me.melds.push({ type: "an", kind: "ca", tiles: [discardTile, withTile], fromSeat });

      // Vinagames "bỏ ăn" rule: once you eat a tile, you may not discard that tile later.
      me.rules.forbiddenDiscardTiles.push(discardTile);
      me.rules.hasEatenCaEver = true;
    }

    // Remove the discard from discarder pile (last tile)
    const from = game.players[fromId];
    if (from && from.discards[from.discards.length - 1] === discardTile) {
      from.discards.pop();
    }

    // Take the discard; you become turn and must discard.
    game.lastDiscard = null;
    game.turnSeat = me.seat;
    game.awaiting = "discard";

    room.game.logger && logLine(room.game.logger, `AN seat=${me.seat} kind=${kind} tile=${discardTile}`);
    audit(room, "AN", { byPlayerId: playerId, bySeat: me.seat, kind, tile: discardTile, withTile: kind === "ca" ? requestedWithTile : undefined });

    touch(room);
    io.to(roomId).emit("room:state", serializeRoom(room));
    room.game.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });

    // Update privates
    socket.emit("game:private", toPrivateGameState({ game, playerId }));
    const fromSockId = room.playersById.get(fromId)?.socketId;
    const fromSock = fromSockId ? io.sockets.sockets.get(fromSockId) : undefined;
    fromSock?.emit("game:private", toPrivateGameState({ game, playerId: fromId }));

    return cb?.({ ok: true });
  });

  socket.on("game:draw", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const game = room.game.state;
    const me = game.players[playerId];
    if (!me) return cb?.({ ok: false, error: "Not a player" });
    if (game.phase !== "playing") return cb?.({ ok: false, error: "Not playing" });
    if (game.awaiting !== "draw") return cb?.({ ok: false, error: "Not awaiting draw" });
    if (me.seat !== game.turnSeat) return cb?.({ ok: false, error: "Not your turn" });
    if (room.game.wall.length === 0) {
      // Hand ends when wall is empty; otherwise clients can get stuck in an "awaiting draw" loop.
      game.phase = "lobby";
      room.phase = "lobby";
      game.lastDiscard = null;
      if (room.game.pending) {
        clearTimeout(room.game.pending);
        room.game.pending = undefined;
      }

      room.game.logger && logLine(room.game.logger, `WALL_EMPTY room=${roomId} turnSeat=${game.turnSeat}`);
      touch(room);
      io.to(roomId).emit("room:state", serializeRoom(room));
      io.to(roomId).emit("game:ended", { reason: "wall_empty" });

      return cb?.({ ok: false, error: "Wall empty" });
    }

    // Vinagames: choosing to draw means you have passed on the last discard ("bỏ ăn").
    // Only the next player (turnSeat) is bound by this for that discard.
    if (game.lastDiscard) {
      const passedTile = game.lastDiscard.tile;
      me.rules.forbiddenDiscardTiles.push(passedTile);
      audit(room, "PASS_DISCARD", { byPlayerId: playerId, bySeat: me.seat, tile: passedTile });
      // After drawing, you can no longer claim the prior discard; close the claim window.
      game.lastDiscard = null;
    }

    const tile = room.game.wall.shift()!;
    me.hand.push(tile);
    game.wallCount = room.game.wall.length;
    game.awaiting = "discard";
    touch(room);

    room.game.logger && logLine(room.game.logger, `DRAW seat=${me.seat} tile=${tile}`);
    audit(room, "DRAW", { byPlayerId: playerId, bySeat: me.seat, tile });

    io.to(roomId).emit("room:state", serializeRoom(room));
    socket.emit("game:private", toPrivateGameState({ game, playerId, lastDrawnTile: tile }));
    room.game.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });

    return cb?.({ ok: true, tile });
  });

  socket.on("game:discard", (raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const schema = z.object({ tile: z.string().min(1) });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: parsed.error.flatten() });

    const game = room.game.state;
    const me = game.players[playerId];
    if (!me) return cb?.({ ok: false, error: "Not a player" });
    if (game.phase !== "playing") return cb?.({ ok: false, error: "Not playing" });
    if (game.awaiting !== "discard") return cb?.({ ok: false, error: "Not awaiting discard" });
    if (me.seat !== game.turnSeat) return cb?.({ ok: false, error: "Not your turn" });

    const tile = parsed.data.tile as TileId;
    const idx = me.hand.indexOf(tile);
    if (idx < 0) return cb?.({ ok: false, error: "Tile not in hand" });

    // Vinagames "bỏ ăn" rule: if you ate or passed a tile before, you may not discard that tile later.
    if (me.rules.forbiddenDiscardTiles.includes(tile)) {
      audit(room, "DISCARD_REJECT", {
        byPlayerId: playerId,
        bySeat: me.seat,
        tile,
        reason: "cannot_discard_tile_you_ate_or_passed"
      });
      return cb?.({ ok: false, error: "Cannot discard a tile you previously ate or passed on" });
    }

    // Compute legal discards under the current rules.
    // If STRICT rules would deadlock the turn (no legal discards), we relax in a controlled way.
    const strictLegal = computeLegalDiscardTiles({ hand: me.hand, rules: me.rules });

    // Track discards by groupKey for "ăn/đánh cạ" rules.
    const gk = groupKey(tile);
    const existing = me.rules.discardedByGroup[gk] ?? [];

    // Vinagames: cấm đánh chắn (cannot discard a tile while still holding its identical pair).
    const sameCount = me.hand.filter(t => t === tile).length;
    const violatesChanRule = sameCount >= 2;

    // Vinagames: If you've ever eaten a cạ, you may not discard both sides of a cạ as trash.
    const violatesSecondInGroupRule = me.rules.hasEatenCaEver && existing.some(t => t !== tile);

    if (violatesChanRule || violatesSecondInGroupRule) {
      if (strictLegal.length > 0) {
        // Not a deadlock: enforce strict rules.
        if (violatesChanRule) {
          audit(room, "DISCARD_REJECT", {
            byPlayerId: playerId,
            bySeat: me.seat,
            tile,
            sameCount,
            reason: "cannot_discard_chan"
          });
          return cb?.({ ok: false, error: "Cannot discard a tile that forms a chắn (pair) in hand" });
        }
        if (violatesSecondInGroupRule) {
          audit(room, "DISCARD_REJECT", {
            byPlayerId: playerId,
            bySeat: me.seat,
            tile,
            group: gk,
            existing,
            reason: "cannot_discard_second_tile_in_group_after_eating_ca"
          });
          return cb?.({ ok: false, error: "Cannot discard both sides of a cạ after having eaten a cạ" });
        }
      }

      // Deadlock breaker:
      // 1) allow discarding a chan tile (breaking a pair)
      const relaxed1 = computeLegalDiscardTiles({ hand: me.hand, rules: me.rules, allowDiscardChan: true });
      if (relaxed1.includes(tile)) {
        room.game.logger && logLine(room.game.logger, `DEADLOCK_BREAK allowDiscardChan seat=${me.seat} tile=${tile}`);
        audit(room, "DEADLOCK_BREAK", { byPlayerId: playerId, bySeat: me.seat, tile, mode: "allow_discard_chan" });
      } else {
        // 2) as a last resort, also allow discarding a second distinct tile in a group after having eaten cạ.
        const relaxed2 = computeLegalDiscardTiles({
          hand: me.hand,
          rules: me.rules,
          allowDiscardChan: true,
          allowSecondTileInGroupAfterEatingCa: true
        });
        if (!relaxed2.includes(tile)) {
          // Still illegal even after relaxation.
          if (violatesChanRule) {
            audit(room, "DISCARD_REJECT", {
              byPlayerId: playerId,
              bySeat: me.seat,
              tile,
              sameCount,
              reason: "cannot_discard_chan"
            });
            return cb?.({ ok: false, error: "Cannot discard a tile that forms a chắn (pair) in hand" });
          }
          if (violatesSecondInGroupRule) {
            audit(room, "DISCARD_REJECT", {
              byPlayerId: playerId,
              bySeat: me.seat,
              tile,
              group: gk,
              existing,
              reason: "cannot_discard_second_tile_in_group_after_eating_ca"
            });
            return cb?.({ ok: false, error: "Cannot discard both sides of a cạ after having eaten a cạ" });
          }
        }

        room.game.logger && logLine(room.game.logger, `DEADLOCK_BREAK allowSecondInGroup seat=${me.seat} tile=${tile}`);
        audit(room, "DEADLOCK_BREAK", { byPlayerId: playerId, bySeat: me.seat, tile, mode: "allow_second_in_group_after_eating_ca" });
      }
    }

    // Apply discard now that all rules allow it.
    me.hand.splice(idx, 1);
    me.discards.push(tile);

    // Vinagames: once you discard a tile, you cannot eat that tile later.
    if (!me.rules.cannotEatTiles.includes(tile)) me.rules.cannotEatTiles.push(tile);

    if (!existing.includes(tile)) existing.push(tile);
    me.rules.discardedByGroup[gk] = existing;

    // If you have discarded both sides of a cạ in a group, later you may not ăn cạ in that group.
    if (existing.length >= 2 && !me.rules.noCaGroups.includes(gk)) me.rules.noCaGroups.push(gk);

    room.game.logger && logLine(room.game.logger, `DISCARD seat=${me.seat} tile=${tile}`);
    audit(room, "DISCARD", { byPlayerId: playerId, bySeat: me.seat, tile });

    // Record last discard so everyone can attempt Chíu.
    game.lastDiscard = { tile, fromPlayerId: playerId };
    auditClaimOptions(room, { when: "after_discard_before_advance_turn" });

    // Determine next seat in turn order.
    const seats = Object.values(game.players)
      .map(p => p.seat)
      .sort((a, b) => a - b);
    const i = seats.indexOf(game.turnSeat);
    const nextSeat = seats[(i + 1) % seats.length];
    // Next player must now draw manually (or attempt "ăn" under the current rule). 
    // Discard remains available for Chíu until the next discard happens.
    game.turnSeat = nextSeat;
    game.awaiting = "draw";
    touch(room);

    auditClaimOptions(room, { when: "after_advance_turn_awaiting_draw" });

    // No timer: Chíu can happen any time while lastDiscard is set.
    if (room.game.pending) {
      clearTimeout(room.game.pending);
      room.game.pending = undefined;
    }

    io.to(roomId).emit("room:state", serializeRoom(room));

    // Update private hand for the discarder
    socket.emit("game:private", toPrivateGameState({ game, playerId }));

    return cb?.({ ok: true });
  });

  socket.on("game:u", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const game = room.game.state;
    const me = game.players[playerId];
    if (!me) return cb?.({ ok: false, error: "Not a player" });
    if (game.phase !== "playing") return cb?.({ ok: false, error: "Not playing" });
    // Family rule: you declare Ù right after your draw (20 tiles) and before discarding.
    if (game.turnSeat !== me.seat) return cb?.({ ok: false, error: "Not your turn" });
    if (game.awaiting !== "discard") return cb?.({ ok: false, error: "You must be in discard step (after drawing)" });

    // Validate win using the same server evaluator used to enable the UI.
    const { isWinningHand } = require("./game/win") as typeof import("./game/win");
    if (!isWinningHand(me.hand)) {
      audit(room, "U_REJECT", { byPlayerId: playerId, bySeat: me.seat, reason: "hand_not_win" });
      return cb?.({ ok: false, error: "Hand is not a win" });
    }

    game.phase = "lobby";
    room.phase = "lobby";
    // Keep lastDiscard for audit? Clear it.
    game.lastDiscard = null;

    if (room.game.pending) {
      clearTimeout(room.game.pending);
      room.game.pending = undefined;
    }

    touch(room);
    io.to(roomId).emit("room:state", serializeRoom(room));
    audit(room, "U", { byPlayerId: playerId, bySeat: me.seat });
    io.to(roomId).emit("game:ended", { winnerSeat: me.seat, winnerName: room.playersById.get(playerId)?.nickname ?? "" });

    return cb?.({ ok: true });
  });

  socket.on("game:chiu", (_raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return cb?.({ ok: false, error: "Not in a room" });
    const room = rooms.get(roomId);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const game = room.game.state;
    if (game.phase !== "playing") return cb?.({ ok: false, error: "Not playing" });
    if (!game.lastDiscard) return cb?.({ ok: false, error: "No last discard" });

    const me = game.players[playerId];
    if (!me) return cb?.({ ok: false, error: "Not a player" });

    const tile = game.lastDiscard.tile;

    // Vinagames Chíu eligibility: you must have 3 copies of the *exact* tile.
    const exactCount = me.hand.filter(t => t === tile).length;
    if (exactCount < 3) {
      audit(room, "CHIU_REJECT", { byPlayerId: playerId, bySeat: me.seat, tile, have: exactCount, reason: "need_3_exact" });
      return cb?.({ ok: false, error: "Not eligible to chiu (need 3 identical in hand)" });
    }

    // Remove 3 exact tiles from hand
    let removed = 0;
    me.hand = me.hand.filter(t => {
      if (t === tile && removed < 3) {
        removed++;
        return false;
      }
      return true;
    });

    me.melds.push({ type: "chiu", tile });

    // Remove the discard from the discarder
    const fromId = game.lastDiscard.fromPlayerId;
    const from = game.players[fromId];
    if (from && from.discards[from.discards.length - 1] === tile) {
      from.discards.pop();
    }

    // Chíu takes the discard; chíu-ing player becomes the current turn and must discard.
    game.lastDiscard = null;
    game.turnSeat = me.seat;
    game.awaiting = "discard";
    if (room.game.pending) {
      clearTimeout(room.game.pending);
      room.game.pending = undefined;
    }

    room.game.logger && logLine(room.game.logger, `CHIU seat=${me.seat} tile=${tile}`);
    audit(room, "CHIU", { byPlayerId: playerId, bySeat: me.seat, tile });

    touch(room);
    io.to(roomId).emit("room:state", serializeRoom(room));
    room.game.logger && io.to(roomId).emit("game:log", { lines: room.game.logger.buffer });

    // Update privates
    socket.emit("game:private", toPrivateGameState({ game, playerId }));
    const fromSockId = room.playersById.get(fromId)?.socketId;
    const fromSock = fromSockId ? io.sockets.sockets.get(fromSockId) : undefined;
    fromSock?.emit("game:private", toPrivateGameState({ game, playerId: fromId }));

    return cb?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const p = room.playersById.get(playerId);
    if (p) {
      // Only mark offline if the disconnecting socket is the current owner.
      // (Prevents takeover from being immediately undone by the prior socket disconnect.)
      if (p.socketId === socket.id) {
        p.connected = false;
        p.socketId = undefined;
        touch(room);
        io.to(roomId).emit("room:state", serializeRoom(room));
      }
    }
  });
});

function serializeRoom(room: Room) {
  return {
    roomId: room.roomId,
    phase: room.phase,
    hostPlayerId: room.hostPlayerId ?? null,
    players: Array.from(room.playersById.values())
      .sort((a, b) => a.seat - b.seat)
      .map(p => ({ playerId: p.playerId, seat: p.seat, nickname: p.nickname, connected: p.connected })),
    publicGame: room.game
      ? toPublicGameState({
          game: room.game.state,
          nicknamesById: new Map(Array.from(room.playersById.values()).map(p => [p.playerId, p.nickname])),
          connectedById: new Map(Array.from(room.playersById.values()).map(p => [p.playerId, p.connected])),
          revealHands: Boolean(room.game.revealHands)
        })
      : null
  };
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
