function renderOutput(out, el, unlocked) {
  const fmt = (m, v) => v == null ? "" : (/(total|revenue|cost|amount|price|sales|\$)/i.test(m.label + m.column) && m.op !== "count" && m.unit !== "%"
    ? "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Number(v).toLocaleString("en-US") + (m.unit || ""));
  const h = [`<p class="q">${esc(out.question || "")}</p><h3 class="head">${esc(out.headline || "")}</h3><ol class="finds">`];
  for (const f of out.findings || []) h.push(`<li>${esc(f.text)}</li>`);
  h.push(`</ol>`);
  if (out.dropped) h.push(`<p class="hint">${out.dropped} sentence${out.dropped > 1 ? "s were" : " was"} left out because a number in it wasn't one the tool computed.</p>`);
  h.push(`<details><summary>The numbers behind it (${(out.metrics || []).length} tables, computed from every row)</summary>`);
  for (const m of out.metrics || []) {
    const max = Math.max(...m.rows.map(r => Math.abs(r.value || 0)), 1);
    h.push(`<div class="mt"><b>${esc(m.label)}</b>${m.filter_column ? ` <span class="hint">where ${esc(m.filter_column)} = ${esc(m.filter_value)}</span>` : ""}<table>${m.rows.map(r =>
      `<tr><td>${esc(r.group)}</td><td class="bar"><i style="width:${Math.round(100 * Math.abs(r.value || 0) / max)}%"></i></td><td class="r">${fmt(m, r.value)}</td></tr>`).join("")}</table></div>`);
  }
  h.push(`</details>`);
  if (unlocked || out.example) h.push(`<div class="row"><button class="ghost" id="csv">Download the tables</button></div>`);
  el.innerHTML = h.join("");
  const c = el.querySelector("#csv");
  if (c) c.onclick = () => {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["metric", "group", "value", "rows"].join(",")];
    for (const m of out.metrics) for (const r of m.rows) rows.push([m.label, r.group, r.value, r.n].map(q).join(","));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })); a.download = "report-tables.csv"; a.click(); track("download");
  };
}
