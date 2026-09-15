# Bai Chan Game Handoff

Last updated: 2026-09-15

This document is for a new coding agent taking over the Bai Chan web game. It captures the current implementation, decisions, known gaps, and safe next steps.

## Repository

- Authoritative local repo: `/Users/michaelnguyen/.openclaw/workspace/bai-chan-web`
- GitHub remote: `https://github.com/mnguyen92646/bai-chan-game.git`
- Branch: `main`
- Current upstream sync before this handoff: local `main` matched `origin/main` at `601fe49` (`Adjust Bai Chan discard rules and table layout`).
- Ignore the sibling folder `bai-chan-web-dev2` unless Michael explicitly asks for archaeology. It is not the GitHub-backed repo.

## Quick Setup

From the repo root:

```bash
npm install
npm run dev -w apps/server
npm run dev -w apps/web
```

Default local services:

- Server: `http://localhost:3001`
- Web: `http://localhost:3000`
- Main shared table route: `http://localhost:3000/table`

Useful build checks:

```bash
npm run build -w apps/server
npm run build -w apps/web
npm run lint -w apps/web
```

Current verification on 2026-09-15:

- `npm run build -w apps/server`: passes.
- `npm run build -w apps/web`: passes.
- `npm run lint -w apps/web`: fails on pre-existing lint/style issues, mostly `any`, synchronous `setState` inside effects, `require()` imports, and Next link/image rules.

## Environment

Server env:

- `PORT`: defaults to `3001`.
- `JWT_SECRET`: defaults to `dev-secret-change-me`; set a real value outside local dev.
- `DEFAULT_ROOM_ID`: defaults to `000000` for single-table mode.

Web env:

- `NEXT_PUBLIC_SERVER_URL`: optional. If absent, `apps/web/src/lib/serverUrl.ts` infers a server URL from the current hostname.

OpenTelemetry:

- `apps/server/.env.example` contains New Relic/OTLP settings.
- `dev:otel` and `start:otel` scripts exist for server instrumentation.

## Architecture

### Server

The server in `apps/server` is authoritative.

Key files:

- `src/index.ts`: Express routes, Socket.IO room/session handling, game actions, audit logging.
- `src/game/engine.ts`: game initialization, public/private state projection.
- `src/game/chanDeck.ts`: real 120-card deck model.
- `src/game/win.ts`: simplified win evaluator and `groupKey` matching model.
- `src/game/types.ts`: public/private game state types.
- `src/game/logger.ts`: player-visible rolling log.
- `src/game/privateLog.ts`: private JSONL audit log.

Important server behavior:

- Rooms live in memory and expire after 8 hours of inactivity.
- `POST /rooms` creates a room with a 6-digit room code.
- `GET /room/default` returns/creates the shared room (`000000` by default).
- Players rejoin via JWT stored client-side.
- A reconnect from another tab/device takes over the old socket for that seat.
- Max seats: 5.
- Host starts/restarts/resets, but if host is disconnected another connected player can take over.
- Runtime logs are intentionally ignored by git.

### Web

The web app is a Next.js mobile-first UI.

Key files:

- `src/app/page.tsx`: home page.
- `src/app/table/page.tsx`: redirects to the shared table room.
- `src/app/room/[roomId]/page.tsx`: main game UI and Socket.IO event handling.
- `src/components/TableBoard.tsx`: table layout, public state, player badges, discards, melds.
- `src/components/FanHand.tsx`: mobile fan-hand interaction and drag reorder.
- `src/components/SortableHand.tsx`: older/alternate hand UI.
- `src/components/TileFace.tsx`: tile rendering helper.
- `src/lib/socket.ts`, `serverUrl.ts`, `playerToken.ts`: client connection/session helpers.

Debug/helpful routes:

- `/labeler`: tile labeling helper.
- `/tile-test`: checks rendered tile images.

## Current Rules Model

Baseline decision:

- Vinagames rules are the baseline.
- Michael's family rules are additive overrides where confirmed.
- English is the default docs/UI language unless Michael asks otherwise.

Current implemented rules/assumptions:

- Deck is 120 cards: 30 distinct tile types x 4 copies.
- Special six bucket: `1_van`, `1_vanh`, `1_sach`, `chi`, `lao`, `thang`.
- Four players: 23 tiles each, wall/noc 28.
- Five players: 19 tiles each, wall/noc 25.
- No dealer bonus tile on initial deal.
- First player/dealer must draw.
- Turns alternate between manual draw and discard.
- Chiu is manual and requires 3 exact copies in hand.
- An is only available to the next player while awaiting draw.
- Family override: An ca is allowed whenever the player has a compatible same-rank-group tile.
- Family override: do not block eating just because the player previously discarded the same tile.
- Bo an pass penalty uses `cannotEatTiles` and applies only to the next eligible player after a discard.
- Discard restriction currently blocks breaking an exact pair only when the player has exactly 2 copies; 3+ can discard one and keep a pair.
- Win evaluator is simplified:
  - 20-tile hand: needs 8 exact pairs plus remaining tiles partitioning into round groups of 4.
  - 24-tile hand: needs 10 exact pairs plus one round group of 4.
  - Full cuoc/scoring and complete Vinagames waiting-state restrictions are not done.

## Logging

Public player-visible logs:

- Stored under `apps/server/logs/room-...log`.
- Sent to clients via `game:log`.

Private audit logs:

- Stored under `apps/server/logs/private/room-...jsonl`.
- Include full hands, snapshots, `CLAIM_OPTIONS`, and reject reason codes.
- Useful for debugging An/Chiu/rule eligibility.
- Do not commit or share publicly.

Note: `src/index.ts` currently hardcodes the logs directory to the local repo path:

```ts
const logsDir = "/Users/michaelnguyen/.openclaw/workspace/bai-chan-web/apps/server/logs";
```

That should become env/config before production hosting.

## Known Gaps

- No automated game-rule test suite yet.
- Web lint fails on existing style issues.
- `apps/server/src/game/tiles.ts` is a stale placeholder; `chanDeck.ts` is the real deck model.
- Logs directory path is hardcoded.
- Game state is in-memory only; refresh/rejoin works through player tokens, but server restarts lose room state.
- Current win/scoring is simplified and does not cover full Vinagames cuoc/scoring.
- Remaining An/Chiu edge cases need live 4-player verification.
- Production hosting for the websocket backend is still undecided.
- The app currently favors family-play/debuggability over polished production UX.

## Recommended Next Steps

1. Add focused server-side tests for:
   - deck size and deal counts for 4/5 players,
   - Chiu exact-3 eligibility,
   - An chan vs An ca eligibility,
   - Bo an pass penalty scope,
   - legal discard restrictions,
   - simplified win evaluator examples.
2. Move logs directory to an env var with a local default.
3. Clean the web lint backlog separately from rule changes.
4. Verify 4-player live flow with private logs open:
   - draw/discard sequence,
   - An ca choice UI,
   - must-prefer-chan behavior,
   - Chiu timing,
   - restart/reset/rejoin behavior.
5. Decide production hosting for the websocket server.
6. Expand win/scoring/cuoc only after the core turn rules are stable.

## Git Hygiene

The repo ignores local/generated/runtime files:

- `node_modules`
- `dist`
- `.next`
- `.env`
- `.env.*`
- `.DS_Store`
- `apps/server/logs/`
- `apps/server/bots-*.log`

Before committing, use:

```bash
git status --short
git diff --stat
git diff
```

Do not include server logs, `.env`, or unrelated workspace files.
