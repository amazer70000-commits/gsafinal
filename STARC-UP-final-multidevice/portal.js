/* ===================== STARC-UP PORTAL (login · command center · rounds · admin) ===================== */
const API = { roster: '/api/roster', login: '/api/login', adminLogin: '/api/admin-login', evaluate: '/api/evaluate', health: '/api/health', test: '/api/test', state: '/api/state' };
const PORTAL = {
  SHEET_CSV: "https://docs.google.com/spreadsheets/d/1HfrtzJy4iMNAbBau30HJFAlb0Boylnr_bS-vj2r5NAU/export?format=csv&gid=1963772888", // REGISTRATION sheet (live) - names + auto passwords. Sheet must be shared "Anyone with the link: Viewer".
  CLOUD: "",       // Legacy direct Firebase URL disabled. Shared state now uses the secure Vercel /api/state backend.
  SHEETS: { // RESPONSE sheets the ML models read automatically (share as "Anyone with the link: Viewer")
    1: "https://docs.google.com/spreadsheets/d/1C6sH5FWt7hPv8hZi4VlWlcajAjn11eEVTNlOjigxMxg/export?format=csv",
    2: "https://docs.google.com/spreadsheets/d/15Mb8uLsHD6kj5kFpoDZoIcY-jhBHaROeTy3Yj0snLqM/export?format=csv&gid=557978367" },
  SHORT_PCT: 0.4, // Round 1: share of entries shortlisted automatically (0.4 = top 40%). Round 2 always has ONE winner.
  FORMS: { pre1: "https://producttrialsurvey.geministudentambassador.com/", sub1: "https://forms.gle/MEhdtkk1YX2hZ71TA",
           pre2: "", sub2: "https://docs.google.com/forms/d/165JziQC52kJyCpHRTkfHkLZtmTyaWVDyIVv2mc6-wjI/edit?ts=6ac6228b",
           post: "https://producttrialfeedback.geministudentambassador.com/" }, // pre1 = R1 pre-survey, sub1/sub2 = submission forms, post = final feedback (opens LAST)
  MEET: "",        // Google Meet link for Round 2 briefing
  REFS: [],        // Round 2 reference links: [{n:"Shortlisted form 1", u:"https://..."}]
  VIDEO: "",       // BACKGROUND VIDEO for every portal page (empty = site background). e.g. "portal-bg.mp4"
  MUSIC: "",       // BACKGROUND MUSIC for the portal (empty = keeps site music)
  PW_SUFFIX: "@1234", // password = first 4 letters of the first real word of the name (initials ignored) + this. T.Rajan -> RAJA@1234
  SAMPLE: { u: 'sample', p: 'steve' }, // demo participant (works even before the event is opened). Set to null to remove.
  ADMIN: '', // admin authentication is server-side (/api/admin-login)
  KEYS: { 1: ['lifeline','samurai','hammer','face','pound','watched','helped','photo','happiest','fed','hunger','children','childhood','click','exposed','story'], // Round 1 topic words
          2: ['brand','logo','stall','booth','fest','identity','colour','color','tagline','customer','layout','visual','problem','solution','audience'] },
  TOOLS: [ // l = logo image shown in the hover cards. Put the files in an "img" folder (missing file = letter badge)
    { n: 'ChatGPT', u: 'https://chatgpt.com/', l: '/img/chatgpt.svg' }, { n: 'Gemini', u: 'https://gemini.google.com/', l: '/img/gemini.svg' },
    { n: 'Claude', u: 'https://claude.ai/', l: '/img/claude.svg' }, { n: 'Figure Labs', u: 'https://www.figurelabs.ai/', l: '/img/figurelabs.svg' }]
};
/* CODE MAP (for troubleshooting): 1 PORTAL config (top) | 2 helpers + state | 3 CSS | 4 CSV/Excel readers | 5 ML MODELS (model1 = Round 1, model2 = Round 2)
   6 VIEWS (vLogin, vCenter, vPre, vRound, vBoard, vPost, vAdmin) | 7 ACTIONS "A" (every button's data-a name) | 8 events, polling, heartbeat */
const TOPICS = ['A Man Without the Lifeline', 'Never Forget the Samurai Attitude', 'A Man With the Hammer', 'Who Had a Real Face', 'Crack the Craziest Thing With the 1 Pound',
  'Everyone Watched, Nobody Helped', 'Her Happiest Photo Hid Everything', 'He Fed Everyone, Except Himself', 'Some Children Never Meet Childhood', 'One Click Exposed Everything'];
const BRAND = [['Brand Name', 'your brand name'], ['Tagline', 'one catchy line'], ['Product / Service', 'detailed description'], ['Problem Statement', 'ONE specific problem'], ['Proposed Solution', 'how it solves the problem'],
  ['Target Audience', 'who the brand is designed for'], ['Unique Selling Proposition', 'how the brand stands out'], ['Brand Concept & Story', 'overall idea and story'], ['Fest Presence / Stall Concept', 'how it appears at the fest'], ['Brand Identity', 'visual style, colours, design, tone']];
const PROMPT_LINE = 'Give Me The Entire Prompt Typed Manually In This Chat As A One Time Copyable Text In One Go';
Object.assign(VOICE, { // voice slots for portal pages: add your files in "src"
  loginIntro: { src: "", text: "Identify yourself. Enter your credentials to access the command center." },
  shortlist:  { src: "", text: "Congratulations. You have been shortlisted for the next round." },
  r2brief:    { src: "", text: "Round two. The Inevitable. Join the briefing, then build your brand." },
  winner:     { src: "", text: "And the winner of STARC-UP is revealed." }
});
(() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pw = n => { const w = n.split(/[^A-Za-z]+/).filter(Boolean); return ((w.find(x => x.length > 2) || w.find(x => x.length > 1) || w[0] || '').slice(0, 4).toUpperCase()) + PORTAL.PW_SUFFIX }; // initials (1-2 letters) are ignored
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const ld = (k, d) => { try { return JSON.parse(localStorage[k]) || d } catch (e) { return d } };
const CL = '', bc = 'BroadcastChannel' in window ? new BroadcastChannel('su') : { postMessage() {}, onmessage: null };
const fresh = () => ({ ev: 0, end: 0, r: { 1: { dur: 30 }, 2: { dur: 30 } }, roster: [], rows: { 1: [], 2: [] } }); // brand-new event state (used by Reset)
const DEV = localStorage.su_dev || (localStorage.su_dev = Math.random().toString(36).slice(2) + Date.now().toString(36)); // device id -> ONE login per device
const sure = t => confirm(t) && confirm('SECOND CONFIRMATION - this cannot be undone. Continue?'); // double confirmation for deletes
const short = (n, len) => n == 1 ? Math.max(1, Math.round(len * PORTAL.SHORT_PCT)) : 1; // auto shortlist size (R2 = 1 winner)
let uv = '', ctl = ld('su_ctl', fresh()), mem = ld('su_mem', {}),
    me = (() => { try { return JSON.parse(sessionStorage.su_me) } catch (e) { return null } })(), tab = 'p', roster = [], msg = '', last = '', tries = 0, lock = 0;
const stateHeaders = () => me?.session ? { 'Content-Type':'application/json', 'Authorization':'Bearer '+me.session } : { 'Content-Type':'application/json' };
const syncCtl = async () => { if(!me?.session) return; try { const r=await fetch(API.state+'?resource=ctl',{headers:stateHeaders(),cache:'no-store'}); const j=await r.json(); if(r.ok&&j.ok&&j.data) { ctl=j.data; localStorage.su_ctl=JSON.stringify(ctl); render(); } } catch(e) {} };
const syncMem = async k => { if(!me?.session) return; try { const r=await fetch(API.state+'?resource=mem&key='+encodeURIComponent(k),{headers:stateHeaders(),cache:'no-store'}); const j=await r.json(); if(r.ok&&j.ok&&j.data) { mem[k]=j.data; localStorage.su_mem=JSON.stringify(mem); render(); } } catch(e) {} };
const sv = () => { localStorage.su_ctl = JSON.stringify(ctl); bc.postMessage(1); if(me?.role==='a'&&me.session) fetch(API.state+'?resource=ctl',{method:'PUT',headers:stateHeaders(),body:JSON.stringify(ctl)}).catch(()=>{}); render() };
const svm = k => { localStorage.su_mem = JSON.stringify(mem); bc.postMessage(1); if(me?.session) fetch(API.state+'?resource=mem&key='+encodeURIComponent(k),{method:'PUT',headers:stateHeaders(),body:JSON.stringify(mem[k])}).catch(()=>{}); render() };
const sme = () => { sessionStorage.su_me = JSON.stringify(me); render() };
const key = n => norm(n).replace(/\W/g, '_');
const R = n => ctl.r[n], M = n => ((mem[me.k] ||= { name: me.name })[n] ||= {});
const b = (a, t, x = '', n = '') => `<button class="btn ${x}" data-a="${a}" data-n="${n}">${t}</button>`;
const mmss = e => { const s = Math.max(0, Math.floor((e - Date.now()) / 1000)); return String(s / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') };
const OK = (n, k) => !!(ctl.ok && ctl.ok[n] && ctl.ok[n][k]);
let warping = 0;
const names = () => { const m = new Map(); (ctl.roster || []).forEach(x => m.set(key(x), x)); Object.values(mem).forEach(x => m.has(key(x.name)) || m.set(key(x.name), x.name)); return [...m.values()] };
const online = k => { const m = mem[k]; return !!(m && m.dev && Date.now() - (m.hb || 0) < 60000) };
const live = n => R(n).subOpen && R(n).end > Date.now();

/* ---------- CSS ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
nav{z-index:60!important}
body.inp #home,body.inp #page404{display:none!important}
#portal{display:none;position:relative;z-index:30;min-height:100vh;padding:86px 5vw 70px;max-width:1200px;margin:0 auto}
body.inp #portal{display:block}
#portal h2,#portal h3{font-family:Sora;margin:6px 0 10px}#portal h2{font-size:clamp(24px,4vw,38px);color:var(--acc)}
#portal .card{margin:0 0 26px}#portal .btn{margin:4px 4px 4px 0}
#portal input,#portal textarea,#portal select{width:100%;max-width:420px;padding:12px 14px;margin:6px 0;border-radius:8px;border:1.5px solid var(--acc);background:var(--bg);color:var(--text);font:inherit}
#portal input[type=file]{border-style:dashed}#portal textarea{max-width:100%;min-height:120px}#portal input[type=number]{width:90px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:22px}.bar span{flex:1;font-family:Sora;font-size:12px;letter-spacing:.2em;color:var(--acc)}
.on{color:#12b76a}.off{color:var(--red)}.done{background:var(--acc)!important;color:var(--on)!important}.err{color:var(--red);font-weight:600}
.cc{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:34px;max-width:900px;margin:40px auto;perspective:1200px}
.tilt{transform-style:preserve-3d;transition:transform .15s;animation:fl 5s ease-in-out infinite;text-align:center;padding:44px 24px;cursor:pointer}
.tilt:nth-child(2){animation-delay:-2.5s}@keyframes fl{50%{translate:0 -14px}}
.tilt h2{font-size:clamp(28px,5vw,44px)!important}.tilt.lk{opacity:.55;cursor:not-allowed}
.ins{background:var(--text);color:var(--bg);border:3px solid var(--red);border-radius:16px;padding:26px 20px;text-align:center;margin:0 0 26px;box-shadow:0 0 40px rgba(var(--acc-rgb),.4)}
#portal .ins h2{color:var(--bg);font-size:clamp(28px,6vw,56px);margin:4px 0}.ins span{letter-spacing:.3em;font-size:12px;font-weight:700;color:var(--red)}
.tm{font:700 clamp(36px,8vw,72px) Sora;color:var(--red);text-align:center}
#portal table{width:100%;border-collapse:collapse;font-size:14px}#portal th,#portal td{padding:8px 10px;border-bottom:1px solid rgba(var(--acc-rgb),.35);text-align:left}
#portal td input{width:62px;padding:6px;margin:0}#portal th{color:var(--acc);font-family:Sora;font-size:12px;letter-spacing:.1em}.tw{overflow-x:auto}
.thumb{height:38px;border-radius:4px;cursor:zoom-in}.st li{margin:6px 0}.scene{perspective:1100px;height:370px;display:grid;place-items:center;overflow:hidden}
.ring{position:relative;width:210px;height:270px;transform-style:preserve-3d;animation:rr 26s linear infinite}.ring.one{animation:none}.scene:hover .ring{animation-play-state:paused}
@keyframes rr{to{transform:rotateY(-360deg)}}
.tc{position:absolute;inset:0;border:2px solid var(--acc);border-radius:18px;background:var(--panel);backdrop-filter:blur(6px);display:grid;place-items:center;align-content:center;text-align:center;cursor:pointer;transition:.3s;transform:rotateY(calc(var(--i)*var(--a)))translateZ(var(--z));font-family:Sora;font-weight:700}
.tc:hover{box-shadow:0 0 44px var(--acc);border-color:var(--red);scale:1.12}.tc .lg{font-size:60px;color:var(--acc);height:80px}.tc img{height:70px;max-width:150px;object-fit:contain}
.sheets{position:fixed;inset:0;perspective:800px;pointer-events:none;z-index:-1;overflow:hidden}
.sh{position:absolute;left:-60%;width:60%;height:15vh;top:calc(var(--y)*1%);border:1px solid rgba(var(--acc-rgb),.45);background:linear-gradient(90deg,transparent,rgba(var(--acc-rgb),.16),transparent);transform:rotateX(62deg) rotateZ(-12deg);animation:fs 10s linear infinite;animation-delay:calc(var(--d)*-1s)}
@keyframes fs{to{left:115%}}
#pvid{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.warp{position:fixed;inset:0;z-index:500;display:grid;place-items:center;background:radial-gradient(circle,#001a10,#000 70%);animation:wi .5s;overflow:hidden}.warp.out{animation:wo .7s forwards}
.warp i{position:absolute;left:50%;top:50%;width:90px;height:90px;margin:-45px;border:3px solid var(--acc);border-radius:50%;animation:wv 1.4s ease-out infinite;box-shadow:0 0 30px var(--acc),inset 0 0 30px var(--acc)}
.warp i:nth-child(2){animation-delay:.35s;border-color:var(--red)}.warp i:nth-child(3){animation-delay:.7s}
.warp b{position:relative;font:700 clamp(18px,4vw,40px) Sora;letter-spacing:.35em;color:#e6f4ec;text-align:center;text-shadow:0 0 20px var(--acc);animation:wt .7s}
@keyframes wi{from{opacity:0}}@keyframes wo{to{opacity:0;transform:scale(1.4)}}@keyframes wv{from{transform:scale(0);opacity:1}to{transform:scale(30);opacity:0}}@keyframes wt{from{opacity:0;letter-spacing:1em;filter:blur(10px)}}
.big{font:700 clamp(30px,7vw,70px) Sora;text-align:center;color:var(--acc);margin:30px 0}.pul{animation:pulse 1.6s infinite}
/* admin layout + round pages + hover images */
.anav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px;padding:10px;border:1px solid rgba(var(--acc-rgb),.4);border-radius:14px;background:var(--panel)}
.anav .btn{margin:0!important;flex:1 1 140px;border-radius:999px;padding:11px 12px}
.stg{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:12px 0}
.stp{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(var(--acc-rgb),.35);border-radius:12px;background:rgba(var(--acc-rgb),.05)}
.stp i{font:700 10px Sora;color:var(--acc);font-style:normal;letter-spacing:.2em}.stp.ok{border-color:#12b76a}
#portal .stp .btn,#portal .stp input{width:100%;max-width:none;margin:0;box-sizing:border-box}
.stats{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0}.stats div{flex:1 1 140px;text-align:center;padding:16px;border:1px solid var(--acc);border-radius:12px;font-size:11px;letter-spacing:.18em}.stats b{display:block;font:700 34px Sora;color:var(--acc)}
.dz{border-color:var(--red)!important}.yes{color:#12b76a;font-weight:700}.no{color:var(--red)}.win td{background:rgba(255,190,0,.2);font-weight:700}
.topics{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:10px 0}.tp{padding:12px 14px;border:1px solid rgba(var(--acc-rgb),.5);border-radius:10px;background:var(--panel);transition:.25s}
.tp:hover{transform:translateY(-3px);border-color:var(--red)}.tp b{color:var(--acc);font-family:Sora;margin-right:8px}
.tc img{transition:.4s;animation:bob 3s ease-in-out infinite}.tc:hover img{transform:scale(1.45) rotate(-5deg);filter:drop-shadow(0 0 18px var(--acc));animation:none}@keyframes bob{50%{transform:translateY(-6px)}}
.cp{display:block;padding:12px;border:1px dashed var(--acc);border-radius:8px;font-family:monospace;word-break:break-word;margin:8px 0}
video{pointer-events:none;-webkit-touch-callout:none;user-select:none}video::-webkit-media-controls,video::-webkit-media-controls-start-playback-button,video::-webkit-media-controls-enclosure{display:none!important}
</style>`);
document.body.insertAdjacentHTML('beforeend', '<div id="portal"></div>');
const $p = document.getElementById('portal');

/* ---------- cinematic ---------- */
function warp(L, cb) {
  const w = document.createElement('div'); w.className = 'warp'; w.innerHTML = '<i></i><i></i><i></i>'; document.body.appendChild(w); let i = 0;
  const nx = () => { const o = w.querySelector('b'); o && o.remove(); if (i < L.length) { const e = document.createElement('b'); e.textContent = L[i++]; w.appendChild(e); setTimeout(nx, 800) } else { w.classList.add('out'); setTimeout(() => w.remove(), 700) } };
  nx(); setTimeout(cb, Math.max(700, L.length * 400));
}

/* ---------- csv / roster / scoring ---------- */
function csv(t) { const r = []; let c = [], f = '', q = 0; for (let i = 0; i < t.length; i++) { const h = t[i];
  if (q) { if (h == '"') { if (t[i + 1] == '"') { f += '"'; i++ } else q = 0 } else f += h } else if (h == '"') q = 1; else if (h == ',') { c.push(f); f = '' }
  else if (h == '\n' || h == '\r') { if (h == '\r' && t[i + 1] == '\n') i++; c.push(f); r.push(c); c = []; f = '' } else f += h }
  if (f || c.length) { c.push(f); r.push(c) } return r.filter(x => x.some(y => y.trim())) }

/* ---------- Excel (.xlsx) / CSV reader (built in, no external library) ---------- */
async function xlsx(f) {
  const u = new Uint8Array(await f.arrayBuffer()), dv = new DataView(u.buffer); let e = u.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw Error('That is not an .xlsx file (old .xls must be saved as .xlsx).');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const F = {};
  for (let i = 0; i < n; i++) { const nl = dv.getUint16(p + 28, true); F[new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), cs: dv.getUint32(p + 20, true), lo: dv.getUint32(p + 42, true) }; p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true) }
  const get = async nm => { const x = F[nm]; if (!x) return ''; const s = x.lo + 30 + dv.getUint16(x.lo + 26, true) + dv.getUint16(x.lo + 28, true); let d = u.subarray(s, s + x.cs);
    if (x.m === 8) d = new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); return new TextDecoder().decode(d) };
  const X = t => new DOMParser().parseFromString(t, 'text/xml');
  const ss = [...X(await get('xl/sharedStrings.xml')).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const sh = Object.keys(F).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0]; if (!sh) throw Error('No worksheet found.');
  const rows = []; for (const r of X(await get(sh)).getElementsByTagName('row')) { const row = [];
    for (const c of r.getElementsByTagName('c')) { const col = c.getAttribute('r').replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1, t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('t')[0];
      row[col] = t == 's' ? ss[+v.textContent] : t == 'inlineStr' ? (is ? is.textContent : '') : v ? v.textContent : '' }
    rows.push(Array.from(row, x => x ?? '')) }
  return rows.filter(r => r.some(x => String(x).trim()));
}
const readRows = async f => /\.xlsx$/i.test(f.name) ? xlsx(f) : csv(await f.text());
const rowsCsv = rows => rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
const rowsObjs = rows => { const [h, ...r] = rows; return r.map(x => Object.fromEntries(h.map((k, i) => [String(k).toLowerCase().trim(), String(x[i] ?? '').trim()]))) };
async function fetchCsv(u) { // tries gviz first (CORS-friendly), then export; throws if the sheet is private / blocked
  const g = u.replace(/export\?format=csv(&gid=(\d+))?/, (m, a, id) => 'gviz/tq?tqx=out:csv' + (id ? '&gid=' + id : '')); let err;
  for (const x of [g, u]) { try { const r = await fetch(x, { cache: 'no-store' }); const t = await r.text(); if (r.ok && !/<html/i.test(t.slice(0, 500)) && t.trim()) return t } catch (e) { err = e } }
  throw err || new Error('sheet not readable') }
const objs = t => rowsObjs(csv(t));
const nameOf = o => o[Object.keys(o).find(k => /name/.test(k) && !/college|school|team/.test(k))] || '';
async function loadRoster() {
  try {
    const r = await fetch(API.roster, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !j.ok) throw Error(j.error || 'Registration service unavailable');
    roster = (j.participants || []).map(x => x.name).filter(Boolean);
    return;
  } catch (apiErr) {
    // Local fallback is retained for offline/demo use, but the admin diagnostics will expose it.
    if (PORTAL.SHEET_CSV) {
      try { roster = objs(await fetchCsv(PORTAL.SHEET_CSV)).map(nameOf).filter(Boolean); if (roster.length) return } catch (sheetErr) {}
    }
    roster = ctl.roster || [];
  }
}
const CR = { 1: [['Prompt', 30], ['Accuracy', 40], ['Creativity', 30]], 2: [['Brand Idea', 25], ['Identity & Document', 20], ['Stall Visualization', 30], ['Stall Accuracy', 25]] };
/* ---------- ML MODELS: a SEPARATE model per round. Input = one Google-Form response row, output = marks per criterion (see CR) ---------- */
const W = t => (t.match(/[a-z']+/g) || []), clamp = x => Math.max(0, Math.min(1, x));
const textOf = o => Object.entries(o).filter(([k, v]) => !/name|mail|time|phone|college|year|dept|roll|reg/.test(k) && !/^https?:/i.test(v)).map(x => x[1]).join(' ').toLowerCase(); // answer text only
const STYLE = ['cinematic', 'lighting', 'realistic', 'detailed', 'dramatic', 'close-up', 'wide', '4k', 'shadow', 'texture', 'mood', 'background', 'foreground', 'colour', 'color', 'angle'];
const EMO = ['emotion', 'tears', 'alone', 'lonely', 'pain', 'hope', 'fear', 'silence', 'crowd', 'struggle', 'sacrifice', 'hunger', 'innocent', 'broken', 'dark', 'light'];
const BR = [['name'], ['tagline'], ['product', 'service'], ['problem'], ['solution'], ['audience', 'target'], ['unique', 'usp', 'differen'], ['concept', 'story'], ['stall', 'fest', 'booth'], ['identity', 'colour', 'color', 'design', 'tone']]; // the 10 brand-document sections
function model1(o) { // ROUND 1 model -> [Prompt 30, Accuracy 40, Creativity 30]
  const t = textOf(o), w = W(t), n = w.length, len = n < 8 ? n / 8 : n > 150 ? .7 : 1,   // prompt length sweet-spot
    sty = clamp(STYLE.filter(k => t.includes(k)).length / 5),                              // prompt-engineering vocabulary
    topic = clamp(PORTAL.KEYS[1].filter(k => t.includes(k)).length / 3),                   // closeness to the 10 round-1 topics
    emo = clamp(EMO.filter(k => t.includes(k)).length / 4), div = n ? new Set(w).size / n : 0;
  return [Math.round(30 * clamp(.5 * len + .5 * sty)), Math.round(40 * clamp(.7 * topic + .3 * len)), Math.round(30 * clamp(.4 * emo + .3 * div + .3 * sty))];
}
function model2(o) { // ROUND 2 model -> [Brand Idea 25, Identity & Document 20, Stall Visualization 30, Stall Accuracy 25]
  const t = textOf(o), n = W(t).length, cov = BR.filter(g => g.some(k => t.includes(k))).length / BR.length, // how many of the 10 sections are covered
    has = re => clamp((t.match(re) || []).length / 3), img = Object.values(o).some(v => /^https?:/i.test(v)) ? 1 : 0, depth = clamp(Math.log2(1 + n) / 8);
  return [Math.round(25 * clamp(.5 * cov + .3 * depth + .2 * has(/tagline|unique|usp|story/g))), Math.round(20 * clamp(.6 * cov + .4 * has(/colou?r|identity|tone|design/g))),
    Math.round(30 * clamp(.4 * has(/stall|booth|fest|layout|visual/g) + .3 * img + .3 * depth)), Math.round(25 * clamp(.5 * cov + .3 * has(/stall|fest/g) + .2 * img))];
}
function score(o, n) { const m = (n == 1 ? model1 : model2)(o); // a numeric column named like a criterion overrides the model
  return CR[n].map(([c, mx], i) => { const col = Object.keys(o).find(k => k.startsWith(c.toLowerCase().split(/[ &]/)[0])), v = col ? parseFloat(o[col]) : NaN; return isNaN(v) ? m[i] : Math.min(mx, v) }) }
const tot = r => r.m.reduce((a, x) => a + (+x || 0), 0);

/* ---------- views ---------- */
const bar = () => `<div class="bar"><span>${me.role == 'a' ? 'ADMIN // COMMAND' : '// ' + esc(me.name)}</span>${b('home', '◂ Home')}${b('out', 'Logout')}</div>`;
const sheets = () => '<div class="sheets">' + [8, 22, 38, 54, 70, 84].map((y, i) => `<div class="sh" style="--y:${y};--d:${i * 1.7}"></div>`).join('') + '</div>';
const vLogin = () => `<div class="card" style="max-width:520px;margin:30px auto"><span class="tag">// ACCESS CONTROL</span><h2>Login</h2>
 ${b('tp', 'Participant', tab == 'p' ? 'done' : '')}${b('ta', 'Admin', tab == 'a' ? 'done' : '')}
 <input id="lu" value="${esc(uv)}" placeholder="${tab == 'p' ? 'Username (your full name)' : 'Admin username'}" autocomplete="username"><input id="lp" type="password" placeholder="Password" autocomplete="current-password">
 <p class="err">${esc(msg)}</p>${b('login', 'Authenticate', 'red big')}</div>`;
const vCenter = () => { const card = n => { const r = R(n), top = R(1).top, ok = r.login && (n == 1 || !top || top.some(t => norm(t.name) == norm(me.name)));
  return `<div class="card tilt ${ok ? '' : 'lk'}" data-a="enter" data-n="${n}"><span class="tag">ROUND 0${n}</span><h2>${n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE'}</h2><b class="${r.login ? 'on' : 'off'}">● SYSTEM ${r.login ? 'ONLINE' : 'OFFLINE'}</b></div>` };
  return bar() + `<span class="tag">// STARC-UP COMMAND CENTER</span><h2>Welcome, ${esc(me.name)}</h2><div class="cc">${card(1)}${card(2)}</div>` };
const vPre = n => { const m = M(n), r = R(n), L = 'Pre-Survey';
  if (n == 2) return bar() + `<div class="card"><span class="tag">ROUND 02 // STANDBY</span><h2>Shortlisted - stand by</h2><p class="pul">Waiting for the admin to reveal Round 2...</p></div>`;
  return bar() + `<div class="card"><span class="tag">ROUND 0${n} // ${L.toUpperCase()}</span><h2>Access Protocol</h2><ol class="st"><li>Open the ${L} Form.</li><li>Complete and submit the form.</li><li>Take a screenshot showing successful submission.</li><li>Upload the screenshot to the portal.</li><li>Wait for verification / access unlock.</li></ol>
  ${b('form', 'Open ' + L + ' Form', 'red', n)}<br><input type="file" id="shot" accept="image/*" data-n="${n}">
  <p>${m.shot ? 'Screenshot uploaded.' : 'No screenshot yet.'} <b class="${OK(n, me.k) ? 'on' : 'off'}">${OK(n, me.k) ? '✔ VERIFIED' : 'AWAITING VERIFICATION'}</b></p>
  ${OK(n, me.k) && !r.reveal ? '<p class="pul">Verified. Waiting for the admin to open the round…</p>' : ''}</div>` };
/* Round 2 submission DEMONSTRATION (3 steps: brand document -> stall image -> prompt). SUBMIT unlocks after step 3. */
const demo = ds => { const S = [
  `<h3>1 · Brand Document</h3><p>Your document must contain these 10 sections, in this order:</p><ol class="st">${BRAND.map(x => `<li><b>${x[0]}</b> - ${x[1]}</li>`).join('')}</ol>${b('dl', '⬇ Download template')}`,
  `<h3>2 · Fest / Stall Visual Image</h3><p>Generate ONE image of how your brand looks at the college fest (stall front, branding, colours, crowd). Keep it as an image file - you upload it with the form.</p>`,
  `<h3>3 · Prompt (entire prompt)</h3><p>Paste this line in the Gemini chat where you made the image:</p><code class="cp">${PROMPT_LINE}</code>${b('copy', '⧉ Copy line')}<p>Gemini replies with your whole prompt as one copyable block. Copy that block into the form.</p>`];
  return `<div class="card"><span class="tag">DEMONSTRATION // STEP ${ds + 1} OF 3</span>${S[ds]}<p>${b('dnext', ds < 2 ? 'Next ▸' : '✔ Got it - unlock submit', 'red')}</p></div>` };
const vRound = n => { const m = M(n), r = R(n), tools = PORTAL.TOOLS.filter(t => n == 1 || t.n == 'Gemini'), a = 360 / tools.length, ds = m.ds || 0, ready = n == 1 || ds >= 3;
  return bar() + sheets() + `<div class="ins"><span>ROUND 0${n} // ${n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE'}</span><h2>Your One line stories to build</h2></div>
  <div class="card"><span class="tag">INSTRUCTIONS</span>${n == 1
   ? `<p>Pick <b>ONE</b> of the 10 topics:</p><div class="topics">${TOPICS.map((t, i) => `<div class="tp"><b>${String(i + 1).padStart(2, '0')}</b>${esc(t)}</div>`).join('')}</div>
   <ul class="st"><li>Write ONE precise prompt describing your story.</li><li>Generate the image with the AI tools below (hover a tool to see it).</li><li>Keep your best image and the exact prompt you used.</li><li>Submit before the timer ends. Marks: Prompt 30 · Accuracy 40 · Creativity 30.</li></ul>`
   : `<ul class="st"><li>Create a startup as an image - and pitch it.</li><li>Only <b>Google Gemini</b> is allowed.</li><li>Submit the <b>Brand Document</b>, the <b>Fest Stall image</b> and the <b>full prompt</b> (see the demonstration below).</li><li>Marks: Brand Idea 25 · Identity & Document 20 · Stall Visualization 30 · Accuracy 25.</li></ul>
   ${PORTAL.MEET ? `<a class="btn red" href="${esc(PORTAL.MEET)}" target="_blank" rel="noopener">Open Meeting</a>` : '<p class="err">Meeting link not set by admin yet.</p>'}
   ${PORTAL.REFS.map(x => `<a class="btn" href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.n)}</a>`).join('')}`}</div>
  <div class="card"><span class="tag">TIMER</span><div class="tm" data-t="${live(n) ? r.end : 0}">--:--</div>
  <p style="text-align:center">${live(n) ? '' : '<b class="pul">Waiting for the admin to open submissions…</b>'}${live(n) && !m.start ? b('start', 'START', 'red big', n) : ''}</p></div>
  ${m.start && !ready ? demo(ds) : ''}
  ${m.start ? `<div class="scene"><div class="ring ${tools.length == 1 ? 'one' : ''}" style="--a:${a}deg;--z:${tools.length == 1 ? 0 : 300}px">${tools.map((t, i) => `<div class="tc" style="--i:${i}" data-a="tool" data-u="${esc(t.u)}" data-t="${esc(t.n)}">${t.l ? `<img src="${esc(t.l)}" data-fb="${esc(t.n[0])}" alt="${esc(t.n)}" loading="eager">` : `<div class="lg">${esc(t.n[0])}</div>`}${esc(t.n)}</div>`).join('')}</div></div>
  ${ready ? `<p style="text-align:center">${b('submit', 'SUBMIT', 'red big', n)}${live(n) ? '' : '<br><b class="err">Submissions are closed.</b>'}</p>` : ''}` : ''}` };
const lbBtn = n => b('vb', '🏆 View Leaderboard', 'red', n); // participant button: opens the board only after the admin reveals it
const vThanks = n => bar() + `<div class="big">THANK YOU FOR YOUR RESPONSE</div><p style="text-align:center">${b('wait', 'Wait for result', 'red big', n)} ${lbBtn(n)}</p>`;
const vWait = n => bar() + `<div class="big pul">EVALUATION IN PROGRESS</div><p style="text-align:center">Stand by. Press the button once the admin announces the results.</p><p style="text-align:center">${lbBtn(n)}</p>`;
const vBoard = n => { const lb = R(n).lb || [], mine = (R(n).top || []).some(x => norm(x.name) == norm(me.name)), w = n == 2;
  return bar() + `<span class="tag">ROUND 0${n} // RESULTS</span><h2>${w ? '🏆 WINNER' : 'LEADERBOARD'}</h2>${n == 1 && mine ? '<div class="ins"><h2>CONGRATULATIONS</h2><span>YOU ARE SHORTLISTED FOR THE NEXT ROUND</span></div>' : ''}${w && mine ? '<div class="ins"><h2>YOU ARE THE WINNER 🏆</h2></div>' : ''}
  <div class="card tw"><table><tr><th>S.NO</th><th>NAME</th><th>${w ? 'WINNER' : 'SHORTLISTED'}</th></tr>${lb.map(x => `<tr class="${w && x.y ? 'win' : ''}"><td>${x.s}</td><td>${esc(x.name)}</td><td class="${x.y ? 'yes' : 'no'}">${x.y ? (w ? '🏆 YES' : 'YES') : 'NO'}</td></tr>`).join('') || '<tr><td colspan=3>-</td></tr>'}</table></div>
  ${w ? `<p style="text-align:center">${b('post', 'Continue → Feedback survey', 'red big')}</p>` : ''}` };
/* FINAL step of the workflow (after the winner reveal): post-survey feedback + screenshot upload, then the thank-you page */
const vPost = () => { const m = M(3); return bar() + `<div class="card"><span class="tag">FINAL STEP // FEEDBACK</span><h2>Post-Survey Feedback</h2><ol class="st"><li>Open the feedback form and complete it.</li><li>Take a screenshot showing successful submission.</li><li>Upload the screenshot here.</li></ol>${b('pform', 'Open Feedback Form', 'red')}<br><input type="file" id="shot" accept="image/*" data-n="3"><p>${m.shot ? '✔ Screenshot uploaded.' : 'No screenshot yet.'}</p>${m.shot ? b('fin', 'Finish', 'red big') : ''}</div>` };
const vEnd = () => `<div class="big">THANK YOU FOR BEING PART OF STARC-UP</div><p style="text-align:center">All systems nominal.</p>`;

function vAdmin() {
  const T = (a, t) => b('tab', t, me.tab == a ? 'done' : '', a);
  let h = bar() + `<div class="anav">${T('dash', '📊 Dashboard')}${T('acc1', '🔓 Round 1 Login')}${T('acc2', '🔓 Round 2 Login')}${T('eval', '🧠 ML Evaluate')}${T('board', '🏆 Leaderboard')}${T('set', '👥 Participants')}${T('diag', '🩺 Check Links')}</div>`;
  if (me.tab == 'dash') { // ---- DASHBOARD: event switch, 7-step control per round, live members, reset
    h += `<div class="card"><span class="tag">EVENT</span><h3>Status: <b class="${ctl.ev ? 'on' : 'off'}">${ctl.ev ? 'OPEN' : 'CLOSED'}</b></h3>${b('ev', ctl.ev ? '⏸ Close event' : '▶ Open event', ctl.ev ? '' : 'red')}${b('end', '■ End event → thank-you page', ctl.end ? 'done' : '')}</div>`;
    [1, 2].forEach(n => { const r = R(n), st = (i, t, a, f) => `<div class="stp ${f ? 'ok' : ''}"><i>STEP ${i}</i>${b(a, t, f ? 'done' : '', n)}</div>`;
      h += `<div class="card"><span class="tag">ROUND 0${n}</span><h3>${n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE'} <span class="${r.login ? 'on' : 'off'}">● ${r.login ? 'ONLINE' : 'OFFLINE'}</span></h3><div class="stg">
      ${st(1, '🔓 Login access', 'acc' + n, r.login)}${n == 1 ? st(2, '✔ Verify all', 'verall', 0) : ''}${st(3, '🚀 Reveal round', 'rev', r.reveal)}
      <div class="stp"><i>TIMER (MIN)</i><input type="number" id="dur${n}" min="1" value="${r.dur || 30}"></div>
      ${st(4, '▶ Open submissions', 'open', live(n))}${st(5, '■ Close submissions', 'close', r.closed)}${st(6, '🧠 ML evaluate', 'goev', (r.top || []).length)}${st(7, '🏆 Reveal leaderboard', 'bd', r.board)}</div>
      <p>Submission timer: <b data-t="${live(n) ? r.end : 0}">--:--</b> ${r.subOpen ? '' : '<i>(closed)</i>'}</p></div>` });
    const mm = Object.values(mem);
    h += `<div class="card tw"><span class="tag">MEMBERS LOGGED IN (${mm.length})</span><table><tr><th>#</th><th>NAME</th><th>LOGIN</th><th>R1 SHOT</th><th>VERIFIED</th><th>R1 DONE</th><th>R2 DONE</th></tr>
      ${mm.map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.name)}</td><td>${m.t ? new Date(m.t).toLocaleTimeString() : ''}</td><td>${m[1] && /^data:image\/jpeg/.test(m[1].shot || '') ? `<img class="thumb" src="${m[1].shot}" data-a="zoom">` : '—'}</td>
      <td>${b('ver1', OK(1, key(m.name)) ? '✔' : '○', OK(1, key(m.name)) ? 'done' : '', key(m.name))}</td><td>${m[1] && m[1].done ? '✔' : ''}</td><td>${m[2] && m[2].done ? '✔' : ''}</td></tr>`).join('')}</table></div>
    <div class="card dz"><span class="tag">DANGER ZONE</span><p>Wipe every participant, mark, shortlist, verification and timer and start fresh as new.</p>${b('reset', '⟲ Reset everything', 'red')}</div>`;
  } else if (/^acc/.test(me.tab)) { const n = +me.tab[3], r = R(n);
    h += `<div class="card" style="text-align:center"><span class="tag">ROUND 0${n} LOGIN PAGE</span><div class="big ${r.login ? 'on' : 'off'}">● ${r.login ? 'ONLINE' : 'OFFLINE'}</div>${b('on', '⚡ ACTIVATE ROUND 0' + n + ' LOGIN', 'red big', n)}${b('offl', 'Take offline', '', n)}</div>`;
  } else if (me.tab == 'eval') { // ---- ML EVALUATE: reads the Google-Form response sheet by itself; admin only presses 2 buttons
    const n = me.er || 1, rows = ctl.rows[n] || [], N = rows.length ? short(n, rows.length) : 0, r = R(n);
    h += `<div class="card">${b('er', 'Round 1', n == 1 ? 'done' : '', 1)}${b('er', 'Round 2', n == 2 ? 'done' : '', 2)}
    <div class="stats"><div><b>${rows.length}</b>NO. OF ENTRIES</div><div><b>${N || '—'}</b>${n == 1 ? 'NO. TO SHORTLIST' : 'WINNER'}</div></div>
    <div class="stg"><div class="stp"><i>STEP 1</i>${b('ml', '🧠 Run ML analysis', 'red', n)}</div><div class="stp"><i>OR UPLOAD EXCEL (.xlsx / .csv)</i><input type="file" id="csvf" accept=".xlsx,.csv,text/csv"></div><div class="stp ${(r.top || []).length ? 'ok' : ''}"><i>STEP 2</i>${b('top', n == 1 ? '✅ Shortlist' : '🏆 Declare winner', (r.top || []).length ? 'done' : 'red', n)}</div></div>
    ${(r.lb || []).length ? `<div class="tw"><table><tr><th>S.NO</th><th>NAME</th><th>${n == 2 ? 'WINNER' : 'SHORTLISTED'}</th></tr>${r.lb.map(x => `<tr class="${n == 2 && x.y ? 'win' : ''}"><td>${x.s}</td><td>${esc(x.name)}</td><td class="${x.y ? 'yes' : 'no'}">${x.y ? (n == 2 ? '🏆 YES' : 'YES') : 'NO'}</td></tr>`).join('')}</table></div><p>${b('bd', r.board ? 'Hide from participants' : 'Reveal leaderboard', 'red', n)}</p>` : ''}
    <details><summary>Marks per entry / manual upload (optional)</summary><p>Fallback if the sheet cannot be read: upload the responses as .xlsx / .csv.</p><textarea id="csvt" placeholder="name,prompt"></textarea>${b('score', 'Run on pasted data', '', n)}
    <div class="tw"><table><tr><th>NAME</th>${CR[n].map(c => `<th>${c[0].toUpperCase()}</th>`).join('')}<th>TOTAL</th><th></th></tr>
    ${[...rows].sort((a, c) => tot(c) - tot(a)).map(x => `<tr><td>${esc(x.name)}</td>${x.m.map((v, j) => `<td><input type="number" value="${v}" data-a="mk" data-n="${n}" data-i="${rows.indexOf(x)}" data-j="${j}" min="0" max="${CR[n][j][1]}"></td>`).join('')}<td><b>${tot(x)}</b></td><td>${b('delrow', '🗑', '', n + ':' + rows.indexOf(x))}</td></tr>`).join('') || '<tr><td>No data yet</td></tr>'}</table></div></details></div>`;
  } else if (me.tab == 'board') {
    h += [1, 2].map(n => `<div class="card tw"><span class="tag">ROUND 0${n} ${n == 2 ? 'WINNER' : 'LEADERBOARD'} - ${R(n).board ? 'VISIBLE TO PARTICIPANTS' : 'HIDDEN'}</span><table><tr><th>S.NO</th><th>NAME</th><th>${n == 2 ? 'WINNER' : 'SHORTLISTED'}</th></tr>${(R(n).lb || []).map(x => `<tr class="${n == 2 && x.y ? 'win' : ''}"><td>${x.s}</td><td>${esc(x.name)}</td><td class="${x.y ? 'yes' : 'no'}">${x.y ? (n == 2 ? '🏆 YES' : 'YES') : 'NO'}</td></tr>`).join('') || '<tr><td colspan=3>-</td></tr>'}</table>${b('bd', R(n).board ? 'Hide' : 'Reveal to participants', 'red', n)}</div>`).join('');
  } else if (me.tab == 'diag') { // ---- CHECK LINKS: tests every sheet + cloud sync and says exactly what is wrong
    h += `<div class="card"><span class="tag">LINK DIAGNOSTICS</span><p>Tests whether the portal can read your Google Sheets.</p>${b('dg', '🩺 Run check', 'red')}
    ${(me.dg || []).map(x => `<p class="${x.ok ? 'yes' : 'no'}">${x.ok ? '✔' : '✖'} <b>${esc(x.t)}</b><br><small>${esc(x.d)}</small></p>`).join('')}</div>`;
  } else { // ---- PARTICIPANTS: auto passwords, force logout, delete (double confirm), Excel export
    const nm = names();
    h += `<div class="card"><span class="tag">ROSTER</span><p>${nm.length} participants${PORTAL.SHEET_CSV ? ' · live sheet connected' : ''}. Passwords are generated from the names the moment they log in.</p>${b('ros', '⟳ Reload from sheet')}${b('xl', '⬇ Export passwords to Excel', 'red')}<br><span class="tag">UPLOAD REGISTRATION EXCEL (.xlsx / .csv) - used instead of the sheet</span><br><input type="file" id="rosf" accept=".xlsx,.csv,text/csv"></div>
    <div class="card tw"><table><tr><th>S.NO</th><th>NAME</th><th>PASSWORD</th><th>STATUS</th><th>ACTIONS</th></tr>${nm.map((x, i) => { const k = key(x), o = online(k);
      return `<tr><td>${i + 1}</td><td>${esc(x)}</td><td><code>${esc(pw(x))}</code></td><td class="${o ? 'yes' : ''}">${o ? '● ONLINE' : mem[k] ? '○ offline' : '-'}</td><td>${o ? b('kick', 'Logout', '', k) : ''}${mem[k] ? b('delm', '🗑 Delete', '', k) : ''}</td></tr>` }).join('')}</table></div>`;
  }
  return h;
}
function view() {
  if (!me) return vLogin();
  if (me.role == 'a') return vAdmin();
  if (ctl.end) return vEnd();
  const n = me.rd, r = n && R(n);
  if (me.v == 'pre' && r.reveal && (n == 2 || OK(n, me.k)) && !warping) { warping = 1; setTimeout(() => { warp(['ACCESS GRANTED', 'ROUND 0' + n + ' // ' + (n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE')], () => { me.v = 'round'; warping = 0; sme(); n == 2 && say('r2brief') }) }, 0) }
  return { center: vCenter, pre: () => vPre(n), round: () => vRound(n), thanks: () => vThanks(n), wait: () => vWait(n), board: () => vBoard(n), post: vPost, fin: () => bar() + vEnd() }[me.v]();
}
function render() {
  // single-device rule: if the admin logged this user out / deleted them / they signed in elsewhere, drop the session
  if (me && me.role == 'p' && (!mem[me.k] || mem[me.k].dev !== DEV)) { me = null; sessionStorage.removeItem('su_me'); last = ''; msg = 'You were logged out (by the admin, or this account signed in on another device).' }
  document.body.classList.toggle('inp', document.body.dataset.p == '1');
  const lg = document.getElementById('login'); if (lg) lg.querySelector('.lbl').textContent = me ? ' Portal' : ' Login';
  if (document.body.dataset.p != '1' || (typeof snapping != 'undefined' && snapping)) return;
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.id != 'shot') return;
  const h = view(); if (h !== last) { last = h; $p.innerHTML = (PORTAL.VIDEO ? `<video id="pvid" src="${esc(PORTAL.VIDEO)}" autoplay muted loop playsinline></video>` : '') + h }
  tick();
}
function tick() { $p.querySelectorAll('[data-t]').forEach(e => { const t = +e.dataset.t; e.textContent = t ? mmss(t) : '--:--'; if (t && t <= Date.now() && !e.dataset.x) { e.dataset.x = 1; last = ''; setTimeout(render, 0) } }) }
setInterval(tick, 500);

/* ---------- actions ---------- */
const open_ = () => { document.body.dataset.p = '1'; if (PORTAL.MUSIC) { MUSIC.light = MUSIC.dark = PORTAL.MUSIC; musicSync() } last = ''; scrollTo(0, 0); render(); !me && say('loginIntro') };
const A = {
  home() { document.body.dataset.p = '0'; render(); scrollTo(0, 0) }, out() { if (me && me.role == 'p' && mem[me.k]) { mem[me.k].dev = ''; svm(me.k) } me = null; sessionStorage.removeItem('su_me'); last = ''; render() }, // frees the device lock
  tp() { tab = 'p'; msg = ''; uv = ''; last = ''; render() }, ta() { tab = 'a'; msg = ''; uv = ''; last = ''; render() },
  async login() {
    uv = $('lu').value; const u = norm(uv), p = $('lp').value.trim(), fail = t => { tries++; if (tries >= 5) lock = Date.now() + 30000; msg = t; last = ''; render() };
    if (Date.now() < lock) return fail('Too many attempts. Wait 30 seconds.'); if (!u || !p) return fail('Enter username and password.');
    if (tab == 'a') { try { const r = await fetch(API.adminLogin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uv, password: p }) }); const j = await r.json(); if (!r.ok || !j.ok) return fail(j.error || 'Access denied.'); me = { role: 'a', tab: 'dash', adminSession: j.session, session: j.session }; await syncCtl(); try { const rr=await fetch(API.state+'?resource=allmem',{headers:stateHeaders(),cache:'no-store'}); const jj=await rr.json(); if(rr.ok&&jj.ok) mem=jj.data||{}; } catch(e) {} loadRoster().then(() => { ctl.roster = roster; sv() }) } catch (e) { return fail('Admin login service is temporarily unavailable.'); } } // admin auth is now server-side
    else { const S = PORTAL.SAMPLE, demo = S && u == norm(S.u); let nm;
      if (demo) { if (p.toLowerCase() !== S.p) return fail('Access denied.'); nm = 'Sample Participant' }
      else {
        try {
          const r = await fetch(API.login, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uv, password: p }) });
          const j = await r.json();
          if (!r.ok || !j.ok) return fail(j.error || 'Unable to verify your registration right now.');
          nm = j.name; me = { role:'p', name:nm, k:j.key, v:'center', session:j.session };
        } catch (e) { return fail('Login service is temporarily unavailable. Please try again.'); }
      }
      await syncCtl(); const k = key(nm); await syncMem(k); if (!ctl.ev && !demo) return fail('The event is not open yet. Please stand by.'); // newest shared copies before the device check
      const o = mem[k]; if (o && o.dev && o.dev !== DEV && Date.now() - (o.hb || 0) < 60000) return fail('This account is already logged in on another device. Ask the admin to log it out.');
      mem[k] ||= { name: nm }; mem[k].t ||= Date.now(); mem[k].dev = DEV; mem[k].hb = Date.now(); svm(k); me ||= { role: 'p', name: nm, k, v: 'center', session: '' }; me.name=nm; me.k=k; me.role='p'; me.v='center' }
    tries = 0; msg = ''; uv = ''; last = ''; warp(['AUTHENTICATING', 'ACCESS GRANTED'], () => { sme() });
  },
  tab(e) { me.tab = e.dataset.n; sme() }, er(e) { me.er = +e.dataset.n; sme() },
  enter(e) { const n = +e.dataset.n, r = R(n), top = R(1).top; if (!r.login || (n == 2 && top && !top.some(t => norm(t.name) == norm(me.name)))) return;
    warp(['ROUND 0' + n, n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE'], () => { me.rd = n; const m = M(n); me.v = r.board ? 'board' : m.done ? 'wait' : (n == 2 || OK(n, me.k)) && r.reveal ? 'round' : 'pre'; sme(); me.v == 'round' && n == 2 && say('r2brief') }) },
  form(e) { const u = PORTAL.FORMS[(e.dataset.n == 1 ? 'pre1' : 'pre2')]; u ? open(u, '_blank', 'noopener') : alert('Form link not set (PORTAL.FORMS in portal.js).') },
  start(e) { M(e.dataset.n).start = Date.now(); svm(me.k) },
  tool(e) { open(e.dataset.u, '_blank', 'noopener'); warp(['LAUNCHING ' + e.dataset.t.toUpperCase(), 'REDIRECTING'], () => {}) },
  submit(e) { const n = +e.dataset.n; if (!live(n)) return alert('Submissions are closed.'); const u = PORTAL.FORMS['sub' + n]; if (!u) return alert('Submission form link not set (PORTAL.FORMS in portal.js).');
    open(u, '_blank', 'noopener'); warp(['SUBMITTING', 'TRANSMISSION COMPLETE'], () => { M(n).done = Date.now(); me.v = 'thanks'; svm(me.k); sme() }) },
  wait() { me.v = 'wait'; sme() }, zoom(e) { open(e.src) },
  ev() { ctl.ev = ctl.ev ? 0 : 1; sv() }, end() { if (confirm('End the event for everyone?')) { ctl.end = 1; sv() } },
  acc1() { me.tab = 'acc1'; sme() }, acc2() { me.tab = 'acc2'; sme() },
  on(e) { const n = +e.dataset.n; if (n == 2 && !(R(1).top || []).length) return alert('Confirm the Round 1 shortlist first.');
    warp(['INITIALIZING', 'ROUND 0' + n, n == 1 ? 'UNLOCK 17-A' : 'THE INEVITABLE', 'SYSTEM ONLINE'], () => { R(n).login = 1; sv() }) },
  offl(e) { R(+e.dataset.n).login = 0; sv() },
  verall(e) { const n = +e.dataset.n || 1; (ctl.ok ||= { 1: {}, 2: {} }); Object.keys(mem).forEach(k => { ctl.ok[n][k] = 1 }); sv() },
  ver1(e) { (ctl.ok ||= { 1: {}, 2: {} }); const k = e.dataset.n; ctl.ok[1][k] = ctl.ok[1][k] ? 0 : 1; sv() },
  rev(e) { R(+e.dataset.n).reveal = 1; sv() },
  open(e) { const n = +e.dataset.n, d = Math.max(1, +$('dur' + n).value || 30), r = R(n); r.dur = d; r.end = Date.now() + d * 60000; r.subOpen = 1; r.closed = 0; sv() },
  close(e) { const r = R(+e.dataset.n); r.subOpen = 0; r.closed = 1; sv() }, goev(e) { me.tab = 'eval'; me.er = +e.dataset.n; sme() },
  bd(e) { const r = R(+e.dataset.n); if (!(r.top || []).length) return alert('Confirm a shortlist first (Evaluate tab).'); r.board = r.board ? 0 : 1; sv() },
  mk(e) { ctl.rows[e.dataset.n][e.dataset.i].m[e.dataset.j] = Math.max(0, +e.value || 0); last = ''; sv() },
  score(e) { const n = +e.dataset.n, t = $('csvt').value.trim(); if (!t) return alert('Paste or upload the submissions CSV first.');
    ctl.rows[n] = objs(t).map(o => ({ name: nameOf(o), m: score(o, n) })).filter(r => r.name); last = ''; sv() },
  async ml(e) { // ML analysis: server reads the live Google-Form response sheet; frontend receives normalized scores
    const n = +e.dataset.n; try {
      const r = await fetch(API.evaluate + '?round=' + n, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw Error(j.error || 'Evaluation service unavailable');
      ctl.rows[n] = j.rows || []; Object.assign(R(n), { top: [], lb: null, board: 0 }); last = ''; sv();
      alert(`${ctl.rows[n].length} entries analysed from the live Round ${n} response sheet.`);
    } catch (er) { alert('Could not read/evaluate the Round ' + n + ' response sheet. ' + er.message + '\n\nUse the manual upload only as a backup.') } },
  top(e) { const n = +e.dataset.n, rows = [...(ctl.rows[n] || [])].sort((a, c) => tot(c) - tot(a)); if (!rows.length) return alert('Run the ML analysis first.'); const N = short(n, rows.length);
    R(n).N = N; R(n).top = rows.slice(0, N).map((r, i) => ({ s: i + 1, name: r.name })); R(n).lb = rows.map((r, i) => ({ s: i + 1, name: r.name, y: i < N ? 1 : 0 })); R(n).board = 0; sv() }, // top = yes-list, lb = full leaderboard (S.no, name, yes/no)
  vb(e) { const n = +e.dataset.n; if (!R(n).board) return alert('The leaderboard has not been revealed yet. Please wait for the admin.'); me.v = 'board'; sme(); n == 1 ? (R(1).top || []).some(x => norm(x.name) == norm(me.name)) && say('shortlist') : say('winner') },
  post() { me.v = 'post'; sme() }, pform() { open(PORTAL.FORMS.post, '_blank', 'noopener') }, fin() { me.v = 'fin'; sme() },
  dnext() { const m = M(2); m.ds = Math.min(3, (m.ds || 0) + 1); svm(me.k) }, copy() { navigator.clipboard.writeText(PROMPT_LINE).then(() => alert('Copied!')).catch(() => prompt('Copy this line:', PROMPT_LINE)) },
  dl() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['BRAND DOCUMENT\n\n' + BRAND.map((x, i) => `${i + 1}. ${x[0]}\n[${x[1]}]\n`).join('\n')], { type: 'text/plain' })); a.download = 'brand-document-template.txt'; a.click() },
  kick(e) { const k = e.dataset.n; if (!confirm('Log this participant out now?')) return; if (mem[k]) { mem[k].dev = ''; mem[k].hb = 0; svm(k) } },
  delm(e) { const k = e.dataset.n; if (!sure('Delete ALL data of ' + ((mem[k] || {}).name || k) + '?')) return; delete mem[k]; ['1', '2'].forEach(n => ctl.ok && ctl.ok[n] && delete ctl.ok[n][k]);
    localStorage.su_mem = JSON.stringify(mem); bc.postMessage(1); if(me?.role==='a'&&me.session) fetch(API.state+'?resource=mem&key='+encodeURIComponent(k), { method: 'DELETE', headers: stateHeaders() }).catch(() => {}); sv() },
  delrow(e) { const [n, i] = e.dataset.n.split(':'); if (!sure('Delete this evaluation entry?')) return; ctl.rows[n].splice(+i, 1); Object.assign(R(+n), { top: [], lb: null, board: 0 }); last = ''; sv() },
  reset() { if (!sure('RESET EVERYTHING? All participants, marks, shortlists and timers will be erased.')) return; ctl = fresh(); mem = {}; localStorage.su_mem = '{}'; localStorage.removeItem('su_ctl');
    me?.role==='a'&&me.session && fetch(API.state+'?resource=allmem', { method:'PUT', headers:stateHeaders(), body:'null' }).catch(()=>{}); loadRoster().then(() => { ctl.roster = roster; sv() }); sv(); alert('Event reset - fresh as new.') },
  xl() { const h = '<meta charset="utf-8"><table border="1"><tr><th>S.No</th><th>Name</th><th>Password</th></tr>' + names().map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x)}</td><td>${esc(pw(x))}</td></tr>`).join('') + '</table>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h], { type: 'application/vnd.ms-excel' })); a.download = 'starc-up-passwords.xls'; a.click() },
  async dg() { me.dg = [{ ok: 1, t: 'Checking...', d: 'please wait' }]; sme();
    try {
      const r = await fetch(API.health, { cache: 'no-store' }); const j = await r.json();
      const out = (j.checks || []).map(x => ({ t: x.label, ok: x.ok, d: x.ok ? `${x.rows} rows · ${x.names} usable names` : x.error }));
      out.push({ t: 'Server-side live login verification', ok: true, d: 'ON - participant credentials are checked against the current registration sheet on every login.' });
      out.push({ t: 'Cloud sync (multi-device event state)', ok: !!me?.session, d: me?.session ? 'ON - shared through the secure Vercel state API.' : 'OFF - log in again.' });
      me.dg = out;
    } catch (e) { me.dg = [{ t: 'Backend health endpoint', ok: false, d: 'Cannot reach /api/health. Redeploy the project with the api/ folder.' }]; }
    sme() },
  async ros() { await loadRoster(); ctl.roster = roster; sv() }
};
$p.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (t && t.tagName != 'INPUT' && A[t.dataset.a]) A[t.dataset.a](t) });
$p.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.a == 'mk') return A.mk(t);
  if (t.id == 'shot' && t.files[0]) { const n = +t.dataset.n, i = new Image(); i.onload = () => { const c = document.createElement('canvas'), s = Math.min(1, 480 / i.width); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); M(n).shot = c.toDataURL('image/jpeg', .5); svm(me.k) }; i.src = URL.createObjectURL(t.files[0]) }
  if ((t.id == 'csvf' || t.id == 'rosf') && t.files[0]) readRows(t.files[0]).then(rows => { if (t.id == 'csvf') { // Excel/CSV of form responses -> run this round's ML model straight away
      const n = me.er || 1, m = new Map(); rowsObjs(rows).forEach(o => { const x = nameOf(o); x && m.set(norm(x), { name: x, m: score(o, n) }) }); ctl.rows[n] = [...m.values()]; Object.assign(R(n), { top: [], lb: null, board: 0 }); t.blur(); last = ''; sv(); alert(ctl.rows[n].length + ' entries analysed. Now press Shortlist / Declare winner.') } else { ctl.roster = rowsObjs(rows).map(nameOf).filter(Boolean); sv(); alert(ctl.roster.length + ' participants loaded.') } }).catch(er => alert(er.message));
});
$p.addEventListener('pointermove', e => { const c = e.target.closest('.tilt'); if (!c) return; const r = c.getBoundingClientRect(); c.style.transform = `rotateY(${((e.clientX - r.left) / r.width - .5) * 22}deg) rotateX(${(.5 - (e.clientY - r.top) / r.height) * 22}deg)` });
$p.addEventListener('pointerout', e => { const c = e.target.closest('.tilt'); c && (c.style.transform = '') });
$('login').onclick = open_;
$p.addEventListener('error', e => { const t = e.target; if (t.tagName == 'IMG' && t.dataset.fb) { const d = document.createElement('div'); d.className = 'lg'; d.textContent = t.dataset.fb; t.replaceWith(d) } }, true); // missing tool logo -> letter badge
setInterval(() => { // heartbeat: tells the admin (and the device lock) this participant is still online
  if (!(me && me.role == 'p' && mem[me.k])) return; const t = Date.now(); mem[me.k].hb = t;
  if (me.session) fetch(API.state+'?resource=mem&key='+encodeURIComponent(me.k), { method:'PUT', headers:stateHeaders(), body:JSON.stringify(mem[me.k]) }).catch(()=>{}); else { const m = ld('su_mem', mem); if (m[me.k]) { m[me.k].hb = t; localStorage.su_mem = JSON.stringify(m) } } }, 20000);
bc.onmessage = () => { ctl = ld('su_ctl', ctl); mem = ld('su_mem', mem); render() };
addEventListener('storage', () => bc.onmessage());
setInterval(async () => { if(!me?.session) return; try { const r=await fetch(API.state+'?resource=ctl',{headers:stateHeaders(),cache:'no-store'}); const j=await r.json(); if(r.ok&&j.ok&&j.data) ctl=j.data; if(me.role==='a'){ const rr=await fetch(API.state+'?resource=allmem',{headers:stateHeaders(),cache:'no-store'}); const jj=await rr.json(); if(rr.ok&&jj.ok) mem=jj.data||{}; } else { const rr=await fetch(API.state+'?resource=mem&key='+encodeURIComponent(me.k),{headers:stateHeaders(),cache:'no-store'}); const jj=await rr.json(); if(rr.ok&&jj.ok){ if(jj.data) mem[me.k]=jj.data; else delete mem[me.k]; } } localStorage.su_ctl=JSON.stringify(ctl); localStorage.su_mem=JSON.stringify(mem); render(); } catch(e) {} }, 2000);
})();
