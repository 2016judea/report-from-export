// Report From Export: the "prepare reports and metrics for the owner / manager" step from
// 25 Twin Cities job postings (hiring-signals, 2026-10-17). DATA_MODEL.md is the spec.
// Two Claude calls around code: (1) Claude reads the column names and a sample and plans
// the metrics that answer the owner's question; (2) code computes every metric over every
// row; (3) Claude writes findings from the computed values only. Code then drops any
// finding that states a number the computation did not produce.
const product = "report-from-export";
const FREE = 200, PAID = 50000;

// --- CSV ------------------------------------------------------------------------------
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
const num = (v) => { const s = String(v ?? "").replace(/[$,%\s]/g, ""); return s !== "" && isFinite(+s) ? +s : null; };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(v || ""));
const month = (v) => { const s = String(v); if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[1].padStart(2, "0")}`; };

function prepare(input, unlocked, files) {
  let text = input;
  const csvFile = files.find((f) => f && f.data);
  if (csvFile) text = (input.match(/^\s*QUESTION:.*$/im)?.[0] || "") + "\n" + Buffer.from(csvFile.data, "base64").toString("utf8");
  const qm = text.match(/^\s*QUESTION:\s*(.*)$/im);
  const question = qm ? qm[1].trim() : "What should the owner know from this?";
  const all = parseCSV(text.replace(/^\s*QUESTION:.*$/im, "").trim());
  if (all.length < 3) return { error: "Paste a CSV export with a header row (or add the .csv file)." };
  const header = all[0].map((h, i) => (h || `col${i + 1}`).trim());
  const body = all.slice(1).filter((r) => r.length >= Math.min(2, header.length));
  const use = body.slice(0, unlocked ? PAID : FREE);
  const types = header.map((_, i) => {
    const vals = use.slice(0, 200).map((r) => r[i]).filter((v) => v !== undefined && v !== "");
    if (vals.length && vals.filter(isDate).length / vals.length > 0.8) return "date";
    if (vals.length && vals.filter((v) => num(v) !== null).length / vals.length > 0.9) return "number";
    return "text";
  });
  const distinct = header.map((_, i) => types[i] === "text" ? [...new Set(use.map((r) => r[i]))].slice(0, 12) : null);
  const di = types.indexOf("date");
  const ds = di >= 0 ? use.map((r) => String(r[di])).filter(isDate).sort() : [];
  const cover = (ds.length ? `DATES COVERED: ${ds[0]} to ${ds[ds.length - 1]}. ` : "") +
    (use.length < body.length ? `NOTE: this is only the first ${use.length} of ${body.length} rows (the free run); the last period shown is cut off, so never compare it with a full period or call it a drop.` : "");
  const content = `OWNER'S QUESTION: ${question}\nROWS: ${use.length}\n${cover}\nCOLUMNS:\n` +
    header.map((h, i) => `- ${h} (${types[i]}${distinct[i] ? `; values like: ${distinct[i].join(", ")}` : ""})`).join("\n") +
    `\nSAMPLE ROWS:\n${[header, ...use.slice(0, 12)].map((r) => r.join(",")).join("\n")}`;
  return { content, cover, question, header, types, rows: use, shown: use.length, total: Math.min(body.length, PAID) };
}

// --- plan, compute, write ----------------------------------------------------------------
const S = { type: "string" };
const planSchema = { type: "object", additionalProperties: false, required: ["metrics"], properties: { metrics: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["id", "label", "op", "column", "group_by", "by_month", "filter_column", "filter_value"],
  properties: { id: S, label: S, op: { type: "string", enum: ["sum", "count", "average", "min", "max", "distinct_count", "share_of_rows"] },
    column: S, group_by: S, by_month: { type: "boolean" }, filter_column: S, filter_value: S } } } } };
const PLAN = `You plan the numbers for a short report a small-business owner asked for. You see the column names, their types and a sample of rows.
Choose 4 to 8 metrics that together answer the owner's question. Each metric: id (m1, m2...), a plain label, op, the column it works on (any column for count; for share_of_rows, the column whose value is filter_value), optional group_by (a text column, "" for none), by_month (true to break out by month using the first date column), optional filter_column/filter_value to restrict rows ("" for none).
Prefer breakdowns the owner can act on: by person, by job type, by month, what is unpaid or late. Use exact column names. You do not compute anything.`;
const writeSchema = { type: "object", additionalProperties: false, required: ["headline", "findings"], properties: {
  headline: S, findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "metric_ids"], properties: { text: S, metric_ids: { type: "array", items: S } } } } } };
const WRITE = `You write the report a small-business owner reads in one minute. You get their question and computed results. Write a one-sentence headline and 3 to 6 findings, plain words, each something they can act on, each citing the metric ids it uses.
Every number you write MUST appear in the computed results exactly as given (you may drop trailing zeros or add a $ or %). Do not add, subtract, divide or round anything yourself. If a comparison needs a number that is not given, say it without the number.`;

function compute(m, prep) {
  const ci = prep.header.indexOf(m.column), gi = m.group_by ? prep.header.indexOf(m.group_by) : -1;
  const fi = m.filter_column ? prep.header.indexOf(m.filter_column) : -1, di = prep.types.indexOf("date");
  let rows = prep.rows;
  if (m.op !== "share_of_rows" && fi >= 0) rows = rows.filter((r) => String(r[fi]).trim().toLowerCase() === String(m.filter_value).trim().toLowerCase());
  const key = (r) => [gi >= 0 ? r[gi] : null, m.by_month && di >= 0 ? month(r[di]) : null].filter((x) => x !== null).join(" · ") || "All";
  const groups = new Map();
  for (const r of rows) { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const r2 = (v) => v == null ? null : Math.round(v * 100) / 100;
  const out = [];
  for (const [k, g] of groups) {
    const vals = ci >= 0 ? g.map((r) => num(r[ci])).filter((v) => v !== null) : [];
    let v = null;
    if (m.op === "count") v = g.length;
    else if (m.op === "sum") v = r2(vals.reduce((a, b) => a + b, 0));
    else if (m.op === "average") v = vals.length ? r2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    else if (m.op === "min") v = vals.length ? r2(Math.min(...vals)) : null;
    else if (m.op === "max") v = vals.length ? r2(Math.max(...vals)) : null;
    else if (m.op === "distinct_count") v = new Set(g.map((r) => r[ci])).size;
    else if (m.op === "share_of_rows") v = r2(100 * g.filter((r) => String(r[ci]).trim().toLowerCase() === String(m.filter_value).trim().toLowerCase()).length / g.length);
    out.push({ group: k, value: v, n: g.length });
  }
  out.sort((a, b) => (m.by_month && !m.group_by) ? a.group.localeCompare(b.group) : (b.value ?? -1) - (a.value ?? -1));
  return { ...m, unit: m.op === "share_of_rows" ? "%" : "", rows: out.slice(0, 15) };
}

function numbersIn(t) { return (String(t).match(/\d[\d,]*\.?\d*/g) || []).map((s) => +s.replace(/,/g, "")).filter((n) => isFinite(n)); }

async function run(ask, prep) {
  const plan = await ask({ system: PLAN, content: prep.content, schema: planSchema, effort: "medium" });
  const metrics = plan.metrics.slice(0, 8).map((m) => compute(m, prep)).filter((m) => m.rows.length);
  const results = metrics.map((m) => ({ id: m.id, label: m.label, op: m.op, unit: m.unit, rows: m.rows.map((r) => ({ [m.group_by || (m.by_month ? "month" : "group")]: r.group, value: r.value, rows: r.n })) }));
  const wrote = await ask({ system: WRITE, content: `OWNER'S QUESTION: ${prep.question}\nTOTAL ROWS: ${prep.rows.length}\n${prep.cover}\nCOMPUTED RESULTS:\n${JSON.stringify(results)}`, schema: writeSchema, effort: "medium" });
  // the guard: every number in a finding must be one the code produced (or a month / year / row count)
  const ok = new Set([prep.rows.length, prep.total]);
  numbersIn(prep.cover + " " + prep.question).forEach((n) => ok.add(n));
  for (const m of metrics) for (const r of m.rows) { ok.add(r.value); ok.add(r.n); numbersIn(r.group).forEach((n) => ok.add(n)); }
  const allowed = (n) => [...ok].some((v) => v != null && (Math.abs(v - n) < 0.006 || Math.abs(Math.round(v) - n) < 0.001 && Math.abs(v) >= 100));
  const kept = [], dropped = [];
  for (const f of wrote.findings) (numbersIn(f.text).every(allowed) ? kept : dropped).push(f);
  if (!numbersIn(wrote.headline).every(allowed)) { dropped.push({ text: wrote.headline }); wrote.headline = kept[0]?.text || "Here is what the export shows."; }
  if (dropped.length) console.log("[guard] dropped:", JSON.stringify(dropped.map((d) => d.text)).slice(0, 1500));
  return { question: prep.question, headline: wrote.headline, findings: kept, dropped: dropped.length, metrics };
}

function post(out) { return out; }

module.exports = {
  product, site: "https://report-from-export.vercel.app", name: "Report From Export", price_usd: 5,
  checkout_line: "Every row of every export, every run, with the tables to download.",
  max_chars: 3000000, system: "", schema: {}, prepare, run, post,
};
