interface Env {
  RULES_DB: D1Database;
  SUBMIT_LIMIT: RateLimit;
}

const fields = [
  "gameName", "deckSize", "deckDetails", "specialCards", "players", "dealFour", "dealFive", "stock",
  "turnOrder", "draw", "discard", "claim", "chiu", "returnCard", "passRestrictions", "winShape",
  "minPairs", "winSource", "scoring", "penalties", "creditName", "region", "source", "attribution",
] as const;
type Field = typeof fields[number];

const json = (body: object, status: number) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/submissions") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (request.headers.get("origin") !== url.origin) return json({ error: "Invalid origin" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
    if (Number(request.headers.get("content-length") ?? 0) > 24000) return json({ error: "Response too long" }, 413);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (!(await env.SUBMIT_LIMIT.limit({ key: ip })).success) return json({ error: "Please wait before sending another response" }, 429);

    let data: Record<string, unknown>;
    try {
      const body = await request.text();
      if (body.length > 24000) return json({ error: "Response too long" }, 413);
      data = JSON.parse(body) as Record<string, unknown>;
    } catch { return json({ error: "Invalid response" }, 400); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Invalid response" }, 400);
    if (data.website) return json({ ok: true, id: "received" }, 201); // Honeypot; do not store.
    if (typeof data.startedAt !== "number" || Date.now() - data.startedAt < 3000 || Date.now() - data.startedAt > 604800000) {
      return json({ error: "Please reopen the form and try again" }, 400);
    }
    const locale = data.locale === "vi" ? "vi" : data.locale === "en" ? "en" : null;
    if (!locale || !data.answers || typeof data.answers !== "object" || Array.isArray(data.answers)) return json({ error: "Invalid response" }, 400);
    const input = data.answers as Record<string, unknown>;
    const answers: Partial<Record<Field, string>> = {};
    for (const field of fields) {
      const value = input[field];
      if (value === undefined || value === "") continue;
      if (typeof value !== "string" || value.length > 2000) return json({ error: "A field is too long" }, 400);
      answers[field] = value.trim();
    }
    if (!answers.gameName || !answers.deckSize || !answers.source || !answers.attribution ||
      !["dealFour", "dealFive", "turnOrder", "claim", "winShape"].some(key => !!answers[key as Field])) {
      return json({ error: "Please give the game name, deck size, source, attribution choice, and at least one rule" }, 400);
    }
    const id = crypto.randomUUID();
    try {
      await env.RULES_DB.prepare("INSERT INTO rule_submissions (id, created_at, locale, answers_json) VALUES (?, ?, ?, ?)")
        .bind(id, new Date().toISOString(), locale, JSON.stringify(answers)).run();
      return json({ ok: true, id: id.slice(0, 8) }, 201);
    } catch {
      return json({ error: "Could not save your response. Please try again later." }, 503);
    }
  },
};
