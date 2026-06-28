/* HD-10 Battle Map — map-hero, built from the real SOTS voter file (window.HD10). */
(function () {
"use strict";
const D = window.HD10, P = D.precincts, T = D.totals;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString();

/* identity */
$("#h-cand").textContent = (D.meta.candidate || "").split(" ").pop();
$("#h-town").textContent = D.meta.town;
$("#bs-v").textContent = fmt(T.persuade);
$("#bs-s").innerHTML = `<b style="color:var(--fg)">${T.pct.U}%</b> of the district — <b style="color:var(--fg)">${(T.persuade / T.party.R).toFixed(1)}×</b> the Republican base. This is the whole game.`;

/* ---- strategic roles (data-driven) ---- */
const byR = [...P].sort((a, b) => b.pct.R - a.pct.R);
const beach = byR[0];                                   // best R ground
const rest = byR.slice(1).sort((a, b) => b.pct.U - a.pct.U);
const persuade = rest[0];                               // deepest unaffiliated pool
const expand = rest[1];                                 // the rest (biggest / lowest-prop)
const ROLE = {};
ROLE[beach.id]    = { tag: "Beachhead", col: "var(--gold-lt)", fill: "#D4A017", desc: "Least-Democratic ground · go first" };
ROLE[persuade.id] = { tag: "Persuade",  col: "var(--npa-lt)", fill: "#7C3AED", desc: "Deepest unaffiliated pool" };
ROLE[expand.id]   = { tag: "Expand",    col: "var(--teal-lt)", fill: "#1A8B9A", desc: "Biggest turf · reactivate low-prop" };

/* ---- map metrics (fixed, honest scales) ---- */
const seq = (v, lo, hi, base) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); const f = [22, 36, 56]; return `rgb(${f.map((c, i) => Math.round(c + (base[i] - c) * (.18 + .82 * t))).join(",")})`; };
const METRICS = {
  priority: { label: "Priority", color: p => ROLE[p.id].fill, fmt: p => ROLE[p.id].tag,
    legend: [["#D4A017", "Beachhead"], ["#7C3AED", "Persuade"], ["#1A8B9A", "Expand"]] },
  persuade: { label: "Unaffiliated", color: p => seq(p.pct.U, 38, 48, [167, 139, 250]), fmt: p => p.pct.U + "%",
    legend: [["#2c2942", "38%"], ["#A78BFA", "48%"]] },
  rbase: { label: "R base", color: p => seq(p.pct.R, 6, 20, [224, 85, 85]), fmt: p => p.pct.R + "%",
    legend: [["#2c1d1d", "6%"], ["#E05555", "20%"]] },
  turnout: { label: "Turnout", color: p => seq(p.v24_pct, 45, 72, [34, 170, 188]), fmt: p => p.v24_pct + "%",
    legend: [["#16313b", "45%"], ["#22AABC", "72%"]] },
};
let metric = "priority", selId = beach.id;

/* segmented control */
$("#seg").innerHTML = Object.entries(METRICS).map(([k, m]) => `<button data-k="${k}" class="${k === metric ? "on" : ""}">${m.label}</button>`).join("");
$("#seg").querySelectorAll("button").forEach(b => b.onclick = () => { metric = b.dataset.k; paint(); });

/* ---- map ---- */
const map = L.map("map", { scrollWheelZoom: false, attributionControl: false, zoomControl: true });
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 19, pane: "markerPane", opacity: .6 }).addTo(map);
map.fitBounds(D.bounds, { padding: [24, 24] });
const pById = id => P.find(p => p.id === id);
let layer;
function paint() {
  if (layer) map.removeLayer(layer);
  const m = METRICS[metric];
  layer = L.geoJSON(D.geo, {
    style: f => ({ fillColor: m.color(pById(f.properties.id)), fillOpacity: f.properties.id === selId ? .92 : .72, color: f.properties.id === selId ? "#fff" : "#06111F", weight: f.properties.id === selId ? 2.5 : 1.4 }),
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${m.fmt(p)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({
        mouseover: e => { e.target.setStyle({ weight: 3, color: "#22AABC" }); },
        mouseout: () => paint(),
        click: () => { selId = p.id; paint(); detail(); }
      });
    }
  }).addTo(map);
  $("#legend").innerHTML = `<div class="kick">${m.label}</div>` + m.legend.map(([c, l]) => `<div class="row"><i style="background:${c}"></i>${l}</div>`).join("");
}

/* ---- selected-precinct detail ---- */
function detail() {
  const p = pById(selId), r = ROLE[p.id];
  const bar = (lab, val, pct, col) => `<div class="bar"><div class="bt"><span>${lab}</span><b>${fmt(val)} · ${pct}%</b></div><div class="track"><i style="width:${pct}%;background:${col}"></i></div></div>`;
  $("#pdetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">Precinct ${p.id} · ${fmt(p.active)} active · ${r.desc}</div>
     <div class="bars">
       ${bar("Unaffiliated", p.party.U, p.pct.U, "var(--npa)")}
       ${bar("Democratic", p.party.D, p.pct.D, "var(--dem)")}
       ${bar("Republican", p.party.R, p.pct.R, "var(--rep)")}
     </div>
     <div class="stat" style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px"><span style="color:var(--fg-muted)">2024 turnout</span><b class="num">${p.v24_pct}%</b></div>
     <div class="stat" style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px"><span style="color:var(--fg-muted)">Low-propensity</span><b class="num">${fmt(p.low_prop)}</b></div>`;
}

/* ---- takeaways ---- */
$("#takeaways").innerHTML = [
  ["rep", T.pct.R + "%", "Republican base", "Can't win on base alone"],
  ["npa", fmt(T.persuade), "Unaffiliated voters", T.pct.U + "% — nearly tied with D"],
  ["gold", (T.persuade / T.party.R).toFixed(1) + "×", "Unaffiliated : Republican", "The math forces persuasion"],
  ["teal", beach.name, "Best ground to start", "R " + beach.pct.R + "% · highest turnout"],
].map(([c, v, l, s]) => `<div class="tcard ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");

/* ---- the play ---- */
$("#plays").innerHTML = [
  ["Skip the base", `Republicans are just <b>${T.pct.R}%</b> of the district — <b>${fmt(T.party.R)}</b> voters. Base turnout alone can't reach a majority. Don't sink the budget into defending it.`],
  ["Own the middle", `<b>${fmt(T.persuade)}</b> unaffiliated voters — <b>${T.pct.U}%</b>, almost the Democratic count. Lead with persuasion mail + doors. This race is won or lost here.`],
  [`Plant the flag in ${beach.name}`, `The least-Democratic precinct (<b>D ${beach.pct.D}%</b>, <b>R ${beach.pct.R}%</b>) with the strongest turnout. Your beachhead — open here and go hard.`],
  [`Then work ${persuade.name}`, `Highest unaffiliated share in the district (<b>${persuade.pct.U}%</b>). The deepest persuasion pool per door once the flag is planted.`],
].map(([h, p], i) => `<div class="play"><div class="n">${i + 1}</div><div><h3>${h}</h3><p>${p}</p></div></div>`).join("");

/* ---- precinct cards ---- */
$("#pcards").innerHTML = [...P].sort((a, b) => b.active - a.active).map(p => {
  const r = ROLE[p.id];
  return `<div class="pc" data-id="${p.id}" style="border-top-color:${r.fill}">
    <div class="pch"><span class="pcn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(255,255,255,.05);border:1px solid ${r.col}">${r.tag}</span></div>
    <div class="pcv">${fmt(p.persuade)}</div><div class="pcl">unaffiliated · ${p.pct.U}% of ${fmt(p.active)}</div>
    <div class="mini"><i style="width:${p.pct.U}%;background:var(--npa)"></i><i style="width:${p.pct.D}%;background:var(--dem)"></i><i style="width:${p.pct.R}%;background:var(--rep)"></i></div>
    <div class="stat"><span>2024 turnout</span><b>${p.v24_pct}%</b></div>
    <div class="stat"><span>Avg age</span><b>${p.avg_age}</b></div></div>`;
}).join("");
$("#pcards").querySelectorAll(".pc").forEach(el => el.onclick = () => { selId = el.dataset.id; paint(); detail(); document.querySelector(".hero").scrollIntoView({ behavior: "smooth", block: "start" }); });

$("#foot").innerHTML = `<b>Source:</b> Connecticut SOTS voter file — ${fmt(T.active)} active registrants in HD-10 (East Hartford precincts 004 · 005 · 006). Precinct boundaries: U.S. Census 2020 voting districts. Party, turnout and age are computed directly from the file; no individual voter records are shown or published.`;

paint(); detail();
})();
