/* HD-10 Intelligence — map-hero dashboard from the real SOTS voter file (window.HD10). */
(function () {
"use strict";
const D = window.HD10, P = D.precincts, T = D.totals;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString();
const pById = id => P.find(p => p.id === id);

/* identity */
$("#h-cand").textContent = (D.meta.candidate || "").split(" ").pop();
$("#h-town").textContent = D.meta.town;
$("#bs-v").textContent = fmt(T.persuade);
$("#bs-s").innerHTML = `<b style="color:var(--fg)">${T.pct.U}%</b> of the district — <b style="color:var(--fg)">${(T.persuade / T.party.R).toFixed(1)}×</b> the Republican base. This is the whole game.`;

/* strategic roles */
const byR = [...P].sort((a, b) => b.pct.R - a.pct.R);
const beach = byR[0], rest = byR.slice(1).sort((a, b) => b.pct.U - a.pct.U), persuade = rest[0], expand = rest[1];
const ROLE = {};
ROLE[beach.id] = { tag: "Beachhead", col: "var(--gold-lt)", fill: "#D4A017", desc: "Least-Democratic ground · go first" };
ROLE[persuade.id] = { tag: "Persuade", col: "var(--npa-lt)", fill: "#7C3AED", desc: "Deepest unaffiliated pool" };
ROLE[expand.id] = { tag: "Expand", col: "var(--teal-lt)", fill: "#1A8B9A", desc: "Biggest turf · reactivate low-prop" };

const seq = (v, lo, hi, base) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); const f = [22, 36, 56]; return `rgb(${f.map((c, i) => Math.round(c + (base[i] - c) * (.18 + .82 * t))).join(",")})`; };

/* ============ tabs ============ */
let mapBuilt = false, imapBuilt = false;
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id === "tab-" + t.dataset.tab));
  if (t.dataset.tab === "map" && BMAP) setTimeout(() => BMAP.invalidateSize(), 60);
  if (t.dataset.tab === "issues") { if (!imapBuilt) { buildIssueMap(); imapBuilt = true; } setTimeout(() => IMAP && IMAP.invalidateSize(), 60); }
});

/* ============ BATTLE MAP ============ */
const METRICS = {
  priority: { label: "Priority", color: p => ROLE[p.id].fill, fmt: p => ROLE[p.id].tag, legend: [["#D4A017", "Beachhead"], ["#7C3AED", "Persuade"], ["#1A8B9A", "Expand"]] },
  persuade: { label: "Unaffiliated", color: p => seq(p.pct.U, 38, 48, [167, 139, 250]), fmt: p => p.pct.U + "%", legend: [["#2c2942", "38%"], ["#A78BFA", "48%"]] },
  rbase: { label: "R base", color: p => seq(p.pct.R, 6, 20, [224, 85, 85]), fmt: p => p.pct.R + "%", legend: [["#2c1d1d", "6%"], ["#E05555", "20%"]] },
  turnout: { label: "Turnout", color: p => seq(p.v24_pct, 45, 72, [34, 170, 188]), fmt: p => p.v24_pct + "%", legend: [["#16313b", "45%"], ["#22AABC", "72%"]] },
};
let metric = "priority", selId = beach.id, BMAP, blayer;
$("#seg").innerHTML = Object.entries(METRICS).map(([k, m]) => `<button data-k="${k}" class="${k === metric ? "on" : ""}">${m.label}</button>`).join("");
$("#seg").querySelectorAll("button").forEach(b => b.onclick = () => { metric = b.dataset.k; $("#seg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); paint(); });

function baseMap(id) {
  const m = L.map(id, { scrollWheelZoom: false, attributionControl: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(m);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 19, pane: "markerPane", opacity: .55 }).addTo(m);
  const fit = () => { m.invalidateSize(); m.fitBounds(D.bounds, { padding: [26, 26] }); };
  fit(); setTimeout(fit, 160); setTimeout(fit, 450);
  return m;
}
function paint() {
  if (!BMAP) BMAP = baseMap("map");
  if (blayer) BMAP.removeLayer(blayer);
  const m = METRICS[metric];
  blayer = L.geoJSON(D.geo, {
    style: f => ({ fillColor: m.color(pById(f.properties.id)), fillOpacity: f.properties.id === selId ? .92 : .72, color: f.properties.id === selId ? "#fff" : "#06111F", weight: f.properties.id === selId ? 2.5 : 1.4 }),
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${m.fmt(p)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({ mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }), mouseout: () => paint(), click: () => { selId = p.id; paint(); detail(); } });
    }
  }).addTo(BMAP);
  $("#legend").innerHTML = `<div class="kick">${m.label}</div>` + m.legend.map(([c, l]) => `<div class="row"><i style="background:${c}"></i>${l}</div>`).join("");
}
function detail() {
  const p = pById(selId), r = ROLE[p.id];
  const bar = (l, v, pc, c) => `<div class="bar"><div class="bt"><span>${l}</span><b>${fmt(v)} · ${pc}%</b></div><div class="track"><i style="width:${pc}%;background:${c}"></i></div></div>`;
  $("#pdetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">Precinct ${p.id} · ${fmt(p.active)} active</div>
     <div class="bars">${bar("Unaffiliated", p.party.U, p.pct.U, "var(--npa)")}${bar("Democratic", p.party.D, p.pct.D, "var(--dem)")}${bar("Republican", p.party.R, p.pct.R, "var(--rep)")}</div>
     <div class="dstat"><span>2024 turnout</span><b>${p.v24_pct}%</b></div><div class="dstat"><span>Low-propensity</span><b>${fmt(p.low_prop)}</b></div><div class="dstat"><span>Avg age</span><b>${p.avg_age}</b></div>`;
}
$("#takeaways").innerHTML = [
  ["rep", T.pct.R + "%", "Republican base", "Can't win on base alone"],
  ["npa", fmt(T.persuade), "Unaffiliated voters", T.pct.U + "% — nearly tied with D"],
  ["gold", (T.persuade / T.party.R).toFixed(1) + "×", "Unaffiliated : Republican", "The math forces persuasion"],
  ["teal", beach.name, "Best ground to start", "R " + beach.pct.R + "% · highest turnout"],
].map(([c, v, l, s]) => `<div class="tcard ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");
$("#pcards").innerHTML = [...P].sort((a, b) => b.active - a.active).map(p => {
  const r = ROLE[p.id];
  return `<div class="pc" data-id="${p.id}" style="border-top-color:${r.fill}">
    <div class="pch"><span class="pcn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(255,255,255,.05);border:1px solid ${r.col}">${r.tag}</span></div>
    <div class="pcv">${fmt(p.persuade)}</div><div class="pcl">unaffiliated · ${p.pct.U}% of ${fmt(p.active)}</div>
    <div class="mini"><i style="width:${p.pct.U}%;background:var(--npa)"></i><i style="width:${p.pct.D}%;background:var(--dem)"></i><i style="width:${p.pct.R}%;background:var(--rep)"></i></div>
    <div class="dstat"><span>2024 turnout</span><b>${p.v24_pct}%</b></div><div class="dstat"><span>Avg age</span><b>${p.avg_age}</b></div></div>`;
}).join("");
$("#pcards").querySelectorAll(".pc").forEach(el => el.onclick = () => { selId = el.dataset.id; paint(); detail(); $("#tab-map").scrollIntoView({ behavior: "smooth" }); });

/* ============ ISSUES ============ */
/* audience = receptive demographic per message; persuade = unaffiliated within it (real counts) */
const br = (p, k) => p.br[k];
const ISSUES = [
  { id: "safety", name: "Public Safety", who: "all voters", aud: p => p.active, per: p => p.party.U },
  { id: "taxes", name: "Taxes", who: "age 50+", aud: p => br(p, "mid").n + br(p, "senior").n, per: p => br(p, "mid").u + br(p, "senior").u },
  { id: "cost", name: "Cost of Living", who: "age 18–49", aud: p => br(p, "young").n + br(p, "parent").n, per: p => br(p, "young").u + br(p, "parent").u },
  { id: "schools", name: "Schools", who: "age 35–49", aud: p => br(p, "parent").n, per: p => br(p, "parent").u },
  { id: "jobs", name: "Jobs & Economy", who: "under 35", aud: p => br(p, "young").n, per: p => br(p, "young").u },
];
let issue = "taxes", IMAP, ilayer;
$("#ichips").innerHTML = ISSUES.map(i => `<button class="ichip ${i.id === issue ? "on" : ""}" data-i="${i.id}">${i.name}</button>`).join("");
$("#ichips").querySelectorAll(".ichip").forEach(b => b.onclick = () => { issue = b.dataset.i; $("#ichips").querySelectorAll(".ichip").forEach(x => x.classList.toggle("on", x === b)); paintIssue(); issueDetail(); });

function curIssue() { return ISSUES.find(i => i.id === issue); }
function buildIssueMap() { IMAP = baseMap("imap"); paintIssue(); }
function paintIssue() {
  if (!IMAP) return;
  if (ilayer) IMAP.removeLayer(ilayer);
  const I = curIssue();
  const shares = P.map(p => 100 * I.per(p) / p.active);
  const lo = Math.min(...shares), hi = Math.max(...shares);
  ilayer = L.geoJSON(D.geo, {
    style: f => { const p = pById(f.properties.id); const s = 100 * I.per(p) / p.active; return { fillColor: seq(s, lo - 1, hi + 1, [212, 160, 23]), fillOpacity: .82, color: "#06111F", weight: 1.4 }; },
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${fmt(I.per(p))}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({ mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }), mouseout: () => paintIssue() });
    }
  }).addTo(IMAP);
  $("#ilegend").innerHTML = `<div class="kick">${I.name} · persuadable</div><div class="row"><i style="background:${seq(lo, lo - 1, hi + 1, [212, 160, 23])}"></i>fewer</div><div class="row"><i style="background:${seq(hi, lo - 1, hi + 1, [212, 160, 23])}"></i>more</div>`;
}
function issueDetail() {
  const I = curIssue();
  const totAud = I.aud(T), totPer = ISSUES === I ? 0 : I.per(T);
  $("#is-v").textContent = fmt(I.per(T));
  $("#is-l").textContent = I.name + " · persuadable";
  $("#is-s").innerHTML = `Unaffiliated voters in the <b style="color:var(--fg)">${I.who}</b> audience — the people to move with this message.`;
  const best = [...P].sort((a, b) => I.per(b) - I.per(a))[0];
  const rows = [...P].sort((a, b) => I.per(b) - I.per(a)).map(p => {
    const r = ROLE[p.id];
    return `<div class="dstat" style="border-bottom:1px solid var(--border);padding-bottom:8px"><span><b style="font-family:var(--disp);font-size:15px;color:var(--fg)">${p.name}</b> <span style="color:var(--fg-dim)">· ${r.tag}</span></span><b style="color:var(--gold-lt)">${fmt(I.per(p))}</b></div>`;
  }).join("");
  $("#idetail").innerHTML = `<div class="kick" style="margin-bottom:10px">Persuadable audience by precinct</div>${rows}<div class="note" style="margin-top:14px">Lead with <b>${I.name}</b> in <b>${best.name}</b> — the biggest persuadable audience for this message.</div>`;
  paintIssue();
}

/* matrix: issues × precincts (persuadable audience), shaded */
function buildMatrix() {
  const ord = [...P].sort((a, b) => b.active - a.active);
  let html = `<div class="mrow head"><div class="mc">Message · Audience</div>${ord.map(p => `<div class="mc">${p.name}</div>`).join("")}</div>`;
  ISSUES.forEach(I => {
    const vals = ord.map(p => I.per(p)); const mx = Math.max(...vals); const best = vals.indexOf(mx);
    html += `<div class="mrow"><div class="mc"><span class="iname">${I.name}</span><span class="iaud">${I.who} · unaffiliated</span></div>` +
      ord.map((p, i) => `<div class="mc cell ${i === best ? "best" : ""}"><div class="fillbg" style="width:${Math.round(100 * I.per(p) / mx)}%"></div><div class="cv">${fmt(I.per(p))}</div><div class="cs">${(100 * I.per(p) / p.active).toFixed(0)}% of precinct</div></div>`).join("") + `</div>`;
  });
  $("#matrix").innerHTML = html;
  $("#inote").innerHTML = `<b>How to read this:</b> each number is the count of <b>unaffiliated</b> voters in the audience most receptive to that message, by precinct — the realistic persuasion target. Gold = the precinct to hit first for that issue. Audiences are modeled from voter-file age structure (not polling); swap in canvass or survey data to sharpen.`;
}

/* ============ STRATEGY ============ */
$("#winstat").innerHTML = [
  ["npa", fmt(T.persuade), "Persuasion universe", "the only path to 50%"],
  ["gold", beach.name, "Open here", "least-blue · best turnout"],
  ["teal", fmt(T.low_prop), "Low-propensity", "register & reactivate"],
  ["rep", T.pct.R + "%", "Hold the base", "but don't live on it"],
].map(([c, v, l, s]) => `<div class="tcard ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");
$("#plays").innerHTML = [
  ["Skip the base", `Republicans are <b>${T.pct.R}%</b> — <b>${fmt(T.party.R)}</b> voters. Base turnout alone can't reach a majority. Hold it, but don't spend the war chest there.`],
  ["Own the middle", `<b>${fmt(T.persuade)}</b> unaffiliated (<b>${T.pct.U}%</b>) — almost the Democratic count. Persuasion mail + doors on pocketbook issues. The race is won here.`],
  [`Plant the flag in ${beach.name}`, `Least-Democratic precinct (<b>D ${beach.pct.D}%</b>, <b>R ${beach.pct.R}%</b>), strongest turnout. Your beachhead — open here, go hard.`],
  [`Then work ${persuade.name}`, `Highest unaffiliated share (<b>${persuade.pct.U}%</b>) — the deepest persuasion pool per door once the flag is planted.`],
].map(([h, p], i) => `<div class="play"><div class="n">${i + 1}</div><div><h3>${h}</h3><p>${p}</p></div></div>`).join("");

$("#foot").innerHTML = `<b>Source:</b> Connecticut SOTS voter file — ${fmt(T.active)} active registrants in HD-10 (East Hartford precincts 004 · 005 · 006). Precinct boundaries: U.S. Census 2020 voting districts. Party, turnout and age computed from the file; issue audiences modeled from age structure. No individual voter records are shown or published.`;

/* boot */
paint(); detail(); issueDetail(); buildMatrix();
})();
