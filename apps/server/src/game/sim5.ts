import { startGame } from "./engine";
import type { GameState } from "./types";
import type { TileId } from "./chanDeck";
import { groupKey, isWinningHand } from "./win";

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

function meldTileCount(m: any): number {
  if (m.type === "chiu") return 4;
  if (m.type === "an") return 2;
  return 0;
}

function totalTiles(state: GameState, wall: TileId[]): number {
  // NOTE: lastDiscard is just a pointer to the most recent tile already sitting
  // in the discarder’s discards pile (unless claimed, in which case it is popped).
  // So it should NOT be counted as an additional tile.
  let n = wall.length;
  for (const p of Object.values(state.players)) {
    n += p.hand.length;
    n += p.discards.length;
    for (const m of p.melds) n += meldTileCount(m);
  }
  return n;
}

function computeChiuEligibility(hand: TileId[], discardTile: TileId) {
  const exactCount = hand.filter(t => t === discardTile).length;
  return exactCount >= 3;
}

function computeAnEligibility(params: {
  meHand: TileId[];
  discardTile: TileId;
  cannotEatTiles?: TileId[];
  noCaGroups?: string[];
}) {
  const { meHand, discardTile } = params;
  if (params.cannotEatTiles?.includes(discardTile)) {
    return { eligible: false as const, reason: "cannot_eat_tile_you_discarded" };
  }

  const canChan = meHand.includes(discardTile);
  const k = groupKey(discardTile);

  const distinctInGroup = Array.from(new Set(meHand.filter(t => groupKey(t) === k)));
  const alreadyHasCaInGroup = distinctInGroup.length >= 2;
  const caBannedByHistory = params.noCaGroups?.includes(k) ?? false;

  const caTiles = alreadyHasCaInGroup || caBannedByHistory
    ? ([] as TileId[])
    : (Array.from(new Set(meHand.filter(t => groupKey(t) === k && t !== discardTile))) as TileId[]);

  if (!canChan && caTiles.length === 0) {
    return {
      eligible: false as const,
      reason: alreadyHasCaInGroup
        ? "already_has_ca_in_group"
        : caBannedByHistory
          ? "ca_banned_by_discard_history"
          : "no_matching_for_chan_or_ca"
    };
  }

  return {
    eligible: true as const,
    canChan,
    caTiles,
    mustPreferChan: canChan && caTiles.length > 0
  };
}

function legalDiscards(
  p: GameState["players"][string],
  opts?: {
    allowDiscardChan?: boolean;
    allowSecondTileInGroupAfterEatingCa?: boolean;
    ignoreForbiddenDiscardTiles?: boolean;
  }
) {
  const uniq = Array.from(new Set(p.hand));
  const legal: TileId[] = [];

  for (const tile of uniq) {
    if (!opts?.ignoreForbiddenDiscardTiles && p.rules.forbiddenDiscardTiles.includes(tile)) continue;

    const sameCount = p.hand.filter(t => t === tile).length;
    if (!opts?.allowDiscardChan && sameCount >= 2) continue;

    const gk = groupKey(tile);
    const existing = p.rules.discardedByGroup[gk] ?? [];
    if (
      p.rules.hasEatenCaEver &&
      !opts?.allowSecondTileInGroupAfterEatingCa &&
      existing.some(t => t !== tile)
    ) {
      continue;
    }

    legal.push(tile);
  }

  return legal;
}

function applyDiscard(
  state: GameState,
  wall: TileId[],
  playerId: string,
  tile: TileId,
  opts?: {
    allowDiscardChan?: boolean;
    allowSecondTileInGroupAfterEatingCa?: boolean;
    ignoreForbiddenDiscardTiles?: boolean;
  }
) {
  const me = state.players[playerId];
  assert(me, "missing player");
  assert(state.phase === "playing", "not playing");
  assert(state.awaiting === "discard", "not awaiting discard");
  assert(me.seat === state.turnSeat, "not your turn");

  const idx = me.hand.indexOf(tile);
  assert(idx >= 0, "tile not in hand");
  if (!opts?.ignoreForbiddenDiscardTiles) {
    assert(!me.rules.forbiddenDiscardTiles.includes(tile), "forbidden discard tile");
  }
  const sameCount = me.hand.filter(t => t === tile).length;
  if (!opts?.allowDiscardChan) assert(sameCount < 2, "cannot discard chan");

  const gk = groupKey(tile);
  const existing = me.rules.discardedByGroup[gk] ?? [];
  if (!opts?.allowSecondTileInGroupAfterEatingCa) {
    assert(
      !(me.rules.hasEatenCaEver && existing.some(t => t !== tile)),
      "cannot discard second tile in group after eating ca"
    );
  }

  me.hand.splice(idx, 1);
  me.discards.push(tile);
  if (!me.rules.cannotEatTiles.includes(tile)) me.rules.cannotEatTiles.push(tile);
  if (!existing.includes(tile)) existing.push(tile);
  me.rules.discardedByGroup[gk] = existing;
  if (existing.length >= 2 && !me.rules.noCaGroups.includes(gk)) me.rules.noCaGroups.push(gk);

  state.lastDiscard = { tile, fromPlayerId: playerId };

  // Advance turn to next seat.
  const seats = Object.values(state.players).map(p => p.seat).sort((a, b) => a - b);
  const i = seats.indexOf(state.turnSeat);
  const nextSeat = seats[(i + 1) % seats.length];
  state.turnSeat = nextSeat;
  state.awaiting = "draw";
  state.wallCount = wall.length;
}

function applyDraw(state: GameState, wall: TileId[], playerId: string, rng: () => number) {
  const me = state.players[playerId];
  assert(me, "missing player");
  assert(state.phase === "playing", "not playing");
  assert(state.awaiting === "draw", "not awaiting draw");
  assert(me.seat === state.turnSeat, "not your turn");

  if (wall.length === 0) {
    state.phase = "lobby";
    state.lastDiscard = null;
    return { ok: false as const, reason: "wall_empty" };
  }

  // Passing on last discard binds forbiddenDiscardTiles (only for the current next player).
  if (state.lastDiscard) {
    me.rules.forbiddenDiscardTiles.push(state.lastDiscard.tile);
    state.lastDiscard = null;
  }

  const tile = wall.shift()!;
  me.hand.push(tile);
  state.wallCount = wall.length;
  state.awaiting = "discard";

  // Family rule: auto-declare win if you have it (so we can exercise win evaluator).
  if (isWinningHand(me.hand)) {
    state.phase = "lobby";
    state.lastDiscard = null;
    return { ok: false as const, reason: "win", winnerPlayerId: playerId };
  }

  // Small randomness: sometimes immediately discard the drawn tile if legal (exercises that path)
  if (rng() < 0.15 && legalDiscards(me).includes(tile)) {
    applyDiscard(state, wall, playerId, tile);
    return { ok: true as const, drew: tile, autoDiscarded: tile };
  }

  return { ok: true as const, drew: tile };
}

function applyAn(state: GameState, wall: TileId[], playerId: string, kind?: "chan" | "ca", withTile?: TileId) {
  const me = state.players[playerId];
  assert(me, "missing player");
  assert(state.phase === "playing", "not playing");
  assert(state.awaiting === "draw", "not awaiting draw");
  assert(me.seat === state.turnSeat, "not your turn");
  assert(state.lastDiscard, "no last discard");
  assert(state.lastDiscard.fromPlayerId !== playerId, "cannot an your own discard");

  const discardTile = state.lastDiscard.tile;
  const fromId = state.lastDiscard.fromPlayerId;
  const fromSeat = state.players[fromId]?.seat ?? -1;

  const elig = computeAnEligibility({
    meHand: me.hand,
    discardTile,
    cannotEatTiles: me.rules.cannotEatTiles,
    noCaGroups: me.rules.noCaGroups
  });
  assert(elig.eligible === true, `not eligible to an: ${"reason" in elig ? (elig as any).reason : ""}`);

  const resolvedKind: "chan" | "ca" = kind ?? (elig.canChan ? "chan" : "ca");
  if (resolvedKind === "ca") assert(!elig.mustPreferChan, "must prefer chan");

  if (resolvedKind === "chan") {
    const idx = me.hand.indexOf(discardTile);
    assert(idx >= 0, "missing matching tile for chan");
    me.hand.splice(idx, 1);
    me.melds.push({ type: "an", kind: "chan", tiles: [discardTile, discardTile], fromSeat });
    me.rules.forbiddenDiscardTiles.push(discardTile);
  } else {
    const chosen = withTile ?? elig.caTiles[0];
    assert(chosen, "missing withTile");
    assert(chosen !== discardTile, "withTile equals discard");
    assert(groupKey(chosen) === groupKey(discardTile), "withTile not compatible");
    const idx = me.hand.indexOf(chosen);
    assert(idx >= 0, "withTile not in hand");
    me.hand.splice(idx, 1);
    me.melds.push({ type: "an", kind: "ca", tiles: [discardTile, chosen], fromSeat });
    me.rules.forbiddenDiscardTiles.push(discardTile);
    me.rules.hasEatenCaEver = true;
  }

  // Remove from discarder pile if last tile.
  const from = state.players[fromId];
  if (from && from.discards[from.discards.length - 1] === discardTile) from.discards.pop();

  state.lastDiscard = null;
  state.turnSeat = me.seat;
  state.awaiting = "discard";
  state.wallCount = wall.length;
}

function applyChiu(state: GameState, wall: TileId[], playerId: string) {
  const me = state.players[playerId];
  assert(me, "missing player");
  assert(state.phase === "playing", "not playing");
  assert(state.lastDiscard, "no last discard");

  const tile = state.lastDiscard.tile;
  assert(computeChiuEligibility(me.hand, tile), "not eligible to chiu");

  // Remove 3 exact tiles
  let removed = 0;
  me.hand = me.hand.filter(t => {
    if (t === tile && removed < 3) {
      removed++;
      return false;
    }
    return true;
  });
  assert(removed === 3, "failed to remove 3 tiles");

  me.melds.push({ type: "chiu", tile });

  const fromId = state.lastDiscard.fromPlayerId;
  const from = state.players[fromId];
  if (from && from.discards[from.discards.length - 1] === tile) from.discards.pop();

  state.lastDiscard = null;
  state.turnSeat = me.seat;
  state.awaiting = "discard";
  state.wallCount = wall.length;
}

function seatToPlayerId(state: GameState, seat: number): string {
  const p = Object.values(state.players).find(pp => pp.seat === seat);
  assert(p, `no player at seat ${seat}`);
  return p.playerId;
}

function simulateOneGame(seed: number) {
  const stats = {
    discard: 0,
    draw: 0,
    anChan: 0,
    anCa: 0,
    chiu: 0,
    win: 0,
    wallEmpty: 0
  };
  const rng = mulberry32(seed);

  const players = Array.from({ length: 5 }, (_, i) => ({ playerId: `P${i + 1}`, seat: i + 1 }));
  const dealerSeat = 1;
  const { game: state, wall } = startGame({ players, dealerSeat });

  const TOTAL_TILES = 120;

  // invariants at start
  assert(totalTiles(state, wall) === TOTAL_TILES, "tile conservation violated at start");

  let steps = 0;
  const MAX_STEPS = 20_000;

  while (state.phase === "playing" && steps++ < MAX_STEPS) {
    assert(totalTiles(state, wall) === TOTAL_TILES, `tile conservation violated step=${steps}`);
    assert(state.wallCount === wall.length, `wallCount mismatch step=${steps}`);

    // If there is a lastDiscard, first allow any player to CHIU (randomly choose one eligible).
    if (state.lastDiscard) {
      const discardTile = state.lastDiscard.tile;
      const eligible = Object.values(state.players)
        .filter(p => computeChiuEligibility(p.hand, discardTile))
        .sort((a, b) => a.seat - b.seat);

      if (eligible.length) {
        // 50% of the time, someone will actually chiu (exercise both take and no-take)
        if (rng() < 0.5) {
          const pick = eligible[Math.floor(rng() * eligible.length)];
          applyChiu(state, wall, pick.playerId);
          stats.chiu++;
          continue;
        }
      }
    }

    const currentPlayerId = seatToPlayerId(state, state.turnSeat);
    const me = state.players[currentPlayerId];

    if (state.awaiting === "draw") {
      // 60% attempt AN if eligible; otherwise draw.
      if (state.lastDiscard && state.lastDiscard.fromPlayerId !== currentPlayerId) {
        const elig = computeAnEligibility({
          meHand: me.hand,
          discardTile: state.lastDiscard.tile,
          cannotEatTiles: me.rules.cannotEatTiles,
          noCaGroups: me.rules.noCaGroups
        });
        if (elig.eligible === true && rng() < 0.6) {
          if (elig.canChan) {
            applyAn(state, wall, currentPlayerId, "chan");
            stats.anChan++;
            continue;
          }
          if (!elig.mustPreferChan && elig.caTiles.length) {
            // choose a random withTile among caTiles
            const withTile = elig.caTiles[Math.floor(rng() * elig.caTiles.length)];
            applyAn(state, wall, currentPlayerId, "ca", withTile);
            stats.anCa++;
            continue;
          }
        }
      }

      const r = applyDraw(state, wall, currentPlayerId, rng);
      if (r.ok === false) {
        if (r.reason === "win") stats.win++;
        if (r.reason === "wall_empty") stats.wallEmpty++;
        break;
      }
      stats.draw++;
      if ((r as any).autoDiscarded) stats.discard++;
      continue;
    }

    if (state.awaiting === "discard") {
      let legal = legalDiscards(me);
      let stage: "strict" | "relax1" | "relax2" | "ignoreForbidden" = "strict";

      if (legal.length === 0) {
        stage = "relax1";
        legal = legalDiscards(me, { allowDiscardChan: true });
      }
      if (legal.length === 0) {
        stage = "relax2";
        legal = legalDiscards(me, { allowDiscardChan: true, allowSecondTileInGroupAfterEatingCa: true });
      }
      if (legal.length === 0) {
        // Simulation-only extra breaker: ignore forbiddenDiscardTiles.
        stage = "ignoreForbidden";
        legal = legalDiscards(me, {
          allowDiscardChan: true,
          allowSecondTileInGroupAfterEatingCa: true,
          ignoreForbiddenDiscardTiles: true
        });
      }
      if (legal.length === 0) {
        throw new Error(
          `No legal discards (even after relaxations) for seat=${me.seat} hand=${JSON.stringify(me.hand)} rules=${JSON.stringify(me.rules)}`
        );
      }
      const tile = legal[Math.floor(rng() * legal.length)];
      // Determine whether this discard is using a deadlock relaxation (to match server behavior).
      const strictLegal = legalDiscards(me);
      const relax1Legal = strictLegal.length === 0 ? legalDiscards(me, { allowDiscardChan: true }) : null;
      const relax2Legal =
        strictLegal.length === 0 && (relax1Legal?.length ?? 0) === 0
          ? legalDiscards(me, { allowDiscardChan: true, allowSecondTileInGroupAfterEatingCa: true })
          : null;

      const opts = {
        allowDiscardChan: stage !== "strict",
        allowSecondTileInGroupAfterEatingCa: stage === "relax2" || stage === "ignoreForbidden",
        ignoreForbiddenDiscardTiles: stage === "ignoreForbidden"
      };

      applyDiscard(state, wall, currentPlayerId, tile, opts);
      stats.discard++;
      continue;
    }

    throw new Error(`Unknown awaiting=${(state as any).awaiting}`);
  }

  return { seed, steps, endedPhase: state.phase, wallLeft: wall.length, stats };
}

function main() {
  const N = Number(process.env.N ?? 500);
  const base = Number(process.env.SEED ?? 1);

  const agg = {
    games: 0,
    steps: 0,
    discard: 0,
    draw: 0,
    anChan: 0,
    anCa: 0,
    chiu: 0,
    win: 0,
    wallEmpty: 0,
    endedLobby: 0
  };

  for (let i = 0; i < N; i++) {
    const seed = base + i;
    try {
      const r = simulateOneGame(seed);
      agg.games++;
      agg.steps += r.steps;
      agg.discard += r.stats.discard;
      agg.draw += r.stats.draw;
      agg.anChan += r.stats.anChan;
      agg.anCa += r.stats.anCa;
      agg.chiu += r.stats.chiu;
      agg.win += r.stats.win;
      agg.wallEmpty += r.stats.wallEmpty;
      if (r.endedPhase === "lobby") agg.endedLobby++;
    } catch (e: any) {
      console.error("SIM_FAIL", { seed, message: String(e?.message ?? e) });
      throw e;
    }
  }

  console.log(JSON.stringify({
    N: agg.games,
    avgSteps: agg.steps / agg.games,
    totals: {
      discard: agg.discard,
      draw: agg.draw,
      anChan: agg.anChan,
      anCa: agg.anCa,
      chiu: agg.chiu,
      win: agg.win,
      wallEmpty: agg.wallEmpty
    }
  }, null, 2));
}

main();
