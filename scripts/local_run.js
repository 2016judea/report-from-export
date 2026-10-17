// Drive site/api/run.js locally with a fake req/res (no vercel CLI on this Mac).
//   node scripts/local_run.js examples/x.txt [--paid] [--out examples/x.out.json]
// --paid mints a comp password with ACCESS_SECRET (from .access_secret).
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
process.env.ACCESS_SECRET ||= fs.readFileSync(path.join(root, ".access_secret"), "utf8").trim();
const lib = require(path.join(root, "site/api/_lib.js"));
const run = require(path.join(root, "site/api/run.js"));
const args = process.argv.slice(2);
const input = fs.readFileSync(args[0], "utf8");
const headers = {};
if (args.includes("--paid")) {
  const nonce = "LOCAL";
  const raw = nonce + lib.mac(nonce, "comp:");
  headers["x-password"] = raw;
}
const req = { method: "POST", headers, body: { input, files: [] } };
const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
  json(o) { const i = args.indexOf("--out"); if (i > -1) fs.writeFileSync(args[i + 1], JSON.stringify(o, null, 1));
    console.log(this.code, JSON.stringify(o, null, 1).slice(0, 6000)); } };
const t = Date.now();
run(req, res).then(() => console.error(`took ${((Date.now() - t) / 1000).toFixed(1)}s`));
