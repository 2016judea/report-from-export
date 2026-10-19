// Code computes every metric; the guard drops any sentence with a number the code did not produce.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../site/api/_tool.js");

const CSV = "QUESTION: who is unpaid?\ndate,tech,total,status\n2026-08-01,Dale,100,paid\n2026-08-02,Jen,$1,250.50,unpaid\n2026-09-03,Dale,50,unpaid\n";

test("prepare reads the question, types the columns, and caps a free run", () => {
  const p = T.prepare(CSV.replace("$1,250.50", "\"$1,250.50\""), false, []);
  assert.equal(p.question, "who is unpaid?");
  assert.deepEqual(p.types, ["date", "text", "number", "text"]);
  assert.equal(p.rows.length, 3);
  const big = "date,x\n" + Array.from({ length: 250 }, (_, i) => `2026-01-01,${i}`).join("\n");
  const q = T.prepare(big, false, []);
  assert.equal(q.shown, 200); assert.equal(q.total, 250);
  assert.equal(T.prepare(big, true, []).shown, 250);
});

test("run computes sums over every row and drops a finding whose number was not computed", async () => {
  const p = T.prepare(CSV.replace("$1,250.50", "\"$1,250.50\""), true, []);
  const ask = async ({ schema }) => schema.required.includes("metrics")
    ? { metrics: [{ id: "m1", label: "Unpaid total by tech", op: "sum", column: "total", group_by: "tech", by_month: false, filter_column: "status", filter_value: "unpaid" }] }
    : { headline: "Jen owes 1,250.50.", findings: [{ text: "Jen has 1250.5 unpaid.", metric_ids: ["m1"] }, { text: "Unpaid is up 37%.", metric_ids: ["m1"] }] };
  const out = await T.run(ask, p);
  assert.deepEqual(out.metrics[0].rows.map((r) => [r.group, r.value]), [["Jen", 1250.5], ["Dale", 50]]);
  assert.deepEqual(out.findings.map((f) => f.text), ["Jen has 1250.5 unpaid."]);
  assert.equal(out.dropped, 1);
  assert.equal(out.headline, "Jen owes 1,250.50.");
});
