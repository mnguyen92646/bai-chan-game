import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT ?? 3001);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
if (IS_PRODUCTION && Buffer.byteLength(JWT_SECRET) < 32) {
  throw new Error("Production requires JWT_SECRET with at least 32 bytes.");
}
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  credentials: true
};

import type { GameState } from "./game/types";
import { startGame, nextDealerSeat, toPrivateGameState, toPublicGameState } from "./game/engine";
import type { TileId } from "./game/chanDeck";
import { transition, type Action } from "../../../packages/game/src/round";
import { botAction, nextActor } from "../../../packages/game/src/practice";
import { makeChanDeck } from "./game/chanDeck";

import { newLogger, logLine, type GameLogger } from "./game/logger";
import { newPrivateLog, logJsonl, type PrivateGameLog } from "./game/privateLog";

type Room = {
  roomId: string;
  createdAt: number;
  lastActiveAt: number;
  hostPlayerId?: string;
  botOptions?: { fillBots: boolean; playerCount: 4 | 5 };
  phase: "lobby" | "playing";
  playersById: Map<
    string,
    {
      playerId: string;
      nickname: string;
      seat: number;
      connected: boolean;
      isBot?: boolean;
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
    handId: g.handId,
    revision: g.revision,
    profile: g.profile,
    reaction: g.reaction,
    returnSeat: g.returnSeat,
    endReason: g.endReason,
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

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}

function getOrCreateRoom(roomId?: string): Room {
  let id = roomId;
  if (!id) {
    // A room ID is a bearer invitation: do not use a guessable short code.
    for (let i = 0; i < 25; i++) {
      const candidate = makeId("room");
      if (!rooms.has(candidate)) {
        id = candidate;
        break;
      }
    }
    if (!id) throw new Error("Could not allocate a room ID");
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
    if (t - room.lastActiveAt > ROOM_TTL_MS) {
      if (room.game?.pending) clearTimeout(room.game.pending);
      rooms.delete(roomId);
    }
  }
}
setInterval(pruneRooms, 60_000).unref();

const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: "8kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/rooms", (_req, res) => {
  const room = getOrCreateRoom();
  res.json({ roomId: room.roomId });
});

// Single-table mode: always use one shared room.
const DEFAULT_ROOM_ID = process.env.DEFAULT_ROOM_ID ?? "000000";
app.get("/room/default", (_req, res) => {
  if (IS_PRODUCTION) return res.sendStatus(404);
  const room = getOrCreateRoom(DEFAULT_ROOM_ID);
  res.json({ roomId: room.roomId });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

const JoinSchema = z.object({
  roomId: z.string().min(1).max(64),
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

const BotOptionsSchema = z.object({ fillBots: z.boolean(), playerCount: z.union([z.literal(4), z.literal(5)]) });
const BOT_DELAY_MS = Math.max(10, Number(process.env.BOT_DELAY_MS) || 1100);

/** Configure seats only at a hand boundary; never replace a disconnected human. */
function prepareSeats(room: Room, raw: unknown): string | undefined {
  const parsed = BotOptionsSchema.safeParse(raw ?? room.botOptions ?? { fillBots: false, playerCount: 4 });
  if (!parsed.success) return "Invalid table options";
  const options = parsed.data;
  const humans = [...room.playersById.values()].filter(p => !p.isBot);
  if (humans.some(p => !p.connected)) return "Wait for disconnected players to rejoin.";
  if (options.fillBots ? humans.length < 2 : ![4, 5].includes(humans.length))
    return options.fillBots ? "Invite at least one other person to play with bots." : "Gather four or five players to start";
  if (options.fillBots && humans.length > options.playerCount) return "Choose a table large enough for everyone.";
  const target = options.fillBots ? options.playerCount : humans.length;
  // Keep existing bot identities/seats for rematches, including a bot who won.
  const bots = [...room.playersById.values()].filter(p => p.isBot).sort((a,b) => a.seat - b.seat);
  for (const bot of bots.slice(Math.max(0, target - humans.length))) room.playersById.delete(bot.playerId);
  while (room.playersById.size < target) {
    const seat = nextAvailableSeat(room)!;
    const playerId = makeId("bot");
    const usedNames = new Set([...room.playersById.values()].map(p => p.nickname));
    const nickname = ["Lan", "Minh", "Mai", "Hương", "Nam"].find(name => !usedNames.has(name)) ?? `Bot ${seat}`;
    room.playersById.set(playerId, { playerId, seat, nickname, connected: true, isBot: true });
  }
  room.botOptions = options;
}

/** Humans and bots share validation, public/private broadcasts and the audit trail. */
function applyAction(room: Room, playerId: string, action: Action): boolean {
  if (!room.game || room.phase !== "playing") return false;
  const before = { game: room.game.state, wall: room.game.wall, log: [] as string[] };
  const after = transition(before, playerId, action, before.game.revision);
  if (after === before) return false;
  room.game.state = after.game; room.game.wall = after.wall;
  room.phase = after.game.phase;
  for (const line of after.log) if (room.game.logger) logLine(room.game.logger, line);
  audit(room, "ACTION", { byPlayerId: playerId, isBot: !!room.playersById.get(playerId)?.isBot, action, revision: after.game.revision, fromPhase: before.game.awaiting, source: before.game.reaction?.source, activeTile: before.game.lastDiscard?.tile });
  touch(room);
  io.to(room.roomId).emit("room:state", serializeRoom(room));
  if (room.game.logger) io.to(room.roomId).emit("game:log", { lines: room.game.logger.buffer });
  for (const p of room.playersById.values()) {
    if (p.socketId) io.sockets.sockets.get(p.socketId)?.emit("game:private", toPrivateGameState({ game: after.game, playerId: p.playerId }));
  }
  if (after.game.endReason) io.to(room.roomId).emit("game:ended", {
    reason: after.game.endReason, winnerSeat: after.game.winnerSeat,
    winnerName: [...room.playersById.values()].find(p => p.seat === after.game.winnerSeat)?.nickname,
  });
  scheduleBot(room);
  return true;
}

function scheduleBot(room: Room) {
  const hand = room.game;
  if (!hand) return;
  if (hand.pending) clearTimeout(hand.pending);
  hand.pending = undefined;
  if (room.phase !== "playing" || ![...room.playersById.values()].some(p => !p.isBot && p.connected)) return;
  const actor = nextActor({ game: hand.state, wall: hand.wall, log: [] });
  if (!room.playersById.get(actor)?.isBot) return;
  const revision = hand.state.revision;
  hand.pending = setTimeout(() => {
    hand.pending = undefined;
    if (rooms.get(room.roomId) !== room || room.game !== hand || hand.state.revision !== revision || room.phase !== "playing") return;
    if (![...room.playersById.values()].some(p => !p.isBot && p.connected)) return;
    const action = botAction({ game: hand.state, wall: hand.wall, log: [] }, actor);
    if (!applyAction(room, actor, action)) audit(room, "BOT_ACTION_REJECTED", { byPlayerId: actor, action });
  }, BOT_DELAY_MS);
  hand.pending.unref();
}

io.on("connection", (socket) => {
  socket.on("room:join", (raw, cb) => {
    const parsed = JoinSchema.safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: parsed.error.flatten() });

    const { roomId, nickname, token } = parsed.data;
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found. Ask the host for an invite link." });
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

          scheduleBot(room);
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

    if (room.phase === "playing") return cb?.({ ok: false, error: "This hand has started. Join after it finishes." });

    // New join path
    const replacement = [...room.playersById.values()].find(p => p.isBot);
    const seat = replacement?.seat ?? nextAvailableSeat(room);
    if (!seat) return cb?.({ ok: false, error: "Room full" });

    if (replacement) room.playersById.delete(replacement.playerId);
    const playerId = makeId("p");
    room.playersById.set(playerId, { playerId, nickname, seat, connected: true, socketId: socket.id });

    if (room.botOptions && room.playersById.size > room.botOptions.playerCount) room.botOptions.playerCount = 5;

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

  socket.on("game:start", (raw, cb) => {
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

    const optionsError = prepareSeats(room, raw && Object.keys(raw).length ? raw : undefined);
    if (optionsError) return cb?.({ ok: false, error: optionsError });

    // Shuffle + deal + first turn.
    const players = Array.from(room.playersById.values()).map(p => ({ playerId: p.playerId, seat: p.seat }));
    // The previous winner opens; retain the host fallback after a draw.
    const dealerSeat = nextDealerSeat(room.game?.state, [...room.playersById.values()], room.playersById.get(room.hostPlayerId!)?.seat ?? 1);

    if (![4, 5].includes(players.length)) return cb?.({ ok: false, error: "Gather four or five players to start" });
    const { game, wall } = startGame({ players, dealerSeat });
    room.phase = "playing";

    // Rotate per-game log
    const gameId = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = process.env.LOGS_DIR ?? new URL("../logs", import.meta.url).pathname;
    const logger = newLogger({ logsDir, roomId, gameId });
    const privateLog = newPrivateLog({ logsDir, roomId, gameId });
    logLine(logger, `GAME_START room=${roomId} players=${players.length} dealerSeat=${dealerSeat}`);

    if (room.game?.pending) clearTimeout(room.game.pending);
    room.game = { state: game, wall, logger, privateLog, gameId };
    scheduleBot(room);
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

    const optionsError = prepareSeats(room, undefined);
    if (optionsError) return cb?.({ ok: false, error: optionsError });

    // Start a fresh game immediately with the same currently-seated players.
    const players = Array.from(room.playersById.values()).map(p => ({ playerId: p.playerId, seat: p.seat }));
    const dealerSeat = nextDealerSeat(room.game?.state, players, room.playersById.get(room.hostPlayerId!)?.seat ?? 1);

    if (![4, 5].includes(players.length)) return cb?.({ ok: false, error: "Gather four or five players to start" });
    const { game, wall } = startGame({ players, dealerSeat });
    room.phase = "playing";

    // Rotate per-game log
    const gameId = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = process.env.LOGS_DIR ?? new URL("../logs", import.meta.url).pathname;
    const logger = newLogger({ logsDir, roomId, gameId });
    const privateLog = newPrivateLog({ logsDir, roomId, gameId });
    logLine(logger, `GAME_RESTART room=${roomId} players=${players.length} dealerSeat=${dealerSeat}`);

    if (room.game?.pending) clearTimeout(room.game.pending);
    room.game = { state: game, wall, logger, privateLog, gameId };
    scheduleBot(room);
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
    if (room.game?.pending) clearTimeout(room.game.pending);
    room.game = undefined;
    room.botOptions = undefined;
    touch(room);

    const newToken = signToken({ roomId, playerId, seat: me.seat, nickname: me.nickname });

    io.to(roomId).emit("room:state", serializeRoom(room));
    io.to(roomId).emit("room:reset", { byPlayerId: playerId, byNickname: me.nickname, bySeat: me.seat });

    return cb?.({ ok: true, token: newToken, seat: me.seat, playerId });
  });

  // Manual draw (required after a discard unless the player chíu's).
  socket.on("debug:revealHands", (raw, cb) => {
    if (IS_PRODUCTION) return cb?.({ ok: false, error: "Unavailable" });
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

  socket.on("game:action", (raw, cb) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    const room = roomId ? rooms.get(roomId) : undefined;
    if (!room?.game || !playerId) return cb?.({ ok: false, error: "Game not started" });
    const parsed = z.object({
      handId: z.string(), revision: z.number().int().nonnegative(),
      action: z.discriminatedUnion("type", [
        z.object({ type: z.enum(["draw", "pass", "chiu", "win"]) }),
        z.object({ type: z.enum(["an", "discard"]), tile: z.string().refine(t => (makeChanDeck() as string[]).includes(t)) }),
      ]),
    }).safeParse(raw);
    if (!parsed.success) return cb?.({ ok: false, error: "Invalid action" });
    if (parsed.data.handId !== room.game.state.handId || parsed.data.revision !== room.game.state.revision)
      return cb?.({ ok: false, error: "The table changed. Try again." });
    if (!applyAction(room, playerId, parsed.data.action as Action))
      return cb?.({ ok: false, error: "That action is not available now." });
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
        scheduleBot(room);
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
    botOptions: room.botOptions,
    players: Array.from(room.playersById.values())
      .sort((a, b) => a.seat - b.seat)
      .map(p => ({ playerId: p.playerId, seat: p.seat, nickname: p.nickname, connected: p.connected, isBot: !!p.isBot })),
    publicGame: room.game
      ? publicGameWithBots(room)
      : null
  };
}

function publicGameWithBots(room: Room) {
  const game = toPublicGameState({
    game: room.game!.state,
    nicknamesById: new Map(Array.from(room.playersById.values()).map(p => [p.playerId, p.nickname])),
    connectedById: new Map(Array.from(room.playersById.values()).map(p => [p.playerId, p.connected])),
    revealHands: Boolean(room.game!.revealHands)
  });
  return { ...game, players: game.players.map(p => ({ ...p, isBot: !!room.playersById.get(p.playerId)?.isBot })) };
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
