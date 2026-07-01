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

/* ── Roles (data-derived) ───────────────────────────────── */
const byR = [...P].sort((a, b) => b.pct.R - a.pct.R);
const byU = [...P].sort((a, b) => b.pct.U - a.pct.U);
const byLow = [...P].sort((a, b) => b.low_prop - a.low_prop);
const basePrecinct = byR[0];
const persuasionPrecinct = byU[0];
const turnoutPrecinct = byLow[0];

/* Intentional accent rotation (handoff): Base=teal · Turnout=gold · Persuasion=purple.
   The three roles are data-derived and land on Goodwin / Silver Lane / Hockanum. */
const ROLE = {};
ROLE[turnoutPrecinct.id] = { key: "Turnout Priority", short: "Turnout", color: C.gold, colorLt: C.goldLt, tint: "rgba(212,160,23,.14)", bd: "rgba(212,160,23,.32)" };
ROLE[persuasionPrecinct.id] = { key: "Persuasion Priority", short: "Persuasion", color: C.npa, colorLt: C.npaLt, tint: "rgba(124,58,237,.16)", bd: "rgba(124,58,237,.36)" };
ROLE[basePrecinct.id] = { key: "Republican Base", short: "Base", color: C.teal, colorLt: C.tealLt, tint: "rgba(26,139,154,.14)", bd: "rgba(26,139,154,.3)" };
P.forEach(p => { if (!ROLE[p.id]) ROLE[p.id] = { key: "Republican Base", short: "Base", color: C.teal, colorLt: C.tealLt, tint: "rgba(26,139,154,.14)", bd: "rgba(26,139,154,.3)" }; });
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
        <div style="font-family:var(--ff-display);font-weight:900;font-size:74px;line-height:.82;color:var(--teal-lt);font-variant-numeric:tabular-nums;">${fmt(OUR_UNIVERSE)}</div>
        <div style="font-family:var(--ff-display);font-weight:600;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--fg-muted);line-height:1.25;">Likely-Voter<br>Targets</div>
      </div>
      <div style="font-size:13px;color:var(--fg-dim);margin-top:18px;line-height:1.5;">50% + 1 of <strong style="color:var(--fg);font-weight:600;">${fmt(TURNOUT_UNIVERSE)}</strong> projected 2026 voters is <strong style="color:var(--fg);font-weight:600;">${fmt(WIN)}</strong> to win.</div>
      <div style="margin-top:14px;">
        <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:#0F1A2C;">
          <div style="width:${winPct}%;background:var(--gold);"></div><div style="flex:1;background:var(--teal);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:7px;font-family:var(--ff-display);font-weight:600;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--fg-muted);">
          <span style="color:var(--gold-lt);">${fmt(WIN)} to win</span><span>${fmt(OUR_UNIVERSE)} in universe</span>
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:22px 0 18px;"></div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;">
        <div class="t-eyebrow" style="max-width:150px;line-height:1.3;">Cushion Above the Win Number</div>
        <div style="font-family:var(--ff-display);font-weight:900;font-size:34px;color:var(--teal-lt);">+${fmt(CUSHION)}</div>
      </div>
      <div style="height:6px;border-radius:3px;background:#0F1A2C;overflow:hidden;margin-top:12px;"><div style="width:${Math.min(100, Math.round(100 * CUSHION / WIN))}%;height:100%;background:var(--teal);"></div></div>
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

function renderPrecincts() {
  const order = rankedByTargets();
  const maxT = Math.max(...order.map(p => tgPrec(p.id)?.target || 0));
  const desc = {
    "Republican Base": "Densest GOP base — confirm & bank.",
    "Turnout Priority": "Lowest-propensity bloc — drive turnout.",
    "Persuasion Priority": "Largest persuadable NPA bloc — persuade.",
  };
  const rows = order.map((p, i) => {
    const r = roleOf(p), tp = tgPrec(p.id), n = tp ? tp.target : 0, m = mayor25Margin(p.id);
    return `
    <div class="rank-row" style="border:1px solid var(--border);border-left:3px solid ${r.color};border-radius:8px;background:rgba(15,26,44,.5);padding:18px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="font-family:var(--ff-display);font-weight:900;font-size:26px;color:${r.colorLt};width:26px;text-align:center;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-family:var(--ff-display);font-weight:800;font-size:19px;letter-spacing:.5px;text-transform:uppercase;">${p.name}</span>
            <span style="font-size:10px;color:var(--fg-muted);letter-spacing:1px;">${p.id}</span>
            <span style="padding:2px 8px;border-radius:2px;background:${r.tint};border:1px solid ${r.bd};color:${r.colorLt};font-family:var(--ff-display);font-weight:600;font-size:9px;letter-spacing:2px;text-transform:uppercase;">${r.short}</span>
          </div>
          <div style="font-size:12px;color:var(--fg-dim);margin-top:5px;">${desc[r.key]}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:var(--ff-display);font-weight:700;font-size:24px;color:${r.colorLt};font-variant-numeric:tabular-nums;line-height:1;">${fmt(n)}</div>
          <div class="stat-lbl" style="margin:5px 0 0;">Targets</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:14px;">
        <div class="demo-track" style="flex:1;height:6px;"><div class="demo-fill" style="width:${Math.round(100 * n / maxT)}%;background:${r.color};"></div></div>
        <div style="display:flex;gap:18px;flex-shrink:0;">
          <div style="text-align:right;"><span class="stat-lbl" style="display:inline;">Reg</span> <span style="font-family:var(--ff-display);font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;">${fmt(p.active)}</span></div>
          <div style="text-align:right;"><span class="stat-lbl" style="display:inline;">'25 Margin</span> <span style="font-family:var(--ff-display);font-weight:700;font-size:14px;color:var(--dem-lt);">D+${m}</span></div>
        </div>
      </div>
    </div>`;
  }).join("");

  $("#tab-precincts").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">Precincts</div>
      <h1>Field Ranking</h1>
      <div class="sub">Where to deploy — ranked by target concentration</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> 3 Precincts</div>
      <div class="stamp">${fmt(OUR_UNIVERSE)} targets total</div>
    </div>
  </header>

  <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:20px;align-items:start;">
    <div style="display:flex;flex-direction:column;gap:12px;">${rows}</div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="chart-tray" style="padding:0;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px 10px;">
          <div class="chart-tray-hd">Precinct Map</div><div class="chart-tray-meta">East Hartford · Role</div>
        </div>
        <div style="padding:0 14px 14px;position:relative;">
          <div class="lmap" id="precinct-map" style="height:290px;min-height:0;max-height:none;"></div>
          <div class="maplegend" id="precinct-legend" style="left:26px;bottom:26px;"></div>
        </div>
      </div>
      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">District Roll-Up</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);border-radius:6px;overflow:hidden;margin-top:6px;">
          <div style="background:var(--navy-card);padding:12px 14px;"><div class="stat-lbl">Total Reg</div><div class="stat-val" style="font-size:20px;">${fmt(T.active)}</div></div>
          <div style="background:var(--navy-card);padding:12px 14px;"><div class="stat-lbl">Targets</div><div class="stat-val teal" style="font-size:20px;">${fmt(OUR_UNIVERSE)}</div></div>
          <div style="background:var(--navy-card);padding:12px 14px;"><div class="stat-lbl">Turnout Univ.</div><div class="stat-val gold" style="font-size:20px;">${fmt(TURNOUT_UNIVERSE)}</div></div>
          <div style="background:var(--navy-card);padding:12px 14px;"><div class="stat-lbl">To Win</div><div class="stat-val" style="font-size:20px;">${fmt(WIN)}</div></div>
        </div>
      </div>
    </div>
  </div>`;
}
function buildPrecinctMap() { precinctMap = baseMap("precinct-map"); paintPrecinctMap(); }
function paintPrecinctMap() {
  if (!precinctMap) return;
  if (precinctLayer) precinctMap.removeLayer(precinctLayer);
  precinctLayer = L.geoJSON(D.geo, {
    style: f => featureStyle(roleOf(pById(f.properties.id)).color, false),
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), r = roleOf(p);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${r.short}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
    },
  }).addTo(precinctMap);
  legend($("#precinct-legend"), "Priority Role",
    [[C.teal, "Base"], [C.gold, "Turnout"], [C.npa, "Persuasion"]]);
}

/* ════════════════════ VOTERS ════════════════════ */
let votersMap, votersLayer;
function renderVoters() {
  if (!TG) { $("#tab-voters").innerHTML = ""; return; }
  const ut = TG.universe_turnout, g = TG.gender, pr = TG.party_pct;
  const womenPct = pct(g.F, OUR_UNIVERSE), menPct = pct(g.M, OUR_UNIVERSE);

  // Real, mutually-exclusive registration split of the target universe (no D targets).
  const segCards = [
    { label: "Persuadable Unaffiliated", sub: "Unaffiliated targets — persuade & turn out", n: TG.party.U, pct: pr.U, color: C.npa, colorLt: C.npaLt, tintbg: "rgba(124,58,237,.06)" },
    { label: "Republican Base", sub: "Registered Republicans — confirm & bank", n: TG.party.R, pct: pr.R, color: C.teal, colorLt: C.tealLt, tintbg: "rgba(26,139,154,.06)" },
  ];

  // Real vote-propensity tiers (sum to the universe).
  const tiers = [
    ["Reliable · 3–4 of 4", ut.locked.n, ut.locked.pct, C.teal],
    ["Likely · 2 of 4", ut.mid.n, ut.mid.pct, C.gold],
    ["New movers", ut.low.n, ut.low.pct, C.npa],
  ];

  // Real overlapping messaging hooks.
  const hooks = Object.entries(TG.segments).sort((a, b) => b[1].n - a[1].n)
    .map(([k, s]) => [s.label, s.n, s.pct_of_target, k === "seg_R" ? C.rep : C.npa]);

  // Real target density by precinct (role-colored).
  const precs = Object.entries(TG.precinct).map(([id, v]) => ({ id, ...v, role: roleOf(pById(id)) }))
    .sort((a, b) => b.target - a.target);

  $("#tab-voters").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">Voters</div>
      <h1>Target Universe</h1>
      <div class="sub">${fmt(OUR_UNIVERSE)} likely-voter targets · who to contact and why</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> Modeled from SOTS File</div>
      <div class="stamp">Party · propensity · turnout</div>
    </div>
  </header>

  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;align-items:start;">
    <!-- LEFT -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">Target Segments</div><div class="chart-tray-meta">${fmt(OUR_UNIVERSE)} total · by registration</div></div>
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="chart-tray">
          <div class="chart-tray-head"><div class="chart-tray-hd">Vote Propensity</div><div class="chart-tray-meta">Of targets</div></div>
          <div class="demo-section" style="padding-top:4px;">
            ${tiers.map(([l, n, p, c]) => `<div class="demo-row"><div class="demo-lbl" style="width:96px;">${l}</div><div class="demo-track"><div class="demo-fill" style="width:${p}%;background:${c};"></div></div><div class="demo-pct">${p}%</div></div>`).join("")}
            <div style="font-size:10px;color:var(--fg-muted);margin-top:10px;line-height:1.5;">Universe excludes 0–1-of-4 voters — targets already turn out.</div>
          </div>
        </div>
        <div class="chart-tray">
          <div class="chart-tray-head"><div class="chart-tray-hd">Who They Are</div><div class="chart-tray-meta">Gender · age</div></div>
          <div class="demo-section" style="padding-top:4px;">
            <div class="demo-row"><div class="demo-lbl">Women</div><div class="demo-track"><div class="demo-fill" style="width:${womenPct}%;background:var(--demo-purple);"></div></div><div class="demo-pct">${womenPct}%</div></div>
            <div class="demo-row"><div class="demo-lbl">Men</div><div class="demo-track"><div class="demo-fill" style="width:${menPct}%;background:var(--demo-green);"></div></div><div class="demo-pct">${menPct}%</div></div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:11px;border-top:1px solid var(--hairline);">
              <div class="stat-lbl" style="margin:0;">Average age</div><div class="stat-val" style="font-size:22px;">${TG.avg_age}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">Messaging Hooks</div><div class="chart-tray-meta">Overlapping · a voter can fit several</div></div>
        <div class="demo-section" style="padding-top:4px;">
          ${hooks.map(([l, n, p, c]) => `<div class="demo-row"><div class="demo-lbl" style="width:auto;flex:1;font-weight:500;font-size:11.5px;color:var(--fg-dim);">${l}</div><div class="demo-track" style="max-width:120px;"><div class="demo-fill" style="width:${p}%;background:${c};"></div></div><div class="demo-pct" style="width:64px;">${fmt(n)}·${p}%</div></div>`).join("")}
        </div>
      </div>
    </div>

    <!-- RIGHT -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="chart-tray" style="padding:0;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px 10px;">
          <div class="chart-tray-hd">Target Density</div><div class="chart-tray-meta">By precinct</div>
        </div>
        <div style="padding:0 14px 14px;">
          <div class="lmap" id="voters-map" style="height:220px;min-height:0;max-height:none;"></div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">
            ${precs.map(p => `<div style="display:flex;align-items:center;gap:9px;font-size:11px;color:var(--fg);"><span style="width:20px;height:9px;border-radius:2px;background:${p.role.color};"></span> ${p.name} · ${fmt(p.target)} targets</div>`).join("")}
          </div>
        </div>
      </div>

      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">Registration of Targets</div><div class="chart-tray-meta">No Democrats targeted</div></div>
        <div class="party-bar-track" style="margin-top:4px;">
          <div class="pb-n" style="width:${pr.U}%;">NPA ${pr.U}%</div>
          <div class="pb-r" style="width:${pr.R}%;">R ${pr.R}%</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--ff-display);font-size:10px;letter-spacing:1px;text-transform:uppercase;">
          <span style="color:var(--npa-lt);">NPA ${fmt(TG.party.U)}</span>
          <span style="color:var(--rep-lt);">R ${fmt(TG.party.R)}</span>
        </div>
      </div>
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
      const p = pById(f.properties.id), tp = tgPrec(p.id), r = roleOf(p);
      const t = tp ? tp.target / maxT : 0;
      return { fillColor: r.color, fillOpacity: .45 + .5 * t, color: "rgba(255,255,255,.55)", weight: 1.2, opacity: 1 };
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), tp = tgPrec(p.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${tp ? fmt(tp.target) : 0}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
    },
  }).addTo(votersMap);
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
      <td style="color:${delta > 0 ? C.tealLt : delta < 0 ? C.repLt : C.muted}">${signed(delta)} pts</td></tr>`;
  }).join("");
  $("#signal-table").innerHTML = `<thead><tr><th>Precinct</th><th>${m.label}</th><th>vs district</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ════════════════════ HISTORY (real precinct returns, by race) ════════════════════ */
const mayorTotals = e => e.bp
  ? Object.values(e.bp).reduce((a, [d, r]) => ({ d: a.d + d, r: a.r + r }), { d: 0, r: 0 })
  : null;

function renderHistory() {
  const mayor = HRES.data.mayor;
  const years = Object.keys(mayor).map(Number).sort((a, b) => b - a);   // 2025 … 2017
  const cyc = years.map(y => {
    const e = mayor[y], t = mayorTotals(e);
    return t ? { y, ...t, m: marginPts(t.d, t.r), un: false, d_name: e.d, r_name: e.r } : { y, un: true, d_name: e.d };
  });
  const cur = cyc[0];                                   // 2025 result
  const curTot = cur.d + cur.r, curDp = Math.round(1000 * cur.d / curTot) / 10, curRp = Math.round(1000 * cur.r / curTot) / 10;
  const contested = cyc.filter(c => !c.un);
  const maxM = Math.max(...contested.map(c => c.m));

  // Precinct Democratic margins — latest contested Mayor cycle (2025).
  const precM = [basePrecinct, turnoutPrecinct, persuasionPrecinct]
    .map(p => ({ p, r: roleOf(p), m: mayor25Margin(p.id) }))
    .sort((a, b) => b.m - a.m);
  const maxPM = Math.max(...precM.map(x => x.m));

  // Turnout by cycle (real ballots on current rolls).
  const turnout = [["2018", T.hist.y2018], ["2022", T.hist.y2022], ["2024", T.hist.y2024]];
  const maxTO = maxOf(turnout.map(t => t[1]));

  $("#tab-history").innerHTML = `
  <header class="phead">
    <div>
      <div class="eyebrow">History</div>
      <h1>Electoral Record</h1>
      <div class="sub">East Hartford Mayor &amp; HD-10 margins · 2017–2025</div>
    </div>
    <div class="right">
      <div class="live-row"><span class="live-dot"></span> Certified Results</div>
      <div class="stamp">SOTS Election Archive</div>
    </div>
  </header>

  <!-- Mayor 2025 result -->
  <div class="chart-tray" style="margin-bottom:20px;">
    <div class="chart-tray-head"><div class="chart-tray-hd">Mayor · East Hartford · ${cur.y}</div><div class="chart-tray-meta">Certified · ${fmt(curTot)} votes</div></div>
    <div style="display:flex;align-items:center;gap:24px;margin-top:8px;flex-wrap:wrap;">
      <div style="flex:1;min-width:280px;">
        <div class="party-bar-track" style="height:30px;">
          <div class="pb-d" style="width:${curDp}%;">${cur.d_name.toUpperCase()} ${curDp}%</div>
          <div class="pb-r" style="width:${curRp}%;">${cur.r_name.toUpperCase()} ${curRp}%</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:10px;">
          <div><div style="font-family:var(--ff-display);font-weight:700;font-size:15px;color:var(--dem-lt);letter-spacing:.5px;">${cur.d_name} (D)</div><div style="font-size:11px;color:var(--fg-muted);margin-top:2px;font-variant-numeric:tabular-nums;">${fmt(cur.d)} votes</div></div>
          <div style="text-align:right;"><div style="font-family:var(--ff-display);font-weight:700;font-size:15px;color:var(--rep-lt);letter-spacing:.5px;">${cur.r_name} (R)</div><div style="font-size:11px;color:var(--fg-muted);margin-top:2px;font-variant-numeric:tabular-nums;">${fmt(cur.r)} votes</div></div>
        </div>
      </div>
      <div class="margin-pill d" style="font-size:14px;padding:8px 16px;flex-shrink:0;">▲ D LEADS BY ${fmt(cur.d - cur.r)} · ${cur.m} pts</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:20px;align-items:start;">
    <!-- Mayoral margin by cycle -->
    <div class="chart-tray">
      <div class="chart-tray-head"><div class="chart-tray-hd">Mayoral Margin by Cycle</div><div class="chart-tray-meta">Democratic advantage</div></div>
      <div style="margin-top:6px;">
        <div style="display:grid;grid-template-columns:64px 1fr 78px;gap:12px;padding:8px 10px;font-family:var(--ff-display);font-weight:600;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--fg-muted);border-bottom:1px solid var(--border);">
          <div>Cycle</div><div>Democratic Margin</div><div style="text-align:right;">Result</div>
        </div>
        ${cyc.map((c, i) => `
          <div class="cyc-row" style="display:grid;grid-template-columns:64px 1fr 78px;gap:12px;padding:11px 10px;align-items:center;border-bottom:1px solid var(--hairline);">
            <div style="font-family:var(--ff-display);font-weight:700;font-size:15px;${i === 0 ? "color:var(--gold-lt);" : ""}">${c.y}</div>
            ${c.un
      ? `<div style="height:9px;border-radius:4px;background:repeating-linear-gradient(45deg,rgba(148,163,184,.16),rgba(148,163,184,.16) 5px,transparent 5px,transparent 10px);"></div>
             <div style="text-align:right;font-family:var(--ff-display);font-weight:600;font-size:11px;color:var(--fg-muted);letter-spacing:1px;">UNOPP</div>`
      : `<div class="demo-track" style="height:9px;"><div class="demo-fill" style="width:${Math.round(100 * c.m / (maxM + 6))}%;background:var(--dem);"></div></div>
             <div style="text-align:right;font-family:var(--ff-display);font-weight:700;font-size:15px;color:var(--dem-lt);">D+${c.m}</div>`}
          </div>`).join("")}
      </div>
      <div style="font-size:10px;color:var(--fg-muted);margin-top:12px;line-height:1.5;">Source: ${HRES.source}</div>
    </div>

    <!-- Precinct margins + turnout -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">Precinct Democratic Margins</div><div class="chart-tray-meta">'${String(cur.y).slice(2)} Mayor</div></div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:6px;">
          ${precM.map(({ p, r, m }) => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;"><span style="font-family:var(--ff-display);font-weight:600;letter-spacing:1px;text-transform:uppercase;">${p.name}</span><span style="color:${r.colorLt};font-family:var(--ff-display);font-weight:700;">D+${m}</span></div>
              <div class="demo-track" style="height:8px;"><div class="demo-fill" style="width:${Math.round(100 * m / maxPM)}%;background:var(--dem);"></div></div>
              <div style="height:3px;margin-top:3px;background:${r.color};border-radius:2px;width:${Math.round(100 * m / maxPM)}%;"></div>
            </div>`).join("")}
        </div>
      </div>

      <div class="chart-tray">
        <div class="chart-tray-head"><div class="chart-tray-hd">General Turnout by Cycle</div><div class="chart-tray-meta">Ballots cast</div></div>
        <div style="display:flex;align-items:flex-end;gap:20px;height:120px;padding:14px 8px 0;">
          ${turnout.map(([yr, n], i) => {
      const last = i === turnout.length - 1;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
              <div style="font-family:var(--ff-display);font-weight:700;font-size:14px;color:${last ? "var(--gold-lt)" : "var(--fg)"};margin-bottom:6px;font-variant-numeric:tabular-nums;">${fmt(n)}</div>
              <div style="width:100%;max-width:48px;height:${Math.round(96 * n / maxTO)}px;border-radius:3px 3px 0 0;background:${last ? "var(--gold)" : "var(--teal)"};opacity:${last ? "1" : ".85"};"></div>
              <div style="font-size:10px;color:${last ? "var(--fg)" : "var(--fg-muted)"};margin-top:8px;letter-spacing:1px;${last ? "font-weight:600;" : ""}">${yr}</div>
            </div>`;
    }).join("")}
        </div>
      </div>
    </div>
  </div>`;
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
