// POST /api/run { input, files?, pw? } -> the tool's structured output.
// Free: the tool runs for real on the first few items of whatever the visitor brings
// (TOOL.prepare decides what an item is). Paid (password): every item, plus whatever
// TOOL.post keeps back from a free run. Claude Opus 5.5 does the reading; numbers come
// from the visitor's input or from code, never from the model (each _tool.js says how).
const Anthropic = require("@anthropic-ai/sdk");
const { TOOL, access } = require("./_lib");

const client = new Anthropic();
const hits = new Map(); // ip -> timestamps, per warm instance: a spend brake, not security
const FREE_PER_HOUR = 12, PAID_PER_HOUR = 60;
function limited(ip, cap) {
  const now = Date.now(), h = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  h.push(now); hits.set(ip, h);
  return h.length > cap;
}

// One structured call. Shared by tools that need one or several.
async function ask({ system, content, schema, effort = "low", max_tokens = 16000 }) {
  const r = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }],
  });
  if (r.stop_reason === "refusal") throw Object.assign(new Error("refusal"), { status: 422 });
  if (r.stop_reason === "max_tokens") throw Object.assign(new Error("too long"), { status: 413 });
  console.log(`[ask] in=${r.usage.input_tokens} out=${r.usage.output_tokens}`);
  return JSON.parse(r.content.filter((x) => x.type === "text").map((x) => x.text).join(""));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = typeof req.body === "object" && req.body ? req.body : {};
  const input = String(b.input || "").slice(0, TOOL.max_chars || 60000);
  const files = Array.isArray(b.files) ? b.files.slice(0, 20) : [];
  if (input.trim().length < 20 && !files.length) return res.status(400).json({ error: "Paste something for it to work on first." });
  const acc = await access(req);
  if (acc.bad) return res.status(401).json({ error: "That password didn't match." });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0] || "?";
  if (limited(ip, acc.ok ? PAID_PER_HOUR : FREE_PER_HOUR)) return res.status(429).json({ error: "That's a lot of runs in an hour. Try again in a bit." });
  try {
    const prep = TOOL.prepare(input, !!acc.ok, files);
    if (prep.error) return res.status(400).json({ error: prep.error });
    const raw = TOOL.run ? await TOOL.run(ask, prep, !!acc.ok)
      : await ask({ system: TOOL.system, content: prep.content, schema: TOOL.schema, effort: TOOL.effort });
    const out = TOOL.post(raw, !!acc.ok, prep);
    console.log(`[run] ${acc.ok ? acc.kind : "free"} items=${prep.shown}/${prep.total}`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ...out, unlocked: !!acc.ok, shown: prep.shown, total: prep.total });
  } catch (e) {
    console.error("[run]", e.status || "", e.message);
    const msg = e.status === 422 ? "It couldn't work on that input." : e.status === 413 ? "That was too much for one run. Try a smaller batch." : "The tool hit a snag. Try again in a minute.";
    res.status(e.status === 422 || e.status === 413 ? e.status : 502).json({ error: msg });
  }
};
module.exports.ask = ask;
