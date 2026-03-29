import { makeChanDeck, shuffle, type TileId } from "./chanDeck";
import { groupKey } from "./win";

/** Seeded RNG (Mulberry32) */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

type Meld =
  | { type: "an"; kind: "chan" | "ca"; tiles: [TileId, TileId]; fromSeat: number }
  | { type: "chiu"; tile: TileId; fromSeat: number };

function meldTiles(m: Meld): TileId[] {
  if (m.type === "an") return [m.tiles[0], m.tiles[1]];
  return [m.tile, m.tile, m.tile, m.tile];
}

function ownedTiles(p: Player): TileId[] {
  const out: TileId[] = [];
  out.push(...p.hand);
  for (const m of p.melds) out.push(...meldTiles(m));
  return out;
}

function requiredPairsForPlayers(nPlayers: 4 | 5): number {
  // Based on Michael’s family rules:
  // - 5 players: win requires 8 pairs.
  // For 4 players we use the most logical extension (same structure): 10 pairs.
  return nPlayers === 5 ? 8 : 10;
}

function canPartitionIntoRoundGroups(tiles: TileId[]): boolean {
  // "Round" = groups of 4 compatible by category (groupKey)
  if (tiles.length % 4 !== 0) return false;
  const counts = new Map<string, number>();
  for (const t of tiles) {
    const k = groupKey(t);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [, c] of counts) if (c % 4 !== 0) return false;
  return true;
}

function isWinningOwnedTiles(all: TileId[], neededPairs: number): boolean {
  // Same structure as win.ts, but applied to the player’s full owned set (hand + visible melds).
  const byTile = new Map<TileId, number>();
  for (const t of all) byTile.set(t, (byTile.get(t) ?? 0) + 1);
  const tileIds = Array.from(byTile.keys()).sort();

  function dfs(idx: number, pairsTaken: number, remaining: Map<TileId, number>): boolean {
    if (pairsTaken === neededPairs) {
      const rest: TileId[] = [];
      for (const [t, c] of remaining) for (let i = 0; i < c; i++) rest.push(t);
      return canPartitionIntoRoundGroups(rest);
    }
    if (idx >= tileIds.length) return false;

    const t = tileIds[idx];
    const c = remaining.get(t) ?? 0;
    if (c >= 2) {
      remaining.set(t, c - 2);
      if (dfs(idx, pairsTaken + 1, remaining)) return true;
      remaining.set(t, c);
    }
    return dfs(idx + 1, pairsTaken, remaining);
  }

  return dfs(0, 0, new Map(byTile));
}

type PlayerRules = {
  // If you pass on eating a discard you were eligible to take, you cannot later
  // eat or discard that exact tile (typical "bỏ ăn" family).
  cannotEatTiles: TileId[];
  forbiddenDiscardTiles: TileId[];
};

type Player = {
  playerId: string;
  seat: number;
  hand: TileId[];
  discards: TileId[];
  melds: Meld[]; // visible on table
  rules: PlayerRules;
};

type Game = {
  phase: "playing" | "ended";
  turnSeat: number;
  awaiting: "draw" | "discard";
  lastDiscard: null | { tile: TileId; fromSeat: number; fromPlayerId: string };
  players: Player[];
  wall: TileId[];
  // table-visible tiles (discards + melds) are derived, but we cache counts for speed
  seenCounts: Map<TileId, number>;
};

function newGame(params: { nPlayers: 4 | 5; seed: number }) {
  const rng = mulberry32(params.seed);
  const deck = shuffle(makeChanDeck(), rng);

  const baseHand = params.nPlayers === 5 ? 19 : 23;
  const wallTarget = params.nPlayers === 5 ? 25 : 28;

  const players: Player[] = Array.from({ length: params.nPlayers }, (_, i) => ({
    playerId: `P${i + 1}`,
    seat: i + 1,
    hand: [],
    discards: [],
    melds: [],
    rules: { cannotEatTiles: [], forbiddenDiscardTiles: [] }
  }));

  for (const p of players) {
    p.hand = deck.splice(0, baseHand) as TileId[];
  }

  const wall = deck;
  assert(wall.length === wallTarget, `wall size mismatch: expected ${wallTarget}, got ${wall.length}`);

  const seenCounts = new Map<TileId, number>();

  const game: Game = {
    phase: "playing",
    turnSeat: 1,
    awaiting: "draw", // first player must draw
    lastDiscard: null,
    players,
    wall,
    seenCounts
  };

  return { game, rng, baseHand };
}

function incSeen(game: Game, t: TileId, n = 1) {
  game.seenCounts.set(t, (game.seenCounts.get(t) ?? 0) + n);
}

function decSeen(game: Game, t: TileId, n = 1) {
  game.seenCounts.set(t, (game.seenCounts.get(t) ?? 0) - n);
}

function totalTileCount(game: Game): number {
  let n = game.wall.length;
  for (const p of game.players) {
    n += p.hand.length;
    n += p.discards.length;
    for (const m of p.melds) {
      if (m.type === "an") n += 2;
      if (m.type === "chiu") n += 4;
    }
  }
  // lastDiscard is already part of discards pile
  return n;
}

function playerBySeat(game: Game, seat: number) {
  const p = game.players.find(x => x.seat === seat);
  assert(p, `missing player seat=${seat}`);
  return p;
}

function nextSeat(game: Game, seat: number) {
  const seats = game.players.map(p => p.seat).sort((a, b) => a - b);
  const i = seats.indexOf(seat);
  return seats[(i + 1) % seats.length];
}

function exactCount(hand: TileId[], t: TileId) {
  let c = 0;
  for (const x of hand) if (x === t) c++;
  return c;
}

function canChiu(hand: TileId[], discard: TileId) {
  // Must still have at least 1 tile left in hand to discard after claiming.
  return exactCount(hand, discard) >= 3 && hand.length - 3 >= 1;
}

function anEligibility(p: Player, discard: TileId) {
  if (p.rules.cannotEatTiles.includes(discard)) {
    return { eligible: false as const, reason: "cannot_eat_tile_you_passed_or_discarded" };
  }

  const canChan = p.hand.includes(discard);
  const k = groupKey(discard);
  const caTiles = Array.from(new Set(p.hand.filter(t => groupKey(t) === k && t !== discard)));

  const eligible = canChan || caTiles.length > 0;
  return eligible
    ? ({ eligible: true as const, canChan, caTiles } as const)
    : ({ eligible: false as const, reason: "no_match" } as const);
}

function countPairsInHand(hand: TileId[]): number {
  const m = new Map<TileId, number>();
  for (const t of hand) m.set(t, (m.get(t) ?? 0) + 1);
  let pairs = 0;
  for (const [, c] of m) pairs += Math.floor(c / 2);
  return pairs;
}

function remainingCopiesEstimate(game: Game, me: Player, tile: TileId): number {
  // 4 copies total.
  const inHand = exactCount(me.hand, tile);
  const seen = game.seenCounts.get(tile) ?? 0;
  // seen excludes my hand; it includes table-visible (discards, melds).
  const used = inHand + seen;
  return Math.max(0, 4 - used);
}

function chooseDiscard(game: Game, me: Player, baseHand: number, rng: () => number): TileId {
  // Heuristic: keep tiles that already form pairs, and tiles that have good chance to form pairs.
  // Discard tiles that:
  // - are forbidden to discard
  // - have 0 matching copies left (low future pair chance)
  // - are singletons in a crowded group

  const uniq = Array.from(new Set(me.hand));

  let best: { tile: TileId; score: number } | null = null;

  for (const t of uniq) {
    if (me.rules.forbiddenDiscardTiles.includes(t)) continue;

    const c = exactCount(me.hand, t);
    const rem = remainingCopiesEstimate(game, me, t);

    // Lower score => more disposable.
    // base: prefer discarding singletons
    let score = 0;

    // Keep pairs/triples; discarding from them reduces progress.
    if (c >= 2) score += 1000;

    // If no copies remain, it will never become a pair.
    if (rem === 0) score -= 200;

    // If only 1 copy remains, pairing is unlikely.
    if (rem === 1) score -= 50;

    // Group pressure: if I have many singles in the same group, toss the worst.
    const gk = groupKey(t);
    const groupTiles = me.hand.filter(x => groupKey(x) === gk);
    const distinctGroup = new Set(groupTiles);
    if (distinctGroup.size >= 3 && c === 1) score -= 20;

    // Prefer discarding tiles not aligned with last discard focus (minor)
    if (game.lastDiscard && groupKey(game.lastDiscard.tile) !== gk && c === 1) score -= 5;

    // Add tiny randomness to avoid deterministic loops
    score += rng() * 0.01;

    if (!best || score < best.score) best = { tile: t, score };
  }

  if (best) return best.tile;

  // If everything is forbidden (should be rare), discard a random tile (simulation fallback)
  return me.hand[Math.floor(rng() * me.hand.length)];
}

function applyDiscard(game: Game, me: Player, tile: TileId) {
  const idx = me.hand.indexOf(tile);
  if (idx < 0) {
    throw new Error(
      `tile not in hand seat=${me.seat} tile=${tile} hand=${JSON.stringify(me.hand)} uniq=${JSON.stringify(Array.from(new Set(me.hand)))} lastDiscard=${JSON.stringify(game.lastDiscard)}`
    );
  }

  me.hand.splice(idx, 1);
  me.discards.push(tile);
  incSeen(game, tile, 1);

  game.lastDiscard = { tile, fromSeat: me.seat, fromPlayerId: me.playerId };
  game.turnSeat = nextSeat(game, me.seat);
  game.awaiting = "draw"; // next player must choose an-or-draw, but we represent decision in logic
}

function applyDraw(game: Game, me: Player) {
  assert(game.wall.length > 0, "wall empty");
  const t = game.wall.shift()!;
  me.hand.push(t);
  game.awaiting = "discard";
  return t;
}

function applyAnChan(game: Game, me: Player, discardTile: TileId, fromSeat: number) {
  const idx = me.hand.indexOf(discardTile);
  assert(idx >= 0, "missing matching tile for an-chan");
  me.hand.splice(idx, 1);
  me.melds.push({ type: "an", kind: "chan", tiles: [discardTile, discardTile], fromSeat });
  // The claimed discard is already counted as seen; it remains on table but moves from discards->meld.
  // Remove from discarder discards pile
  const discarder = playerBySeat(game, fromSeat);
  if (discarder.discards[discarder.discards.length - 1] === discardTile) {
    discarder.discards.pop();
    // seen count stays the same (tile remains visible on table)
  }

  game.lastDiscard = null;
  game.turnSeat = me.seat;
  game.awaiting = "discard";
}

function applyChiu(game: Game, chiuPlayer: Player, discardTile: TileId, fromSeat: number) {
  // Remove 3 tiles from hand, plus take the discard => meld of 4.
  let removed = 0;
  chiuPlayer.hand = chiuPlayer.hand.filter(t => {
    if (t === discardTile && removed < 3) {
      removed++;
      return false;
    }
    return true;
  });
  assert(removed === 3, "failed to remove 3 for chiu");

  chiuPlayer.melds.push({ type: "chiu", tile: discardTile, fromSeat });

  const discarder = playerBySeat(game, fromSeat);
  if (discarder.discards[discarder.discards.length - 1] === discardTile) {
    discarder.discards.pop();
  }

  game.lastDiscard = null;
  game.turnSeat = chiuPlayer.seat;
  game.awaiting = "discard";
}

function simulateOneGame(seed: number, nPlayers: 4 | 5) {
  const { game, rng, baseHand } = newGame({ nPlayers, seed });

  const TOTAL = 120;
  assert(totalTileCount(game) === TOTAL, "tile conservation at start");

  const neededPairs = requiredPairsForPlayers(nPlayers);

  const stats = {
    steps: 0,
    draws: 0,
    discards: 0,
    anChan: 0,
    chiu: 0,
    wins: 0,
    wallEmpty: 0
  };

  const MAX_STEPS = 200_000;

  while (game.phase === "playing" && stats.steps++ < MAX_STEPS) {
    assert(totalTileCount(game) === TOTAL, `tile conservation step=${stats.steps}`);

    // Chíu interrupt: if there is a last discard, any player with 3 can claim.
    // First-click-wins: we model reaction time as rng jitter.
    if (game.lastDiscard) {
      const d = game.lastDiscard.tile;
      const fromSeat = game.lastDiscard.fromSeat;

      const claimers = game.players
        .filter(p => canChiu(p.hand, d))
        .map(p => ({ p, t: rng() }))
        .sort((a, b) => a.t - b.t);

      if (claimers.length) {
        const winner = claimers[0].p;
        applyChiu(game, winner, d, fromSeat);
        stats.chiu++;

        // Win can happen immediately after chíu (you can Ù any time).
        if (isWinningOwnedTiles(ownedTiles(winner), neededPairs)) {
          game.phase = "ended";
          stats.wins++;
          break;
        }

        // After chiu, the chiu player must discard.
        continue;
      }
    }

    const me = playerBySeat(game, game.turnSeat);

    if (game.awaiting === "draw") {
      // If there is a discard, this is the "ăn-or-draw" decision for the next player.
      if (game.lastDiscard) {
        const d = game.lastDiscard.tile;
        const fromSeat = game.lastDiscard.fromSeat;

        const elig = anEligibility(me, d);
        if (elig.eligible) {
          // Decide to take or pass.
          // Heuristic: take if it completes an exact pair (ăn chắn). Otherwise pass.
          if (elig.canChan && me.hand.length - 1 >= 1 && rng() < 0.92) {
            applyAnChan(game, me, d, fromSeat);
            stats.anChan++;

            // Win can happen immediately after ăn.
            if (isWinningOwnedTiles(ownedTiles(me), neededPairs)) {
              game.phase = "ended";
              stats.wins++;
              break;
            }

            continue;
          }

          // Passing on an eligible eat triggers "bỏ ăn" restriction.
          if (!me.rules.cannotEatTiles.includes(d)) me.rules.cannotEatTiles.push(d);
          if (!me.rules.forbiddenDiscardTiles.includes(d)) me.rules.forbiddenDiscardTiles.push(d);
          // And then draw.
        }
        // If not eligible: must draw.
      }

      if (game.wall.length === 0) {
        game.phase = "ended";
        stats.wallEmpty++;
        break;
      }

      applyDraw(game, me);
      stats.draws++;

      // Win check after draw
      if (isWinningOwnedTiles(ownedTiles(me), neededPairs)) {
        game.phase = "ended";
        stats.wins++;
        break;
      }

      continue;
    }

    if (game.awaiting === "discard") {
      const tile = chooseDiscard(game, me, baseHand, rng);
      applyDiscard(game, me, tile);
      stats.discards++;

      // Enforce hand cap: in this ruleset, after drawing you must discard down to baseHand.
      // Our state machine draws exactly 1 then discards exactly 1, so it stays capped.
      assert(me.hand.length <= baseHand, `hand over cap seat=${me.seat} len=${me.hand.length} cap=${baseHand}`);

      continue;
    }
  }

  return stats;
}

function main() {
  const N = Number(process.env.N ?? 20000);
  const seed = Number(process.env.SEED ?? 1);
  const nPlayers = (Number(process.env.P ?? 5) === 4 ? 4 : 5) as 4 | 5;

  const agg = {
    games: 0,
    steps: 0,
    draws: 0,
    discards: 0,
    anChan: 0,
    chiu: 0,
    wins: 0,
    wallEmpty: 0
  };

  for (let i = 0; i < N; i++) {
    const s = simulateOneGame(seed + i, nPlayers);
    agg.games++;
    agg.steps += s.steps;
    agg.draws += s.draws;
    agg.discards += s.discards;
    agg.anChan += s.anChan;
    agg.chiu += s.chiu;
    agg.wins += s.wins;
    agg.wallEmpty += s.wallEmpty;
  }

  console.log(
    JSON.stringify(
      {
        N: agg.games,
        P: nPlayers,
        avgSteps: agg.steps / agg.games,
        totals: {
          draws: agg.draws,
          discards: agg.discards,
          anChan: agg.anChan,
          chiu: agg.chiu,
          wins: agg.wins,
          wallEmpty: agg.wallEmpty
        }
      },
      null,
      2
    )
  );
}

main();
