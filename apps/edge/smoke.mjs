import assert from "node:assert/strict";

const base = process.env.EDGE_URL ?? "http://localhost:3102";
const created = await fetch(`${base}/rooms`, { method: "POST" });
assert.equal(created.status, 200);
const { roomId } = await created.json();
assert.match(roomId, /^room_[A-Za-z0-9_-]{22}$/);

function connect(id) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/rooms/${id}/ws`;
    const ws = new WebSocket(url);
    const events = [];
    const pending = new Map();
    let nextId = 1;
    const timer = setTimeout(() => reject(new Error(`WebSocket connect timed out: ${id}`)), 5000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve({
        ws,
        events,
        request(event, data = {}) {
          return new Promise((done, fail) => {
            const number = nextId++;
            pending.set(number, done);
            ws.send(JSON.stringify({ id: number, event, data }));
            setTimeout(() => { if (pending.delete(number)) fail(new Error(`${event} timed out`)); }, 5000);
          });
        },
      });
    }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`WebSocket rejected: ${id}`)); }, { once: true });
    ws.addEventListener("message", message => {
      const packet = JSON.parse(String(message.data));
      if (packet.ack !== undefined) {
        pending.get(packet.ack)?.(packet.data);
        pending.delete(packet.ack);
      } else events.push(packet);
    });
  });
}

await assert.rejects(connect("room_AAAAAAAAAAAAAAAAAAAAAA"), /rejected/);
const host = await connect(roomId);
const hostJoin = await host.request("room:join", { roomId, nickname: "Host" });
assert.equal(hostJoin.ok, true);
assert.ok(hostJoin.token);
const duplicateSeat = await host.request("room:join", { roomId, nickname: "Intruder" });
assert.equal(duplicateSeat.ok, false);
const guest = await connect(roomId);
const guestJoin = await guest.request("room:join", { roomId, nickname: "Guest" });
assert.equal(guestJoin.ok, true);
assert.notEqual(guestJoin.token, hostJoin.token);

const start = await host.request("game:start", { fillBots: true, playerCount: 4 });
assert.deepEqual(start, { ok: true });
const room = host.events.filter(packet => packet.event === "room:state").at(-1)?.data;
assert.equal(room?.phase, "playing");
assert.equal(room.players.length, 4);
assert.equal(room.players.filter(player => player.isBot).length, 2);
assert.equal(room.publicGame.players.every(player => !("hand" in player)), true);
assert.ok(host.events.some(packet => packet.event === "game:private"));
assert.ok(guest.events.some(packet => packet.event === "game:private"));
const guestPrivate = guest.events.find(packet => packet.event === "game:private")?.data;
assert.equal(guestPrivate?.you?.playerId, guestJoin.playerId);

const stale = await guest.request("game:action", { handId: "wrong", revision: 0, action: { type: "draw" } });
assert.equal(stale.ok, false);

guest.ws.close();
const returned = await connect(roomId);
const rejoin = await returned.request("room:join", { roomId, nickname: "Guest", token: guestJoin.token });
assert.equal(rejoin.ok, true);
assert.equal(rejoin.playerId, guestJoin.playerId);
assert.equal(rejoin.rejoined, true);
assert.ok(returned.events.some(packet => packet.event === "game:private"));
host.ws.close();
returned.ws.close();
const fiveCreated = await fetch(`${base}/rooms`, { method: "POST" });
assert.equal(fiveCreated.status, 200);
const { roomId: fiveRoomId } = await fiveCreated.json();
const fiveHost = await connect(fiveRoomId);
const fiveGuest = await connect(fiveRoomId);
assert.equal((await fiveHost.request("room:join", { roomId: fiveRoomId, nickname: "Five Host" })).ok, true);
assert.equal((await fiveGuest.request("room:join", { roomId: fiveRoomId, nickname: "Five Guest" })).ok, true);
assert.equal((await fiveHost.request("game:start", { fillBots: true, playerCount: 5 })).ok, true);
const fiveState = fiveHost.events.filter(packet => packet.event === "room:state").at(-1)?.data;
assert.equal(fiveState.players.length, 5);
assert.equal(fiveState.players.filter(player => player.isBot).length, 3);
assert.equal(fiveState.publicGame.players.every(player => !("hand" in player)), true);
fiveHost.ws.close();
fiveGuest.ws.close();
console.log(`Edge room smoke passed: ${roomId}`);
