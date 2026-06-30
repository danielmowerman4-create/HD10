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
/* Issue = a transparent age-defined audience (stated in the UI). Every count
   under it — audience size, persuadable U, D/R, 2024 turnout, age — is REAL,
   read straight from the SOTS file per precinct (D.issues). */
const ISS = D.issues, IDEFS = ISS.defs;
const idist = id => ISS.district[id];
const icell = (pid, id) => ISS.byPrecinct[pid][id];
let issue = "taxes", iSel = beach.id, IMAP, ilayer;

$("#ichips").innerHTML = IDEFS.map(i => `<button class="ichip ${i.id === issue ? "on" : ""}" data-i="${i.id}">${i.name}</button>`).join("");
$("#ichips").querySelectorAll(".ichip").forEach(b => b.onclick = () => {
  issue = b.dataset.i;
  $("#ichips").querySelectorAll(".ichip").forEach(x => x.classList.toggle("on", x === b));
  paintIssue(); issueDetail();
});
function curDef() { return IDEFS.find(i => i.id === issue); }
function buildIssueMap() { IMAP = baseMap("imap"); paintIssue(); }

function paintIssue() {
  if (!IMAP) return;
  if (ilayer) IMAP.removeLayer(ilayer);
  const shares = P.map(p => 100 * icell(p.id, issue).persuade / p.active);
  const lo = Math.min(...shares), hi = Math.max(...shares);
  ilayer = L.geoJSON(D.geo, {
    style: f => {
      const p = pById(f.properties.id), s = 100 * icell(p.id, issue).persuade / p.active;
      return { fillColor: seq(s, lo - 1, hi + 1, [212, 160, 23]), fillOpacity: f.properties.id === iSel ? .92 : .74, color: f.properties.id === iSel ? "#fff" : "#06111F", weight: f.properties.id === iSel ? 2.5 : 1.4 };
    },
    onEachFeature: (f, lyr) => {
      const p = pById(f.properties.id);
      lyr.bindTooltip(`<span class="plabel">${p.name}<br>${fmt(icell(p.id, issue).persuade)}</span>`, { permanent: true, direction: "center", className: "plabel-wrap" });
      lyr.on({
        mouseover: e => e.target.setStyle({ weight: 3, color: "#22AABC" }),
        mouseout: () => paintIssue(),
        click: () => { iSel = p.id; paintIssue(); issueDetail(); }
      });
    }
  }).addTo(IMAP);
  $("#ilegend").innerHTML = `<div class="kick">${curDef().name} · persuadable U</div><div class="row"><i style="background:${seq(lo, lo - 1, hi + 1, [212, 160, 23])}"></i>fewer per door</div><div class="row"><i style="background:${seq(hi, lo - 1, hi + 1, [212, 160, 23])}"></i>more per door</div>`;
}

function issueDetail() {
  const def = curDef(), dd = idist(issue);
  $("#is-v").textContent = fmt(dd.persuade);
  $("#is-l").textContent = def.name + " · persuadable";
  $("#is-s").innerHTML = `<b style="color:var(--fg)">${fmt(dd.persuade)}</b> unaffiliated voters in the <b style="color:var(--fg)">${def.who}</b> audience — the realistic people to move on this message district-wide.`;

  const p = pById(iSel), r = ROLE[p.id], c = icell(p.id, issue);
  const audPct = (100 * c.aud / p.active).toFixed(0);
  const bar = (l, v, d, col) => `<div class="bar"><div class="bt"><span>${l}</span><b>${fmt(v)} · ${pct(v, d)}%</b></div><div class="track"><i style="width:${pct(v, d)}%;background:${col}"></i></div></div>`;
  $("#idetail").innerHTML =
    `<div class="top"><span class="pn">${p.name}</span><span class="role" style="color:${r.col};background:rgba(124,58,237,.12);border:1px solid ${r.col}">${r.tag}</span></div>
     <div class="kick" style="margin-top:3px">${def.name} audience · ${def.who}</div>
     <div class="dstat" style="margin-top:12px"><span>Audience size</span><b>${fmt(c.aud)} · ${audPct}% of precinct</b></div>
     <div class="bars" style="margin-top:10px">
       ${bar("Unaffiliated (persuade)", c.persuade, c.aud, "var(--npa)")}
       ${bar("Democratic", c.D, c.aud, "var(--dem)")}
       ${bar("Republican", c.R, c.aud, "var(--rep)")}
     </div>
     <div class="dstat" style="margin-top:12px"><span>Voted 2024</span><b>${c.v24_pct}% · ${fmt(c.v24)} of ${fmt(c.aud)}</b></div>
     <div class="dstat"><span>Avg age</span><b>${c.avg_age}</b></div>
     <div class="kick" style="margin-top:13px;margin-bottom:6px">Persuadable U by precinct — click the map</div>
     ${[...P].sort((a, b) => icell(b.id, issue).persuade - icell(a.id, issue).persuade).map(pp => {
        const on = pp.id === iSel;
        return `<div class="dstat" style="border-bottom:1px solid var(--border);padding-bottom:7px;cursor:pointer;${on ? "background:rgba(212,160,23,.08)" : ""}" data-pid="${pp.id}"><span><b style="font-family:var(--disp);font-size:14px;color:${on ? "var(--gold-lt)" : "var(--fg)"}">${pp.name}</b> <span style="color:var(--fg-dim)">· ${ROLE[pp.id].tag}</span></span><b style="color:var(--gold-lt)">${fmt(icell(pp.id, issue).persuade)}</b></div>`;
      }).join("")}`;
  $("#idetail").querySelectorAll("[data-pid]").forEach(el => el.onclick = () => { iSel = el.dataset.pid; paintIssue(); issueDetail(); });
  paintIssue();
}

/* matrix: issues × precincts — real persuadable U, shaded, click to focus */
function buildMatrix() {
  const ord = [...P].sort((a, b) => b.active - a.active);
  let html = `<div class="mrow head"><div class="mc">Message · Audience</div>${ord.map(p => `<div class="mc">${p.name}</div>`).join("")}</div>`;
  IDEFS.forEach(def => {
    const vals = ord.map(p => icell(p.id, def.id).persuade), mx = Math.max(...vals), best = vals.indexOf(mx);
    html += `<div class="mrow"><div class="mc"><span class="iname">${def.name}</span><span class="iaud">${def.who} · unaffiliated</span></div>` +
      ord.map((p, i) => {
        const c = icell(p.id, def.id);
        return `<div class="mc cell ${i === best ? "best" : ""}" data-pid="${p.id}" data-iss="${def.id}" style="cursor:pointer"><div class="fillbg" style="width:${Math.round(100 * c.persuade / mx)}%"></div><div class="cv">${fmt(c.persuade)}</div><div class="cs">${pct(c.persuade, p.active)}% of precinct</div></div>`;
      }).join("") + `</div>`;
  });
  $("#matrix").innerHTML = html;
  $("#matrix").querySelectorAll(".cell").forEach(el => el.onclick = () => {
    issue = el.dataset.iss; iSel = el.dataset.pid;
    $("#ichips").querySelectorAll(".ichip").forEach(x => x.classList.toggle("on", x.dataset.i === issue));
    issueDetail(); $("#tab-issues").scrollIntoView({ behavior: "smooth" });
  });
  $("#inote").innerHTML = `<b>How to read this:</b> each cell is the real count of <b>unaffiliated</b> voters in that age audience, by precinct — the realistic persuasion target for the message. Gold = the precinct to hit first. <b>Click any cell</b> to focus it on the map. Audience boundaries are age definitions from the voter file; every count is real. Layer in canvass or survey data to confirm which message lands.`;
}

/* ============ UNIVERSE (turnout segments — all real from the file) ============ */
const SEG = D.segments, SD = SEG.district;
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

function uTop() {
  const compBar = LADDER.concat("dormant").map(k => {
    const s = SD[k]; return `<i style="width:${(100 * s.n / SD._total).toFixed(1)}%;background:${SEGCOL[k][1]}" title="${s.label}"></i>`;
  }).join("");
  $("#u-top").innerHTML =
    `<div class="winhero">
       <div class="kick">Locked-in turnout universe</div>
       <div class="v">${fmt(lockedIn)}</div>
       <div class="l">Core + Strong — voted 3–4 of last 4 generals</div>
       <div class="s" style="font-size:12.5px;color:var(--fg-muted);margin:8px 0 16px;line-height:1.5">${pct(lockedIn, SD._total)}% of active voters turn out almost no matter what. They get a turnout/persuasion mix — never a registration ask. The race is decided in the three groups below them.</div>
       <div class="kick" style="margin-bottom:6px">Universe composition</div>
       <div class="wbar" style="display:flex">${compBar}</div>
       <div style="display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:10px">${LADDER.concat("dormant").map(k => `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg-muted)"><i style="width:11px;height:11px;border-radius:2px;background:${SEGCOL[k][1]}"></i>${SD[k].label}</span>`).join("")}</div>
     </div>
     <div class="side">
       <div class="bigstat" style="background:linear-gradient(160deg,rgba(124,58,237,.16),rgba(15,33,64,.5));border-color:rgba(124,58,237,.34)">
         <div class="v" style="color:var(--npa-lt)">${fmt(persuasion)}</div>
         <div class="l">Persuadable unaffiliated</div>
         <div class="s">Unaffiliated voters in the Medium, Recent &amp; Sporadic groups — winnable and not yet locked to either party.</div>
       </div>
       <div class="bigstat" style="background:linear-gradient(160deg,rgba(232,148,58,.14),rgba(15,33,64,.5));border-color:rgba(232,148,58,.32)">
         <div class="v" style="color:#E8943A">${fmt(reactivate)}</div>
         <div class="l">Reactivation pool</div>
         <div class="s">Sporadic voters + ${fmt(SD.dormant.n)} registrants with no vote history — the GOTV &amp; registration universe.</div>
       </div>
     </div>`;
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

function uTargets() {
  const cards = [
    { k: "recent", title: "Recent Movers", v: SD.recent.n, sub: `${SD.recent.party_pct.U}% unaffiliated · avg age ${SD.recent.avg_age}`, note: `Newly engaged — voted ’22 &amp; ’24 only. ${fmt(SD.recent.new_reg_local)} are post-2022 registrants who already vote local. Define their issues early.` },
    { k: "medium", title: "Soft Persuasion", v: SD.medium.party.U, sub: `unaffiliated in the 2-of-4 group`, note: `Vote in big years, skip the rest. Nearly evenly split D/U — the cleanest persuasion mail target in the file.` },
    { k: "sporadic", title: "Reactivation", v: SD.sporadic.n, sub: `${SD.sporadic.party_pct.U}% U · ${fmt(SD.sporadic.new_reg_local)} new-reg local voters`, note: `Voted once or only off-cycle. Heavily unaffiliated (${SD.sporadic.party_pct.U}%) and young (avg ${SD.sporadic.avg_age}) — a GOTV + persuasion universe.` },
  ];
  $("#u-targets").innerHTML = cards.map(c => {
    const s = SD[c.k];
    return `<div class="pc" style="border-top-color:${SEGCOL[c.k][1]};cursor:default">
      <div class="pch"><span class="pcn">${c.title}</span><span class="role" style="color:${SEGCOL[c.k][0]};background:rgba(255,255,255,.05);border:1px solid ${SEGCOL[c.k][0]}">${s.label}</span></div>
      <div class="pcv" style="color:${SEGCOL[c.k][0]}">${fmt(c.v)}</div><div class="pcl">${c.sub}</div>
      <div class="mini"><i style="width:${s.party_pct.D}%;background:var(--dem)"></i><i style="width:${s.party_pct.U}%;background:var(--npa)"></i><i style="width:${s.party_pct.R}%;background:var(--rep)"></i></div>
      <p style="font-size:12px;color:var(--fg-muted);line-height:1.5;margin-top:12px">${c.note}</p></div>`;
  }).join("");
}

function uPrec() {
  const ord = [...P].sort((a, b) => b.active - a.active);
  let html = `<div class="mrow head"><div class="mc">Segment</div>${ord.map(p => `<div class="mc">${p.name}</div>`).join("")}</div>`;
  LADDER.concat("dormant").forEach(k => {
    const vals = ord.map(p => SEG.byPrecinct[p.id][k].n), mx = Math.max(...vals), best = vals.indexOf(mx);
    html += `<div class="mrow"><div class="mc"><span class="iname" style="color:${SEGCOL[k][0]}">${SD[k].label}</span><span class="iaud">${SD[k].rule}</span></div>` +
      ord.map((p, i) => {
        const s = SEG.byPrecinct[p.id][k];
        return `<div class="mc cell ${i === best ? "best" : ""}"><div class="fillbg" style="width:${Math.round(100 * s.n / mx)}%;background:${SEGCOL[k][1]}22"></div><div class="cv">${fmt(s.n)}</div><div class="cs">${s.pct}% · U ${s.party_pct.U}%</div></div>`;
      }).join("") + `</div>`;
  });
  $("#u-prec").innerHTML = html;
}

uTop(); uPyramid(); uTargets(); uPrec();

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
