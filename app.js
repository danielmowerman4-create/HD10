/* HD-10 Intelligence — map-hero dashboard from the real SOTS voter file (window.HD10). */
(function () {
"use strict";
const D = window.HD10, P = D.precincts, T = D.totals;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString();
const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
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
let mapBuilt = false, imapBuilt = false, umapBuilt = false;
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id === "tab-" + t.dataset.tab));
  if (t.dataset.tab === "map" && BMAP) setTimeout(() => BMAP.invalidateSize(), 60);
  if (t.dataset.tab === "universe") { if (!umapBuilt) { buildUniverseMap(); umapBuilt = true; } setTimeout(() => UMAP && UMAP.invalidateSize(), 60); }
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

/* ============ AUDIENCES (real, addressable voter slices — no invented issues) ===
   Each audience is a defined slice of the file (age cohort or new registrant)
   paired with the message that fits. Every number — size, persuadable U, party,
   2024 turnout, age — is read straight from the SOTS file, per precinct. */
const AUD = D.audiences, ADEFS = AUD.defs;
const adist = id => AUD.district[id];
const acell = (pid, id) => AUD.byPrecinct[pid][id];
let aud = "older", iSel = beach.id, IMAP, ilayer;

$("#ichips").innerHTML = ADEFS.map(a => `<button class="ichip ${a.id === aud ? "on" : ""}" data-i="${a.id}">${a.name}</button>`).join("");
$("#ichips").querySelectorAll(".ichip").forEach(b => b.onclick = () => {
  aud = b.dataset.i;
  $("#ichips").querySelectorAll(".ichip").forEach(x => x.classList.toggle("on", x === b));
  audDetail();
});
function curAud() { return ADEFS.find(a => a.id === aud); }
function buildIssueMap() { IMAP = baseMap("imap"); paintAud(); }

function paintAud() {
  if (!IMAP) return;
  if (ilayer) IMAP.removeLayer(ilayer);
  const shares = P.map(p => 100 * acell(p.id, aud).persuade / p.active);
  const lo = Math.min(...shares), hi = Math.max(...shares);
  ilayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id), s = 100 * acell(p.id, aud).persuade / p.active;
      return { fillColor: seq(s, lo - 1, hi + 1, [212, 160, 23]), fillOpacity: f.properties.id === iSel ? .92 : .74, color: f.properties.id === iSel ? "#fff" : "#06111F", weight: f.properties.id === iSel ? 2.5 : 1.4 };
    },
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${fmt(acell(p.id, aud).persuade)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }),
        mouseout: () => paintAud(),
        click: () => { iSel = p.id; paintAud(); audDetail(); }
      });
    }
  }).addTo(IMAP);
  $("#ilegend").innerHTML = `<div class="kick">${curAud().name} · persuadable U</div><div class="row"><i style="background:${seq(lo, lo - 1, hi + 1, [212, 160, 23])}"></i>fewer per door</div><div class="row"><i style="background:${seq(hi, lo - 1, hi + 1, [212, 160, 23])}"></i>more per door</div>`;
}

function audDetail() {
  const def = curAud(), dd = adist(aud);
  $("#is-v").textContent = fmt(dd.persuade);
  $("#is-l").textContent = def.name + " · persuadable";
  $("#is-s").innerHTML = `<b style="color:var(--fg)">${fmt(dd.aud)}</b> voters · <b style="color:var(--fg)">${fmt(dd.persuade)}</b> unaffiliated to move. Message: <b style="color:var(--gold-lt)">${def.msg}</b>.`;

  const p = pById(iSel), r = ROLE[p.id], c = acell(p.id, aud);
  const bar = (l, v, d, col) => `<div class="bar"><div class="bt"><span>${l}</span><b>${fmt(v)} · ${pct(v, d)}%</b></div><div class="track"><i style="width:${pct(v, d)}%;background:${col}"></i></div></div>`;
  $("#idetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">${def.name} · ${def.who}</div>
     <div class="dstat" style="margin-top:12px"><span>Audience size</span><b>${fmt(c.aud)} · ${pct(c.aud, p.active)}% of precinct</b></div>
     <div class="bars" style="margin-top:10px">
       ${bar("Unaffiliated (persuade)", c.persuade, c.aud, "var(--npa)")}
       ${bar("Democratic", c.D, c.aud, "var(--dem)")}
       ${bar("Republican", c.R, c.aud, "var(--rep)")}
     </div>
     <div class="dstat" style="margin-top:12px"><span>Voted 2024</span><b>${c.v24_pct}% · ${fmt(c.v24)} of ${fmt(c.aud)}</b></div>
     <div class="dstat"><span>Avg age</span><b>${c.avg_age}</b></div>
     <div class="kick" style="margin-top:13px;margin-bottom:6px">Persuadable U by precinct — click the map</div>
     ${[...P].sort((a, b) => acell(b.id, aud).persuade - acell(a.id, aud).persuade).map(pp => {
        const on = pp.id === iSel;
        return `<div class="dstat" style="border-bottom:1px solid var(--border);padding-bottom:7px;cursor:pointer;${on ? "background:rgba(212,160,23,.08)" : ""}" data-pid="${pp.id}"><span><b style="font-family:var(--disp);font-size:14px;color:${on ? "var(--gold-lt)" : "var(--fg)"}">${pp.name}</b> <span style="color:var(--fg-dim)">· ${ROLE[pp.id].tag}</span></span><b style="color:var(--gold-lt)">${fmt(acell(pp.id, aud).persuade)}</b></div>`;
      }).join("")}`;
  $("#idetail").querySelectorAll("[data-pid]").forEach(el => el.onclick = () => { iSel = el.dataset.pid; paintAud(); audDetail(); });
  $("#inote").innerHTML = `<b>How to read this:</b> the voter file holds no issue opinions, so none are invented. Each audience is a real slice of the file — an age cohort or recent registrant — and the message is the one that demographically fits. Every count (size, unaffiliated, party, 2024 turnout, age) is read straight from the SOTS file, per precinct. Pair with canvass or survey data to confirm which message lands hardest.`;
  paintAud();
}

/* ============ UNIVERSE (turnout segments — all real from the file) ============ */
const SEG = D.segments, SD = SEG.district, segP = pid => SEG.byPrecinct[pid];
const SEGCOL = {
  core: ["var(--gold-lt)", "#D4A017"], strong: ["var(--teal-lt)", "#1A8B9A"],
  medium: ["var(--npa-lt)", "#7C3AED"], recent: ["var(--good)", "#34D399"],
  sporadic: ["#E8943A", "#E8943A"], dormant: ["var(--fg-muted)", "#4A5E76"],
};
/* visible ladder = everyone with usable signal; dormant shown separately */
const LADDER = ["core", "strong", "medium", "recent", "sporadic"];
const lockedIn = SD.core.n + SD.strong.n;                       // 3-4 of 4 generals
const persuasion = SD.medium.party.U + SD.recent.party.U + SD.sporadic.party.U; // U not yet locked
const reactivate = SD.sporadic.n + SD.dormant.n;                // chase / register
const pLocked = p => segP(p.id).core.n + segP(p.id).strong.n;
const pPersuade = p => segP(p.id).medium.party.U + segP(p.id).recent.party.U + segP(p.id).sporadic.party.U;
const pReact = p => segP(p.id).sporadic.n + segP(p.id).dormant.n;

/* headline stat strip */
$("#u-stats").innerHTML = [
  ["gold", fmt(lockedIn), "Locked-in voters", pct(lockedIn, SD._total) + "% turn out no matter what"],
  ["npa", fmt(persuasion), "Persuadable unaffiliated", "the winnable middle"],
  ["teal", fmt(reactivate), "Reactivation pool", "GOTV + registration universe"],
  ["rep", fmt(SD.dormant.n), "No vote history", SD.dormant.pct + "% — registered, never voted"],
].map(([c, v, l, s]) => `<div class="tcard ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");

/* universe map — color precincts by a turnout dimension, click to focus */
const UMETRICS = {
  locked: { label: "Locked-in", base: [212, 160, 23], val: p => 100 * pLocked(p) / p.active },
  persuade: { label: "Persuadable", base: [167, 139, 250], val: p => 100 * pPersuade(p) / p.active },
  react: { label: "Reactivation", base: [232, 148, 58], val: p => 100 * pReact(p) / p.active },
};
let umetric = "locked", uSel = beach.id, UMAP, ulayer;
$("#useg").innerHTML = Object.entries(UMETRICS).map(([k, m]) => `<button data-k="${k}" class="${k === umetric ? "on" : ""}">${m.label}</button>`).join("");
$("#useg").querySelectorAll("button").forEach(b => b.onclick = () => { umetric = b.dataset.k; $("#useg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); paintU(); });

function buildUniverseMap() { UMAP = baseMap("umap"); paintU(); }
function paintU() {
  if (!UMAP) return;
  if (ulayer) UMAP.removeLayer(ulayer);
  const m = UMETRICS[umetric];
  const vals = P.map(m.val), lo = Math.min(...vals), hi = Math.max(...vals);
  ulayer = L.geoJSON(D.geo, {
    style: f => { const p = pById(f.properties.id); return { fillColor: seq(m.val(p), lo - 1, hi + 1, m.base), fillOpacity: f.properties.id === uSel ? .92 : .74, color: f.properties.id === uSel ? "#fff" : "#06111F", weight: f.properties.id === uSel ? 2.5 : 1.4 }; },
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${m.val(p).toFixed(0)}%</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({ mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }), mouseout: () => paintU(), click: () => { uSel = p.id; paintU(); uDetail(); } });
    }
  }).addTo(UMAP);
  $("#ulegend").innerHTML = `<div class="kick">${m.label} · share of precinct</div><div class="row"><i style="background:${seq(lo, lo - 1, hi + 1, m.base)}"></i>lower</div><div class="row"><i style="background:${seq(hi, lo - 1, hi + 1, m.base)}"></i>higher</div>`;
}
function uDetail() {
  const p = pById(uSel), r = ROLE[p.id], sp = segP(p.id);
  const lad = LADDER.map(k => { const s = sp[k], mx = Math.max(...LADDER.map(j => sp[j].n)); return `<div class="bar"><div class="bt"><span style="color:${SEGCOL[k][0]}">${SD[k].label}</span><b>${fmt(s.n)} · U ${s.party_pct.U}%</b></div><div class="track"><i style="width:${Math.round(100 * s.n / mx)}%;background:${SEGCOL[k][1]}"></i></div></div>`; }).join("");
  $("#udetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">Precinct ${p.id} · ${fmt(p.active)} active</div>
     <div class="dstat" style="margin-top:12px"><span>Locked-in (3–4 of 4)</span><b>${fmt(pLocked(p))} · ${pct(pLocked(p), p.active)}%</b></div>
     <div class="dstat"><span>Persuadable unaffiliated</span><b>${fmt(pPersuade(p))}</b></div>
     <div class="dstat"><span>Reactivation pool</span><b>${fmt(pReact(p))}</b></div>
     <div class="kick" style="margin-top:14px;margin-bottom:8px">Turnout ladder</div>
     <div class="bars">${lad}</div>`;
}

function uPyramid() {
  $("#u-pyramid").innerHTML = LADDER.map(k => {
    const s = SD[k], col = SEGCOL[k][1];
    const seg = (v, c) => v > 3 ? `<i style="width:${v}%;background:${c}">${v >= 8 ? v + "%" : ""}</i>` : "";
    return `<div class="prow2">
      <div class="plab"><span class="pt" style="color:${SEGCOL[k][0]}">${s.label}</span><span class="ps">${fmt(s.n)} · ${s.pct}% · avg age ${s.avg_age}</span></div>
      <div class="pbar2" title="D ${s.party_pct.D}% · U ${s.party_pct.U}% · R ${s.party_pct.R}%">
        ${seg(s.party_pct.D, "var(--dem)")}${seg(s.party_pct.U, "var(--npa)")}${seg(s.party_pct.R, "var(--rep)")}
      </div></div>`;
  }).join("");
  $("#u-pnote").innerHTML = `<b>How to read this:</b> mutually-exclusive segments by participation in the last four general elections (2018 · 2020 · 2022 · 2024). Bars show party mix (<b style="color:var(--dem)">D</b> / <b style="color:var(--npa)">U</b> / <b style="color:var(--rep)">R</b>). Propensity climbs with age and Democratic lean — the lower-propensity groups are markedly more unaffiliated, which is exactly where a Republican has room. <b>Registered · No History</b> (${fmt(SD.dormant.n)}, ${SD.dormant.pct}%) is shown in the composition bar above but excluded from the ladder.`;
}

uPyramid(); uDetail();

/* ============ TARGET UNIVERSE (Republican chase list — real, from the file) ============ */
const TG = window.HD10_TARGET;
if (TG) {
  const SEGORD = ["seg_R", "seg_U_with_R", "seg_U_highprop", "seg_U_recent", "seg_U_newer", "seg_U_sel2"];
  const SEGFILL = {
    seg_R: "#E05555", seg_U_with_R: "#F0B82A", seg_U_highprop: "#22AABC",
    seg_U_recent: "#34D399", seg_U_newer: "#A78BFA", seg_U_sel2: "#E8943A",
  };
  $("#t-stats").innerHTML = [
    ["gold", fmt(TG.target_size), "Target universe", TG.target_pct_active + "% of active voters"],
    ["teal", fmt(TG.projected_vote), "Projected vote", "likely 2026 — voted ≥2 of last 4"],
    ["npa", fmt(TG.gotv), "High-priority GOTV", "in target · need a turnout push"],
    ["rep", TG.party_pct.U + "%", "Unaffiliated share", "built on persuasion, not base"],
  ].map(([c, v, l, s]) => `<div class="tcard ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");

  const segMax = Math.max(...SEGORD.map(k => TG.segments[k].n));
  $("#t-segs").innerHTML = SEGORD.map(k => {
    const s = TG.segments[k], w = Math.round(100 * s.n / segMax);
    return `<div class="hbar" style="grid-template-columns:1fr">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
        <span style="font-family:var(--disp);font-weight:700;font-size:14px;letter-spacing:.3px">${s.label}</span>
        <span style="font-family:var(--disp);font-weight:700;font-size:14px;color:${SEGFILL[k]}">${fmt(s.n)} <span style="color:var(--fg-muted);font-size:12px">· ${s.pct_of_target}%</span></span>
      </div>
      <div class="htrack" style="height:13px"><i style="width:${w}%;background:${SEGFILL[k]}"></i></div>
    </div>`;
  }).join("");
  $("#t-segnote").innerHTML = `<b>How to read this:</b> a voter enters the universe by meeting <b>any</b> rule, so segments overlap and don't sum to the total. Every voter is a Republican or an Unaffiliated — <b>no Democrats</b> are targeted. Household rules group by street address; "Republican household" and the Democrat-count filter use active registrants at the address.`;

  const splitCards = [
    ["teal", fmt(TG.projected_vote), "Projected Vote", "Likely 2026", `Voted in ≥2 of the last 4 generals. ${pct(TG.projected_vote, TG.target_size)}% of the target — your <b>persuasion &amp; turnout</b> universe. Build the win number here first.`],
    ["npa", fmt(TG.gotv), "High-Priority GOTV", "Needs a push", `In the target but voted ≤1 of the last 4. ${pct(TG.gotv, TG.target_size)}% of the target — chase mail, doors, and reminders. Votes left on the table.`],
    ["gold", fmt(TG.segments.seg_U_with_R.n), "Soft-R Households", "Persuade early", `Unaffiliated who live with a Republican — the cleanest persuasion signal in the file. Talk to them with the household.`],
  ];
  $("#t-split").innerHTML = splitCards.map(([c, v, t, role, p]) => {
    const col = c === "teal" ? "var(--teal-lt)" : c === "npa" ? "var(--npa-lt)" : "var(--gold-lt)";
    return `<div class="pc" style="border-top-color:${col};cursor:default">
      <div class="pch"><span class="pcn">${t}</span><span class="role" style="color:${col};background:rgba(255,255,255,.05);border:1px solid ${col}">${role}</span></div>
      <div class="pcv" style="color:${col}">${v}</div><div class="pcl">of ${fmt(TG.target_size)} in target</div>
      <p style="font-size:12px;color:var(--fg-muted);line-height:1.5;margin-top:12px">${p}</p></div>`;
  }).join("");

  const distEntries = Object.entries(TG.by_district).sort((a, b) => b[1] - a[1]);
  const distMax = Math.max(...distEntries.map(d => d[1]));
  const gbar = (l, v, d, col) => `<div class="bar"><div class="bt"><span>${l}</span><b>${fmt(v)} · ${pct(v, d)}%</b></div><div class="track"><i style="width:${pct(v, d)}%;background:${col}"></i></div></div>`;
  $("#t-comp").innerHTML =
    `<div class="pdetail">
       <div class="top"><span class="pn">Who's in the target</span></div>
       <div class="kick" style="margin-top:3px">${fmt(TG.target_size)} active voters · avg age ${TG.avg_age}</div>
       <div class="bars" style="margin-top:14px">
         ${gbar("Republican", TG.party.R, TG.target_size, "var(--rep)")}
         ${gbar("Unaffiliated", TG.party.U, TG.target_size, "var(--npa)")}
       </div>
       <div class="dstat" style="margin-top:14px"><span>Women</span><b>${fmt(TG.gender.F)} · ${pct(TG.gender.F, TG.target_size)}%</b></div>
       <div class="dstat"><span>Men</span><b>${fmt(TG.gender.M)} · ${pct(TG.gender.M, TG.target_size)}%</b></div>
       <div class="dstat"><span>Average age</span><b>${TG.avg_age}</b></div>
     </div>
     <div class="side">
       <div class="pdetail">
         <div class="kick" style="margin-bottom:12px">Target by voting district</div>
         ${distEntries.map(([name, v]) => `<div style="margin-bottom:12px"><div class="bt" style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${name}</span><b style="font-family:var(--disp);font-size:13px;color:var(--gold-lt)">${fmt(v)}</b></div><div class="track"><i style="width:${Math.round(100 * v / distMax)}%;background:var(--gold)"></i></div></div>`).join("")}
         <div class="note" style="margin-top:6px">Evenly spread — no single precinct carries the universe. Resource all three.</div>
       </div>
     </div>`;

  $("#t-plays").innerHTML = [
    ["Bank the likely voters", `<b>${fmt(TG.projected_vote)}</b> target voters already turn out (≥2 of 4 generals). Lead with persuasion and ID — don't waste GOTV budget reminding people who always vote.`],
    ["Push the GOTV pool", `<b>${fmt(TG.gotv)}</b> targets vote rarely (≤1 of 4). These are winnable votes that only count if they show — mail, doors, chase, absentee/early-vote nudges.`],
    ["Work the household", `<b>${fmt(TG.segments.seg_U_with_R.n)}</b> unaffiliated share a roof with a Republican and <b>${fmt(TG.segments.seg_U_sel2.n)}</b> selective 2/4 voters sit in low-Democrat homes. Canvass the household, not just the voter.`],
    ["Define the new movers", `<b>${fmt(TG.segments.seg_U_newer.n)}</b> newer persuadables registered since 2023. First contact wins — reach them before the other side frames the race.`],
  ].map(([h, p], i) => `<div class="play"><div class="n">${i + 1}</div><div><h3>${h}</h3><p>${p}</p></div></div>`).join("");
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
paint(); detail(); audDetail();
})();
