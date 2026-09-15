# Agent Notes

This repo is the authoritative Bai Chan game repo for GitHub:

- Remote: `https://github.com/mnguyen92646/bai-chan-game.git`
- Local path: `/Users/michaelnguyen/.openclaw/workspace/bai-chan-web`
- The nearby `/Users/michaelnguyen/.openclaw/workspace/bai-chan-web-dev2` folder is an older side copy, not the GitHub repo.

## Start Here

Read these files before making changes:

1. `HANDOFF.md`
2. `README.md`
3. `apps/server/src/game/engine.ts`
4. `apps/server/src/index.ts`
5. `apps/web/src/app/room/[roomId]/page.tsx`
6. `apps/web/src/components/TableBoard.tsx`
7. `apps/web/src/components/FanHand.tsx`

## Project Shape

- `apps/server`: Express + Socket.IO authoritative game server.
- `apps/web`: Next.js client, mobile-first, with a shared single-table path at `/table`.
- `apps/web/public/tiles`: rendered tile assets.
- `packages`: currently minimal workspace structure.

## Rules Baseline

- Canonical baseline is Vinagames-style Bai Chan; family rules are additive overrides.
- English is the default UI/documentation language unless Michael asks otherwise.
- Chiu is manual and requires 3 exact matching tiles in hand.
- "Bo an" pass penalty only blocks the next eligible player after a discard.
- Current win evaluator is simplified; do not treat it as final full scoring/cuoc logic.

## Safety

- Do not commit `.env`, `.env.*`, `apps/server/logs/`, `.next/`, `dist/`, `node_modules/`, or `.DS_Store`.
- Server private JSONL logs include hands and claim/reject details; keep them local.
- Avoid broad refactors while rule behavior is still being verified with family play.

## Verification

Useful checks:

```bash
npm run build -w apps/server
npm run build -w apps/web
npm run lint -w apps/web
```

As of 2026-09-15, both builds pass. Web lint fails on existing style issues; see `HANDOFF.md`.
