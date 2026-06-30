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

/* ── Sourced election history (CT SOTS / Ballotpedia / Wikipedia) ── */
const HISTORY = {
  recent: { year: 2024, d: { name: "Henry Genga", pct: 68.8 }, r: { name: "Chris Tierinni", pct: 31.2 } },
  timeline: [
    { year: 2024, win: "Genga (D)", sub: "68.8% – 31.2% vs Tierinni (R)" },
    { year: 2022, win: "Genga (D)", sub: "Unopposed" },
    { year: 2020, win: "Genga (D)", sub: "Re-elected" },
    { year: 2018, win: "Genga (D)", sub: "Re-elected" },
    { year: 2016, win: "Genga (D)", sub: "def. Simpson (R)" },
  ],
  held: "Democratic-held since 1998 — Henry Genga (D) since 2006, Melody Currey (D) 1998–2005.",
  offices: [
    { o: "President", lean: "Dem", color: C.dem, colorLt: C.demLt, s: "Harris (D) carried Connecticut in 2024; East Hartford votes strongly Democratic top-of-ticket." },
    { o: "Governor", lean: "Dem", color: C.dem, colorLt: C.demLt, s: "Lamont (D) carried the area in 2018 and 2022." },
    { o: "U.S. Senate", lean: "Dem", color: C.dem, colorLt: C.demLt, s: "Murphy and Blumenthal (D) win the region comfortably." },
    { o: "U.S. House · CT-01", lean: "Dem", color: C.dem, colorLt: C.demLt, s: "John Larson (D) holds CT-01, which includes East Hartford." },
    { o: "State Senate", lean: "Dem", color: C.dem, colorLt: C.demLt, s: "East Hartford's state senate seats are Democratic-held." },
    { o: "State House · HD-10", lean: "Dem", color: C.rep, colorLt: C.repLt, s: "Genga (D) 68.8% vs Tierinni (R) 31.2% in 2024 — the seat in play.", firm: true },
  ],
  source: "Sources: CT Secretary of the State; Ballotpedia; Wikipedia (CT 10th assembly district).",
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
  const funnel = [
    [C.demLt, T.active, "All Active Voters", "Every active HD-10 registrant."],
    [C.goldLt, TURNOUT_UNIVERSE, "Turnout Universe", "Projected to vote in the 2026 election."],
    [C.tealLt, OUR_UNIVERSE, "Our Target Universe", "Our voters who are already likely to turn out."],
  ];
  const segKeys = TG ? Object.keys(TG.segments) : [];

  $("#tab-voters").innerHTML = `
  <div class="page-head"><h2>Voters</h2><p>Our universe is only the voters we target who are <strong>already likely to vote</strong> — no turnout-lift pool for now. ${fmt(OUR_UNIVERSE)} people, ${COVERAGE}% of the votes needed to win.</p></div>

  <div class="funnel" style="grid-template-columns:repeat(3,1fr)">
    ${funnel.map(([c, v, l, s]) => `<div class="funnel-step" style="--accent:${c};--accent-lt:${c}"><div class="v num">${fmt(v)}</div><div class="l">${l}</div><p>${s}</p></div>`).join("")}
  </div>

  <div class="sec-head"><h2>Our Universe</h2><div class="note">${fmt(OUR_UNIVERSE)} likely-voter targets</div></div>
  <div class="grid4">
    ${statCard(C.tealLt, ut ? fmt(ut.locked.n) : "—", "Locked-In", `Voted 3–4 of the last 4 — turn out no matter what (${ut ? ut.locked.pct : 0}%).`)}
    ${statCard(C.goldLt, ut ? fmt(ut.mid.n) : "—", "Mid-Propensity", `Voted 2 of 4 — likely, worth a reminder (${ut ? ut.mid.pct : 0}%).`)}
    ${statCard(C.repLt, TG ? `${fmt(TG.party.R)}` : "—", "Republicans", `${TG ? TG.party_pct.R : 0}% of our universe.`)}
    ${statCard(C.npaLt, TG ? `${fmt(TG.party.U)}` : "—", "Unaffiliated", `${TG ? TG.party_pct.U : 0}% — the persuasion pool.`)}
  </div>

  <div class="map-grid" style="margin-top:24px">
    <div class="panel-card"><div class="pc-top"><h3>Who They Are</h3></div>
      <div class="rows">
        ${TG ? drow("Republicans", `${fmt(TG.party.R)} · ${TG.party_pct.R}%`) : ""}
        ${TG ? drow("Unaffiliated", `${fmt(TG.party.U)} · ${TG.party_pct.U}%`) : ""}
        ${TG ? drow("Women", `${fmt(TG.gender.F)} · ${pct(TG.gender.F, OUR_UNIVERSE)}%`) : ""}
        ${TG ? drow("Men", `${fmt(TG.gender.M)} · ${pct(TG.gender.M, OUR_UNIVERSE)}%`) : ""}
        ${TG ? drow("Average age", TG.avg_age) : ""}
      </div></div>
    <div class="panel-card"><div class="pc-top"><h3>By Precinct</h3></div>
      <div class="rows">
        ${TG && TG.precinct ? Object.values(TG.precinct).sort((a, b) => b.target - a.target).map(pr =>
          `<div class="drow"><span class="l">${pr.name}</span><span class="v">${fmt(pr.target)} <span style="color:var(--fg-muted);font-size:12px;font-weight:400">of ${fmt(pr.likely_voters)} likely</span></span></div>`).join("") : ""}
      </div></div>
  </div>

  <div class="sec-head"><h2>How We Reach Them</h2><div class="note">Overlapping segments</div></div>
  <div class="seg-grid">
    ${segKeys.map(k => {
      const s = TG.segments[k];
      const accent = k === "seg_R" ? [C.rep, C.repLt] : [C.npa, C.npaLt];
      return `<div class="seg-card" style="--accent:${accent[0]};--accent-lt:${accent[1]}"><h4>${s.label}</h4>
        <div class="v num">${fmt(s.n)}</div>
        <div class="meta"><div><span>Share of universe</span><b>${s.pct_of_target}%</b></div></div></div>`;
    }).join("")}
  </div>`;
}
function statCard(accentLt, v, l, s) {
  return `<div class="stat-card" style="--accent:${accentLt};--accent-lt:${accentLt}"><div class="v num">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`;
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

/* ════════════════════ HISTORY ════════════════════ */
function renderHistory() {
  const H = HISTORY, rec = H.recent;
  const turnout = [["2018", T.hist.y2018], ["2022", T.hist.y2022], ["2024", T.hist.y2024]];
  const tmax = maxOf(turnout.map(x => x[1]));
  $("#tab-history").innerHTML = `
  <div class="page-head"><h2>District History</h2><p>How HD-10 has voted — the state house seat, the partisan environment up and down the ballot, and turnout by cycle. High-level, with sources noted below.</p></div>

  <div class="map-grid">
    <div class="panel-card card-accent" style="--accent:${C.dem}">
      <div class="pc-top"><h3>The Seat · HD-10 State Rep</h3><span class="tag" style="color:${C.demLt}">Dem hold</span></div>
      <div style="margin-top:16px">
        <div class="hist-row"><div class="top"><span class="yr">${rec.year}</span><span class="res">${rec.d.name} (D) · ${rec.r.name} (R)</span></div>
          <div class="dr-bar"><div class="d" style="width:${rec.d.pct}%">${rec.d.pct}%</div><div class="r" style="width:${rec.r.pct}%">${rec.r.pct}%</div></div></div>
      </div>
      <div class="rows" style="margin-top:18px">
        ${H.timeline.slice(1).map(t => `<div class="drow"><span class="l"><b style="color:var(--fg);font-family:var(--ff-display);font-size:16px">${t.year}</b> &nbsp;${t.win}</span><span class="v" style="font-size:13px;color:var(--fg-muted);font-weight:400">${t.sub}</span></div>`).join("")}
      </div>
      <div class="callout" style="margin-top:16px"><b>${H.held}</b></div>
    </div>

    <div class="panel-card"><div class="pc-top"><h3>Turnout by Cycle</h3></div>
      <div class="hist-bars" style="margin-top:16px">
        ${turnout.map(([yr, n]) => `<div class="hist-row"><div class="top"><span class="yr">${yr}</span><span class="res">${fmt(n)} ballots</span></div>
          <div class="track" style="height:14px"><i style="width:${Math.round(100 * n / tmax)}%;--accent:${yr === "2024" ? C.tealLt : C.muted}"></i></div></div>`).join("")}
      </div>
      <p style="color:var(--fg-dim);font-size:12px;line-height:1.5;margin-top:16px">Ballots cast within the active-voter universe. Presidential years (2024) draw far more than midterms (2018·2022).</p>
    </div>
  </div>

  <div class="sec-head"><h2>All Levels — Partisan Environment</h2><div class="note">District lean by office</div></div>
  <div class="grid3">
    ${H.offices.map(o => `<div class="office-tile" style="--accent:${o.color};--accent-lt:${o.colorLt}">
      <div class="o">${o.o}</div><div class="lean">${o.lean}${o.firm ? " · seat in play" : ""}</div><div class="s">${o.s}</div></div>`).join("")}
  </div>

  <div class="sec-head"><h2>Registration Environment</h2><div class="note">${fmt(T.active)} active</div></div>
  <div class="panel-card">
    ${bar("Democratic", T.party.D, T.active, C.demLt)}
    ${bar("Unaffiliated", T.party.U, T.active, C.npaLt)}
    ${bar("Republican", T.party.R, T.active, C.repLt)}
    <div class="callout" style="margin-top:18px">${H.source} Precinct-exact President / Governor / U.S. House / U.S. Senate splits come from the SOTS Statement of Vote and can be layered in next.</div>
  </div>`;
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
