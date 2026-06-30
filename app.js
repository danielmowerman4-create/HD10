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

const ROLE = {};
ROLE[turnoutPrecinct.id] = { key: "Turnout Priority", color: C.teal, colorLt: C.tealLt };
ROLE[persuasionPrecinct.id] = { key: "Persuasion Priority", color: C.npa, colorLt: C.npaLt };
ROLE[basePrecinct.id] = { key: "Republican Base", color: C.rep, colorLt: C.repLt };
P.forEach(p => { if (!ROLE[p.id]) ROLE[p.id] = { key: "Republican Base", color: C.rep, colorLt: C.repLt }; });
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
  const fit = () => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [30, 30] }); };
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
  const t = turnoutPrecinct, b = basePrecinct, p = persuasionPrecinct;
  $("#tab-overview").innerHTML = `
  <section class="hero">
    <div class="stripe"></div>
    <div class="hero-left">
      <div class="eyebrow gold">Campaign Assessment</div>
      <h1>HD-10 is difficult, but winnable with disciplined focus.</h1>
      <p class="lede">HD-10 is Democratic-leaning, but Republicans have a viable path by working
        <strong>${fmt(OUR_UNIVERSE)}</strong> targeted voters who are already likely to turn out — concentrated in
        <strong>${b.name}</strong>, <strong>${t.name}</strong>, and <strong>${p.name}</strong>.</p>
      <div class="glance">
        <div class="cell"><div class="l">Active Voters</div><div class="v num">${fmt(T.active)}</div></div>
        <div class="cell"><div class="l">Turnout Universe</div><div class="v num">${fmt(TURNOUT_UNIVERSE)}</div></div>
        <div class="cell"><div class="l">Our Targets</div><div class="v num" style="color:${C.tealLt}">${fmt(OUR_UNIVERSE)}</div></div>
      </div>
    </div>
    <div class="hero-right">
      <div class="eyebrow">Path to Victory</div>
      <div class="win-num"><span class="big num">${fmt(WIN)}</span><span class="lbl">Votes<br>To Win</span></div>
      <div class="win-sub">50% + 1 of <strong>${fmt(TURNOUT_UNIVERSE)}</strong> projected 2026 voters</div>
      <div class="win-bar"><div class="fill" style="width:50%"></div><div class="tick"></div></div>
      <div class="win-foot"><span>Win Threshold</span><span>50% + 1</span></div>
      <div class="coverage">
        <div class="cov-top"><span>Our likely-voter universe</span><b class="num" style="color:${C.tealLt}">${fmt(OUR_UNIVERSE)}</b></div>
        <div class="cov-bar"><i style="width:${Math.min(100, COVERAGE)}%"></i></div>
        <div class="cov-foot">${COVERAGE}% of the votes needed — every target counts</div>
      </div>
    </div>
  </section>

  <div class="sec-head"><h2>The Plan — In Priority Order</h2><div class="note">Pick one · work it · move on</div></div>
  <div class="grid3">
    ${planCard("01", roleOf(b), b.name, tgPrec(b.id) ? tgPrec(b.id).target : 0, "likely<br>targets",
      `Most of our universe and the strongest Republican share at ${b.pct.R}%. Confirm supporters and bank votes early.`)}
    ${planCard("02", roleOf(t), t.name, tgPrec(t.id) ? tgPrec(t.id).target : 0, "likely<br>targets",
      `${tgPrec(t.id) ? fmt(tgPrec(t.id).locked_in) : 0} of these are locked-in. Hold them with vote-plan follow-up.`)}
    ${planCard("03", roleOf(p), p.name, tgPrec(p.id) ? tgPrec(p.id).target : 0, "likely<br>targets",
      `Highest unaffiliated share at ${p.pct.U}%. Affordability, taxes, and candidate validation carry the message.`)}
  </div>
  <div class="foot-note"><i></i>Target universe = our voters already likely to vote · ${fmt(OUR_UNIVERSE)} of ${fmt(TURNOUT_UNIVERSE)} projected · Export field packets from the Precincts tab</div>`;
}
function planCard(idx, role, title, n, unit, body) {
  return `<div class="plan-card" style="--accent:${role.color};--accent-lt:${role.colorLt}">
    <div class="idx">${idx}</div>
    <div class="k">${role.key}</div>
    <h3>${title}</h3>
    <div class="stat"><b class="num">${fmt(n)}</b><span>${unit}</span></div>
    <p>${body}</p>
  </div>`;
}

/* ════════════════════ PRECINCTS ════════════════════ */
const PMETRICS = {
  priority: { label: "Priority", title: "Priority role", color: p => roleOf(p).color, value: p => roleOf(p).key,
    legend: [[C.teal, "Turnout"], [C.npa, "Persuasion"], [C.rep, "Republican base"]] },
  persuadable: { label: "Persuadable", title: "Unaffiliated share", color: p => fillSeq(p.pct.U, 40, 45, hex2rgb(C.npaLt)), value: p => `${p.pct.U}% U`,
    legend: [["#2a2547", "Lower"], [C.npaLt, "Higher"]] },
  turnout: { label: "Turnout", title: "Lower-propensity voters", color: p => fillSeq(p.low_prop, Math.min(...P.map(x => x.low_prop)), maxOf(P.map(x => x.low_prop)), hex2rgb(C.tealLt)), value: p => `${fmt(p.low_prop)}`,
    legend: [["#143038", "Fewer"], [C.tealLt, "More"]] },
  base: { label: "Republican", title: "Republican share", color: p => fillSeq(p.pct.R, 8, 15, hex2rgb(C.repLt)), value: p => `${p.pct.R}% R`,
    legend: [["#3a1f22", "Lower"], [C.repLt, "Higher"]] },
};
let precinctMap, precinctLayer, precinctMetric = "priority", selectedPrecinct = null;

function renderPrecincts() {
  $("#tab-precincts").innerHTML = `
  <div class="page-head"><h2>Precincts</h2>
    <p>The working map for focus decisions. Switch the layer, then select a precinct for its full registration, turnout, and contact-universe profile.</p></div>
  <div class="map-grid">
    <div class="mapcard"><div class="map-controls" id="precinct-controls"></div><div class="lmap" id="precinct-map"></div><div class="maplegend" id="precinct-legend"></div></div>
    <aside class="side"><div class="panel-card card-accent" id="precinct-detail"></div><div class="panel-card" id="precinct-export"></div></aside>
  </div>
  <div class="sec-head"><h2>Precinct Ranking</h2><div class="note">By priority score</div></div>
  <div class="table-wrap"><table class="tbl" id="precinct-table"></table></div>`;
  renderPrecinctControls();
  renderPrecinctDetail();
  renderPrecinctTable();
}
function renderPrecinctControls() {
  $("#precinct-controls").innerHTML = Object.entries(PMETRICS).map(([k, m]) =>
    `<button class="seg-btn ${k === precinctMetric ? "on" : ""}" data-pm="${k}" type="button">${m.label}</button>`).join("");
  $$("[data-pm]").forEach(b => b.addEventListener("click", () => { precinctMetric = b.dataset.pm; renderPrecinctControls(); paintPrecinctMap(); }));
}
function buildPrecinctMap() { precinctMap = baseMap("precinct-map"); paintPrecinctMap(); }
function paintPrecinctMap() {
  if (!precinctMap) return;
  if (precinctLayer) precinctMap.removeLayer(precinctLayer);
  const m = PMETRICS[precinctMetric];
  precinctLayer = L.geoJSON(D.geo, {
    style: f => featureStyle(m.color(pById(f.properties.id)), selectedPrecinct === f.properties.id),
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${m.value(p)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#fff" }),
        mouseout: () => paintPrecinctMap(),
        click: () => { selectedPrecinct = p.id; renderPrecinctDetail(); paintPrecinctMap(); },
      });
    },
  }).addTo(precinctMap);
  legend($("#precinct-legend"), m.title, m.legend);
}
function renderPrecinctDetail() {
  const el = $("#precinct-detail"), ex = $("#precinct-export");
  if (!el) return;
  if (!selectedPrecinct) {
    el.innerHTML = `<div class="pc-top"><h3>Select a precinct</h3></div>
      <p style="color:var(--fg-dim);font-size:13px;line-height:1.55;margin-top:10px">Tap a precinct on the map for its registration split, turnout, and contact universe.</p>`;
    el.style.setProperty("--accent", C.gold);
    ex.innerHTML = `<div class="pc-top"><h3>Contact universe</h3></div>
      <p style="color:var(--fg-dim);font-size:13px;line-height:1.55;margin-top:10px">Counts appear once a precinct is selected.</p>`;
    return;
  }
  const p = pById(selectedPrecinct), r = roleOf(p), tp = tgPrec(p.id);
  el.style.setProperty("--accent", r.color);
  el.innerHTML = `<div class="pc-top"><div><h3>${p.name}</h3><div class="kk" style="margin-top:5px">Precinct ${p.id} · ${fmt(p.active)} active</div></div>
      <span class="tag" style="color:${r.colorLt}">${r.key}</span></div>
    <div class="rows">
      ${tp ? drow("Our targets", `<span style="color:${C.tealLt}">${fmt(tp.target)}</span>`) : ""}
      ${tp ? drow("Likely voters", fmt(tp.likely_voters)) : ""}
      ${tp ? drow("Targets / likely", `${tp.target_pct_of_turnout}%`) : ""}
      ${tp ? drow("Locked-in (3–4 of 4)", fmt(tp.locked_in)) : ""}
      ${tp ? drow("Voted 2024", fmt(tp.voted_2024)) : ""}
      ${drow("2024 turnout", `${p.v24_pct}%`)}
      ${tp ? drow("Avg age (targets)", tp.avg_age) : drow("Average age", p.avg_age)}
    </div>`;
  ex.style.setProperty("--accent", r.color);
  ex.innerHTML = `<div class="pc-top"><h3>Our targets</h3><span class="tag" style="color:${r.colorLt}">${tp ? fmt(tp.target) : 0} voters</span></div>
    ${tp ? bar("Republicans", tp.party.R, tp.target, C.repLt) : ""}
    ${tp ? bar("Unaffiliated", tp.party.U, tp.target, C.npaLt) : ""}
    ${tp ? bar("Locked-in", tp.locked_in, tp.target, C.tealLt) : ""}
    <div class="btn-row"><button class="btn gold" id="export-precinct" type="button">Export precinct summary</button></div>`;
  $("#export-precinct").addEventListener("click", () => exportPrecinct(p));
}
function renderPrecinctTable() {
  const rows = ranked().map(p => {
    const r = roleOf(p), tp = tgPrec(p.id);
    return `<tr>
      <td><b>${p.name}</b><div class="kk">Precinct ${p.id}</div></td>
      <td><span class="tag" style="color:${r.colorLt}">${r.key}</span></td>
      <td><b style="color:${C.tealLt}">${tp ? fmt(tp.target) : "—"}</b><div class="kk">likely targets</div></td>
      <td><b>${tp ? fmt(tp.likely_voters) : "—"}</b><div class="kk">likely voters</div></td>
      <td><b>${p.v24_pct}%</b><div class="kk">'24 turnout</div></td>
      <td><button class="btn" type="button" data-sel="${p.id}">View</button></td></tr>`;
  }).join("");
  $("#precinct-table").innerHTML = `<thead><tr><th>Precinct</th><th>Role</th><th>Our targets</th><th>Likely voters</th><th>2024</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  $$("[data-sel]").forEach(b => b.addEventListener("click", () => { selectedPrecinct = b.dataset.sel; renderPrecinctDetail(); paintPrecinctMap(); $("#precinct-map").scrollIntoView({ behavior: "smooth", block: "center" }); }));
}
function exportPrecinct(p) {
  const tp = tgPrec(p.id) || {};
  const rows = [
    ["precinct_id", "precinct", "role", "our_targets", "likely_voters", "targets_pct_of_likely", "target_republicans", "target_unaffiliated", "locked_in", "voted_2024", "avg_age", "active", "turnout_2024_pct"],
    [p.id, p.name, roleOf(p).key, tp.target ?? "", tp.likely_voters ?? "", tp.target_pct_of_turnout ?? "", tp.party ? tp.party.R : "", tp.party ? tp.party.U : "", tp.locked_in ?? "", tp.voted_2024 ?? "", tp.avg_age ?? "", p.active, p.v24_pct],
  ];
  download(`hd10-${p.id}-${p.name.toLowerCase().replace(/\s+/g, "-")}-summary.csv`, rows);
}
function download(name, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ════════════════════ VOTERS ════════════════════ */
function renderVoters() {
  const ut = TG ? TG.universe_turnout : null;

  // funnel: where the universe comes from (narrowing), final step emphasized
  const funnel = [
    [C.demLt, T.active, "All Active Voters", "Every active HD-10 registrant."],
    [C.goldLt, TURNOUT_UNIVERSE, "Likely to Vote in 2026", `Projected to cast a ballot — ${pct(TURNOUT_UNIVERSE, T.active)}% of active voters.`],
    [C.tealLt, OUR_UNIVERSE, "Our Targets", `The likely voters we work — ${pct(OUR_UNIVERSE, TURNOUT_UNIVERSE)}% of the 2026 electorate.`],
  ];

  // propensity tiers — these THREE add up to the whole universe
  const tiers = ut ? [
    ["var(--teal-lt)", ut.locked.n, ut.locked.pct, "Reliable", "voted 3–4 of the last 4 generals"],
    ["var(--gold-lt)", ut.mid.n, ut.mid.pct, "Likely · 2-of", "two of the last 3/4, incl. a midterm or ’22+’24"],
    ["var(--npa-lt)", ut.low.n, ut.low.pct, "New movers", "recent registrants who voted the 2025 locals"],
  ] : [];
  const stack = tiers.map(([c, n, p, l]) =>
    `<span style="flex:0 0 ${p}%;background:${c};height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--ff-display);font-weight:700;font-size:12px;color:#06111F">${p >= 8 ? p + "%" : ""}</span>`).join("");
  const tierRows = tiers.map(([c, n, p, l, s]) =>
    `<div class="drow"><span class="l"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${c};margin-right:9px;vertical-align:-1px"></span><b style="color:var(--fg);font-weight:600">${l}</b> — ${s}</span><span class="v">${fmt(n)} · ${p}%</span></div>`).join("");

  // who they are
  const pr = TG ? TG.party_pct : { U: 0, R: 0 };
  const bar = (label, val, p, col) =>
    `<div class="bar"><div class="bar-top"><span>${label}</span><b>${fmt(val)} · ${p}%</b></div><div class="track"><i style="width:${p}%;background:${col}"></i></div></div>`;

  // where they are
  const precs = TG && TG.precinct ? Object.values(TG.precinct).sort((a, b) => b.target - a.target) : [];
  const maxT = precs.length ? Math.max(...precs.map(p => p.target)) : 1;
  const precRows = precs.map(p =>
    `<div class="bar"><div class="bar-top"><span>${p.name}</span><b>${fmt(p.target)} <span style="color:var(--fg-muted);font-weight:400">of ${fmt(p.likely_voters)} likely</span></b></div><div class="track"><i style="width:${Math.round(100 * p.target / maxT)}%;background:var(--teal-lt)"></i></div></div>`).join("");

  // how we reach them — overlapping segments, sorted, as comparable bars
  const segs = TG ? Object.entries(TG.segments).sort((a, b) => b[1].n - a[1].n) : [];
  const segRows = segs.map(([k, s]) =>
    `<div class="bar"><div class="bar-top"><span>${s.label}</span><b>${fmt(s.n)} · ${s.pct_of_target}%</b></div><div class="track"><i style="width:${s.pct_of_target}%;background:${k === "seg_R" ? "var(--rep-lt)" : "var(--npa-lt)"}"></i></div></div>`).join("");

  $("#tab-voters").innerHTML = `
  <div class="page-head"><h2>Voters</h2><p>Our universe is only the voters we target who are <strong>already likely to vote</strong> — no turnout-lift pool for now. <strong>${fmt(OUR_UNIVERSE)}</strong> people, ${COVERAGE}% of the votes needed to win.</p></div>

  <div class="funnel" style="grid-template-columns:repeat(3,1fr)">
    ${funnel.map(([c, v, l, s], i) => `<div class="funnel-step" style="--accent:${c};--accent-lt:${c}${i === 2 ? ";border-width:1px 1px 1px 1px;box-shadow:0 0 0 1px " + c + " inset" : ""}"><div class="v num">${fmt(v)}</div><div class="l">${l}</div><p>${s}</p></div>`).join("")}
  </div>

  <div class="sec-head"><h2>How Likely They Are to Vote</h2><div class="note">The three tiers add up to ${fmt(OUR_UNIVERSE)}</div></div>
  <div class="panel-card">
    <div class="callout" style="margin-bottom:18px"><b>“Likely to vote” =</b> 4/4 or 3/4 recent generals · 2 of the last 3 (’20·’22·’24) · 2 of the last 4 incl. a midterm · 2 of the last 2 (’22·’24) · or a new mover (registered the last year or two) who voted the 2025 locals.</div>
    <div style="display:flex;height:34px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.05)">${stack}</div>
    <div class="rows" style="margin-top:10px">${tierRows}</div>
  </div>

  <div class="sec-head"><h2>Who &amp; Where They Are</h2></div>
  <div class="map-grid">
    <div class="panel-card"><div class="pc-top"><h3>Who They Are</h3></div>
      ${TG ? bar("Unaffiliated", TG.party.U, pr.U, "var(--npa-lt)") : ""}
      ${TG ? bar("Republican", TG.party.R, pr.R, "var(--rep-lt)") : ""}
      <div class="rows" style="margin-top:10px">
        ${TG ? drow("Women", `${fmt(TG.gender.F)} · ${pct(TG.gender.F, OUR_UNIVERSE)}%`) : ""}
        ${TG ? drow("Men", `${fmt(TG.gender.M)} · ${pct(TG.gender.M, OUR_UNIVERSE)}%`) : ""}
        ${TG ? drow("Average age", TG.avg_age) : ""}
      </div></div>
    <div class="panel-card"><div class="pc-top"><h3>Where They Are</h3></div>
      ${precRows}
    </div>
  </div>

  <div class="sec-head"><h2>How We Reach Them</h2><div class="note">Messaging hooks · a voter can be in several</div></div>
  <div class="panel-card">${segRows}</div>`;
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
let histMap, histLayer, histOffice = "statehouse", histYear = 2024;
const histYears = office => Object.keys(HRES.data[office]).map(Number).sort((a, b) => b - a);
const histEntry = () => HRES.data[histOffice][histYear];
const hasBP = e => e && e.bp;
const distTotals = e => hasBP(e)
  ? Object.values(e.bp).reduce((a, [d, r]) => ({ d: a.d + d, r: a.r + r }), { d: 0, r: 0 })
  : null;
const margin = (d, r) => (d + r) ? Math.round(100 * (d - r) / (d + r)) : 0;
// Sequential ramp: light = closer race, deep = safer. Blue for D, red for R.
const HIST_DOM = [8, 58];               // margin (pts) mapped across the ramp
const D_RAMP = [[224, 238, 255], [21, 46, 130]];   // pale blue -> deep navy-blue
const R_RAMP = [[255, 226, 224], [120, 18, 18]];   // pale red  -> deep red
function marginColor(m) {
  if (m == null) return "#33415A";
  const [lo, hi] = HIST_DOM;
  const t = Math.max(0, Math.min(1, (Math.abs(m) - lo) / (hi - lo)));
  const [a, b] = m >= 0 ? D_RAMP : R_RAMP;
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}

function renderHistory() {
  $("#tab-history").innerHTML = `
  <div class="page-head"><h2>District History</h2><p>How HD-10 has voted, by office and year — <strong>real precinct returns</strong> for voting districts 004 · 005 · 006. Pick a race; the map shades each precinct by its Democratic margin.</p></div>
  <div class="map-controls" style="position:static;margin-bottom:12px" id="hist-office"></div>
  <div class="map-controls" style="position:static;margin-bottom:16px" id="hist-year"></div>
  <div class="map-grid">
    <div class="mapcard"><div class="lmap" id="hist-map"></div><div class="maplegend" id="hist-legend"></div></div>
    <aside class="side"><div class="panel-card card-accent" id="hist-result" style="--accent:${C.dem}"></div></aside>
  </div>
  <div class="sec-head" id="hist-sec"><h2>${HRES.meta[histOffice].label} — All Cycles</h2><div class="note">${HRES.meta[histOffice].sub}</div></div>
  <div class="table-wrap"><table class="tbl" id="hist-table"></table></div>

  <div class="sec-head"><h2>Turnout by Cycle</h2><div class="note">ballots on current rolls</div></div>
  <div class="panel-card">
    ${[["2018", T.hist.y2018], ["2022", T.hist.y2022], ["2024", T.hist.y2024]].map(([yr, n]) => {
      const tmax = maxOf([T.hist.y2018, T.hist.y2022, T.hist.y2024]);
      return `<div class="hist-row" style="margin-bottom:14px"><div class="top"><span class="yr">${yr}</span><span class="res">${fmt(n)} ballots</span></div>
        <div class="track" style="height:14px"><i style="width:${Math.round(100 * n / tmax)}%;--accent:${yr === "2024" ? C.tealLt : C.muted}"></i></div></div>`;
    }).join("")}
  </div>`;
  renderHistControls(); renderHistResult(); renderHistTable();
}
function renderHistControls() {
  $("#hist-office").innerHTML = HRES.order.map(o => `<button class="seg-btn ${o === histOffice ? "on" : ""}" data-ho="${o}" type="button">${HRES.meta[o].label}</button>`).join("");
  $("#hist-year").innerHTML = histYears(histOffice).map(y => `<button class="seg-btn ${y === histYear ? "on" : ""}" data-hy="${y}" type="button">${y}</button>`).join("");
  $$("[data-ho]").forEach(b => b.addEventListener("click", () => { histOffice = b.dataset.ho; histYear = histYears(histOffice)[0]; refreshHistory(); }));
  $$("[data-hy]").forEach(b => b.addEventListener("click", () => { histYear = +b.dataset.hy; refreshHistory(); }));
}
function refreshHistory() {
  renderHistControls(); paintHistMap(); renderHistResult(); renderHistTable();
  const sh = $("#hist-sec"); if (sh) sh.innerHTML = `<h2>${HRES.meta[histOffice].label} — All Cycles</h2><div class="note">${HRES.meta[histOffice].sub}</div>`;
}
function buildHistMap() { histMap = baseMap("hist-map"); paintHistMap(); }
function paintHistMap() {
  if (!histMap) return;
  if (histLayer) histMap.removeLayer(histLayer);
  const e = histEntry();
  histLayer = L.geoJSON(D.geo, {
    style: f => {
      const cell = hasBP(e) ? e.bp[f.properties.id] : null;
      return featureStyle(cell ? marginColor(margin(cell[0], cell[1])) : e.un ? "#2E4A78" : "#3A4658", false);
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id), cell = hasBP(e) ? e.bp[f.properties.id] : null;
      const lbl = cell ? `${e.d.split(" ").pop()} +${Math.abs(margin(cell[0], cell[1]))}` : e.un ? "Unopposed" : "data pending";
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${lbl}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
    },
  }).addTo(histMap);
  legend($("#hist-legend"), `${HRES.meta[histOffice].label} ${histYear} · D margin`,
    hasBP(e) ? [[marginColor(10), "Closer · D+10"], [marginColor(33), "Lean · D+33"], [marginColor(55), "Safer · D+55"]]
      : e.un ? [["#2E4A78", "Unopposed (D)"]] : [["#33415A", "Result pending"]]);
}
function renderHistResult() {
  const e = histEntry(), meta = HRES.meta[histOffice], tot = distTotals(e);
  let body;
  if (tot) {
    const tp = tot.d + tot.r, dp = Math.round(1000 * tot.d / tp) / 10, rp = Math.round(1000 * tot.r / tp) / 10;
    const prow = pid => {
      const c = e.bp[pid]; if (!c) return "";
      return `<div class="drow"><span class="l">${pById(pid).name}</span><span class="v">${margin(c[0], c[1]) >= 0 ? "D" : "R"} +${Math.abs(margin(c[0], c[1]))}<span style="color:var(--fg-muted);font-size:12px;font-weight:400"> · ${fmt(c[0])}–${fmt(c[1])}</span></span></div>`;
    };
    body = `<div class="hist-row" style="margin-top:6px"><div class="dr-bar" style="height:30px">
        <div class="d" style="width:${dp}%">${dp}%</div><div class="r" style="width:${rp}%">${rp}%</div></div></div>
      <div class="rows" style="margin-top:14px">
        ${drow(`${e.d} (D)`, `${dp}% · ${fmt(tot.d)}`)}
        ${drow(`${e.r} (R)`, `${rp}% · ${fmt(tot.r)}`)}
      </div>
      <div class="kk" style="margin:16px 0 2px">By precinct</div>
      <div class="rows">${["004", "005", "006"].map(prow).join("")}</div>`;
  } else if (e.un) {
    body = `<div class="callout" style="margin-top:10px;background:rgba(37,99,235,.1);border-color:rgba(96,165,250,.3)"><b style="color:${C.demLt}">${e.d} (D) ran unopposed.</b> No Republican on the ballot — the seat was uncontested.</div>`;
  } else {
    body = `<div class="rows" style="margin-top:10px">${drow("Winner", `${e.d} (D)`)}${e.r ? drow("Opponent", `${e.r} (R)`) : ""}</div>
      <div class="callout" style="margin-top:14px">${e.note || "Result pending."}</div>`;
  }
  $("#hist-result").innerHTML = `<div class="pc-top"><div><h3>${meta.label} ${histYear}</h3><div class="kk" style="margin-top:5px">${meta.sub}</div></div>
      <span class="tag" style="color:${C.demLt}">${tot ? "D +" + margin(tot.d, tot.r) : e.un ? "Uncontested" : "Dem"}</span></div>
    ${body}
    <p style="color:var(--fg-dim);font-size:11.5px;line-height:1.5;margin-top:14px">Source: ${HRES.source}</p>`;
}
function renderHistTable() {
  const rows = histYears(histOffice).map(y => {
    const e = HRES.data[histOffice][y], tot = distTotals(e);
    if (tot) {
      const tp = tot.d + tot.r, dp = Math.round(1000 * tot.d / tp) / 10, rp = Math.round(1000 * tot.r / tp) / 10;
      return `<tr><td><b>${y}</b></td><td>${e.d} (D) · ${e.r} (R)</td><td><b>${dp}%</b> – ${rp}%</td><td><span style="color:${C.demLt}">D +${margin(tot.d, tot.r)}</span></td></tr>`;
    }
    return `<tr><td><b>${y}</b></td><td>${e.d} (D)${e.r ? " · " + e.r + " (R)" : ""}</td><td colspan="2"><span style="color:var(--fg-muted)">${e.un ? "Unopposed" : (e.note || "pending")}</span></td></tr>`;
  }).join("");
  $("#hist-table").innerHTML = `<thead><tr><th>Year</th><th>Candidates</th><th>Result (HD-10)</th><th>Margin</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ════════════════════ BOOT ════════════════════ */
function renderFooter() {
  $("#foot").innerHTML = `<b>HD10 Command Center.</b> Built from the Connecticut SOTS voter-file build — ${fmt(T.active)} active registrants across East Hartford precincts ${P.map(p => p.id).join(", ")}. Counts are for campaign planning, not certainty. Election history sourced from CT Secretary of the State, Ballotpedia, and Wikipedia.`;
}
function refit(map) {
  if (!map) return;
  setTimeout(() => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [30, 30] }); }, 90);
}
function wireTabs() {
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => t.classList.toggle("on", t === tab));
      $$(".panel").forEach(panel => panel.classList.toggle("on", panel.id === `tab-${tab.dataset.tab}`));
      const id = tab.dataset.tab;
      if (id === "precincts") { if (!precinctMap) buildPrecinctMap(); refit(precinctMap); }
      if (id === "signals") { if (!signalMap) buildSignalMap(); refit(signalMap); }
      if (id === "history") { if (!histMap) buildHistMap(); refit(histMap); }
    });
  });
}
function boot() {
  $("#district-chip").textContent = D.meta.district ? `Connecticut ${D.meta.district}` : "Connecticut House District 10";
  wireTabs();
  renderOverview();
  renderPrecincts();
  renderVoters();
  renderSignals();
  renderHistory();
  renderFooter();
}
boot();
})();
