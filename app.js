/* HD10 Command Center — war-room intelligence UI (NPS dashboard surface).
   Data-forward: shows the numbers and the map. No prescriptive action lists. */
(function () {
"use strict";

const D = window.HD10;
const TG = window.HD10_TARGET;
const P = D.precincts;
const T = D.totals;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmt = n => Math.round(Number(n || 0)).toLocaleString();
const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
const pById = id => P.find(p => p.id === id);
const maxOf = arr => Math.max(...arr.map(Number));
const signed = n => (n > 0 ? "+" : "") + n;

const C = {
  navy: "#06111F", card: "#0F2140",
  teal: "#1A8B9A", tealLt: "#22AABC",
  gold: "#D4A017", goldLt: "#F0B82A",
  rep: "#DC2626", repLt: "#F87171",
  npa: "#7C3AED", npaLt: "#A78BFA",
  dem: "#2563EB", demLt: "#60A5FA",
  muted: "#6B87A3",
};
// Single-hue red ramp (light → deep) for ordered categories — the GOP brand
// accent for generic data viz. Gold is the patriotic secondary/emphasis; party
// (blue/red/purple) and role colors stay semantic.
const RAMP_T = ["#F4B6B3", "#E67E78", "#D23B32", "#9E211A"];
const rampN = (i, n) => RAMP_T[Math.min(RAMP_T.length - 1, Math.round(i * (RAMP_T.length - 1) / Math.max(1, n - 1)))];

/* ── Roles (data-derived) ───────────────────────────────── */
const byR = [...P].sort((a, b) => b.pct.R - a.pct.R);
const byU = [...P].sort((a, b) => b.pct.U - a.pct.U);
const byLow = [...P].sort((a, b) => b.low_prop - a.low_prop);
const basePrecinct = byR[0];
const persuasionPrecinct = byU[0];
const turnoutPrecinct = byLow[0];

/* Role rotation (Republican brand): Base=red · Turnout=gold · Persuasion=purple.
   The three roles are data-derived and land on Goodwin / Silver Lane / Hockanum. */
const ROLE = {};
ROLE[turnoutPrecinct.id] = { key: "Turnout Priority", short: "Turnout", color: C.gold, colorLt: C.goldLt, tint: "rgba(212,160,23,.14)", bd: "rgba(212,160,23,.32)" };
ROLE[persuasionPrecinct.id] = { key: "Persuasion Priority", short: "Persuasion", color: C.npa, colorLt: C.npaLt, tint: "rgba(124,58,237,.16)", bd: "rgba(124,58,237,.36)" };
ROLE[basePrecinct.id] = { key: "Republican Base", short: "Base", color: C.rep, colorLt: C.repLt, tint: "rgba(220,38,38,.15)", bd: "rgba(220,38,38,.36)" };
P.forEach(p => { if (!ROLE[p.id]) ROLE[p.id] = { key: "Republican Base", short: "Base", color: C.rep, colorLt: C.repLt, tint: "rgba(220,38,38,.15)", bd: "rgba(220,38,38,.36)" }; });
const roleOf = p => ROLE[p.id];

function priorityScore(p) {
  return Math.round((p.pct.R * 2.2) + (p.pct.U * 1.2) + ((100 - p.v24_pct) * .75) + (p.low_prop / maxOf(P.map(x => x.low_prop)) * 24));
}
const ranked = () => [...P].sort((a, b) => priorityScore(b) - priorityScore(a));

const PR = D.profiles, PMET = PR.metrics, PDIST = PR.district;
const pmeta = id => PMET.find(m => m.id === id);
const pval = (pid, id) => PR.byPrecinct[pid][id];
const SEG = D.segments, SD = SEG.district;

/* ── Universe (turnout-universe rule) ───────────────────────
   Target universe = ONLY our targets who are already likely to vote
   (voted >=2 of last 4 generals). No turnout-lift analysis for now. */
const TURNOUT_UNIVERSE = D.win.projected2026;          // ~6,826 projected 2026 turnout
const OUR_UNIVERSE = TG ? TG.target_size : 0;          // 3,655 likely-voter targets
const WIN = D.win.win_number;                          // 3,414 to win
const COVERAGE = WIN ? Math.round(100 * OUR_UNIVERSE / WIN) : 0;
const CUSHION = OUR_UNIVERSE - WIN;                    // targets above the win number
const tgPrec = id => (TG && TG.precinct && TG.precinct[id]) || null;

/* ── Election history — REAL precinct-level returns (HD-10 voting districts
   004 Silver Lane / 005 Hockanum / 006 Goodwin), pulled from the CT SOS
   election database polling-place results (electionhistory.ct.gov).
   bp = { precinct: [Democratic votes, Republican votes] }. Years without bp
   are pending (contest not yet pulled). */
const HRES = {
  order: ["statehouse", "president", "governor", "mayor"],
  meta: {
    statehouse: { label: "State House", sub: "HD-10 seat (the race)" },
    president:  { label: "President",   sub: "HD-10 precincts" },
    governor:   { label: "Governor",    sub: "HD-10 precincts" },
    mayor:      { label: "Mayor",       sub: "HD-10 precincts (town-wide race)" },
  },
  source: "CT Secretary of the State election database (electionhistory.ct.gov), polling-place returns.",
  data: {
    statehouse: {
      2024: { d: "Genga", r: "Tierinni", bp: { "004": [2131, 687], "005": [1527, 755], "006": [1812, 1042] } },
      2022: { d: "Genga", un: true },
      2020: { d: "Genga", un: true },
      2018: { d: "Genga", un: true },
      2016: { d: "Genga", r: "Simpson", bp: { "004": [2554, 557], "005": [1778, 607], "006": [1914, 906] } },
    },
    president: {
      2024: { d: "Harris", r: "Trump", bp: { "004": [2220, 749], "005": [1605, 800], "006": [1908, 1016] } },
      2020: { d: "Biden", r: "Trump", bp: { "004": [2781, 724], "005": [1934, 815], "006": [2163, 1016] } },
      2016: { d: "Clinton", r: "Trump", bp: { "004": [2702, 625], "005": [1750, 724], "006": [1802, 1085] } },
    },
    governor: {
      2022: { d: "Lamont", r: "Stefanowski", bp: { "004": [1357, 391], "005": [1019, 503], "006": [1280, 747] } },
      2018: { d: "Lamont", r: "Stefanowski", bp: { "004": [1901, 507], "005": [1239, 636], "006": [1368, 988] } },
    },
    mayor: {
      2025: { d: "Martin", r: "Davis", bp: { "004": [560, 118], "005": [509, 185], "006": [714, 268] } },
      2023: { d: "Martin", r: "Davis", bp: { "004": [572, 134], "005": [454, 166], "006": [666, 240] } },
      2021: { d: "Walsh", r: "Harper", bp: { "004": [573, 208], "005": [480, 331], "006": [682, 558] } },
      2019: { d: "Leclerc", r: "Morrison", bp: { "004": [591, 242], "005": [470, 315], "006": [612, 519] } },
      2017: { d: "Leclerc", un: true },
    },
  },
};

/* ── Real Democratic margin from the latest contested Mayor cycle (2025) ──
   Used by Precincts (per-precinct margin) and History. bp = [D votes, R votes]. */
function marginPts(d, r) { return (d + r) ? Math.round(100 * (d - r) / (d + r)) : 0; }
function mayor25Margin(pid) {
  const bp = HRES.data.mayor[2025].bp[pid];
  return bp ? marginPts(bp[0], bp[1]) : null;
}

/* ── Small builders ─────────────────────────────────────── */
function drow(l, v) { return `<div class="drow"><span class="l">${l}</span><span class="v">${v}</span></div>`; }
function bar(label, value, denom, color) {
  const pc = pct(value, denom);
  return `<div class="bar"><div class="bar-top"><span>${label}</span><b>${fmt(value)} · ${pc}%</b></div>
    <div class="track"><i style="width:${pc}%;--accent:${color}"></i></div></div>`;
}
function fillSeq(v, lo, hi, rgb) {
  const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo)));
  const base = [15, 33, 64];
  return `rgb(${base.map((c, i) => Math.round(c + (rgb[i] - c) * (.22 + .78 * t))).join(",")})`;
}
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/* ── Maps (dark war-room basemap) ───────────────────────── */
function baseMap(id) {
  const map = L.map(id, { scrollWheelZoom: false, attributionControl: false, zoomControl: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 19, pane: "markerPane", opacity: .7 }).addTo(map);
  const fit = () => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [18, 18] }); };
  fit(); setTimeout(fit, 140); setTimeout(fit, 440);
  return map;
}
function featureStyle(color, selected) {
  return { fillColor: color, fillOpacity: selected ? .92 : .74, color: selected ? "#fff" : "rgba(255,255,255,.55)", weight: selected ? 3 : 1.2, opacity: 1 };
}
function legend(el, title, rows) {
  el.innerHTML = `<div class="eyebrow" style="color:#cfe0ee;margin-bottom:2px">${title}</div>` +
    rows.map(r => `<div class="row"><i style="background:${r[0]}"></i>${r[1]}</div>`).join("");
}

/* ════════════════════ OVERVIEW ════════════════════ */
function renderOverview() {
  const winPct = Math.min(100, pct(WIN, OUR_UNIVERSE));
  const targetCards = [basePrecinct, turnoutPrecinct, persuasionPrecinct]
    .map(p => ({ p, role: roleOf(p), n: tgPrec(p.id) ? tgPrec(p.id).target : 0 }))
    .sort((a, b) => b.n - a.n);
  const desc = {
    "Republican Base": "Densest Republican base — confirm & bank.",
    "Turnout Priority": "Lowest-propensity bloc — drive turnout.",
    "Persuasion Priority": "Highest unaffiliated share — persuade.",
  };

  $("#tab-overview").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">Command Center</div>
      <h1>HD-10 · East Hartford</h1>
      <div class="sub">What to do, where to go, and who to contact.</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> Live · SOTS Sync</div>
      <div class="stamp">Updated Jul 1, 2026 · 06:00</div>
    </div>
  </header>

  <!-- Assessment / Path to victory -->
  <div style="border:1px solid var(--border);border-radius:10px;background:rgba(15,26,44,.5);display:grid;grid-template-columns:1.4fr 1fr;overflow:hidden;margin-bottom:26px;">
    <div style="padding:30px 34px;">
      <div style="font-family:var(--ff-display);font-weight:600;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:var(--gold);">Campaign Assessment</div>
      <div style="font-family:var(--ff-display);font-weight:900;font-size:54px;line-height:.9;letter-spacing:.5px;text-transform:uppercase;margin-top:16px;">${fmt(WIN)} Votes to Win HD-10.</div>
      <div style="font-size:15px;color:var(--fg-dim);line-height:1.6;margin-top:18px;max-width:560px;">Democratic-leaning, but winnable with disciplined focus. Republicans reach the win number by working <strong style="color:var(--fg);font-weight:600;">${fmt(OUR_UNIVERSE)}</strong> targeted voters already likely to turn out — concentrated in <strong style="color:var(--fg);font-weight:600;">${basePrecinct.name}</strong>, <strong style="color:var(--fg);font-weight:600;">${turnoutPrecinct.name}</strong>, and <strong style="color:var(--fg);font-weight:600;">${persuasionPrecinct.name}</strong>.</div>
      <div style="height:1px;background:var(--border);margin:26px 0 20px;"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
        <div><div class="stat-lbl">Active Voters</div><div class="stat-val" style="font-size:26px;">${fmt(T.active)}</div></div>
        <div><div class="stat-lbl">Turnout Universe</div><div class="stat-val" style="font-size:26px;">${fmt(TURNOUT_UNIVERSE)}</div></div>
        <div><div class="stat-lbl">Above Win Number</div><div class="stat-val teal" style="font-size:26px;">+${fmt(CUSHION)}</div></div>
      </div>
    </div>
    <div style="padding:30px 34px;border-left:1px solid var(--border);">
      <div class="t-eyebrow">Path to Victory</div>
      <div style="display:flex;align-items:baseline;gap:14px;margin-top:14px;">
        <div style="font-family:var(--ff-display);font-weight:900;font-size:74px;line-height:.82;color:var(--rep-lt);font-variant-numeric:tabular-nums;">${fmt(OUR_UNIVERSE)}</div>
        <div style="font-family:var(--ff-display);font-weight:600;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--fg-muted);line-height:1.25;">Likely-Voter<br>Targets</div>
      </div>
      <div style="font-size:13px;color:var(--fg-dim);margin-top:18px;line-height:1.5;">50% + 1 of <strong style="color:var(--fg);font-weight:600;">${fmt(TURNOUT_UNIVERSE)}</strong> projected 2026 voters is <strong style="color:var(--fg);font-weight:600;">${fmt(WIN)}</strong> to win.</div>
      <div style="margin-top:14px;">
        <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:#0F1A2C;">
          <div style="width:${winPct}%;background:var(--gold);"></div><div style="flex:1;background:var(--rep);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:7px;font-family:var(--ff-display);font-weight:600;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--fg-muted);">
          <span style="color:var(--gold-lt);">${fmt(WIN)} to win</span><span>${fmt(OUR_UNIVERSE)} in universe</span>
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:22px 0 18px;"></div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;">
        <div class="t-eyebrow" style="max-width:150px;line-height:1.3;">Cushion Above the Win Number</div>
        <div style="font-family:var(--ff-display);font-weight:900;font-size:34px;color:var(--rep-lt);">+${fmt(CUSHION)}</div>
      </div>
      <div style="height:6px;border-radius:3px;background:#0F1A2C;overflow:hidden;margin-top:12px;"><div style="width:${Math.min(100, Math.round(100 * CUSHION / WIN))}%;height:100%;background:var(--rep);"></div></div>
      <div style="font-size:11px;color:var(--fg-muted);margin-top:10px;line-height:1.5;"><strong style="color:var(--fg-dim);font-weight:600;">${fmt(CUSHION)}</strong> targets above the line — the margin for slippage if turnout softens.</div>
    </div>
  </div>

  <!-- Where the targets are -->
  <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;">
    <div class="t-eyebrow">Where the Targets Are</div>
    <button class="linklike" type="button" data-goto="precincts">Full ranking →</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
    ${targetCards.map(({ p, role, n }) => `
      <div style="border:1px solid var(--border);border-top:2px solid ${role.color};border-radius:8px;background:rgba(15,26,44,.5);padding:17px 18px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-family:var(--ff-display);font-weight:800;font-size:18px;letter-spacing:1px;text-transform:uppercase;">${p.name}</div>
          <div style="font-size:10px;color:var(--fg-muted);letter-spacing:1px;">PCT ${p.id}</div>
        </div>
        <div style="display:inline-block;margin-top:9px;padding:3px 9px;border-radius:2px;background:${role.tint};border:1px solid ${role.bd};color:${role.colorLt};font-family:var(--ff-display);font-weight:600;font-size:10px;letter-spacing:2px;text-transform:uppercase;">${role.key}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:16px;">
          <div style="font-family:var(--ff-display);font-weight:700;font-size:30px;color:${role.colorLt};font-variant-numeric:tabular-nums;">${fmt(n)}</div>
          <div class="stat-lbl" style="margin:0;">targets</div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--fg-dim);line-height:1.5;">${desc[role.key]}</div>
      </div>`).join("")}
  </div>`;
  $$("[data-goto]").forEach(b => b.addEventListener("click", () => gotoTab(b.dataset.goto)));
}

/* ════════════════════ PRECINCTS ════════════════════ */
let precinctMap, precinctLayer;
const rankedByTargets = () => [...P].sort((a, b) => (tgPrec(b.id)?.target || 0) - (tgPrec(a.id)?.target || 0));
let selectedPrecinct = rankedByTargets()[0].id;

/* Small chart builders (shared by the detail panels) */
function dRow(label, w, color, val, lw) {
  return `<div class="demo-row"><div class="demo-lbl" style="${lw ? `width:${lw}px;` : ""}">${label}</div><div class="demo-track"><div class="demo-fill" style="width:${Math.max(2, Math.min(100, w))}%;background:${color};"></div></div><div class="demo-pct">${val}</div></div>`;
}
function trayBars(title, meta, rowsHtml) {
  return `<div class="chart-tray"><div class="chart-tray-head"><div class="chart-tray-hd">${title}</div>${meta ? `<div class="chart-tray-meta">${meta}</div>` : ""}</div><div class="demo-section" style="padding-top:4px;">${rowsHtml}</div></div>`;
}

function renderPrecincts() {
  const order = rankedByTargets();
  const maxT = Math.max(...order.map(p => tgPrec(p.id)?.target || 0));
  const desc = {
    "Republican Base": "Densest GOP base — confirm & bank.",
    "Turnout Priority": "Lowest-propensity bloc — drive turnout.",
    "Persuasion Priority": "Largest persuadable NPA bloc — persuade.",
  };
  const rows = order.map((p, i) => {
    const r = roleOf(p), tp = tgPrec(p.id), n = tp ? tp.target : 0, sel = p.id === selectedPrecinct;
    return `
    <div class="rank-row${sel ? " sel" : ""}" data-psel="${p.id}" style="border:1px solid ${sel ? r.color : "var(--border)"};border-left:3px solid ${r.color};border-radius:8px;background:rgba(15,26,44,.5);padding:12px 14px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-family:var(--ff-display);font-weight:900;font-size:20px;color:${r.colorLt};width:16px;text-align:center;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:var(--ff-display);font-weight:800;font-size:16px;letter-spacing:.5px;text-transform:uppercase;">${p.name}</span>
            <span style="padding:2px 7px;border-radius:2px;background:${r.tint};border:1px solid ${r.bd};color:${r.colorLt};font-family:var(--ff-display);font-weight:600;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;">${r.short}</span>
          </div>
          <div class="demo-track" style="height:5px;margin-top:8px;"><div class="demo-fill" style="width:${Math.round(100 * n / maxT)}%;background:${r.color};"></div></div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:var(--ff-display);font-weight:700;font-size:20px;color:${r.colorLt};font-variant-numeric:tabular-nums;line-height:1;">${fmt(n)}</div>
          <div class="stat-lbl" style="margin:3px 0 0;font-size:8px;">Targets</div>
        </div>
      </div>
    </div>`;
  }).join("");

  $("#tab-precincts").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">Precincts</div>
      <h1>Field Ranking</h1>
      <div class="sub">Where to deploy — click a precinct on the map or list for its full electorate profile</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> 3 Precincts</div>
      <div class="stamp">${fmt(OUR_UNIVERSE)} targets total</div>
    </div>
  </header>

  <div class="map-grid">
    <div class="mapcard"><div class="lmap" id="precinct-map"></div><div class="maplegend" id="precinct-legend"></div></div>
    <aside class="side">
      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">District Roll-Up</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);border-radius:6px;overflow:hidden;margin-top:6px;">
          <div style="background:var(--navy-card);padding:14px;"><div class="stat-lbl">Total Reg</div><div class="stat-val" style="font-size:22px;">${fmt(T.active)}</div></div>
          <div style="background:var(--navy-card);padding:14px;"><div class="stat-lbl">Targets</div><div class="stat-val teal" style="font-size:22px;">${fmt(OUR_UNIVERSE)}</div></div>
          <div style="background:var(--navy-card);padding:14px;"><div class="stat-lbl">Turnout Univ.</div><div class="stat-val gold" style="font-size:22px;">${fmt(TURNOUT_UNIVERSE)}</div></div>
          <div style="background:var(--navy-card);padding:14px;"><div class="stat-lbl">To Win</div><div class="stat-val" style="font-size:22px;">${fmt(WIN)}</div></div>
        </div>
      </div>
      <div class="chart-tray" style="flex:1;">
        <div class="chart-tray-head"><div class="chart-tray-hd">Field Ranking</div><div class="chart-tray-meta">By targets</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">${rows}</div>
      </div>
    </aside>
  </div>

  <div class="sec-head"><h2>Precinct Profile</h2><div class="note" id="precinct-profile-name"></div></div>
  <div id="precinct-detail"></div>`;
  $$("[data-psel]").forEach(el => el.addEventListener("click", () => selectPrecinct(el.dataset.psel)));
  renderPrecinctDetail();
}
function selectPrecinct(id) {
  selectedPrecinct = id;
  $$("[data-psel]").forEach(el => {
    const on = el.dataset.psel === id, r = roleOf(pById(id));
    el.classList.toggle("sel", on);
    el.style.borderColor = on ? roleOf(pById(el.dataset.psel)).color : "var(--border)";
    el.style.borderLeftColor = roleOf(pById(el.dataset.psel)).color;
  });
  renderPrecinctDetail();
  paintPrecinctMap();
}
function renderPrecinctDetail() {
  const el = $("#precinct-detail"); if (!el) return;
  const p = pById(selectedPrecinct), r = roleOf(p), tp = tgPrec(p.id);
  const nm = $("#precinct-profile-name"); if (nm) nm.textContent = `${p.name} · ${p.id} · full electorate`;

  // Registration party bar (D/R/U/O)
  const oPct = Math.max(0, Math.round((100 - p.pct.D - p.pct.R - p.pct.U) * 10) / 10);
  const regBar = `<div class="party-bar-track" style="height:28px;">
      <div class="pb-d" style="width:${p.pct.D}%;">D ${p.pct.D}%</div>
      <div class="pb-n" style="width:${p.pct.U}%;">U ${p.pct.U}%</div>
      <div class="pb-r" style="width:${p.pct.R}%;">R ${p.pct.R}%</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--ff-display);font-size:10px;letter-spacing:1px;text-transform:uppercase;">
      <span style="color:var(--dem-lt);">Dem ${fmt(p.party.D)}</span>
      <span style="color:var(--npa-lt);">Unaff ${fmt(p.party.U)}</span>
      <span style="color:var(--rep-lt);">Rep ${fmt(p.party.R)}</span>
    </div>`;

  // Age brackets (real counts from br)
  const brOrder = [["young", "18–34"], ["parent", "35–54"], ["mid", "55–64"], ["senior", "65+"]];
  const brTot = brOrder.reduce((s, [k]) => s + p.br[k].n, 0);
  const ageRows = brOrder.map(([k, lbl], i) =>
    dRow(lbl, 100 * p.br[k].n / brTot, RAMP_T[i], `${Math.round(100 * p.br[k].n / brTot)}%`, 56)).join("");

  // Vote propensity (real tiers) — prime deepest, unlikely lightest
  const tOrder = [["prime", "Prime · 4/4"], ["likely", "Likely · 3/4"], ["dropoff", "Drop-off"], ["unlikely", "Unlikely"]];
  const tTot = tOrder.reduce((s, [k]) => s + p.tiers[k].n, 0);
  const propRows = tOrder.map(([k, lbl], i) =>
    dRow(lbl, 100 * p.tiers[k].n / tTot, RAMP_T[3 - i], `${Math.round(100 * p.tiers[k].n / tTot)}%`, 96)).join("");

  // How they vote (method — % of 2024 voters)
  const methodRows = [
    dRow("Election Day", pval(p.id, "eday"), RAMP_T[3], `${pval(p.id, "eday")}%`, 108),
    dRow("Early in-person", pval(p.id, "early"), RAMP_T[2], `${pval(p.id, "early")}%`, 108),
    dRow("Absentee / mail", pval(p.id, "vbm"), RAMP_T[1], `${pval(p.id, "vbm")}%`, 108),
  ].join("");

  // Turnout by cycle
  const th = p.hist, thMax = maxOf([th.y2018, th.y2022, th.y2024]);
  const toBars = [["2018", th.y2018], ["2022", th.y2022], ["2024", th.y2024]].map(([yr, n], i) => {
    const last = i === 2;
    return `<div class="col"><div class="n" style="color:${last ? "var(--gold-lt)" : "var(--fg)"}">${fmt(n)}</div>
      <div class="bar" style="height:${Math.round(88 * n / thMax)}px;background:${last ? "var(--gold)" : "var(--rep)"};opacity:${last ? 1 : .8};"></div>
      <div class="yr" style="${last ? "color:var(--fg);font-weight:600;" : ""}">${yr}</div></div>`;
  }).join("");

  el.innerHTML = `
    <div class="chart-tray" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="font-family:var(--ff-display);font-weight:800;font-size:22px;letter-spacing:.5px;text-transform:uppercase;">${p.name}</div>
        <span style="padding:3px 9px;border-radius:2px;background:${r.tint};border:1px solid ${r.bd};color:${r.colorLt};font-family:var(--ff-display);font-weight:600;font-size:10px;letter-spacing:2px;text-transform:uppercase;">${r.key}</span>
        <div style="margin-left:auto;display:flex;gap:26px;">
          <div><div class="stat-lbl">Active Reg</div><div class="stat-val">${fmt(p.active)}</div></div>
          <div><div class="stat-lbl">Turnout '24</div><div class="stat-val gold">${p.v24_pct}%</div></div>
          <div><div class="stat-lbl">Targets</div><div class="stat-val teal">${tp ? fmt(tp.target) : "—"}</div></div>
          <div><div class="stat-lbl">Avg Age</div><div class="stat-val">${p.avg_age}</div></div>
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="chart-tray"><div class="chart-tray-head"><div class="chart-tray-hd">Who's There</div><div class="chart-tray-meta">Registration</div></div><div style="margin-top:6px;">${regBar}</div></div>
      ${trayBars("Age Breakdown", "Active voters", ageRows)}
      ${trayBars("How Often They Vote", "Last 4 generals", propRows)}
      ${trayBars("How They Vote", "Of '24 voters", methodRows)}
      <div class="chart-tray"><div class="chart-tray-head"><div class="chart-tray-hd">Turnout by Cycle</div><div class="chart-tray-meta">Ballots</div></div><div class="mini-bars">${toBars}</div></div>
      ${trayBars("Signals", "Share of active", [
        dRow("Unaffiliated", pval(p.id, "unaff"), C.repLt, `${pval(p.id, "unaff")}%`, 108),
        dRow("Midterm drop-off", pval(p.id, "dropoff"), C.repLt, `${pval(p.id, "dropoff")}%`, 108),
        dRow("New movers", pval(p.id, "newmover"), C.repLt, `${pval(p.id, "newmover")}%`, 108),
        dRow("Single-voter homes", pval(p.id, "solo"), C.repLt, `${pval(p.id, "solo")}%`, 108),
      ].join(""))}
    </div>`;
}
function buildPrecinctMap() { precinctMap = baseMap("precinct-map"); paintPrecinctMap(); }
function paintPrecinctMap() {
  if (!precinctMap) return;
  if (precinctLayer) precinctMap.removeLayer(precinctLayer);
  precinctLayer = L.geoJSON(D.geo, {
    style: f => featureStyle(roleOf(pById(f.properties.id)).color, f.properties.id === selectedPrecinct),
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), r = roleOf(p);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${r.short}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#fff" }),
        mouseout: () => paintPrecinctMap(),
        click: () => selectPrecinct(p.id),
      });
    },
  }).addTo(precinctMap);
  legend($("#precinct-legend"), "Priority Role",
    [[C.rep, "Base"], [C.gold, "Turnout"], [C.npa, "Persuasion"]]);
}

/* ════════════════════ VOTERS ════════════════════ */
let votersMap, votersLayer, selectedVoterPrec = "006";
function renderVoters() {
  if (!TG) { $("#tab-voters").innerHTML = ""; return; }
  const ut = TG.universe_turnout, g = TG.gender, pr = TG.party_pct;
  const womenPct = pct(g.F, OUR_UNIVERSE), menPct = pct(g.M, OUR_UNIVERSE);

  // Real, mutually-exclusive registration split of the target universe (no D targets).
  const segCards = [
    { label: "Persuadable Unaffiliated", sub: "Unaffiliated targets — persuade & turn out", n: TG.party.U, pct: pr.U, color: C.npa, colorLt: C.npaLt, tintbg: "rgba(124,58,237,.06)" },
    { label: "Republican Base", sub: "Registered Republicans — confirm & bank", n: TG.party.R, pct: pr.R, color: C.rep, colorLt: C.repLt, tintbg: "rgba(220,38,38,.06)" },
  ];

  // Real vote-propensity tiers (sum to the universe) — single teal ramp.
  const tiers = [
    ["Reliable · 3–4 of 4", ut.locked.n, ut.locked.pct, RAMP_T[3]],
    ["Likely · 2 of 4", ut.mid.n, ut.mid.pct, RAMP_T[2]],
    ["New movers", ut.low.n, ut.low.pct, RAMP_T[1]],
  ];

  // Real target density by precinct (role-colored).
  const precs = Object.entries(TG.precinct).map(([id, v]) => ({ id, ...v, role: roleOf(pById(id)) }))
    .sort((a, b) => b.target - a.target);
  const chips = precs.map(p => `<button class="seg-btn ${p.id === selectedVoterPrec ? "on" : ""}" data-vsel="${p.id}" type="button" style="position:static;">${p.name}</button>`).join("");

  $("#tab-voters").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">Voters</div>
      <h1>Target Universe</h1>
      <div class="sub">${fmt(OUR_UNIVERSE)} likely-voter targets · click a precinct on the map for its target profile</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> Modeled from SOTS File</div>
      <div class="stamp">Party · propensity · turnout</div>
    </div>
  </header>

  <div class="map-grid">
    <div class="mapcard"><div class="lmap" id="voters-map"></div><div class="maplegend" id="voters-legend"></div></div>
    <aside class="side">
      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">Registration of Targets</div><div class="chart-tray-meta">No Democrats targeted</div></div>
        <div class="party-bar-track" style="height:28px;margin-top:4px;">
          <div class="pb-n" style="width:${pr.U}%;">NPA ${pr.U}%</div>
          <div class="pb-r" style="width:${pr.R}%;">R ${pr.R}%</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--ff-display);font-size:10px;letter-spacing:1px;text-transform:uppercase;">
          <span style="color:var(--npa-lt);">NPA ${fmt(TG.party.U)}</span>
          <span style="color:var(--rep-lt);">R ${fmt(TG.party.R)}</span>
        </div>
      </div>
      <div class="chart-tray" style="flex:1;">
        <div class="chart-tray-head"><div class="chart-tray-hd">Target Segments</div><div class="chart-tray-meta">${fmt(OUR_UNIVERSE)} total</div></div>
        <div style="display:flex;flex-direction:column;gap:11px;margin-top:6px;">
          ${segCards.map(s => `
            <div style="border:1px solid var(--border);border-left:3px solid ${s.color};border-radius:6px;background:${s.tintbg};padding:13px 15px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                <div><div style="font-family:var(--ff-display);font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${s.colorLt};">${s.label}</div><div style="font-size:11px;color:var(--fg-dim);margin-top:3px;">${s.sub}</div></div>
                <div style="font-family:var(--ff-display);font-weight:700;font-size:24px;font-variant-numeric:tabular-nums;">${fmt(s.n)}</div>
              </div>
              <div class="demo-track" style="height:6px;margin-top:10px;"><div class="demo-fill" style="width:${s.pct}%;background:${s.color};"></div></div>
            </div>`).join("")}
        </div>
      </div>
    </aside>
  </div>

  <div class="sec-head"><h2>The Universe</h2><div class="note">${fmt(OUR_UNIVERSE)} targets · propensity &amp; demographics</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div class="chart-tray">
      <div class="chart-tray-head"><div class="chart-tray-hd">Vote Propensity</div><div class="chart-tray-meta">Of targets</div></div>
      <div class="demo-section" style="padding-top:4px;">
        ${tiers.map(([l, n, p, c]) => `<div class="demo-row"><div class="demo-lbl" style="width:130px;">${l}</div><div class="demo-track"><div class="demo-fill" style="width:${p}%;background:${c};"></div></div><div class="demo-pct">${p}%</div></div>`).join("")}
        <div style="font-size:10px;color:var(--fg-muted);margin-top:10px;line-height:1.5;">Universe excludes 0–1-of-4 voters — targets already turn out.</div>
      </div>
    </div>
    <div class="chart-tray">
      <div class="chart-tray-head"><div class="chart-tray-hd">Who They Are</div><div class="chart-tray-meta">Gender · age</div></div>
      <div class="demo-section" style="padding-top:4px;">
        <div class="demo-row"><div class="demo-lbl">Women</div><div class="demo-track"><div class="demo-fill" style="width:${womenPct}%;background:${C.repLt};"></div></div><div class="demo-pct">${womenPct}%</div></div>
        <div class="demo-row"><div class="demo-lbl">Men</div><div class="demo-track"><div class="demo-fill" style="width:${menPct}%;background:#7F1D1D;"></div></div><div class="demo-pct">${menPct}%</div></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:11px;border-top:1px solid var(--hairline);">
          <div class="stat-lbl" style="margin:0;">Average age</div><div class="stat-val" style="font-size:22px;">${TG.avg_age}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="sec-head"><h2>Targets by Precinct</h2>
    <div class="map-controls" style="position:static;">${chips}</div></div>
  <div id="voter-detail"></div>`;
  $$("[data-vsel]").forEach(el => el.addEventListener("click", () => selectVoterPrec(el.dataset.vsel)));
  renderVoterDetail();
}
function selectVoterPrec(id) {
  selectedVoterPrec = id;
  $$("[data-vsel]").forEach(b => b.classList.toggle("on", b.dataset.vsel === id));
  renderVoterDetail(); paintVotersMap();
}
function renderVoterDetail() {
  const el = $("#voter-detail"); if (!el || !TG) return;
  const id = selectedVoterPrec, tp = TG.precinct[id], p = pById(id), r = roleOf(p);
  const nm = $("#voter-detail-name"); if (nm) nm.textContent = `${tp.name} · ${fmt(tp.target)} targets`;
  const uPct = pct(tp.party.U, tp.target), rPct = pct(tp.party.R, tp.target);
  const womenPct = pct(tp.gender.F, tp.target), menPct = pct(tp.gender.M, tp.target);
  const lockPct = pct(tp.locked_in, tp.target), restPct = 100 - lockPct;

  el.innerHTML = `
    <div class="chart-tray" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="font-family:var(--ff-display);font-weight:800;font-size:22px;letter-spacing:.5px;text-transform:uppercase;">${tp.name}</div>
        <span style="padding:3px 9px;border-radius:2px;background:${r.tint};border:1px solid ${r.bd};color:${r.colorLt};font-family:var(--ff-display);font-weight:600;font-size:10px;letter-spacing:2px;text-transform:uppercase;">${r.key}</span>
        <div style="margin-left:auto;display:flex;gap:26px;">
          <div><div class="stat-lbl">Targets</div><div class="stat-val teal">${fmt(tp.target)}</div></div>
          <div><div class="stat-lbl">Likely Voters</div><div class="stat-val">${fmt(tp.likely_voters)}</div></div>
          <div><div class="stat-lbl">Of Likely</div><div class="stat-val gold">${tp.target_pct_of_turnout}%</div></div>
          <div><div class="stat-lbl">Avg Age</div><div class="stat-val">${tp.avg_age}</div></div>
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="chart-tray"><div class="chart-tray-head"><div class="chart-tray-hd">Who We Target</div><div class="chart-tray-meta">Registration</div></div>
        <div class="party-bar-track" style="height:28px;margin-top:6px;"><div class="pb-n" style="width:${uPct}%;">NPA ${uPct}%</div><div class="pb-r" style="width:${rPct}%;">R ${rPct}%</div></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--ff-display);font-size:10px;letter-spacing:1px;text-transform:uppercase;"><span style="color:var(--npa-lt);">Unaff ${fmt(tp.party.U)}</span><span style="color:var(--rep-lt);">Rep ${fmt(tp.party.R)}</span></div>
      </div>
      ${trayBars("Gender", "Of targets", [
        dRow("Women", womenPct, C.repLt, `${womenPct}%`, 64),
        dRow("Men", menPct, "#7F1D1D", `${menPct}%`, 64),
      ].join(""))}
      ${trayBars("How Reliable", "Of targets", [
        dRow("Locked-in 3–4/4", lockPct, RAMP_T[3], `${lockPct}%`, 108),
        dRow("Rest of universe", restPct, RAMP_T[1], `${restPct}%`, 108),
      ].join(""))}
      <div class="chart-tray"><div class="chart-tray-head"><div class="chart-tray-hd">Turnout Anchor</div><div class="chart-tray-meta">Targets who voted '24</div></div>
        <div style="display:flex;align-items:baseline;gap:10px;margin-top:12px;"><div style="font-family:var(--ff-display);font-weight:700;font-size:34px;color:var(--rep-lt);font-variant-numeric:tabular-nums;">${fmt(tp.voted_2024)}</div><div class="stat-lbl" style="margin:0;">voted 2024 · ${pct(tp.voted_2024, tp.target)}% of targets</div></div>
        <div class="demo-track" style="height:8px;margin-top:12px;"><div class="demo-fill" style="width:${pct(tp.voted_2024, tp.target)}%;background:var(--rep);"></div></div>
      </div>
    </div>`;
}
function buildVotersMap() { votersMap = baseMap("voters-map"); paintVotersMap(); }
function paintVotersMap() {
  if (!votersMap) return;
  if (votersLayer) votersMap.removeLayer(votersLayer);
  const maxT = Math.max(...P.map(p => tgPrec(p.id)?.target || 0));
  votersLayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id), tp = tgPrec(p.id), r = roleOf(p), on = p.id === selectedVoterPrec;
      const t = tp ? tp.target / maxT : 0;
      return { fillColor: r.color, fillOpacity: .45 + .5 * t, color: on ? "#fff" : "rgba(255,255,255,.55)", weight: on ? 3 : 1.2, opacity: 1 };
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), tp = tgPrec(p.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${tp ? fmt(tp.target) : 0}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#fff" }),
        mouseout: () => paintVotersMap(),
        click: () => selectVoterPrec(p.id),
      });
    },
  }).addTo(votersMap);
  const leg = $("#voters-legend");
  if (leg) legend(leg, "Targets by Precinct",
    [...P].sort((a, b) => (tgPrec(b.id)?.target || 0) - (tgPrec(a.id)?.target || 0))
      .map(p => [roleOf(p).color, `${p.name} · ${fmt(tgPrec(p.id)?.target || 0)}`]));
}

/* ════════════════════ SIGNALS ════════════════════ */
// Only surface signals that actually differ across precincts (>=7-point spread).
const SIG_SPREAD = id => { const v = P.map(p => pval(p.id, id)); return Math.max(...v) - Math.min(...v); };
const SIGNALS = ["turnout24", "dropoff", "vbm", "early", "eday", "newmover", "solo", "unaff", "rep"]
  .filter(id => SIG_SPREAD(id) >= 7)
  .sort((a, b) => SIG_SPREAD(b) - SIG_SPREAD(a));
let signalMap, signalLayer, signalMetric = SIGNALS[0], selectedSignal = basePrecinct.id;

function renderSignals() {
  $("#tab-signals").innerHTML = `
  <div class="page-head"><h2>Signals</h2><p>Precinct-level signals from the voter file — only the ones that <strong>meaningfully differ</strong> between precincts (7+ point spread) are shown. Pick a signal to shade the map.</p></div>
  <div class="map-grid">
    <div class="mapcard"><div class="map-controls" id="signal-controls"></div><div class="lmap" id="signal-map"></div><div class="maplegend" id="signal-legend"></div></div>
    <aside class="side"><div class="panel-card card-accent" id="signal-detail" style="--accent:${C.gold}"></div></aside>
  </div>
  <div class="sec-head"><h2>Signal by Precinct</h2><div class="note">% of active voters</div></div>
  <div class="table-wrap"><table class="tbl" id="signal-table"></table></div>`;
  renderSignalControls();
  renderSignalDetail();
  renderSignalTable();
}
function renderSignalControls() {
  $("#signal-controls").innerHTML = SIGNALS.map(id => `<button class="seg-btn ${id === signalMetric ? "on" : ""}" data-sig="${id}" type="button">${pmeta(id).label}</button>`).join("");
  $$("[data-sig]").forEach(b => b.addEventListener("click", () => { signalMetric = b.dataset.sig; renderSignalControls(); paintSignalMap(); renderSignalDetail(); renderSignalTable(); }));
}
function buildSignalMap() { signalMap = baseMap("signal-map"); paintSignalMap(); }
function paintSignalMap() {
  if (!signalMap) return;
  if (signalLayer) signalMap.removeLayer(signalLayer);
  const vals = P.map(p => pval(p.id, signalMetric)), lo = Math.min(...vals), hi = Math.max(...vals);
  // Pad the domain so real differences read clearly without exaggerating them.
  const pad = Math.max((hi - lo) * 0.6, 6), dLo = lo - pad, dHi = hi + pad;
  signalLayer = L.geoJSON(D.geo, {
    style: f => featureStyle(fillSeq(pval(f.properties.id, signalMetric), dLo, dHi, hex2rgb(C.goldLt)), selectedSignal === f.properties.id),
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${pval(p.id, signalMetric)}%</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#fff" }),
        mouseout: () => paintSignalMap(),
        click: () => { selectedSignal = p.id; paintSignalMap(); renderSignalDetail(); renderSignalTable(); },
      });
    },
  }).addTo(signalMap);
  legend($("#signal-legend"), `${pmeta(signalMetric).label} · ${lo}–${hi}%`, [[fillSeq(lo, dLo, dHi, hex2rgb(C.goldLt)), `Low · ${lo}%`], [fillSeq(hi, dLo, dHi, hex2rgb(C.goldLt)), `High · ${hi}%`]]);
}
function renderSignalDetail() {
  const p = pById(selectedSignal), m = pmeta(signalMetric);
  const delta = Math.round((pval(p.id, signalMetric) - PDIST[signalMetric]) * 10) / 10;
  $("#signal-detail").innerHTML = `<div class="pc-top"><h3>${p.name}</h3><span class="tag" style="color:${C.goldLt}">${m.label}</span></div>
    <div class="rows">
      ${drow("Precinct value", `${pval(p.id, signalMetric)}%`)}
      ${drow("District average", `${PDIST[signalMetric]}%`)}
      ${drow("Difference", `${signed(delta)} pts`)}
    </div>
    <p style="color:var(--fg-dim);font-size:12.5px;line-height:1.5;margin-top:14px">${m.desc || ""}</p>`;
}
function renderSignalTable() {
  const m = pmeta(signalMetric);
  const rows = [...P].sort((a, b) => pval(b.id, signalMetric) - pval(a.id, signalMetric)).map(p => {
    const v = pval(p.id, signalMetric), delta = Math.round((v - PDIST[signalMetric]) * 10) / 10;
    return `<tr><td><b>${p.name}</b><div class="kk">Precinct ${p.id}</div></td><td><b>${v}%</b></td>
      <td style="color:${delta > 0 ? C.goldLt : delta < 0 ? C.muted : C.muted}">${signed(delta)} pts</td></tr>`;
  }).join("");
  $("#signal-table").innerHTML = `<thead><tr><th>Precinct</th><th>${m.label}</th><th>vs district</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ════════════════════ HISTORY (real precinct returns, by race) ════════════════════ */
let histMap, histLayer, histOffice = "mayor", histYear = 2025;
const histYears = office => Object.keys(HRES.data[office]).map(Number).sort((a, b) => b - a);
const histEntry = () => HRES.data[histOffice][histYear];
const hasBP = e => e && e.bp;
const distTotals = e => hasBP(e)
  ? Object.values(e.bp).reduce((a, [d, r]) => ({ d: a.d + d, r: a.r + r }), { d: 0, r: 0 })
  : null;
// Sequential ramp: light = closer race, deep = safer. Blue for D, red for R.
const HIST_DOM = [8, 58];
const D_RAMP = [[224, 238, 255], [21, 46, 130]];
const R_RAMP = [[255, 226, 224], [120, 18, 18]];
function marginColor(m) {
  if (m == null) return "#33415A";
  const [lo, hi] = HIST_DOM, t = Math.max(0, Math.min(1, (Math.abs(m) - lo) / (hi - lo)));
  const [a, b] = m >= 0 ? D_RAMP : R_RAMP;
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}

function renderHistory() {
  const turnout = [["2018", T.hist.y2018], ["2022", T.hist.y2022], ["2024", T.hist.y2024]];
  const maxTO = maxOf(turnout.map(t => t[1]));

  $("#tab-history").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">History</div>
      <h1>Electoral Record</h1>
      <div class="sub">Real precinct returns by office &amp; year · voting districts 004 · 005 · 006</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> Certified Results</div>
      <div class="stamp">SOTS Election Archive</div>
    </div>
  </header>

  <div class="map-controls" style="position:static;margin-bottom:10px" id="hist-office"></div>
  <div class="map-controls" style="position:static;margin-bottom:16px" id="hist-year"></div>

  <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:start;">
    <div class="mapcard"><div class="lmap" id="hist-map"></div><div class="maplegend" id="hist-legend"></div></div>
    <div class="chart-tray" id="hist-result"></div>
  </div>

  <div class="sec-head"><h2 id="hist-sec-h"></h2><div class="note" id="hist-sec-n"></div></div>
  <div class="table-wrap"><table class="tbl" id="hist-table"></table></div>

  <div class="sec-head"><h2>General Turnout by Cycle</h2><div class="note">ballots on current rolls</div></div>
  <div class="chart-tray">
    <div class="mini-bars" style="height:140px;">
      ${turnout.map(([yr, n], i) => {
    const last = i === 2;
    return `<div class="col"><div class="n" style="font-size:14px;color:${last ? "var(--gold-lt)" : "var(--fg)"}">${fmt(n)}</div>
        <div class="bar" style="max-width:60px;height:${Math.round(112 * n / maxTO)}px;background:${last ? "var(--gold)" : "var(--rep)"};opacity:${last ? 1 : .8};"></div>
        <div class="yr" style="${last ? "color:var(--fg);font-weight:600;" : ""}">${yr}</div></div>`;
  }).join("")}
    </div>
  </div>`;
  renderHistControls(); renderHistResult(); renderHistTable();
}
function renderHistControls() {
  $("#hist-office").innerHTML = HRES.order.map(o => `<button class="seg-btn ${o === histOffice ? "on" : ""}" data-ho="${o}" type="button">${HRES.meta[o].label}</button>`).join("");
  $("#hist-year").innerHTML = histYears(histOffice).map(y => `<button class="seg-btn ${y === histYear ? "on" : ""}" data-hy="${y}" type="button">${y}</button>`).join("");
  $$("[data-ho]").forEach(b => b.addEventListener("click", () => { histOffice = b.dataset.ho; histYear = histYears(histOffice)[0]; refreshHistory(); }));
  $$("[data-hy]").forEach(b => b.addEventListener("click", () => { histYear = +b.dataset.hy; refreshHistory(); }));
}
function refreshHistory() { renderHistControls(); paintHistMap(); renderHistResult(); renderHistTable(); }
function buildHistMap() { histMap = baseMap("hist-map"); paintHistMap(); }
function paintHistMap() {
  if (!histMap) return;
  if (histLayer) histMap.removeLayer(histLayer);
  const e = histEntry();
  histLayer = L.geoJSON(D.geo, {
    style: f => {
      const cell = hasBP(e) ? e.bp[f.properties.id] : null;
      return featureStyle(cell ? marginColor(marginPts(cell[0], cell[1])) : e.un ? "#2E4A78" : "#3A4658", false);
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), cell = hasBP(e) ? e.bp[f.properties.id] : null;
      const lbl = cell ? `${e.d.split(" ").pop()} +${Math.abs(marginPts(cell[0], cell[1]))}` : e.un ? "Unopposed" : "pending";
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${lbl}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
    },
  }).addTo(histMap);
  legend($("#hist-legend"), `${HRES.meta[histOffice].label} ${histYear} · D margin`,
    hasBP(e) ? [[marginColor(10), "Closer · D+10"], [marginColor(33), "Lean · D+33"], [marginColor(55), "Safer · D+55"]]
      : e.un ? [["#2E4A78", "Unopposed (D)"]] : [["#33415A", "Result pending"]]);
}
function renderHistResult() {
  const e = histEntry(), meta = HRES.meta[histOffice], tot = distTotals(e);
  const r1 = x => Math.round(x * 10) / 10;
  let body;
  if (tot) {
    const tp = tot.d + tot.r, dp = r1(100 * tot.d / tp), rp = r1(100 * tot.r / tp), m = marginPts(tot.d, tot.r);
    const prow = pid => {
      const c = e.bp[pid]; if (!c) return "";
      const pm = marginPts(c[0], c[1]), rl = roleOf(pById(pid));
      return `<div class="drow"><span class="l">${pById(pid).name}</span><span class="v" style="color:${rl.colorLt}">${pm >= 0 ? "D" : "R"}+${Math.abs(pm)}<span style="color:var(--fg-muted);font-size:12px;font-weight:400"> · ${fmt(c[0])}–${fmt(c[1])}</span></span></div>`;
    };
    body = `<div class="party-bar-track" style="height:30px;">
        <div class="pb-d" style="width:${dp}%;">${e.d.toUpperCase()} ${dp}%</div><div class="pb-r" style="width:${rp}%;">${e.r.toUpperCase()} ${rp}%</div></div>
      <div class="rows" style="margin-top:12px">
        ${drow(`${e.d} (D)`, `${dp}% · ${fmt(tot.d)}`)}${drow(`${e.r} (R)`, `${rp}% · ${fmt(tot.r)}`)}
      </div>
      <div class="stat-lbl" style="margin:16px 0 4px">By precinct</div>
      <div class="rows">${["004", "005", "006"].map(prow).join("")}</div>`;
  } else if (e.un) {
    body = `<div class="callout" style="margin-top:8px;background:rgba(37,99,235,.1);border-color:rgba(96,165,250,.3)"><b style="color:${C.demLt}">${e.d} (D) ran unopposed.</b> No Republican on the ballot — the seat was uncontested.</div>`;
  } else {
    body = `<div class="rows" style="margin-top:8px">${drow("Winner", `${e.d} (D)`)}${e.r ? drow("Opponent", `${e.r} (R)`) : ""}</div>`;
  }
  $("#hist-result").innerHTML = `<div class="chart-tray-head"><div class="chart-tray-hd">${meta.label} · ${histYear}</div>
      <span class="margin-pill ${tot ? (marginPts(tot.d, tot.r) >= 0 ? "d" : "r") : "tie"}">${tot ? (marginPts(tot.d, tot.r) >= 0 ? "D" : "R") + "+" + Math.abs(marginPts(tot.d, tot.r)) : e.un ? "UNCONTESTED" : "PENDING"}</span></div>
    <div style="font-size:11px;color:var(--fg-muted);margin:-2px 0 10px;">${meta.sub}</div>
    ${body}
    <div style="font-size:10px;color:var(--fg-muted);margin-top:14px;line-height:1.5;">Source: ${HRES.source}</div>`;
}
function renderHistTable() {
  const sh = $("#hist-sec-h"), sn = $("#hist-sec-n");
  if (sh) sh.textContent = `${HRES.meta[histOffice].label} — All Cycles`;
  if (sn) sn.textContent = HRES.meta[histOffice].sub;
  const rows = histYears(histOffice).map(y => {
    const e = HRES.data[histOffice][y], tot = distTotals(e);
    if (tot) {
      const tp = tot.d + tot.r, dp = Math.round(1000 * tot.d / tp) / 10, rp = Math.round(1000 * tot.r / tp) / 10, m = marginPts(tot.d, tot.r);
      return `<tr><td><b>${y}</b></td><td>${e.d} (D) · ${e.r} (R)</td><td><b>${dp}%</b> – ${rp}%</td><td><span style="color:${C.demLt}">D+${m}</span></td></tr>`;
    }
    return `<tr><td><b>${y}</b></td><td>${e.d} (D)${e.r ? " · " + e.r + " (R)" : ""}</td><td colspan="2"><span style="color:var(--fg-muted)">${e.un ? "Unopposed" : (e.note || "pending")}</span></td></tr>`;
  }).join("");
  $("#hist-table").innerHTML = `<thead><tr><th>Year</th><th>Candidates</th><th>Result (HD-10)</th><th>Margin</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ════════════════════ BOOT ════════════════════ */
function refit(map) {
  if (!map) return;
  setTimeout(() => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [18, 18] }); }, 90);
}
function showTab(id) {
  $$(".rail-link").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  $$(".panel").forEach(panel => panel.classList.toggle("on", panel.id === `tab-${id}`));
  if (id === "precincts") { if (!precinctMap) buildPrecinctMap(); refit(precinctMap); }
  if (id === "voters") { if (!votersMap) buildVotersMap(); refit(votersMap); }
  if (id === "signals") { if (!signalMap) buildSignalMap(); refit(signalMap); }
  if (id === "history") { if (!histMap) buildHistMap(); refit(histMap); }
}
function gotoTab(id) { showTab(id); }
function wireTabs() {
  $$(".rail-link").forEach(tab => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
}
function boot() {
  const meta = $("#rail-meta");
  if (meta && D.meta.district) meta.textContent = `Connecticut ${D.meta.district} · SOTS Voter File`;
  wireTabs();
  renderOverview();
  renderPrecincts();
  renderVoters();
  renderSignals();
  renderHistory();
}
boot();
})();
