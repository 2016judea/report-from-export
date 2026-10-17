// Local dev server: static site/ + site/api/*.js handlers (Vercel-style req/res shim).
//   node scripts/serve.js [port]      (needs ANTHROPIC_API_KEY / STRIPE_SECRET_KEY for those routes)
const http = require("http"), fs = require("fs"), path = require("path"), url = require("url");
const root = path.resolve(__dirname, "..", "site");
process.env.ACCESS_SECRET ||= fs.readFileSync(path.resolve(__dirname, "..", ".access_secret"), "utf8").trim();
const port = +process.argv[2] || 4321;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname.startsWith("/api/")) {
    const f = path.join(root, "api", path.basename(u.pathname) + ".js");
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = ""; for await (const c of req) body += c;
    req.query = u.query; try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return require(f)(req, res);
  }
  let p = path.join(root, u.pathname);
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log("http://localhost:" + port));
