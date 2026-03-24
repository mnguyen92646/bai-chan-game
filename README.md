# Bài Chắn (web)

Mobile-friendly web game for iPhone-sized screens. Multiplayer rooms with refresh-proof rejoin.

## MVP goals
- Create room + join via link/code
- No login; per-player **JWT** persisted in browser storage
- Reconnect/refresh resumes seat + state (sessions <= 8 hours)
- Authoritative server via WebSockets

## Architecture (proposed)
- `apps/web`: Next.js (mobile-first UI)
- `apps/server`: Node.js + Socket.IO authoritative game server
- `packages/shared`: shared types + validation

## Rejoin / identity model
- On first join: server mints a signed JWT containing `roomId`, `playerId`, `seat`, `nickname`.
- Web stores token in `localStorage` (or cookie later).
- On reconnect: client presents JWT; server re-attaches player to their seat.

## Session persistence (8h)
MVP: in-memory state + periodic snapshot/event log to local SQLite (dev) or Redis/Postgres (prod).
TTL for rooms: 8h since last activity.

## Open questions
- Should a player be allowed to reconnect from a second device and "take over" their seat?
- Do we require 4 players always, or allow 2-3 with bots?
- Vietnamese-only UI for V1?
