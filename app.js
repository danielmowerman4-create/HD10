/* HD10 Command Center: simplified campaign operating view powered by bundled HD10 data. */
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

const color = {
  turnout: "#147f8d",
  persuasion: "#7357c7",
  low: "#697586",
  base: "#c8403f",
  gold: "#c38b23",
  green: "#2b936d",
};

const byR = [...P].sort((a, b) => b.pct.R - a.pct.R);
const byUShare = [...P].sort((a, b) => b.pct.U - a.pct.U);
const byLowProp = [...P].sort((a, b) => b.low_prop - a.low_prop);
const baseArea = byR[0];
const persuasionArea = byUShare[0];
const turnoutArea = byLowProp[0];
const lowerPriorityArea = [...P].sort((a, b) => priorityScore(a) - priorityScore(b))[0];

function priorityScore(p) {
  return (p.low_prop * .012) + (p.persuade * .006) + (p.pct.R * 1.8) + ((100 - p.v24_pct) * .5);
}

function areaRole(p) {
  if (p.id === turnoutArea.id) return {
    label: "Turnout priority",
    color: color.turnout,
    why: `${p.name} has the largest pool of lower-turnout voters who can add margin if contacted repeatedly.`,
    targets: p.low_prop,
    action: "Run repeated doors, calls, and early-vote reminders here first.",
  };
  if (p.id === persuasionArea.id) return {
    label: "Persuasion priority",
    color: color.persuasion,
    why: `${p.name} has the highest unaffiliated share and is the cleanest persuasion test.`,
    targets: p.persuade,
    action: "Use candidate persuasion, affordability, and local trust messaging.",
  };
  return {
    label: "Low priority",
    color: color.low,
    why: `${p.name} matters, but it should not pull resources away from the higher-return field work.`,
    targets: Math.min(p.low_prop, p.persuade),
    action: "Maintain light coverage and focus extra time elsewhere.",
  };
}

function metric(accent, value, label, small) {
  return `<div class="metric-card" style="--accent:${accent}"><div class="value">${value}</div><div class="label">${label}</div><div class="small">${small}</div></div>`;
}

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><b>${value}</b></div>`;
}

function card(accent, title, text) {
  return `<div class="plan-card" style="--accent:${accent}"><h3>${title}</h3><p>${text}</p></div>`;
}

function csvDownload(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildAreaRows(group) {
  return [["Precinct", "Target Group", "Available Target Count", "Recommended Action"]]
    .concat(P.map(p => [p.name, group.name, group.areaCount(p), group.action]));
}

function baseMap(id) {
  const map = L.map(id, { scrollWheelZoom: false, attributionControl: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 19, pane: "markerPane", opacity: .68 }).addTo(map);
  const fit = () => { map.invalidateSize(); map.fitBounds(D.bounds, { padding: [28, 28] }); };
  fit();
  setTimeout(fit, 160);
  return map;
}

let focusMap;
let focusLayer;
let selectedArea = turnoutArea.id;

function renderAssessment() {
  $("#district-chip").textContent = D.meta.district ? `Connecticut ${D.meta.district}` : "Connecticut House District 10";
  $("#source-chip").textContent = "SOTS voter file";
  $("#assessment").innerHTML = `HD-10 is Democratic leaning, but Republicans have a viable path by maximizing turnout in <b>${turnoutArea.name}</b>, holding losses in <b>${baseArea.name}</b>, and persuading reachable unaffiliated voters in <b>${persuasionArea.name}</b>.`;

  $("#overview-metrics").innerHTML = [
    metric(color.base, fmt(T.party.R), "Republican base voters", `${T.pct.R}% of active voters`),
    metric(color.persuasion, fmt(TG ? TG.party.U : T.persuade), "Reachable persuasion targets", `Unaffiliated voters in the contact pool`),
    metric(color.gold, fmt(D.win.win_number), "Votes needed to win", `50% + 1 of ${fmt(D.win.projected2026)} projected voters`),
    metric(color.turnout, turnoutArea.name, "Highest priority area", `${fmt(turnoutArea.low_prop)} turnout targets`),
  ].join("");
}

function renderFocusMap() {
  focusMap = baseMap("focus-map");
  paintFocusMap();
  renderAreaCard();
  $("#focus-legend").innerHTML = `<div class="kick" style="color:#dce5ed">Priority Areas</div>
    <div class="row"><i style="background:${color.turnout}"></i>Turnout priority</div>
    <div class="row"><i style="background:${color.persuasion}"></i>Persuasion priority</div>
    <div class="row"><i style="background:${color.low}"></i>Low priority</div>`;
}

function paintFocusMap() {
  if (focusLayer) focusMap.removeLayer(focusLayer);
  focusLayer = L.geoJSON(D.geo, {
    style: feature => {
      const p = pById(feature.properties.id);
      const role = areaRole(p);
      const selected = p.id === selectedArea;
      return {
        fillColor: role.color,
        fillOpacity: selected ? .9 : .72,
        color: selected ? "#091421" : "#ffffff",
        weight: selected ? 3 : 1.3,
      };
    },
    onEachFeature: (feature, layer) => {
      const p = pById(feature.properties.id);
      const role = areaRole(p);
      layer.bindTooltip(`<span class="plabel">${p.name}<br>${role.label}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      layer.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#091421" }),
        mouseout: () => paintFocusMap(),
        click: () => {
          selectedArea = p.id;
          paintFocusMap();
          renderAreaCard();
        },
      });
    },
  }).addTo(focusMap);
}

function renderAreaCard() {
  const p = pById(selectedArea);
  const role = areaRole(p);
  $("#area-card").innerHTML = `<h3>${p.name}</h3><span class="tag" style="--accent:${role.color}">${role.label}</span>
    <div class="facts">
      ${fact("Why this area matters", role.why)}
      ${fact("Target voters", fmt(role.targets))}
      ${fact("Recommended action", role.action)}
    </div>`;
}

function renderWhatMatters() {
  const conclusions = [
    [`Turn out ${turnoutArea.name}`, `${turnoutArea.name} has ${fmt(turnoutArea.low_prop)} lower-turnout voters. This is where repeated contact can create margin.`],
    [`Persuade ${persuasionArea.name}`, `${persuasionArea.name} has the highest unaffiliated share at ${persuasionArea.pct.U}%. Use candidate and affordability messaging.`],
    [`Limit low-return work`, `${lowerPriorityArea.name} should receive coverage, but not at the expense of turnout and persuasion priorities.`],
  ];
  $("#what-matters").innerHTML = conclusions.map(([title, text]) => `<div class="conclusion"><b>${title}</b><p>${text}</p></div>`).join("");
}

const targetGroups = [
  {
    key: "rep-turnout",
    name: "Republican Turnout",
    color: color.base,
    n: T.party.R,
    top: baseArea,
    method: "Doors, phones, and vote-plan follow-up",
    message: "Affordability, taxes, and candidate validation",
    action: `Confirm and bank Republican voters, starting in ${baseArea.name}.`,
    areaCount: p => p.party.R,
  },
  {
    key: "persuasion",
    name: "Persuasion Targets",
    color: color.persuasion,
    n: TG ? TG.party.U : T.persuade,
    top: persuasionArea,
    method: "Canvass, mail, and candidate contact",
    message: "Practical leadership, cost of living, and local trust",
    action: `Work reachable unaffiliated voters first in ${persuasionArea.name}.`,
    areaCount: p => p.persuade,
  },
  {
    key: "expansion",
    name: "Expansion Voters",
    color: color.turnout,
    n: TG ? TG.gotv : T.low_prop,
    top: turnoutArea,
    method: "Repeated GOTV contact and early-vote chase",
    message: "Make the race local, useful, and worth showing up for",
    action: `Convert lower-turnout favorable voters in ${turnoutArea.name}.`,
    areaCount: p => p.low_prop,
  },
  {
    key: "low",
    name: "Low Priority",
    color: color.low,
    n: Math.max(0, T.active - (TG ? TG.target_size : T.party.R + T.persuade)),
    top: lowerPriorityArea,
    method: "Light-touch mail or no direct contact",
    message: "Do not spend heavy field time without stronger evidence",
    action: "Keep scarce canvassing time out of low-return voter pools.",
    areaCount: p => Math.max(0, p.active - p.party.R - p.persuade),
  },
];
let selectedGroup = targetGroups[0].key;

function renderTargetCards() {
  $("#target-cards").innerHTML = targetGroups.map(group => `<button class="target-card ${group.key === selectedGroup ? "on" : ""}" style="--accent:${group.color}" type="button" data-group="${group.key}">
    <h3>${group.name}</h3>
    <div class="value">${fmt(group.n)}</div>
    <p>${group.action}</p>
  </button>`).join("");
  $$("[data-group]").forEach(btn => btn.addEventListener("click", () => {
    selectedGroup = btn.dataset.group;
    renderTargets();
  }));
}

function currentGroup() {
  return targetGroups.find(g => g.key === selectedGroup);
}

function renderTargets() {
  renderTargetCards();
  const group = currentGroup();
  $("#target-detail").innerHTML = `<h3>${group.name}</h3><span class="tag" style="--accent:${group.color}">Selected group</span>
    <div class="facts">
      ${fact("Number of voters", fmt(group.n))}
      ${fact("Top precinct or area", group.top.name)}
      ${fact("Best contact method", group.method)}
      ${fact("Message type", group.message)}
      ${fact("Campaign action", group.action)}
    </div>
    <div class="export-row">
      <button class="export-btn alt" type="button" data-export="walk">Export walk list</button>
      <button class="export-btn" type="button" data-export="call">Export call list</button>
      <button class="export-btn" type="button" data-export="mail">Export mail list</button>
    </div>`;
  $$("[data-export]").forEach(btn => btn.addEventListener("click", () => {
    csvDownload(`hd10-${group.key}-${btn.dataset.export}-packet.csv`, buildAreaRows(group));
  }));
  $("#list-preview").innerHTML = `<tr><td colspan="6"><div class="empty-row"><b>Individual voter rows are not bundled in this public app.</b><br>The campaign data here is aggregate by precinct and target group. The export buttons create field packets from the available targeting counts; a private voter-row file can power name, address, and contact-status previews.</div></td></tr>`;
}

function renderPlan() {
  const baseRepeat = TG ? TG.gotv : T.low_prop;
  $("#plan-blocks").innerHTML = [
    card(color.base, "Turn Out the Base", `${baseArea.name} has the strongest Republican share. Start with the ${fmt(T.party.R)} registered Republican base and give lower-turnout favorable voters repeated contact.`),
    card(color.persuasion, "Persuade Reachable Voters", `${persuasionArea.name} is the best persuasion test. Use affordability, local trust, and candidate validation with reachable unaffiliated voters.`),
    card(color.low, "Avoid Wasted Resources", `Do not let low-return voters consume field time. Keep heavy canvassing focused on ${turnoutArea.name}, ${persuasionArea.name}, and the strongest Republican households.`),
  ].join("");

  const weekly = [
    `Knock 400 Republican turnout doors, starting in ${baseArea.name}.`,
    `Call 250 persuasion targets in ${persuasionArea.name}.`,
    `Send follow-up mail to ${fmt(Math.min(750, baseRepeat))} expansion voters in ${turnoutArea.name}.`,
    `Schedule one candidate visibility event in ${persuasionArea.name}.`,
    `Do not devote canvassing resources to low-priority voter pools this week.`,
  ];
  $("#weekly-priorities").innerHTML = weekly.map(item => `<li>${item}</li>`).join("");

  $("#more-detail-content").innerHTML = `<p><b>Source:</b> Connecticut SOTS voter-file-derived local build for ${fmt(T.active)} active HD10 registrants. The public bundle contains aggregate precinct and target counts, not individual voter records.</p>
    <ul>
      <li>Projected 2026 turnout: ${fmt(D.win.projected2026)}.</li>
      <li>Votes needed to win: ${fmt(D.win.win_number)}.</li>
      <li>Priority contact voters: ${TG ? fmt(TG.target_size) : "not bundled"}.</li>
      <li>Message recommendations are inferred from registration, turnout history, and precinct patterns; validate them in voter contact.</li>
    </ul>`;
}

function renderFooter() {
  $("#foot").innerHTML = `<b>HD10 Command Center.</b> Built from bundled HD10 voter-file summaries: ${fmt(T.active)} active registrants across East Hartford precincts. Counts are for campaign planning, not certainty.`;
}

function wireTabs() {
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => t.classList.toggle("on", t === tab));
      $$(".panel").forEach(panel => panel.classList.toggle("on", panel.id === `tab-${tab.dataset.tab}`));
      if (tab.dataset.tab === "overview") setTimeout(() => focusMap && focusMap.invalidateSize(), 80);
    });
  });
}

function boot() {
  wireTabs();
  renderAssessment();
  renderFocusMap();
  renderWhatMatters();
  renderTargets();
  renderPlan();
  renderFooter();
}

boot();
})();
