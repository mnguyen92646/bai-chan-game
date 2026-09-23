# Public rules questionnaire

The public [English](https://bai-chan-rules.white-violet-3211.workers.dev/?lang=en) and [Vietnamese](https://bai-chan-rules.white-violet-3211.workers.dev/?lang=vi) forms live in `apps/rules-survey`. They ask the same broad subjects as the private family questionnaire: deck inventory, deal, turns, claims, chíu, winning hands, scoring, and source. They do not copy family responses, private access keys, audio, or private survey routes. The public form saves a draft in the visitor's browser and submits only when the visitor presses Send.

Submissions are private D1 rows in `bai-chan-public-rules`. There is no public read or list endpoint. A visitor receives an eight-character reference. Names are optional, and the form asks for attribution permission. Do not copy submitted text or a name onto the website without reviewing the response and its permission choice.

## Deploy

From the repository root, with Wrangler logged in to the intended Cloudflare account:

```sh
npx wrangler d1 migrations apply RULES_DB --remote --config apps/rules-survey/wrangler.jsonc
npx wrangler deploy --config apps/rules-survey/wrangler.jsonc
```

The D1 database ID is tracked in the Wrangler configuration. Do not point the public Worker at the private family questionnaire's local response files. The public form is intentionally a separate Worker from the game and room Workers.

## Review responses

Only someone with Cloudflare account access can read the database. From the repository root:

```sh
npx wrangler d1 execute RULES_DB --remote --config apps/rules-survey/wrangler.jsonc --command "SELECT id, created_at, locale, answers_json FROM rule_submissions ORDER BY created_at DESC LIMIT 25"
```

The API accepts same-origin JSON only, caps payload and field size, checks a hidden trap field, and rate-limits submissions to three attempts per minute per IP. These controls reduce casual spam; review submissions before treating them as evidence. The Free plan has D1 quotas and may temporarily reject writes when a quota is reached.
