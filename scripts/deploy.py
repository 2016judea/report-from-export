#!/usr/bin/env python3
"""Create (once), configure and deploy site/ to Vercel production over the REST API.

Not the CLI: `vercel deploy --prod` has returned BLOCKED on this account with no error,
while /v13/deployments goes READY (unit-turns-mpls, 2026-10-17). Polls readyState and
exits non-zero on anything but READY.

  python3 scripts/deploy.py --setup   # create project, env vars, analytics (idempotent)
  python3 scripts/deploy.py           # deploy

Needs VERCEL_TOKEN, STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, MAILGUN_* in the environment (bricks/.env).
ACCESS_SECRET is generated once and kept in .access_secret (gitignored).
"""
import hashlib, json, os, secrets, sys, time, urllib.error, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITE = REPO / "site"
TOOL = json.loads((REPO / "tool.json").read_text())
PROJECT = TOOL["product"]
TEAM = "team_XnhPzBEcaSfEmZFo9M2isLFY"
SKIP = {".git", "node_modules", ".vercel", "__pycache__", ".DS_Store", ".env"}


def req(method, url, token, body=None, headers=None, raw=None):
    h = {"Authorization": f"Bearer {token}"}
    h.update(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None:
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(r) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")
        except urllib.error.URLError:
            time.sleep(2 + attempt * 3)   # Errno 51 is transient here; retry
    sys.exit(f"network failed: {url}")


def setup(token):
    api = "https://api.vercel.com"
    code, p = req("GET", f"{api}/v9/projects/{PROJECT}?teamId={TEAM}", token)
    if code == 404:
        code, p = req("POST", f"{api}/v10/projects?teamId={TEAM}", token, {"name": PROJECT, "framework": None})
        print("created project", code, p.get("id"))
    pid = p["id"]
    sec_file = REPO / ".access_secret"
    if not sec_file.exists():
        sec_file.write_text(secrets.token_hex(32))
    env = {"STRIPE_SECRET_KEY": os.environ["STRIPE_SECRET_KEY"], "ANTHROPIC_API_KEY": os.environ["ANTHROPIC_API_KEY"],
           "ACCESS_SECRET": sec_file.read_text().strip(), "SITE_URL": TOOL["site"],
           **{k: os.environ[k] for k in ("MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAILGUN_FROM")}}
    for k, v in env.items():
        c, out = req("POST", f"{api}/v10/projects/{pid}/env?teamId={TEAM}&upsert=true", token,
                     {"key": k, "value": v, "type": "encrypted", "target": ["production", "preview"]})
        print("env", k, c)
    c, out = req("POST", f"{api}/web/insights/toggle?projectId={pid}&teamId={TEAM}", token, {"value": True})
    print("analytics", c, out)
    c, out = req("PATCH", f"{api}/v9/projects/{pid}?teamId={TEAM}", token, {"ssoProtection": None})
    print("public", c)


def deploy(token):
    files, total = [], 0
    for path in sorted(SITE.rglob("*")):
        rel = path.relative_to(SITE)
        if not path.is_file() or any(p in SKIP for p in rel.parts):
            continue
        body = path.read_bytes()
        sha = hashlib.sha1(body).hexdigest()
        c, out = req("POST", "https://api.vercel.com/v2/files", token, raw=body,
                     headers={"Content-Type": "application/octet-stream", "x-vercel-digest": sha, "x-vercel-team-id": TEAM})
        if c >= 400:
            sys.exit(f"upload {rel} failed: {c} {out}")
        files.append({"file": str(rel), "sha": sha, "size": len(body)})
        total += len(body)
    print(f"  {len(files)} files, {total:,} bytes")
    c, out = req("POST", f"https://api.vercel.com/v13/deployments?teamId={TEAM}&skipAutoDetectionConfirmation=1", token,
                 {"name": PROJECT, "project": PROJECT, "target": "production", "files": files,
                  "projectSettings": {"framework": None}})
    if c >= 400 or out.get("error"):
        sys.exit(f"create failed: {c} {json.dumps(out.get('error'))}")
    url = out["url"]
    print(f"  deploying https://{url}")
    for _ in range(100):
        time.sleep(3)
        _, d = req("GET", f"https://api.vercel.com/v13/deployments/{url}?teamId={TEAM}", token)
        s = d.get("readyState")
        if s in ("READY", "ERROR", "BLOCKED", "CANCELED"):
            print(f"  {s} {d.get('errorMessage') or ''}")
            sys.exit(0 if s == "READY" else 1)
    sys.exit("timed out")


if __name__ == "__main__":
    tok = os.environ.get("VERCEL_TOKEN") or sys.exit("VERCEL_TOKEN is not set")
    setup(tok) if "--setup" in sys.argv else deploy(tok)
