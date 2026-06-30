/* HD10 Intelligence: campaign briefing interface powered by window.HD10 and window.HD10_TARGET. */
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
const max = arr => Math.max(...arr.map(Number));

const colors = {
  base: "#c83e3f",
  persuasion: "#7457c8",
  turnout: "#147f8d",
  gold: "#c79124",
  green: "#2c9b74",
  orange: "#d5813a",
  blue: "#2d65a8",
  low: "#5a6675",
};

const lastUpdated = "June 30, 2026";
const sourceNote = "SOTS voter file";
const districtName = "Connecticut House District 10";
const candidate = D.meta.candidate || "Campaign";
const candidateLast = candidate.split(" ").slice(-1)[0] || candidate;

const byRepublicanShare = [...P].sort((a, b) => b.pct.R - a.pct.R);
const byUnaffiliated = [...P].sort((a, b) => b.pct.U - a.pct.U);
const byTurnoutOpportunity = [...P].sort((a, b) => b.low_prop - a.low_prop);
const basePrecinct = byRepublicanShare[0];
const persuasionPrecinct = byUnaffiliated[0];
const turnoutPrecinct = byTurnoutOpportunity[0];

const ROLE = {};
ROLE[basePrecinct.id] = {
  label: "Base Protection",
  priority: "Highest Priority",
  color: colors.base,
  message: "Taxes, affordability, and competence",
  action: "Bank reliable Republican and Republican-leaning unaffiliated votes early, then protect turnout.",
  contribution: "Provides the strongest Republican registration share and the highest recent turnout reliability.",
};
ROLE[persuasionPrecinct.id] = {
  label: persuasionPrecinct.id === basePrecinct.id ? "Base and Persuasion" : "Persuasion Opportunity",
  priority: "Persuasion Opportunity",
  color: colors.persuasion,
  message: "Cost of living and pragmatic local leadership",
  action: "Prioritize canvass and mail to unaffiliated voters, especially reachable households with prior vote history.",
  contribution: "Adds the largest pool of unaffiliated voters available for persuasion.",
};
ROLE[turnoutPrecinct.id] = {
  label: turnoutPrecinct.id === basePrecinct.id ? "Base and Turnout" : "Turnout Opportunity",
  priority: "Turnout Opportunity",
  color: colors.turnout,
  message: "Neighborhood services, affordability, and direct voter contact",
  action: "Run repeated contact, registration repair, early-vote reminders, and low-propensity GOTV.",
  contribution: "Contains the largest low-propensity universe that can manufacture needed margin.",
};
P.forEach(p => {
  if (!ROLE[p.id]) ROLE[p.id] = {
    label: "Lower Priority",
    priority: "Lower Priority",
    color: colors.low,
    message: "Local trust and household economics",
    action: "Maintain coverage after the highest-opportunity precincts are staffed.",
    contribution: "Adds supplemental votes once higher-yield work is underway.",
  };
});

const roleOf = p => ROLE[p.id];

const PR = D.profiles;
const PMET = PR.metrics;
const PDIST = PR.district;
const pmeta = id => PMET.find(m => m.id === id);
const pval = (pid, id) => PR.byPrecinct[pid][id];
const pdelta = (pid, id) => Math.round((pval(pid, id) - PDIST[id]) * 10) / 10;
const signed = n => (n > 0 ? "+" : "") + n;

const SEG = D.segments;
const SD = SEG.district;
const lockedIn = SD.core.n + SD.strong.n;

function fillSeq(v, lo, hi, rgb) {
  const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo)));
  const base = [240, 232, 218];
  return `rgb(${base.map((c, i) => Math.round(c + (rgb[i] - c) * (.25 + .75 * t))).join(",")})`;
}

function emptyState(title, text) {
  return `<div class="empty"><div class="symbol"></div><h3>${title}</h3><p>${text}</p></div>`;
}

function card(accent, value, label, small) {
  return `<div class="card" style="--accent:${accent}"><div class="value">${value}</div><div class="label">${label}</div><div class="small">${small}</div></div>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;
}

function bar(label, value, denom, color) {
  const pc = pct(value, denom);
  return `<div class="bar"><div class="bar-top"><span>${label}</span><b>${fmt(value)} · ${pc}%</b></div><div class="track"><i style="width:${pc}%;background:${color}"></i></div></div>`;
}

function baseMap(id) {
  const map = L.map(id, { scrollWheelZoom: false, attributionControl: false, zoomControl: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 19, pane: "markerPane", opacity: .65 }).addTo(map);
  const fit = () => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [28, 28] }); };
  fit();
  setTimeout(fit, 120);
  setTimeout(fit, 420);
  return map;
}

function featureStyle(p, color, selected) {
  return {
    fillColor: color,
    fillOpacity: selected ? .9 : .72,
    color: selected ? "#07111d" : "#ffffff",
    weight: selected ? 3 : 1.3,
    opacity: 1,
  };
}

function buildLegend(el, title, rows) {
  el.innerHTML = `<div class="kick" style="color:#d8e1ea">${title}</div>` + rows.map(r => `<div class="row"><i style="background:${r[0]}"></i>${r[1]}</div>`).join("");
}

function priorityScore(p) {
  return Math.round((p.pct.R * 2.2) + (p.pct.U * 1.2) + ((100 - p.v24_pct) * .75) + (p.low_prop / max(P.map(x => x.low_prop)) * 24));
}

function sortedPrecincts() {
  return [...P].sort((a, b) => priorityScore(b) - priorityScore(a));
}

function strongestSignal(p) {
  const standout = PR.standouts[p.id]?.[0];
  return standout ? `${standout.label} (${signed(standout.delta)} vs district)` : "No standout signal available";
}

/* Header and navigation */
$("#h-district").textContent = districtName;
$("#h-candidate").textContent = candidate;
$("#h-source").textContent = sourceNote;

let overviewMap, overviewLayer;
let precinctMap, precinctLayer, precinctMetric = "priority", selectedPrecinct = null;
let signalMap, signalLayer, signalMetric = "turnout24", selectedSignalPrecinct = basePrecinct.id;

$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.toggle("on", t === tab));
    $$(".panel").forEach(panel => panel.classList.toggle("on", panel.id === `tab-${tab.dataset.tab}`));
    if (tab.dataset.tab === "overview") setTimeout(() => overviewMap && overviewMap.invalidateSize(), 80);
    if (tab.dataset.tab === "precincts") {
      if (!precinctMap) buildPrecinctMap();
      setTimeout(() => precinctMap && precinctMap.invalidateSize(), 80);
    }
    if (tab.dataset.tab === "messages") {
      if (!signalMap) buildSignalMap();
      setTimeout(() => signalMap && signalMap.invalidateSize(), 80);
    }
  });
});

function openMethodology() {
  $("#method-drawer").classList.add("on");
  $("#method-drawer").setAttribute("aria-hidden", "false");
}
function closeMethodology() {
  $("#method-drawer").classList.remove("on");
  $("#method-drawer").setAttribute("aria-hidden", "true");
}
$("#method-open").addEventListener("click", openMethodology);
$("#method-open-2").addEventListener("click", openMethodology);
$$("[data-close-method]").forEach(el => el.addEventListener("click", closeMethodology));

/* Overview */
function renderOverview() {
  $("#last-updated").textContent = "Jun 30";
  $("#race-label").textContent = `${candidateLast} path model`;
  $("#overview-winning-path").innerHTML = `Hold the <b>${fmt(T.party.R)}</b> registered Republican base, maximize turnout in ${turnoutPrecinct.name} and ${basePrecinct.name}, and win a defined share of the <b>${fmt(T.persuade)}</b> unaffiliated voters who make up ${T.pct.U}% of the district.`;
  $("#overview-cards").innerHTML = [
    card(colors.base, fmt(T.party.R), "Republican Base", `${T.pct.R}% of active voters. Estimated vote floor depends on retaining reliable Republican and Republican-leaning households.`),
    card(colors.persuasion, fmt(T.persuade), "Persuadable Opportunity", `${T.pct.U}% unaffiliated districtwide. Highest precinct share: ${persuasionPrecinct.name} at ${persuasionPrecinct.pct.U}%.`),
    card(colors.gold, fmt(D.win.win_number), "Win Condition", `Modeled 50% + 1 of ${fmt(D.win.projected2026)} projected 2026 voters. The campaign needs base retention plus persuasion and turnout gains.`),
  ].join("");

  $("#overview-priorities").innerHTML = `<div class="detail-top"><h3>Top Priority Precincts</h3><span class="tag" style="--accent:${colors.gold}">Ranked</span></div>
    <div class="metric-list">
      ${sortedPrecincts().slice(0, 3).map((p, i) => metric(`${i + 1}. ${p.name}`, `${roleOf(p).label} · ${fmt(p.persuade)} persuadable`)).join("")}
    </div>
    <div class="takeaway"><b>Takeaway:</b> resource decisions should start with ${basePrecinct.name} for reliability, ${persuasionPrecinct.name} for unaffiliated volume, and ${turnoutPrecinct.name} for turnout opportunity.</div>`;

  $("#overview-now").innerHTML = `<div class="detail-top"><h3>What To Do Now</h3><span class="tag" style="--accent:${colors.turnout}">Action</span></div>
    <div class="metric-list">
      ${metric("1. Build the base", `Confirm and bank ${fmt(T.party.R)} registered Republicans.`)}
      ${metric("2. Define persuadables", `Prioritize ${fmt(TG ? TG.party.U : T.persuade)} unaffiliated voters in the contact universe.`)}
      ${metric("3. Close the turnout gap", `Turn out ${fmt(TG ? TG.gotv : T.low_prop)} lower-propensity priority voters.`)}
    </div>
    <div class="takeaway"><b>Data confidence:</b> registration, precinct, participation, age, and party are from the voter file. Message fit is inferred from file signals and should be validated in the field.</div>`;
}

function buildOverviewMap() {
  overviewMap = baseMap("overview-map");
  overviewLayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id);
      return featureStyle(p, roleOf(p).color, false);
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${roleOf(p).label}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on("click", () => {
        $$('.tab[data-tab="precincts"]')[0].click();
        selectedPrecinct = p.id;
        renderPrecinctDetail();
        paintPrecinctMap();
      });
    },
  }).addTo(overviewMap);
  buildLegend($("#overview-legend"), "Priority logic", [
    [colors.base, "Base Protection"],
    [colors.persuasion, "Persuasion Opportunity"],
    [colors.turnout, "Turnout Opportunity"],
  ]);
}

/* Priority Precincts */
const PRECINCT_METRICS = {
  priority: {
    label: "Priority",
    title: "Priority type",
    color: p => roleOf(p).color,
    value: p => roleOf(p).label,
    legend: [[colors.base, "Base Protection"], [colors.persuasion, "Persuasion Opportunity"], [colors.turnout, "Turnout Opportunity"]],
  },
  persuasion: {
    label: "Persuadable",
    title: "Persuadable share",
    color: p => fillSeq(p.pct.U, 38, 48, [116, 87, 200]),
    value: p => `${p.pct.U}% unaffiliated`,
    legend: [["#ddd0ee", "Lower unaffiliated share"], [colors.persuasion, "Higher unaffiliated share"]],
  },
  turnout: {
    label: "Turnout Opportunity",
    title: "Lower-propensity voters",
    color: p => fillSeq(p.low_prop, Math.min(...P.map(x => x.low_prop)), max(P.map(x => x.low_prop)), [20, 127, 141]),
    value: p => `${fmt(p.low_prop)} low-propensity`,
    legend: [["#cde5df", "Lower opportunity"], [colors.turnout, "Higher opportunity"]],
  },
  base: {
    label: "Republican Base",
    title: "Republican share",
    color: p => fillSeq(p.pct.R, 8, 15, [200, 62, 63]),
    value: p => `${p.pct.R}% Republican`,
    legend: [["#ecd0c7", "Lower R share"], [colors.base, "Higher R share"]],
  },
};

function renderPrecinctControls() {
  $("#precinct-controls").innerHTML = Object.entries(PRECINCT_METRICS).map(([key, m]) => `<button class="seg-btn ${key === precinctMetric ? "on" : ""}" data-precinct-metric="${key}" type="button">${m.label}</button>`).join("");
  $$("[data-precinct-metric]").forEach(btn => {
    btn.addEventListener("click", () => {
      precinctMetric = btn.dataset.precinctMetric;
      renderPrecinctControls();
      paintPrecinctMap();
    });
  });
}

function buildPrecinctMap() {
  renderPrecinctControls();
  precinctMap = baseMap("precinct-map");
  paintPrecinctMap();
}

function paintPrecinctMap() {
  if (!precinctMap) return;
  if (precinctLayer) precinctMap.removeLayer(precinctLayer);
  const m = PRECINCT_METRICS[precinctMetric];
  precinctLayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id);
      return featureStyle(p, m.color(p), selectedPrecinct === p.id);
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${m.value(p)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#07111d" }),
        mouseout: () => paintPrecinctMap(),
        click: () => { selectedPrecinct = p.id; renderPrecinctDetail(); paintPrecinctMap(); },
      });
    },
  }).addTo(precinctMap);
  buildLegend($("#precinct-legend"), m.title, m.legend);
}

function renderPrecinctDetail() {
  if (!selectedPrecinct) {
    $("#precinct-detail").innerHTML = emptyState("Select a precinct", "Select a precinct to view its strategic profile, contact universe, message opportunity, and recommended campaign action.");
    $("#precinct-export").innerHTML = emptyState("Contact universe", "A precinct-level export summary will become available after a precinct is selected.");
    return;
  }
  const p = pById(selectedPrecinct);
  const r = roleOf(p);
  $("#precinct-detail").innerHTML = `<div class="detail-top"><div><h3>${p.name}</h3><div class="kick" style="color:#aeb9c6;margin-top:5px">Precinct ${p.id} · ${fmt(p.active)} active voters</div></div><span class="tag" style="--accent:${r.color}">${r.priority}</span></div>
    <div class="metric-list">
      ${metric("Estimated Republican base", `${fmt(p.party.R)} · ${p.pct.R}%`)}
      ${metric("Persuadable voter count", `${fmt(p.persuade)} unaffiliated · ${p.pct.U}%`)}
      ${metric("Turnout opportunity", `${fmt(p.low_prop)} lower-propensity voters`)}
      ${metric("Recent partisan performance", `Registration: D ${p.pct.D}% · R ${p.pct.R}% · U ${p.pct.U}%`)}
      ${metric("Strongest message opportunity", r.message)}
      ${metric("Recommended campaign action", r.action)}
      ${metric("Contribution to winning coalition", r.contribution)}
    </div>`;
  $("#precinct-export").innerHTML = `<div class="detail-top"><h3>Contact Universe</h3><span class="tag" style="--accent:${r.color}">${r.label}</span></div>
    ${bar("Republican base", p.party.R, p.active, colors.base)}
    ${bar("Persuadable unaffiliated", p.persuade, p.active, colors.persuasion)}
    ${bar("Turnout opportunity", p.low_prop, p.active, colors.turnout)}
    <button class="seg-btn" id="export-precinct" type="button" style="position:static;background:var(--ink);color:#fff;margin-top:16px">Export precinct summary</button>
    <div class="takeaway"><b>Note:</b> this app bundle contains aggregate precinct data, not individual voter rows. The export preserves the available contact-universe summary without inventing voter records.</div>`;
  $("#export-precinct").addEventListener("click", () => exportPrecinctSummary(p));
}

function exportPrecinctSummary(p) {
  const rows = [
    ["precinct_id", "precinct", "active_voters", "republican_base", "persuadable_unaffiliated", "turnout_opportunity", "priority", "recommended_focus"],
    [p.id, p.name, p.active, p.party.R, p.persuade, p.low_prop, roleOf(p).priority, roleOf(p).action],
  ];
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hd10-${p.id}-${p.name.toLowerCase().replace(/\s+/g, "-")}-contact-universe-summary.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderPrecinctRanking() {
  const rows = sortedPrecincts().map(p => `<tr>
    <td><b>${p.name}</b><div class="kick">Precinct ${p.id}</div></td>
    <td><span class="tag" style="--accent:${roleOf(p).color}">${roleOf(p).label}</span></td>
    <td>${fmt(p.party.R)}<div class="kick">${p.pct.R}%</div></td>
    <td>${fmt(p.persuade)}<div class="kick">${p.pct.U}% unaffiliated</div></td>
    <td>${fmt(p.low_prop)}<div class="kick">${p.v24_pct}% 2024 turnout</div></td>
    <td>${roleOf(p).action}</td>
    <td><button type="button" data-rank-select="${p.id}">View</button></td>
  </tr>`).join("");
  $("#precinct-ranking").innerHTML = `<thead><tr><th>Precinct</th><th>Priority</th><th>Republican Base</th><th>Persuadable Voters</th><th>Turnout Opportunity</th><th>Recommended Focus</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  $$("[data-rank-select]").forEach(btn => btn.addEventListener("click", () => {
    selectedPrecinct = btn.dataset.rankSelect;
    renderPrecinctDetail();
    paintPrecinctMap();
    $("#tab-precincts").scrollIntoView({ behavior: "smooth" });
  }));
}

/* Priority Voters */
function targetSegment(k) {
  return TG?.segments?.[k] || { label: "Not available", n: 0, pct_of_target: 0 };
}

function renderVoters() {
  const likelyGeneral = T.high_turnout;
  const contact = TG ? TG.target_size : T.persuade;
  $("#voter-funnel").innerHTML = [
    [colors.blue, fmt(T.active), "All Active Voters", "Every active HD10 registrant in the voter-file build."],
    [colors.gold, fmt(likelyGeneral), "Likely General Election Voters", "High-turnout voters already visible in the participation file."],
    [colors.persuasion, fmt(T.persuade), "Persuadable or Reachable Voters", "Unaffiliated voters plus reachable households for persuasion testing."],
    [colors.red, fmt(contact), "Priority Contact Universe", "Republican and unaffiliated voters selected for direct campaign contact."],
  ].map(([accent, value, label, text]) => `<div class="funnel-step" style="--accent:${accent}"><div class="value">${value}</div><div class="label">${label}</div><p>${text}</p></div>`).join("");

  const segmentCards = [
    ["Reliable Republican Base", T.party.R, colors.base, "High among frequent voters", "Protect and bank.", "Vote plan, candidate validation, early vote reminders.", basePrecinct.name],
    ["High-Propensity Republican", targetSegment("seg_R").n, colors.red, "Likely", "Base retention and vote banking.", "Direct ask, endorsement, tax and affordability frame.", basePrecinct.name],
    ["Low-Propensity Republican Turnout Opportunity", TG ? TG.gotv : T.low_prop, colors.orange, "Lower", "Manufacture margin through repeated contact.", "Door, phone, ballot chase, Election Day reminder.", turnoutPrecinct.name],
    ["Republican-Leaning Unaffiliated", targetSegment("seg_U_with_R").n, colors.gold, "Medium to high", "Persuasion through household context.", "Pragmatic leadership, affordability, public safety.", basePrecinct.name],
    ["Swing Unaffiliated", targetSegment("seg_U_highprop").n, colors.persuasion, "High", "Persuasion among voters who reliably show up.", "Cost of living, competence, contrast without overpartisan tone.", persuasionPrecinct.name],
    ["Weak Democratic Persuasion Opportunity", 0, colors.low, "Not modeled", "Review only. Current target model does not include Democrats.", "Do not assume conversion without better evidence.", "No modeled precinct concentration"],
  ];
  $("#segment-cards").innerHTML = segmentCards.map(([label, n, accent, turnout, role, contactType, precinct]) => `<div class="segment-card" style="--accent:${accent}">
    <h4>${label}</h4>
    <div class="value">${fmt(n)}</div>
    <p><b>Typical turnout:</b> ${turnout}</p>
    <p><b>Strategic role:</b> ${role}</p>
    <p><b>Contact type:</b> ${contactType}</p>
    <p><b>Best concentration:</b> ${precinct}</p>
  </div>`).join("");
  $("#segment-takeaway").innerHTML = `<b>Takeaway:</b> the largest available gain comes from lower-propensity Republicans and unaffiliated voters in ${turnoutPrecinct.name} and ${persuasionPrecinct.name}, not from trying to convert strong Democrats.`;

  const projected = TG ? TG.projected_vote : lockedIn;
  const gotv = TG ? TG.gotv : T.low_prop;
  $("#reliable-vs-opportunity").innerHTML = [
    card(colors.green, fmt(projected), "Reliable Voters", `Likely 2026 voters inside the priority universe. Persuade, identify, and bank them early.`),
    card(colors.orange, fmt(gotv), "Turnout Opportunities", `Priority voters who need a real turnout push before they become votes.`),
    card(colors.persuasion, TG ? `${TG.party_pct.U}%` : `${T.pct.U}%`, "Target Mix", `The contact universe is persuasion-heavy and depends on unaffiliated voters.`),
  ].join("");

  const targetTotal = TG ? TG.target_size : T.active;
  $("#target-mix").innerHTML = `<div class="detail-top"><h3>Target Mix</h3><span class="tag" style="--accent:${colors.persuasion}">Contact Universe</span></div>
    ${TG ? bar("Registered Republicans", TG.party.R, targetTotal, colors.base) : bar("Registered Republicans", T.party.R, targetTotal, colors.base)}
    ${TG ? bar("Unaffiliated priority voters", TG.party.U, targetTotal, colors.persuasion) : bar("Unaffiliated voters", T.party.U, targetTotal, colors.persuasion)}
    ${TG ? metric("Average age", TG.avg_age) : metric("Average age", T.avg_age)}
    ${TG ? metric("Women", `${fmt(TG.gender.F)} · ${pct(TG.gender.F, targetTotal)}%`) : ""}
    ${TG ? metric("Men", `${fmt(TG.gender.M)} · ${pct(TG.gender.M, targetTotal)}%`) : ""}
    <div class="takeaway"><b>Takeaway:</b> this contact universe is not the entire electorate. It is the reachable Republican plus unaffiliated pool the campaign should prioritize.</div>`;

  const ladder = ["core", "strong", "medium", "recent", "sporadic", "dormant"];
  $("#turnout-ladder").innerHTML = `<div class="detail-top"><h3>Turnout Landscape</h3><span class="tag" style="--accent:${colors.gold}">Participation</span></div>
    ${ladder.map(k => {
      const s = SD[k];
      return bar(s.label, s.n, T.active, k === "core" || k === "strong" ? colors.green : k === "dormant" ? colors.low : colors.orange);
    }).join("")}
    <div class="takeaway"><b>Takeaway:</b> reliable voters establish the floor, but the modeled margin has to come from persuadable and lower-propensity voters who need contact.</div>`;
}

/* Message Map */
const SIGNALS = ["turnout24", "dropoff", "vbm", "early", "eday", "newmover", "solo", "unaff", "rep"];

function messageRows() {
  return [
    {
      issue: "Affordability",
      audience: "Swing unaffiliated voters",
      precincts: [persuasionPrecinct.name, turnoutPrecinct.name],
      use: "Persuasion mail and canvass scripts",
      purpose: "Persuasion",
      frame: "Focus on household costs, taxes, and practical local decisions.",
      strength: "Modeled from unaffiliated share and target mix",
      color: colors.persuasion,
    },
    {
      issue: "Public safety and neighborhood quality",
      audience: "Republican base and reachable unaffiliated households",
      precincts: [basePrecinct.name, persuasionPrecinct.name],
      use: "Base activation and contrast messaging",
      purpose: "Trust",
      frame: "Connect safety and quality-of-life concerns to competent local representation.",
      strength: "Inferred from precinct composition; validate in voter contact",
      color: colors.base,
    },
    {
      issue: "Local services and responsiveness",
      audience: "New movers, single-voter homes, and low-propensity voters",
      precincts: [turnoutPrecinct.name],
      use: "Door scripts, registration repair, and turnout follow-up",
      purpose: "Turnout",
      frame: "Make the race personal and local for voters not yet anchored to the district.",
      strength: "Supported by turnout and household-file contrasts",
      color: colors.turnout,
    },
    {
      issue: "Pragmatic leadership",
      audience: "High-propensity unaffiliated voters",
      precincts: [basePrecinct.name, persuasionPrecinct.name],
      use: "Candidate bio, validation, and persuasion close",
      purpose: "Persuasion",
      frame: "Position the candidate as a practical check on one-party control.",
      strength: "Modeled; no issue polling loaded",
      color: colors.gold,
    },
  ];
}

function renderMessages() {
  const rows = messageRows();
  $("#message-cards").innerHTML = rows.map(r => `<div class="segment-card" style="--accent:${r.color}">
    <h4>${r.issue}</h4>
    <p><b>Relevant audience:</b> ${r.audience}</p>
    <p><b>Best precincts:</b> ${r.precincts.join(", ")}</p>
    <p><b>Strategic purpose:</b> ${r.purpose}</p>
    <p><b>Suggested framing:</b> ${r.frame}</p>
    <p><b>Confidence:</b> ${r.strength}</p>
  </div>`).join("");
  $("#message-matrix").innerHTML = `<div class="mrow head"><div class="mcell">Issue</div><div class="mcell">Audience</div><div class="mcell">Best Precincts</div><div class="mcell">Campaign Use</div><div class="mcell">Confidence</div></div>` +
    rows.map(r => `<div class="mrow">
      <div class="mcell"><h4>${r.issue}</h4><p>${r.frame}</p></div>
      <div class="mcell">${r.audience}</div>
      <div class="mcell">${r.precincts.join("<br>")}</div>
      <div class="mcell">${r.use}</div>
      <div class="mcell">${r.strength}</div>
    </div>`).join("");
  $("#message-takeaway").innerHTML = `<b>Takeaway:</b> affordability has the broadest modeled reach because the contact universe is heavily unaffiliated. Public safety and local services should be tested as segment-specific frames, not treated as universal proof points.`;
  renderSignalControls();
}

function renderSignalControls() {
  $("#signal-controls").innerHTML = SIGNALS.map(id => `<button class="seg-btn ${id === signalMetric ? "on" : ""}" data-signal="${id}" type="button">${pmeta(id).label}</button>`).join("");
  $$("[data-signal]").forEach(btn => btn.addEventListener("click", () => {
    signalMetric = btn.dataset.signal;
    renderSignalControls();
    paintSignalMap();
    renderSignalDetail();
  }));
}

function buildSignalMap() {
  signalMap = baseMap("signal-map");
  paintSignalMap();
  renderSignalDetail();
}

function paintSignalMap() {
  if (!signalMap) return;
  if (signalLayer) signalMap.removeLayer(signalLayer);
  const vals = P.map(p => pval(p.id, signalMetric));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  signalLayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id);
      return featureStyle(p, fillSeq(pval(p.id, signalMetric), lo - .5, hi + .5, [199, 145, 36]), selectedSignalPrecinct === p.id);
    },
    onEachFeature: (f, layer) => {
      const p = pById(f.properties.id);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${pval(p.id, signalMetric)}%</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#07111d" }),
        mouseout: () => paintSignalMap(),
        click: () => { selectedSignalPrecinct = p.id; paintSignalMap(); renderSignalDetail(); },
      });
    },
  }).addTo(signalMap);
  buildLegend($("#signal-legend"), `${pmeta(signalMetric).label} by precinct`, [
    [fillSeq(lo, lo - .5, hi + .5, [199, 145, 36]), "Lower"],
    [fillSeq(hi, lo - .5, hi + .5, [199, 145, 36]), "Higher"],
  ]);
}

function renderSignalDetail() {
  const p = pById(selectedSignalPrecinct);
  const mt = pmeta(signalMetric);
  $("#signal-detail").innerHTML = `<div class="detail-top"><h3>${p.name}</h3><span class="tag" style="--accent:${colors.gold}">${mt.label}</span></div>
    <div class="metric-list">
      ${metric("Precinct value", `${pval(p.id, signalMetric)}%`)}
      ${metric("District average", `${PDIST[signalMetric]}%`)}
      ${metric("Difference", `${signed(pdelta(p.id, signalMetric))} points`)}
      ${metric("Strategic meaning", mt.desc)}
      ${metric("Top contrast", strongestSignal(p))}
    </div>
    <div class="takeaway"><b>Modeled use:</b> this signal helps choose message emphasis and contact channel. It is not issue polling.</div>`;
}

/* Path to Victory */
function renderPath() {
  const targetLikely = TG ? TG.projected_vote : lockedIn;
  const gotvNeed = TG ? TG.gotv : T.low_prop;
  const persuasionGain = Math.max(0, D.win.win_number - T.party.R);
  const priorityContribution = sortedPrecincts().slice(0, 2).map(p => p.name).join(" + ");
  $("#winning-coalition").innerHTML = [
    [colors.base, fmt(T.party.R), "Expected Republican Base", "Registered Republican universe that must be held and banked."],
    [colors.orange, fmt(gotvNeed), "Required Turnout Gain", "Lower-propensity priority voters who need repeated contact."],
    [colors.persuasion, fmt(Math.min(T.persuade, persuasionGain)), "Required Persuasion Gain", "Unaffiliated voters needed after base math is accounted for."],
    [colors.gold, priorityContribution, "Priority Precinct Contribution", "The precincts where the model says focus should begin."],
    [colors.green, fmt(D.win.win_number), "Winning Number", `Modeled 50% + 1 of ${fmt(D.win.projected2026)} projected voters.`],
  ].map(([accent, value, label, text]) => `<div class="flow-card" style="--accent:${accent}"><div class="value">${value}</div><h4>${label}</h4><p>${text}</p></div>`).join("");

  $("#path-baseline").innerHTML = `<div class="detail-top"><h3>Baseline and Goal</h3><span class="tag" style="--accent:${colors.green}">Modeled</span></div>
    <div class="metric-list">
      ${metric("Projected 2026 turnout", fmt(D.win.projected2026))}
      ${metric("Votes to win", fmt(D.win.win_number))}
      ${metric("2022 turnout", fmt(D.win.turnout2022))}
      ${metric("2024 turnout", fmt(D.win.turnout2024))}
      ${metric("Priority universe likely vote", fmt(targetLikely))}
    </div>
    <div class="takeaway"><b>Read it carefully:</b> the target universe is just above the modeled win number, so the campaign has little slack. Contact quality matters.</div>`;

  $("#path-precincts").innerHTML = `<div class="detail-top"><h3>Top Precincts That Matter</h3><span class="tag" style="--accent:${colors.gold}">Sequence</span></div>
    <div class="metric-list">
      ${sortedPrecincts().slice(0, 3).map(p => metric(p.name, `${roleOf(p).label}: ${roleOf(p).action}`)).join("")}
    </div>
    <div class="takeaway"><b>Coalition requirement:</b> this is the coalition required to make the race competitive. It is a planning model, not a prediction.</div>`;

  const phase = (n, title, audience, precincts, tactic, purpose, accent) => `<div class="action" style="--accent:${accent}">
    <div class="n">${n}</div><div><h4>${title}</h4>
    <p><b>Target audience:</b> ${audience}</p>
    <p><b>Priority precincts:</b> ${precincts}</p>
    <p><b>Suggested tactic:</b> ${tactic}</p>
    <p><b>Strategic purpose:</b> ${purpose}</p></div></div>`;
  $("#action-plan").innerHTML = [
    phase(1, "Build the Base", "Reliable and low-propensity Republicans", basePrecinct.name, "Vote plan, early validation, door and phone confirmation.", "Lock in the floor before persuasion spend scales.", colors.base),
    phase(2, "Win the Persuadables", "Republican-leaning and swing unaffiliated voters", `${persuasionPrecinct.name}, ${basePrecinct.name}`, "Issue-specific canvass, mail, and candidate validation.", "Move enough unaffiliated voters to make the base mathematically relevant.", colors.persuasion),
    phase(3, "Close the Turnout Gap", "Lower-propensity priority voters", `${turnoutPrecinct.name}, ${persuasionPrecinct.name}`, "Repeated GOTV, early-vote chase, registration repair, and Election Day reminders.", "Convert modeled support into counted votes.", colors.turnout),
  ].join("");
}

function renderMethodology() {
  $("#method-content").innerHTML = `<p><b>Source data:</b> Connecticut SOTS voter-file-derived HD10 build covering ${fmt(T.active)} active registrants across East Hartford precincts 004, 005, and 006. Precinct polygons are bundled in the local app data.</p>
    <ul>
      <li><b>Last interface update:</b> ${lastUpdated}. The bundled data does not expose an exact SOTS extract date, so the app does not claim one.</li>
      <li><b>Priority scores:</b> precinct priority is determined from Republican registration share, unaffiliated persuasion volume, turnout opportunity, and recent participation patterns. Labels are descriptive planning categories.</li>
      <li><b>Modeled and inferred fields:</b> message fit, persuasion opportunity, and action recommendations are inferred from party registration, turnout history, age, household, new-mover, and precinct-composition signals.</li>
      <li><b>Limits:</b> the app supports campaign planning, targeting, and resource allocation. It is not polling, a forecast, or a guarantee of vote choice.</li>
      <li><b>Missing data states:</b> when a field is not present, the interface describes the limitation rather than filling the gap with invented numbers.</li>
    </ul>`;
}

function renderFooter() {
  $("#foot").innerHTML = `<b>HD10 Intelligence.</b> Source: Connecticut SOTS voter file-derived local build; ${fmt(T.active)} active registrants in ${D.meta.town}. Registration, turnout, age, precinct, and target-universe counts are computed from bundled app data. Message recommendations are modeled from available voter-file signals and should be validated by campaign contact.`;
}

function boot() {
  renderOverview();
  buildOverviewMap();
  renderPrecinctDetail();
  renderPrecinctRanking();
  renderVoters();
  renderMessages();
  renderPath();
  renderMethodology();
  renderFooter();
}

boot();
})();
