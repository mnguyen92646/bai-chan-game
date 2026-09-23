import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { startGame, nextDealerSeat, toPrivateGameState, toPublicGameState } from "../../../packages/game/src/engine";
import { transition, type Action } from "../../../packages/game/src/round";
import { botAction, nextActor } from "../../../packages/game/src/practice";
import { makeChanDeck, type TileId } from "../../../packages/game/src/chanDeck";
import type { GameState } from "../../../packages/game/src/types";

const ROOM_TTL_MS = 8 * 60 * 60 * 1000;
const BOT_DELAY_MS = 1100;
const MAX_SOCKETS = 10;
const MAX_MESSAGE_BYTES = 4096;
const MAX_MESSAGES_PER_MINUTE = 60;
const TELEMETRY_ACTIONS = new Set(["draw", "pass", "chiu", "win", "an", "discard"]);
const validTiles = new Set<string>(makeChanDeck());

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  CREATE_LIMIT: RateLimit;
  CONNECT_LIMIT: RateLimit;
  WEB_ORIGINS: string;
}

type Player = {
  playerId: string;
  nickname: string;
  seat: number;
  connected: boolean;
  isBot?: boolean;
  token?: string;
};

type RoomData = {
  roomId: string;
  createdAt: number;
  lastActiveAt: number;
  hostPlayerId?: string;
  botOptions?: { fillBots: boolean; playerCount: 4 | 5 };
  phase: "lobby" | "playing";
  players: Player[];
  game?: { state: GameState; wall: TileId[]; log: string[] };
  botDueAt?: number;
};

type SocketInfo = { playerId?: string; windowStart: number; messages: number };
type ClientMessage = { id?: number; event: string; data?: unknown };
type Reply = { ok: boolean; error?: string; [key: string]: unknown };

const joinSchema = z.object({
  roomId: z.string().regex(/^room_[A-Za-z0-9_-]{22}$/),
  nickname: z.string().trim().min(1).max(32),
  token: z.string().max(128).optional(),
});
const optionsSchema = z.object({
  fillBots: z.boolean(),
  playerCount: z.union([z.literal(4), z.literal(5)]),
});
const actionSchema = z.object({
  handId: z.string().max(128),
  revision: z.number().int().nonnegative(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.enum(["draw", "pass", "chiu", "win"]) }),
    z.object({ type: z.enum(["an", "discard"]), tile: z.string().refine(tile => validTiles.has(tile)) }),
  ]),
});

function randomId(prefix: string, bytes = 16): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  const binary = String.fromCharCode(...values);
  return `${prefix}_${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

function json(data: unknown, status = 200, origin?: string): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  });
}

function permittedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return undefined;
  return env.WEB_ORIGINS.split(",").map(value => value.trim()).includes(origin) ? origin : undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true });

    const origin = request.headers.get("Origin");
    const allowed = permittedOrigin(request, env);
    if (origin && !allowed) return json({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowed ?? "",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }

    if (url.pathname === "/rooms" && request.method === "POST") {
      const key = `create:${request.headers.get("CF-Connecting-IP") ?? "local"}`;
      if (!(await env.CREATE_LIMIT.limit({ key })).success) return json({ error: "Too many rooms" }, 429, allowed);
      const roomId = randomId("room");
      const stub = env.ROOMS.getByName(roomId);
      const response = await stub.fetch(new Request("https://room.internal/init", { method: "POST", body: roomId }));
      if (!response.ok) return json({ error: "Could not create room" }, 500, allowed);
      return json({ roomId }, 200, allowed);
    }

    const match = url.pathname.match(/^\/rooms\/(room_[A-Za-z0-9_-]{22})\/ws$/);
    if (match && request.method === "GET") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "WebSocket required" }, 426, allowed);
      const key = `connect:${match[1]}:${request.headers.get("CF-Connecting-IP") ?? "local"}`;
      if (!(await env.CONNECT_LIMIT.limit({ key })).success) return json({ error: "Too many connections" }, 429, allowed);
      return env.ROOMS.getByName(match[1]).fetch(request);
    }
    return json({ error: "Not found" }, 404, allowed);
  },
} satisfies ExportedHandler<Env>;

export class RoomObject extends DurableObject<Env> {
  private room: RoomData | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)");
    const row = ctx.storage.sql.exec<{ payload: string }>("SELECT payload FROM room_state WHERE id = 1").toArray()[0];
    if (row) this.room = JSON.parse(row.payload) as RoomData;
  }

  private persist(): void {
    if (!this.room) return;
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO room_state (id, payload) VALUES (1, ?)", JSON.stringify(this.room));
  }

  private touch(): void {
    if (!this.room) return;
    this.room.lastActiveAt = Date.now();
    this.persist();
  }

  private socketsFor(playerId?: string): WebSocket[] {
    return this.ctx.getWebSockets().filter(ws => !playerId || (ws.deserializeAttachment() as SocketInfo | null)?.playerId === playerId);
  }

  private send(ws: WebSocket, event: string, data: unknown): void {
    try { ws.send(JSON.stringify({ event, data })); } catch { /* socket closed */ }
  }

  private broadcast(event: string, data: unknown): void {
    for (const ws of this.ctx.getWebSockets()) this.send(ws, event, data);
  }

  private reply(ws: WebSocket, id: number | undefined, data: Reply): void {
    if (id === undefined) return;
    try { ws.send(JSON.stringify({ ack: id, data })); } catch { /* socket closed */ }
  }

  private publicRoom(): unknown {
    const room = this.room!;
    const game = room.game
      ? toPublicGameState({
          game: room.game.state,
          nicknamesById: new Map(room.players.map(p => [p.playerId, p.nickname])),
          connectedById: new Map(room.players.map(p => [p.playerId, p.connected])),
          revealHands: false,
        })
      : null;
    return {
      roomId: room.roomId,
      phase: room.phase,
      hostPlayerId: room.hostPlayerId ?? null,
      botOptions: room.botOptions,
      players: room.players.slice().sort((a, b) => a.seat - b.seat).map(({ playerId, nickname, seat, connected, isBot }) => ({ playerId, nickname, seat, connected, isBot: !!isBot })),
      publicGame: game ? { ...game, players: game.players.map(p => ({ ...p, isBot: !!room.players.find(player => player.playerId === p.playerId)?.isBot })) } : null,
    };
  }

  private broadcastState(): void {
    this.broadcast("room:state", this.publicRoom());
  }

  private sendPrivate(): void {
    if (!this.room?.game) return;
    for (const player of this.room.players) {
      if (player.isBot) continue;
      const state = toPrivateGameState({ game: this.room.game.state, playerId: player.playerId });
      if (state) for (const ws of this.socketsFor(player.playerId)) this.send(ws, "game:private", state);
    }
  }

  private nextSeat(): number | null {
    const used = new Set(this.room!.players.map(p => p.seat));
    for (let seat = 1; seat <= 5; seat++) if (!used.has(seat)) return seat;
    return null;
  }

  private prepareSeats(raw: unknown): string | undefined {
    const room = this.room!;
    const parsed = optionsSchema.safeParse(raw ?? room.botOptions ?? { fillBots: false, playerCount: 4 });
    if (!parsed.success) return "Invalid table options";
    const options = parsed.data;
    const humans = room.players.filter(p => !p.isBot);
    if (humans.some(p => !p.connected)) return "Wait for disconnected players to rejoin.";
    if (options.fillBots ? humans.length < 2 : ![4, 5].includes(humans.length))
      return options.fillBots ? "Invite at least one other person to play with bots." : "Gather four or five players to start";
    if (options.fillBots && humans.length > options.playerCount) return "Choose a table large enough for everyone.";
    const target = options.fillBots ? options.playerCount : humans.length;
    const bots = room.players.filter(p => p.isBot).sort((a, b) => a.seat - b.seat);
    for (const bot of bots.slice(Math.max(0, target - humans.length))) room.players = room.players.filter(p => p !== bot);
    while (room.players.length < target) {
      const seat = this.nextSeat()!;
      const usedNames = new Set(room.players.map(p => p.nickname));
      const nickname = ["Lan", "Minh", "Mai", "Hương", "Nam"].find(name => !usedNames.has(name)) ?? `Bot ${seat}`;
      room.players.push({ playerId: randomId("bot"), nickname, seat, connected: true, isBot: true });
    }
    room.botOptions = options;
    this.persist();
  }

  private async schedule(): Promise<void> {
    if (!this.room) return;
    const room = this.room;
    room.botDueAt = undefined;
    if (room.phase === "playing" && room.game && room.players.some(p => !p.isBot && p.connected)) {
      const actor = nextActor({ game: room.game.state, wall: room.game.wall, log: [] });
      if (room.players.find(p => p.playerId === actor)?.isBot) room.botDueAt = Date.now() + BOT_DELAY_MS;
    }
    this.persist();
    await this.ctx.storage.setAlarm(Math.min(room.lastActiveAt + ROOM_TTL_MS, room.botDueAt ?? Infinity));
  }

  private async applyAction(playerId: string, action: Action): Promise<boolean> {
    const room = this.room!;
    if (!room.game || room.phase !== "playing") return false;
    const before = { game: room.game.state, wall: room.game.wall, log: [] as string[] };
    const after = transition(before, playerId, action, before.game.revision);
    if (after === before) return false;
    room.game.state = after.game;
    room.game.wall = after.wall;
    room.phase = after.game.phase;
    room.game.log.push(...after.log);
    room.game.log = room.game.log.slice(-100);
    this.touch();
    this.broadcastState();
    this.broadcast("game:log", { lines: room.game.log });
    this.sendPrivate();
    if (after.game.endReason) this.broadcast("game:ended", {
      reason: after.game.endReason,
      winnerSeat: after.game.winnerSeat,
      winnerName: room.players.find(p => p.seat === after.game.winnerSeat)?.nickname,
    });
    await this.schedule();
    return true;
  }

  private async startHand(): Promise<void> {
    const room = this.room!;
    const players = room.players.map(p => ({ playerId: p.playerId, seat: p.seat }));
    const dealerSeat = nextDealerSeat(room.game?.state, players, room.players.find(p => p.playerId === room.hostPlayerId)?.seat ?? 1);
    const { game, wall } = startGame({ players, dealerSeat });
    room.phase = "playing";
    room.game = { state: game, wall, log: [`GAME_START players=${players.length} dealerSeat=${dealerSeat}`] };
    this.touch();
    this.broadcastState();
    this.broadcast("game:log", { lines: room.game.log });
    this.sendPrivate();
    await this.schedule();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      if (this.room) return json({ error: "Already exists" }, 409);
      const roomId = await request.text();
      if (!/^room_[A-Za-z0-9_-]{22}$/.test(roomId)) return json({ error: "Invalid room" }, 400);
      this.room = { roomId, createdAt: Date.now(), lastActiveAt: Date.now(), phase: "lobby", players: [] };
      this.persist();
      await this.schedule();
      return json({ ok: true });
    }
    if (!this.room || Date.now() - this.room.lastActiveAt > ROOM_TTL_MS) return json({ error: "Room not found" }, 404);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "WebSocket required" }, 426);
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return json({ error: "Room connection limit reached" }, 429);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ windowStart: Date.now(), messages: 0 } satisfies SocketInfo);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.room) { ws.close(1008, "Room not found"); return; }
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) { ws.close(1009, "Message too large"); return; }
    const info = (ws.deserializeAttachment() as SocketInfo | null) ?? { windowStart: Date.now(), messages: 0 };
    if (Date.now() - info.windowStart >= 60_000) { info.windowStart = Date.now(); info.messages = 0; }
    info.messages++;
    ws.serializeAttachment(info);
    if (info.messages > MAX_MESSAGES_PER_MINUTE) { ws.close(1008, "Message rate exceeded"); return; }
    let input: ClientMessage;
    try { input = JSON.parse(message) as ClientMessage; } catch { ws.close(1007, "Invalid JSON"); return; }
    if (!input || typeof input.event !== "string" || input.event.length > 32 || (input.id !== undefined && (!Number.isInteger(input.id) || input.id < 0))) {
      ws.close(1007, "Invalid message"); return;
    }
    const startedAt = performance.now();
    try {
      const result = await this.handle(ws, info, input.event, input.data);
      if (input.event === "game:action") {
        const rawAction = input.data && typeof input.data === "object" && "action" in input.data ? input.data.action : undefined;
        const rawType = rawAction && typeof rawAction === "object" && "type" in rawAction ? rawAction.type : undefined;
        console.log(JSON.stringify({
          kind: "game_action",
          action: typeof rawType === "string" && TELEMETRY_ACTIONS.has(rawType) ? rawType : "invalid",
          ok: result.ok,
          durationMs: Math.round(performance.now() - startedAt),
          seats: this.room.players.length,
          ...(result.ok ? {} : { reason: result.error }),
        }));
      }
      this.reply(ws, input.id, result);
    } catch (error) {
      console.error(JSON.stringify({ kind: "room_message_error", event: input.event === "game:action" ? "game:action" : "other", errorType: error instanceof Error ? error.name : "unknown" }));
      this.reply(ws, input.id, { ok: false, error: "The table could not process that action." });
    }
  }

  private async handle(ws: WebSocket, info: SocketInfo, event: string, raw: unknown): Promise<Reply> {
    const room = this.room!;
    if (event === "room:join") {
      const parsed = joinSchema.safeParse(raw);
      if (!parsed.success || parsed.data.roomId !== room.roomId) return { ok: false, error: "Invalid invite" };
      const { nickname, token } = parsed.data;
      if (info.playerId && room.players.find(p => p.playerId === info.playerId)?.token !== token)
        return { ok: false, error: "This connection already has a seat" };
      let player = token ? room.players.find(p => !p.isBot && p.token === token) : undefined;
      if (player) {
        for (const prior of this.socketsFor(player.playerId)) if (prior !== ws) prior.close(1000, "Seat rejoined elsewhere");
        player.connected = true;
        player.nickname = nickname;
        info.playerId = player.playerId;
        ws.serializeAttachment(info);
        this.touch();
        this.broadcastState();
        if (room.game) {
          this.send(ws, "game:log", { lines: room.game.log });
          const privateState = toPrivateGameState({ game: room.game.state, playerId: player.playerId });
          if (privateState) this.send(ws, "game:private", privateState);
        }
        await this.schedule();
        return { ok: true, token, roomId: room.roomId, playerId: player.playerId, seat: player.seat, rejoined: true, isHost: room.hostPlayerId === player.playerId };
      }
      if (room.phase === "playing") return { ok: false, error: "This hand has started. Join after it finishes." };
      const replacement = room.players.find(p => p.isBot);
      const seat = replacement?.seat ?? this.nextSeat();
      if (!seat) return { ok: false, error: "Room full" };
      if (replacement) room.players = room.players.filter(p => p !== replacement);
      player = { playerId: randomId("p"), nickname, seat, connected: true, token: randomId("seat", 32) };
      room.players.push(player);
      if (room.botOptions && room.players.length > room.botOptions.playerCount) room.botOptions.playerCount = 5;
      if (!room.hostPlayerId) room.hostPlayerId = player.playerId;
      info.playerId = player.playerId;
      ws.serializeAttachment(info);
      this.touch();
      this.broadcastState();
      if (room.game) this.send(ws, "game:log", { lines: room.game.log });
      await this.schedule();
      return { ok: true, token: player.token, roomId: room.roomId, playerId: player.playerId, seat, rejoined: false, isHost: room.hostPlayerId === player.playerId };
    }
    const player = room.players.find(p => p.playerId === info.playerId && !p.isBot);
    if (!player || !player.connected) return { ok: false, error: "Not in a room" };
    if (event === "game:action") {
      if (!room.game) return { ok: false, error: "Game not started" };
      const parsed = actionSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "Invalid action" };
      if (parsed.data.handId !== room.game.state.handId || parsed.data.revision !== room.game.state.revision)
        return { ok: false, error: "The table changed. Try again." };
      return await this.applyAction(player.playerId, parsed.data.action as Action)
        ? { ok: true } : { ok: false, error: "That action is not available now." };
    }
    if (event === "game:start" || event === "game:restart" || event === "room:reset") {
      const host = room.players.find(p => p.playerId === room.hostPlayerId);
      if (room.hostPlayerId !== player.playerId && host?.connected) return { ok: false, error: "Only host can change the table" };
      if (!host?.connected) room.hostPlayerId = player.playerId;
      if (event === "room:reset") {
        for (const other of room.players) if (other.playerId !== player.playerId) {
          for (const socket of this.socketsFor(other.playerId)) {
            this.send(socket, "room:reset", { byPlayerId: player.playerId, byNickname: player.nickname, bySeat: player.seat });
            socket.close(1000, "Table reset");
          }
        }
        room.players = [player];
        player.seat = 1;
        room.phase = "lobby";
        room.game = undefined;
        room.botOptions = undefined;
        this.touch();
        this.broadcastState();
        await this.schedule();
        return { ok: true, token: player.token, seat: player.seat, playerId: player.playerId };
      }
      if (event === "game:start" && room.phase !== "lobby") return { ok: false, error: "Game already started" };
      const optionsError = this.prepareSeats(event === "game:start" && raw && typeof raw === "object" && Object.keys(raw).length ? raw : undefined);
      if (optionsError) return { ok: false, error: optionsError };
      if (event === "game:restart") this.broadcast("game:restarted", { byPlayerId: player.playerId, byNickname: player.nickname, bySeat: player.seat });
      await this.startHand();
      return { ok: true };
    }
    return { ok: false, error: "Unknown action" };
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* already closed */ }
    await this.disconnected(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.disconnected(ws);
  }

  private async disconnected(ws: WebSocket): Promise<void> {
    const id = (ws.deserializeAttachment() as SocketInfo | null)?.playerId;
    if (!id || !this.room) return;
    if (this.socketsFor(id).some(other => other !== ws)) return;
    const player = this.room.players.find(p => p.playerId === id);
    if (!player) return;
    player.connected = false;
    this.touch();
    this.broadcastState();
    await this.schedule();
  }

  async alarm(): Promise<void> {
    if (!this.room) return;
    if (Date.now() >= this.room.lastActiveAt + ROOM_TTL_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1001, "Room expired");
      this.ctx.storage.sql.exec("DELETE FROM room_state WHERE id = 1");
      this.room = undefined;
      return;
    }
    if (this.room.botDueAt && Date.now() >= this.room.botDueAt && this.room.game && this.room.phase === "playing" && this.room.players.some(p => !p.isBot && p.connected)) {
      const actor = nextActor({ game: this.room.game.state, wall: this.room.game.wall, log: [] });
      if (this.room.players.find(p => p.playerId === actor)?.isBot) {
        const action = botAction({ game: this.room.game.state, wall: this.room.game.wall, log: [] }, actor);
        if (await this.applyAction(actor, action)) return;
      }
    }
    await this.schedule();
  }
}
