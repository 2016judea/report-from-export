#!/usr/bin/env python3
"""Write site/index.html and one site/for/<token>/index.html per lead, from tool.json + render.js.

The page opens on the duty the way an employer wrote it in a job posting, then shows the
tool already doing that step on a worked example, so the visitor sees the job as a step
rather than a hire within one screen. /for/<token>/ pages open on that employer's own
posting line (product-paywall rule 3: a path token is the only per-recipient signal).

Generated output: never hand-edit site/index.html or site/for/; edit this, tool.json or
render.js and re-run.
"""
import html, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
T = json.loads((ROOT / "tool.json").read_text())
RENDER = (ROOT / "render.js").read_text()
POSTHOG = (Path(__file__).resolve().parent / "posthog_snippet.html").read_text().replace("__SITE__", T["product"])
E = html.escape


def page(lead=None):
    quote = lead["quote"] if lead else T["duty_quote"]
    who = (f'{E(lead["employer"])}&rsquo;s job posting, {E(lead["posted_label"])}' if lead
           else f'{T["employer_count"]} Twin Cities employers posted this step in the last 30 days')
    boot = {"product": T["product"], "token": lead["token"] if lead else "", "free_items": T["free_items"],
            "item_word": T["item_word"], "example_output": T["example_output"], "price": T["price_usd"]}
    title = T["name"]
    FIRST = f"the first {T['free_items']} {E(T['item_word'])}" if T["free_items"] > 1 else f"the first {E(T['item_word_singular'])}"
    FILES = ('<div class="row"><label class="btn ghost" style="background:transparent;color:var(--ink);border:1px solid var(--rule)">'
             f'Add files<input id="files" type="file" multiple accept="{T["accepts_files"]}" hidden></label>'
             f'<span class="hint" id="fileList">{E(T.get("files_hint","PDFs or photos, up to 3 MB together"))}</span></div>') if T.get("accepts_files") else ""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(T['meta'])}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23{T['accent'].lstrip('#')}'/></svg>">
{POSTHOG}
<style>
:root{{--bg:#f7f5f0;--ink:#16140f;--muted:#6b665c;--rule:#ddd7cb;--card:#fff;--accent:{T['accent']};--onaccent:#fff;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--serif:Georgia,"Times New Roman",serif}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{--bg:#14130f;--ink:#efece4;--muted:#a39d90;--rule:#36332c;--card:#1d1c17}}}}
*{{box-sizing:border-box}}html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--sans)}}
.wrap{{max-width:1120px;margin:0 auto;padding:28px 16px 64px}}
.eyebrow{{font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}}
h1{{font:400 clamp(28px,5.4vw,52px)/1.08 var(--serif);margin:10px 0 8px;letter-spacing:-.01em;max-width:22ch}}
h1 q{{quotes:"\\201C" "\\201D"}}
.src{{font-size:14px;color:var(--muted);margin:0 0 18px}}
.turn{{font-size:clamp(18px,2.4vw,22px);margin:0 0 22px;max-width:46ch}}
.turn b{{color:var(--accent)}}
.grid{{display:grid;grid-template-columns:1fr;gap:14px}}
@media (min-width:900px){{.grid{{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}}}}
.pane{{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px;min-width:0}}
.pane h2{{font:600 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;display:flex;justify-content:space-between;gap:8px;align-items:center}}
textarea{{width:100%;min-height:300px;font:14px/1.45 var(--mono);color:var(--ink);background:transparent;border:1px solid var(--rule);border-radius:8px;padding:10px;resize:vertical}}
@media (max-width:899px){{textarea{{min-height:200px}}.grid>.pane:nth-child(2){{order:-1}}#out{{max-height:62vh;overflow:auto}}.turn{{font-size:17px;margin-bottom:14px}}.src{{margin-bottom:10px}}}}
.row{{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}}
button,.btn{{font:600 16px var(--sans);border:0;border-radius:9px;padding:12px 18px;cursor:pointer;background:var(--accent);color:var(--onaccent);min-height:44px;text-decoration:none;display:inline-flex;align-items:center}}
button.ghost{{background:transparent;color:var(--ink);border:1px solid var(--rule)}}
button:disabled{{opacity:.55;cursor:wait}}
.hint{{font-size:13px;color:var(--muted)}}
#out{{min-height:120px}}
.err{{color:#b3261e;font-size:14px}}
.lock{{border:1px dashed var(--accent);border-radius:10px;padding:12px 14px;margin-top:12px;font-size:15px}}
.pay{{margin-top:40px;border-top:1px solid var(--rule);padding-top:26px;max-width:640px}}
.pay h3{{font:400 26px/1.2 var(--serif);margin:0 0 6px}}
.pay ul{{margin:8px 0 14px;padding-left:20px}}
.pw{{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}}
.pw input{{font:16px var(--mono);padding:10px;border:1px solid var(--rule);border-radius:8px;background:var(--card);color:var(--ink);min-height:44px;flex:1;min-width:0}}
#checkout{{margin-top:14px}}
.custom{{margin-top:34px;font-size:15px;color:var(--muted);max-width:640px}}
.custom a{{color:var(--ink)}}
.foot{{margin-top:40px;border-top:1px solid var(--rule);padding-top:12px;font-size:13px;color:var(--muted);max-width:72ch}}
.foot a{{color:var(--muted)}}
.unl{{font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;background:var(--accent);color:var(--onaccent);border-radius:4px;padding:3px 7px}}
{T.get('css','')}
</style>
<script>window.va=window.va||function(){{(window.vaq=window.vaq||[]).push(arguments)}};</script><script defer src="/_vercel/insights/script.js"></script>
</head><body><main class="wrap">
<div class="eyebrow">{who}</div>
<h1><q>{E(quote)}</q></h1>
<p class="src">{E(T['source_line'])}</p>
<p class="turn">{T['turn_html']}</p>
<div class="grid">
 <section class="pane"><h2><span>{E(T['input_label'])}</span><span id="inState" class="hint">example</span></h2>
  <textarea id="inp" spellcheck="false" aria-label="{E(T['input_label'])}">{E(T['example_input'])}</textarea>
  {FILES}<div class="row"><button id="run">{E(T['run_label'])}</button><button class="ghost" id="clear">Paste your own</button></div>
  <p class="hint" id="freeLine">Free: {FIRST} of whatever you paste. $5 once: all of them, {E(T['paid_extra'])}.</p>
 </section>
 <section class="pane"><h2><span>{E(T['output_label'])}</span><span id="outState" class="hint">done on the example</span></h2>
  <div id="out"></div>
 </section>
</div>
<section class="pay" id="pay">
 <h3 id="payH">All of them, for $5</h3>
 <p id="payP">{E(T['pay_line'])}</p>
 <div class="row"><button id="buy">Unlock for $5</button><span class="hint">Once. Card or Link, through Stripe.</span></div>
 <div id="checkout"></div>
 <div class="pw"><input id="pwIn" placeholder="Have a password? XXXX-XXXX-XXXX" autocomplete="off" aria-label="Password"><button class="ghost" id="pwGo">Unlock</button></div>
 <p class="hint" id="pwMsg"></p>
</section>
<p class="custom" id="custom">Want this built around your team&rsquo;s actual workflow? <a id="customLink" href="mailto:aidan@brickandmortar.dev?subject={E(T['name'])}%20for%20our%20team">Email aidan@brickandmortar.dev</a>.</p>
<footer class="foot">{T['foot_html']}<br>Built by <a href="https://brickandmortar.dev">Brick &amp; Mortar</a>, Minneapolis. The example is synthetic. What you paste is sent to the model to do the work and is not stored.</footer>
</main>
<script src="https://js.stripe.com/v3/"></script>
<script>
const BOOT={json.dumps(boot)};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}}[c]));
const track=(name,data={{}})=>{{data={{...data,token:BOOT.token}};try{{window.va("event",{{name,data}})}}catch(e){{}}try{{if(window.posthog&&posthog.capture)posthog.capture(name,data)}}catch(e){{}}}};
let PW=null;try{{PW=localStorage.getItem("pw:"+BOOT.product)}}catch(e){{}}
let LAST=null;let FILES=[];
const fi=document.getElementById("files");if(fi)fi.onchange=async()=>{{FILES=[];let tot=0;for(const f of fi.files){{if(tot+f.size>3.2e6)break;tot+=f.size;const b64=await new Promise(r=>{{const R=new FileReader();R.onload=()=>r(String(R.result).split(",")[1]);R.readAsDataURL(f)}});FILES.push({{name:f.name,type:f.type,data:b64}})}}$("fileList").textContent=FILES.map(f=>f.name).join(", ")||"none";$("inState").textContent="yours";track("files_added",{{n:FILES.length}})}};
{RENDER}
function show(out){{LAST=out;const el=$("out");el.innerHTML="";renderOutput(out,el,!!out.unlocked);
 if(!out.unlocked&&out.total>out.shown){{const d=document.createElement("div");d.className="lock";d.innerHTML=`It did the first ${{out.shown}} of your ${{out.total}} ${{esc(BOOT.item_word)}}. <a href="#pay" id="lockA">Unlock all ${{out.total}} for $5</a>.`;el.appendChild(d);$("lockA").onclick=()=>track("paywall_click",{{why:"more_items"}})}}}}
show({{...BOOT.example_output,unlocked:false,shown:0,total:0}});
$("clear").onclick=()=>{{$("inp").value="";$("inp").focus();$("inState").textContent="yours";track("paste_own")}};
$("inp").addEventListener("input",()=>{{$("inState").textContent="yours"}},{{once:true}});
$("run").onclick=async()=>{{const b=$("run");b.disabled=true;b.textContent="Working…";$("outState").textContent="working";track("run",{{own:$("inState").textContent==="yours",unlocked:!!PW}});
 try{{const r=await fetch("/api/run",{{method:"POST",headers:{{"Content-Type":"application/json",...(PW?{{"x-password":PW}}:{{}})}},body:JSON.stringify({{input:$("inp").value,files:FILES}})}});const j=await r.json();
  if(!r.ok){{$("out").innerHTML=`<p class="err">${{esc(j.error||"Something went wrong.")}}</p>`;$("outState").textContent="error";track("run_error",{{status:r.status}});if(r.status===401){{PW=null;try{{localStorage.removeItem("pw:"+BOOT.product)}}catch(e){{}}}}}}
  else{{show(j);$("outState").textContent=j.unlocked?"done, unlocked":"done";track("run_ok",{{shown:j.shown,total:j.total}})}}}}
 catch(e){{$("out").innerHTML='<p class="err">Network hiccup. Try again.</p>'}}
 b.disabled=false;b.textContent={json.dumps(T['run_label'])}}};
function unlockedUI(via){{$("payH").innerHTML='<span class="unl">Unlocked</span> Every run does all of them';$("payP").textContent="Your password is saved in this browser. It works on any device.";$("buy").parentNode.hidden=true;$("freeLine").textContent="Unlocked: every {E(T['item_word_singular'])} you paste, {E(T['paid_extra'])}.";track("unlock",{{via}})}}
async function tryPw(pw,via){{const r=await fetch("/api/check",{{method:"POST",headers:{{"x-password":pw}}}});if(r.ok){{PW=pw;try{{localStorage.setItem("pw:"+BOOT.product,pw)}}catch(e){{}}unlockedUI(via);return true}}$("pwMsg").textContent="That password didn't match.";return false}}
$("pwGo").onclick=()=>tryPw($("pwIn").value.trim(),"typed");
let CO=null;
$("buy").onclick=async()=>{{track("checkout_open");if(CO){{$("checkout").scrollIntoView({{behavior:"smooth"}});return}}
 const b=$("buy");b.disabled=true;try{{const r=await fetch("/api/checkout",{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify({{token:BOOT.token}})}});const j=await r.json();if(!j.clientSecret)throw 0;
 const st=Stripe({json.dumps(T['stripe_pk'])});CO=await st.initEmbeddedCheckout({{fetchClientSecret:async()=>j.clientSecret}});CO.mount("#checkout")}}catch(e){{$("pwMsg").textContent="Checkout couldn't start. Try again in a minute."}}b.disabled=false}};
$("customLink").onclick=()=>track("custom_click");
(async()=>{{const u=new URLSearchParams(location.search);const sid=u.get("paid"),pw=u.get("pw");
 if(pw){{await tryPw(pw,"link")}}else if(PW){{unlockedUI("stored")}}
 if(sid){{const r=await fetch("/api/session-status?session_id="+encodeURIComponent(sid));const j=await r.json();
  if(j.paid&&j.password){{track("paid");$("payH").textContent="Paid. Your password:";$("payP").innerHTML=`<b style="font:600 22px var(--mono);letter-spacing:2px">${{esc(j.password)}}</b><br>It is also in the Stripe receipt sent to ${{esc(j.email||"your email")}}. Keep it: it unlocks this tool on any device.`;PW=j.password;try{{localStorage.setItem("pw:"+BOOT.product,PW)}}catch(e){{}}$("buy").parentNode.hidden=true;$("pay").scrollIntoView()}}}}
 track("preview_open")}})();
</script></body></html>"""


def main():
    site = ROOT / "site"
    (site / "index.html").write_text(page())
    shutil.rmtree(site / "for", ignore_errors=True)
    leads = json.loads((ROOT / "leads.json").read_text()) if (ROOT / "leads.json").exists() else []
    for L in leads:
        d = site / "for" / L["token"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(page(L))
    print(f"wrote index + {len(leads)} /for/ pages")


if __name__ == "__main__":
    main()
