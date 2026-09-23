# Public multiplayer release path

## Hosting choice

Use two Cloudflare Workers on the Workers Free plan. `apps/edge` owns private rooms: a SQLite-backed Durable Object per room coordinates WebSockets, persists game state and runs bots. `apps/web` builds the public play routes with vinext and Workers Static Assets. `wrangler.jsonc` files are the deployment configuration. The existing Express/Socket.IO server remains a development preview and is not deployed.

The public web build uses `apps/web/public-app/app`, which links only `/`, `/create`, `/join`, `/practice`, `/rules`, and `/room/[roomId]` into vinext. The build disables the general `public/` asset copy and explicitly copies game tile and audio files. The questionnaire, family response files and development fixtures are absent from that bundle. Keep the normal Next.js build for the private preview.

Do not publish a development preview or expose a developer's local machine directly. Render's free Node service is an easier compatibility option, but it sleeps after inactivity; in-memory rooms would vanish on sleep or restart.

## Room privacy

- A new room uses a 128-bit random invitation ID. Joining an unknown ID never creates a room. Only people with the invitation link can take an open seat.
- Treat the invitation link as a bearer secret. A forwarded or leaked link lets its holder take an open seat. Host approval is out of scope.
- Rejoin requires the existing player token. Never broadcast private hands to other room members or put them in public logs.
- The public Worker has no default shared room or reveal-hands action. Rejoin tokens are generated with 256 random bits and stored in the room's Durable Object; they are not signed bearer tokens.

## Before publishing

1. Verify the Durable Object protocol against four- and five-seat games. `apps/edge/smoke.mjs` covers invite-only joining, both seat counts with bot fill, hidden hands, stale actions and rejoining. The room record and wall are stored in the object's SQLite storage, so ordinary hibernation can restore them. Recovery from every possible platform failure remains a release test, not a promise to users.
2. Admit anyone holding the private link to an open seat. Keep the UI clear that forwarded links also grant access; do not add host approval.
3. Use Cloudflare edge limits for HTTP room creation and WebSocket connection attempts. The Cloudflare WAF only inspects the initial WebSocket request, so the game backend must still limit message size, message rate, active connections, room count, and room lifetime. CORS alone does not authenticate clients. A different reverse proxy needs its own protections.
4. Keep private hand logs out of production telemetry; remove or minimize unnecessary personal data and set a retention period.
5. Test unknown-room rejection, invitation guessing resistance, rejoin authorization, cross-room isolation, disconnect/reconnect, 4- and 5-player games, and abuse limits in a production-like preview.
6. Inspect the built public assets for private data, then deploy to the temporary Workers URLs. Link the site only after multiplayer is verified there.

## Current local verification

- `npm run check -w @bai-chan/edge` and `npm run dry-run -w @bai-chan/edge` pass.
- `npm run smoke -w @bai-chan/edge` passes against `npm run dev -w @bai-chan/edge`.
- `PLAY_SERVER_URL=http://localhost:3102 npm run build:public -w web` builds the public routes. A local Worker served those routes; `/family-rules/abc` and `/api/rules-survey/abc` returned 404.
- In the browser, the local public build created a room, accepted a second player, dealt a 4-seat hand with two bots, accepted a discard and restored the host's private hand after refresh.
- The production-targeted public build and both Wrangler dry runs pass. A local Worker returns 404 for `/hoi-luat-chan.txt`; the rules page omits its questionnaire link. Tile and audio assets still load.
- The existing Next.js preview builds on 16.3.6 and is running again on port 3100. The web production dependency audit has one low-severity `esbuild` advisory and no moderate, high or critical findings.

## First release: live 2026-09-22

The account's `workers.dev` subdomain is `white-violet-3211`. The live game is [bai-chan-play.white-violet-3211.workers.dev](https://bai-chan-play.white-violet-3211.workers.dev/), backed by `bai-chan-rooms.white-violet-3211.workers.dev`. The edge Worker's `WEB_ORIGINS` is set to the exact game origin; local development overrides it in `apps/edge/package.json`. Deployed Worker versions: room `57068eb5-b68a-4e73-9b8c-cd5a4177023e`, game `dc658f72-3e29-4021-a65c-657768702cdd`.

For manual updates, deploy the room Worker first from `apps/edge` with `npx wrangler deploy`. Then build the public web app from the repository root with `PLAY_SERVER_URL=https://bai-chan-rooms.white-violet-3211.workers.dev npm run build:public -w web`, and deploy from `apps/web` with `npx wrangler deploy --config dist/server/wrangler.json`. No GitHub automation or API key is required for these manual releases.

Live verification: room Worker `/health` returned 200; the edge smoke completed four- and five-seat games. The browser created a room, joined a second player, dealt, discarded and restored the private host hand after refresh. Public pages and game assets returned 200; `/hoi-luat-chan.txt`, `/family-rules/abc` and `/api/rules-survey/abc` returned 404. The [personal site](https://michaelnguyen.net/baichan.html) links to the public game.

No public URL can prevent people from sending scan or penetration-test requests. The goal is to expose only the required routes and make unauthorized requests harmless.
