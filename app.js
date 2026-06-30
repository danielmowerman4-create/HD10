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

/* ============ PROFILES — how each precinct is genuinely DIFFERENT ===========
   Every signal is real, read from the SOTS file per precinct, shown against the
   district average so the contrasts (not the similarities) drive targeting. */
const PR = D.profiles, PMET = PR.metrics, PDIST = PR.district;
const pmeta = id => PMET.find(m => m.id === id);
const pval = (pid, id) => PR.byPrecinct[pid][id];
const pdelta = (pid, id) => Math.round((pval(pid, id) - PDIST[id]) * 10) / 10;
const fdelta = d => (d > 0 ? "+" : "") + d;            // signed
/* metrics surfaced as map chips (the matrix below shows all of them) */
const MAPMETRICS = ["turnout24", "dropoff", "vbm", "early", "newmover", "solo", "rep"];
/* a one-line targeting play per precinct, grounded in its real standouts */
const PLAY = {
  "004": "Renter-heavy, youngest and lowest-turnout — they live alone and move often. Register and re-register, chase early-vote, and reach voters individually (not by household). Persuasion volume is here; reliability isn't.",
  "005": "The Election-Day precinct — fewest mail/early voters and the steadiest midterm turnout. Run a classic GOTV-day + persuasion mix, and lean on its slightly stronger Republican lean among the swing turf.",
  "006": "Stable family homeowners, oldest and highest-turnout — few new movers, few singles. This is the beachhead: persuade whole households at the door, bank the reliable vote, and don't overspend on GOTV that's already baked in.",
};
let pmetric = "turnout24", iSel = beach.id, IMAP, ilayer;

/* ---- DNA cards: each precinct's distinct fingerprint ---- */
function dnaCards() {
  $("#dna").innerHTML = [...P].sort((a, b) => pval(b.id, "turnout24") - pval(a.id, "turnout24")).map(p => {
    const r = ROLE[p.id], st = PR.standouts[p.id];
    const chips = st.map(s => {
      const up = s.delta > 0, neutral = pmeta(s.id).good === "neutral";
      const col = neutral ? "var(--fg)" : (pmeta(s.id).good === "high" ? (up ? "var(--good)" : "var(--rep)") : "var(--fg)");
      return `<div class="dstat" style="border-bottom:1px solid var(--border);padding-bottom:6px"><span>${pmeta(s.id).label}</span><b><span style="color:var(--fg)">${s.value}%</span> <span style="color:${col};font-size:12px">${fdelta(s.delta)}</span></b></div>`;
    }).join("");
    return `<div class="pc" data-pid="${p.id}" style="border-top-color:${r.fill};cursor:pointer">
      <div class="pch"><span class="pcn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(255,255,255,.05);border:1px solid ${r.col}">${r.tag}</span></div>
      <div class="pcv" style="color:${r.col}">${pval(p.id, "turnout24")}%</div><div class="pcl">2024 turnout · ${fdelta(pdelta(p.id, "turnout24"))} vs district</div>
      <div style="margin-top:14px">${chips}</div>
      <p style="font-size:12px;color:var(--fg-muted);line-height:1.5;margin-top:13px">${PLAY[p.id]}</p></div>`;
  }).join("");
  $("#dna").querySelectorAll(".pc").forEach(el => el.onclick = () => { iSel = el.dataset.pid; profileDetail(); });
}

/* ---- map chips + clickable signal map ---- */
$("#ichips").innerHTML = MAPMETRICS.map(id => `<button class="ichip ${id === pmetric ? "on" : ""}" data-i="${id}">${pmeta(id).label}</button>`).join("");
$("#ichips").querySelectorAll(".ichip").forEach(b => b.onclick = () => {
  pmetric = b.dataset.i;
  $("#ichips").querySelectorAll(".ichip").forEach(x => x.classList.toggle("on", x === b));
  profileDetail();
});
function buildIssueMap() { IMAP = baseMap("imap"); paintProfile(); }

function paintProfile() {
  if (!IMAP) return;
  if (ilayer) IMAP.removeLayer(ilayer);
  const vals = P.map(p => pval(p.id, pmetric)), lo = Math.min(...vals), hi = Math.max(...vals);
  ilayer = L.geoJSON(D.geo, {
    style: f => { const p = pById(f.properties.id); return { fillColor: seq(pval(p.id, pmetric), lo - .5, hi + .5, [212, 160, 23]), fillOpacity: f.properties.id === iSel ? .92 : .74, color: f.properties.id === iSel ? "#fff" : "#06111F", weight: f.properties.id === iSel ? 2.5 : 1.4 }; },
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${pval(p.id, pmetric)}%</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({ mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }), mouseout: () => paintProfile(), click: () => { iSel = p.id; paintProfile(); profileDetail(); } });
    }
  }).addTo(IMAP);
  $("#ilegend").innerHTML = `<div class="kick">${pmeta(pmetric).label} · % by precinct</div><div class="row"><i style="background:${seq(lo, lo - .5, hi + .5, [212, 160, 23])}"></i>lower</div><div class="row"><i style="background:${seq(hi, lo - .5, hi + .5, [212, 160, 23])}"></i>higher</div>`;
}

function profileDetail() {
  const mt = pmeta(pmetric);
  $("#is-v").textContent = PDIST[pmetric] + "%";
  $("#is-l").textContent = mt.label + " · district avg";
  $("#is-s").innerHTML = mt.desc;

  const p = pById(iSel), r = ROLE[p.id];
  $("#idetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">Precinct ${p.id} · ${fmt(p.active)} active</div>
     <div class="dstat" style="margin-top:12px"><span>${mt.label}</span><b>${pval(p.id, pmetric)}% <span style="color:var(--fg-muted);font-size:12px">(${fdelta(pdelta(p.id, pmetric))} vs district)</span></b></div>
     <div class="kick" style="margin-top:14px;margin-bottom:6px">All three on this signal — click the map</div>
     ${[...P].sort((a, b) => pval(b.id, pmetric) - pval(a.id, pmetric)).map(pp => {
        const on = pp.id === iSel, d = pdelta(pp.id, pmetric);
        return `<div class="dstat" style="border-bottom:1px solid var(--border);padding-bottom:7px;cursor:pointer;${on ? "background:rgba(212,160,23,.08)" : ""}" data-pid="${pp.id}"><span><b style="font-family:var(--disp);font-size:14px;color:${on ? "var(--gold-lt)" : "var(--fg)"}">${pp.name}</b></span><b><span style="color:var(--gold-lt)">${pval(pp.id, pmetric)}%</span> <span style="color:var(--fg-dim);font-size:12px">${fdelta(d)}</span></b></div>`;
      }).join("")}
     <div class="kick" style="margin-top:14px;margin-bottom:6px">${p.name} — top contrasts</div>
     ${PR.standouts[p.id].map(s => `<div class="dstat"><span>${pmeta(s.id).label}</span><b>${s.value}% <span style="color:var(--fg-muted);font-size:12px">${fdelta(s.delta)}</span></b></div>`).join("")}`;
  $("#idetail").querySelectorAll("[data-pid]").forEach(el => el.onclick = () => { iSel = el.dataset.pid; paintProfile(); profileDetail(); });
  paintProfile();
}

/* ---- side-by-side matrix: every signal vs the district average ---- */
function buildProfileMatrix() {
  const ord = [...P].sort((a, b) => b.active - a.active);
  let html = `<div class="mrow head"><div class="mc">Signal · vs district</div>${ord.map(p => `<div class="mc">${p.name}</div>`).join("")}<div class="mc">District</div></div>`;
  PMET.forEach(mt => {
    const deltas = ord.map(p => Math.abs(pdelta(p.id, mt.id))), mx = Math.max(...deltas, 0.1);
    html += `<div class="mrow"><div class="mc"><span class="iname">${mt.label}</span><span class="iaud">${mt.desc}</span></div>` +
      ord.map(p => {
        const v = pval(p.id, mt.id), d = pdelta(p.id, mt.id);
        const tint = d === 0 ? "rgba(255,255,255,.04)" : (mt.good === "high" ? (d > 0 ? "rgba(52,211,153,.20)" : "rgba(224,85,85,.18)") : "rgba(124,58,237,.18)");
        const dcol = mt.good === "high" ? (d > 0 ? "var(--good)" : "var(--rep)") : "var(--fg-muted)";
        return `<div class="mc cell"><div class="fillbg" style="width:${Math.round(100 * Math.abs(d) / mx)}%;background:${tint}"></div><div class="cv">${v}%</div><div class="cs" style="color:${dcol}">${fdelta(d)} vs dist</div></div>`;
      }).join("") +
      `<div class="mc" style="justify-content:center"><span class="num" style="font-size:17px;color:var(--fg-muted)">${PDIST[mt.id]}%</span></div></div>`;
  });
  $("#pmatrix").innerHTML = html;
  $("#inote").innerHTML = `<b>How to read this:</b> every figure is real, computed from the SOTS file for each precinct and shown against the district average. <b>Turnout/Republican/Unaffiliated</b> are tinted green above average, red below; behavioral signals (method, age, movers, household) are tinted by how far they swing from the norm. Method shares (mail/early/Election-Day) are of each precinct's 2024 voters. This is the contrast that should drive a precinct-by-precinct plan — pair with canvass or commercial/Census overlays to go deeper.`;
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

/* ---- the 2026 math: how many turn out, and how many of MY targets are in it --
   Ties projected turnout (D.win) to the Republican Target Universe and its
   propensity makeup (window.HD10_TARGET), so turnout vs target is explicit. */
(function uCross() {
  const T = window.HD10_TARGET, W = D.win;
  if (!T || !T.universe_turnout || !W) return;
  const ut = T.universe_turnout;
  const likely = T.projected_vote;                 // target voters likely to vote (>=2 of 4)
  const seg = (o, col, lbl) => `<i style="width:${o.pct}%;background:${col}" title="${lbl} ${o.pct}%">${o.pct >= 12 ? o.pct + "%" : ""}</i>`;
  const big = (v, l, s, col) => `<div style="flex:1;min-width:210px">
      <div class="num" style="font-size:60px;line-height:.88;color:${col}">${v}</div>
      <div style="font-family:var(--disp);font-weight:600;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:var(--fg);margin-top:7px">${l}</div>
      <div style="font-size:12.5px;color:var(--fg-muted);margin-top:5px;line-height:1.45">${s}</div>
    </div>`;
  $("#u-cross").innerHTML =
    `<div style="background:linear-gradient(160deg,rgba(212,160,23,.17),rgba(15,33,64,.55));border:1px solid rgba(212,160,23,.34);border-radius:var(--r);padding:22px 24px;margin-bottom:14px">
       <div class="kick" style="margin-bottom:16px">The 2026 math — who turns out, who you target</div>
       <div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">
         ${big("~" + fmt(W.projected2026), "Will turn out in 2026", "Projected midterm turnout. Last midterm (’22): " + fmt(W.turnout2022) + " · last presidential (’24): " + fmt(W.turnout2024) + ".", "var(--fg)")}
         <div style="width:1px;align-self:stretch;background:var(--border-lt);min-height:96px"></div>
         ${big(fmt(likely), "Your targets in that turnout", "Of your " + fmt(T.target_size) + "-voter target universe, the " + fmt(likely) + " who are likely to vote — the votes actually in play for you.", "var(--gold-lt)")}
         <div style="width:1px;align-self:stretch;background:var(--border-lt);min-height:96px"></div>
         ${big(fmt(W.win_number), "Votes to win", "50% + 1 of projected turnout — your finish line.", "var(--teal-lt)")}
       </div>
       <div style="margin-top:20px">
         <div class="kick" style="margin-bottom:6px">Your ${fmt(T.target_size)} targets, by what it takes to get them to the polls</div>
         <div class="wbar" style="display:flex;height:22px">
           ${seg(ut.locked, "#D4A017", "Locked-in 3–4 of 4")}${seg(ut.mid, "#7C3AED", "Mid 2 of 4")}${seg(ut.low, "#E8943A", "Needs a push 0–1 of 4")}
         </div>
         <div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:10px;font-size:11.5px;color:var(--fg-muted)">
           <span style="display:flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:2px;background:#D4A017"></i>Locked-in · will vote (3–4 of 4) · ${fmt(ut.locked.n)}</span>
           <span style="display:flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:2px;background:#7C3AED"></i>Likely · a nudge helps (2 of 4) · ${fmt(ut.mid.n)}</span>
           <span style="display:flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:2px;background:#E8943A"></i>Needs a real GOTV push (0–1 of 4) · ${fmt(ut.low.n)}</span>
         </div>
         <div class="note" style="margin-top:14px"><b>Read it:</b> about <b>${fmt(W.projected2026)}</b> will vote, and you need <b>${fmt(W.win_number)}</b> to win. Your target universe puts <b>${fmt(likely)}</b> likely voters in play — just above the line, with <b>zero</b> slack — plus <b>${fmt(ut.low.n)}</b> lower-propensity targets you only get by turning them out. Hold the likely pool with persuasion; manufacture the margin with GOTV.</div>
       </div>
     </div>`;
})();

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

/* ---- historical turnout by precinct (SVG line chart, real from the file) ---- */
function uHistory() {
  const H = D.turnout_history;
  if (!H) return;
  const years = H.years, W = 920, Hh = 380, mL = 52, mR = 150, mT = 20, mB = 48;
  const pw = W - mL - mR, ph = Hh - mT - mB;
  const yMax = Math.ceil(Math.max(...P.map(p => Math.max(...years.map(y => H.byPrecinct[p.id][y])))) / 500) * 500;
  const xOf = i => mL + (years.length === 1 ? pw / 2 : pw * i / (years.length - 1));
  const yOf = v => mT + ph - ph * v / yMax;
  const ord = [...P].sort((a, b) => b.active - a.active);  // Silver, Goodwin, Hockanum by size

  let svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Historical general-election turnout by precinct">`;
  // presidential-year shading + x grid
  years.forEach((y, i) => {
    if (H.kind[y] === "pres") svg += `<rect x="${xOf(i) - 26}" y="${mT}" width="52" height="${ph}" fill="rgba(255,255,255,.025)"/>`;
  });
  // y gridlines + labels
  for (let g = 0; g <= yMax; g += 1000) {
    svg += `<line x1="${mL}" y1="${yOf(g)}" x2="${mL + pw}" y2="${yOf(g)}" stroke="rgba(255,255,255,.07)"/>`;
    svg += `<text class="clab" x="${mL - 8}" y="${yOf(g) + 4}" text-anchor="end">${fmt(g)}</text>`;
  }
  // x labels (year + pres/mid)
  years.forEach((y, i) => {
    svg += `<text class="cyr" x="${xOf(i)}" y="${mT + ph + 22}" text-anchor="middle">${y}</text>`;
    svg += `<text class="ckind" x="${xOf(i)}" y="${mT + ph + 36}" text-anchor="middle">${H.kind[y] === "pres" ? "PRESIDENTIAL" : "MIDTERM"}</text>`;
  });
  // one line per precinct
  ord.forEach(p => {
    const col = ROLE[p.id].fill;
    const pts = years.map((y, i) => [xOf(i), yOf(H.byPrecinct[p.id][y])]);
    svg += `<polyline points="${pts.map(pt => pt.join(",")).join(" ")}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`;
    pts.forEach(([x, yv], i) => {
      const pres = H.kind[years[i]] === "pres";
      svg += `<circle cx="${x}" cy="${yv}" r="${pres ? 5 : 3.5}" fill="${pres ? col : "var(--navy-card)"}" stroke="${col}" stroke-width="2"/>`;
    });
  });
  // legend (right)
  ord.forEach((p, i) => {
    const col = ROLE[p.id].fill, ly = mT + 8 + i * 22;
    svg += `<rect x="${mL + pw + 18}" y="${ly}" width="12" height="12" rx="2" fill="${col}"/>`;
    svg += `<text class="clab" x="${mL + pw + 36}" y="${ly + 11}" style="fill:var(--fg)">${p.name}</text>`;
    svg += `<text class="cval" x="${mL + pw + 36}" y="${ly + 11}" dx="78" text-anchor="end" style="fill:${col}">${fmt(H.byPrecinct[p.id][years[years.length - 1]])}</text>`;
  });
  svg += `</svg>`;
  $("#u-hist").innerHTML = svg;
  $("#u-histnote").innerHTML = `<b>What this is:</b> general-election ballots cast by East Hartford voters <b>currently on the rolls</b>, by precinct, from the SOTS file — the real presidential-vs-midterm sawtooth (filled dots = presidential). <b>Caveat:</b> the file only holds today's registrants, so recent cycles are near-complete while older ones undercount voters since moved or removed. Official town turnout actually <b>fell from ~66% (2020) to ~51% (2024)</b> — a drop the file understates because departed 2020 voters aren't counted. For exact official ballots-by-precinct, drop in East Hartford's "Statement of Vote" PDF and I'll plot those numbers precisely. Sources: <b>CTData</b> 2024 turnout analysis · <b>CT SOS</b> election database.`;
}

uPyramid(); uDetail(); uHistory();

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
paint(); detail(); dnaCards(); profileDetail(); buildProfileMatrix();
})();
