#!/usr/bin/env python3
"""
HD-10 dashboard data engine.

Reads the single-district SOTS extract (HD10_voters.csv), derives every metric
the dashboard shows directly from the official file, and rewrites data/hd10.js.

It PRESERVES the existing window.HD10 shape (meta / totals / precincts / geo /
win) so app.js keeps working, and ADDS two fully real, file-derived blocks:

  * segments   — the turnout universe (Core/Strong/Medium/Recent/Sporadic),
                 district-wide and per precinct, with party, gender and age.
  * issues     — per-precinct issue audiences with real party + turnout splits,
                 so the Issues tab is clickable by precinct on real numbers.

Nothing about vote choice is invented. Issue->audience is a transparent
demographic definition stated in the UI; every count under it is real.

Usage:  python3 build/build_hd10.py
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

csv.field_size_limit(10_000_000)

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
CSV_PATH = Path.home() / "Documents" / "SOTS Voter Files" / "HD10_voters.csv"
CURRENT_YEAR = 2026

# --- column indices (verified against the file header) -----------------------
C = {
    "voter_id": 0, "status": 7, "dist": 10, "poll": 15,
    "addr_num": 20, "addr_unit": 21, "street": 22, "town": 23,
    "birth_year": 37, "party": 39, "gender": 41, "reg_date": 42,
}
HIST_START = 43  # repeating (DATE, TYPE, ABSENTEE) triples to col 102

# --- the four most-recent major general elections ----------------------------
GENERALS = {2024: "11/05/2024", 2022: "11/08/2022",
            2020: "11/03/2020", 2018: "11/06/2018"}
GEN_DATES = {d: y for y, d in GENERALS.items()}

# --- longer general-election history for the turnout-trend chart -------------
# (presidential years marked so the chart can show the presidential/midterm saw)
HISTORY_GENERALS = {
    2016: ("11/08/2016", "pres"), 2018: ("11/06/2018", "mid"),
    2020: ("11/03/2020", "pres"), 2022: ("11/08/2022", "mid"),
    2024: ("11/05/2024", "pres"),
}
HIST_GEN_DATES = {d: y for y, (d, _) in HISTORY_GENERALS.items()}

PRECINCT_NAMES = {"004": "Silver Lane", "005": "Hockanum", "006": "Goodwin"}
LOCAL_TYPES = {"S", "R", "T", "P"}  # special / referendum / town / primary


def clean(v) -> str:
    return str(v).strip() if v is not None else ""


def parse_year(text: str):
    m = re.search(r"/(\d{4})$", text) or re.search(r"^(\d{4})", text)
    if not m:
        d = None
        for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
            try:
                d = datetime.strptime(text, fmt)
                break
            except ValueError:
                pass
        return d.year if d else None
    return int(m.group(1))


def age_bucket(age):
    if age is None:
        return None
    if age < 35:
        return "young"      # 18-34  (jobs / cost of living)
    if age < 50:
        return "parent"     # 35-49  (schools / cost of living)
    if age < 65:
        return "mid"        # 50-64  (taxes / affordability)
    return "senior"         # 65+    (taxes / fixed income)


def load_voters():
    voters = []
    with CSV_PATH.open(newline="", encoding="utf-8", errors="replace") as f:
        r = csv.reader(f)
        next(r)  # header
        for row in r:
            if len(row) < 45:
                continue
            if not clean(row[C["status"]]).upper().startswith("A"):
                continue  # active universe only
            party = clean(row[C["party"]]).upper() or "U"
            party = party if party in ("D", "R", "U") else "O"
            gender = clean(row[C["gender"]]).upper()[:1] or "X"
            if gender not in ("M", "F"):
                gender = "X"
            try:
                by = int(clean(row[C["birth_year"]]))
                age = CURRENT_YEAR - by if 1900 < by <= CURRENT_YEAR else None
            except ValueError:
                age = None
            reg_year = parse_year(clean(row[C["reg_date"]]))

            gens = set()           # which of the 4 target generals voted
            hist_gens = set()      # which of the 2016-2024 generals voted (trend)
            voted_local = False    # any S/R/T/P participation
            ever = False
            method24 = None        # how they cast the 2024 general: N/E/Y
            for i in range(HIST_START, min(len(row), 103), 3):
                date = clean(row[i])
                if not date:
                    continue
                ever = True
                etype = clean(row[i + 1]).upper() if i + 1 < len(row) else ""
                method = clean(row[i + 2]).upper() if i + 2 < len(row) else ""
                if etype == "E" and date in GEN_DATES:
                    gens.add(GEN_DATES[date])
                    if GEN_DATES[date] == 2024:
                        method24 = method if method in ("N", "E", "Y") else "N"
                if etype == "E" and date in HIST_GEN_DATES:
                    hist_gens.add(HIST_GEN_DATES[date])
                if etype in LOCAL_TYPES:
                    voted_local = True

            # household key (street address) for household-size signals
            hh = "|".join(clean(row[C[k]]).upper() for k in
                          ("addr_num", "addr_unit", "street", "town"))

            voters.append({
                "dist": clean(row[C["dist"]]),
                "party": party, "gender": gender, "age": age,
                "abucket": age_bucket(age), "reg_year": reg_year,
                "gens": gens, "hist_gens": hist_gens,
                "voted_local": voted_local, "ever": ever,
                "v24": 2024 in gens, "method24": method24, "hh": hh,
            })
    return voters


def turnout_history(voters):
    """Per-precinct general-election ballots cast by voters CURRENTLY on the
    rolls (the only history the file holds). Recent cycles are near-complete;
    older ones undercount voters since removed — labelled as such in the UI."""
    years = sorted(HISTORY_GENERALS)
    by_precinct = {pid: {y: 0 for y in years} for pid in PRECINCT_NAMES}
    district = {y: 0 for y in years}
    for v in voters:
        if v["dist"] not in PRECINCT_NAMES:
            continue
        for y in v["hist_gens"]:
            by_precinct[v["dist"]][y] += 1
            district[y] += 1
    return {
        "years": years,
        "kind": {y: HISTORY_GENERALS[y][1] for y in years},
        "byPrecinct": by_precinct,
        "district": district,
    }


# --- turnout-universe segmentation (mutually exclusive) ----------------------
def segment_of(v) -> str:
    g = v["gens"]
    n = len(g)
    if n == 4:
        return "core"
    if n == 3:
        return "strong"
    if n == 2:
        # split the 2/4 bucket: the freshest two (rising, often new movers)
        # vs any other two (a fading pattern) — both real, mutually exclusive.
        if 2024 in g and 2022 in g:
            return "recent"
        return "medium"
    if n == 1 or (n == 0 and v["ever"]):
        return "sporadic"      # voted at least once, but not 2 recent generals
    return "dormant"           # active reg, no vote history on file


SEG_ORDER = ["core", "strong", "medium", "recent", "sporadic", "dormant"]
SEG_META = {
    "core":     {"label": "Core High-Propensity",   "rule": "Voted 4 of 4 recent generals (’18·’20·’22·’24)"},
    "strong":   {"label": "Strong High-Propensity", "rule": "Voted 3 of 4 recent generals"},
    "medium":   {"label": "Medium-Propensity",       "rule": "Voted 2 of 4 — an older/declining pair"},
    "recent":   {"label": "Recent 2-Cycle",          "rule": "Voted ’24 + ’22 only — newly engaged / movers"},
    "sporadic": {"label": "Newer / Sporadic",        "rule": "Voted at least once but ≤1 recent general"},
    "dormant":  {"label": "Registered · No History",  "rule": "Active registrant, no vote history on file"},
}


def blank_seg():
    return {"n": 0, "age_sum": 0, "age_n": 0,
            "party": {"D": 0, "R": 0, "U": 0, "O": 0},
            "gender": {"M": 0, "F": 0, "X": 0},
            "new_reg_local": 0}


def pct(n, d):
    return round(100 * n / d, 1) if d else 0.0


def summarize_segments(voters):
    out = {}
    for v in voters:
        s = segment_of(v)
        b = out.setdefault(s, blank_seg())
        b["n"] += 1
        if v["age"] is not None:
            b["age_sum"] += v["age"]
            b["age_n"] += 1
        b["party"][v["party"]] += 1
        b["gender"][v["gender"]] += 1
        # special sub-callout: recent registrants (2022+) who voted a local/special
        if v["reg_year"] and v["reg_year"] >= 2022 and v["voted_local"]:
            b["new_reg_local"] += 1
    total = sum(b["n"] for b in out.values())
    result = {}
    for s in SEG_ORDER:
        b = out.get(s, blank_seg())
        n = b["n"]
        result[s] = {
            "key": s, "label": SEG_META[s]["label"], "rule": SEG_META[s]["rule"],
            "n": n, "pct": pct(n, total),
            "avg_age": round(b["age_sum"] / b["age_n"]) if b["age_n"] else None,
            "party": b["party"],
            "party_pct": {k: pct(b["party"][k], n) for k in ("D", "R", "U", "O")},
            "gender": b["gender"],
            "gender_pct": {k: pct(b["gender"][k], n) for k in ("M", "F", "X")},
            "new_reg_local": b["new_reg_local"],
        }
    result["_total"] = total
    return result


# --- message audiences: REAL, addressable voter slices -----------------------
# The voter file holds no issue opinions, so we don't invent any. Instead each
# audience is a real, defined slice of the file (age cohort or new registrant),
# paired with the message that demographically fits. Every count is real.
AUDIENCES = [
    {"id": "young",  "name": "Young Voters",     "who": "Age 18–34",
     "msg": "Jobs, affordability & a reason to stay",
     "pred": lambda v: v["age"] is not None and v["age"] < 35},
    {"id": "family", "name": "Working Families", "who": "Age 35–54",
     "msg": "Cost of living, schools & safe streets",
     "pred": lambda v: v["age"] is not None and 35 <= v["age"] < 55},
    {"id": "older",  "name": "Older Voters",     "who": "Age 55+",
     "msg": "Taxes, fixed income & public safety",
     "pred": lambda v: v["age"] is not None and v["age"] >= 55},
    {"id": "newmover", "name": "New Movers",     "who": "Registered 2023+",
     "msg": "Introduce the candidate, define the race first",
     "pred": lambda v: bool(v["reg_year"]) and v["reg_year"] >= 2023},
]


def blank_cell():
    return {"n": 0, "D": 0, "R": 0, "U": 0, "O": 0,
            "v24": 0, "age_sum": 0, "age_n": 0}


def add_voter(cell, v):
    cell["n"] += 1
    cell[v["party"]] += 1
    if v["v24"]:
        cell["v24"] += 1
    if v["age"] is not None:
        cell["age_sum"] += v["age"]
        cell["age_n"] += 1


def finalize(cell):
    return {"aud": cell["n"], "persuade": cell["U"], "D": cell["D"], "R": cell["R"],
            "v24": cell["v24"], "v24_pct": pct(cell["v24"], cell["n"]),
            "avg_age": round(cell["age_sum"] / cell["age_n"]) if cell["age_n"] else None}


def audience_rows(voters):
    """Real per-precinct audience cells (party / turnout / age), all from file."""
    precincts = sorted({v["dist"] for v in voters if v["dist"] in PRECINCT_NAMES})
    data = {"defs": [{"id": a["id"], "name": a["name"], "who": a["who"], "msg": a["msg"]}
                     for a in AUDIENCES],
            "byPrecinct": {}, "district": {}}
    for pid in precincts:
        cells = {a["id"]: blank_cell() for a in AUDIENCES}
        for v in (x for x in voters if x["dist"] == pid):
            for a in AUDIENCES:
                if a["pred"](v):
                    add_voter(cells[a["id"]], v)
        data["byPrecinct"][pid] = {aid: finalize(c) for aid, c in cells.items()}
    dcells = {a["id"]: blank_cell() for a in AUDIENCES}
    for v in voters:
        for a in AUDIENCES:
            if a["pred"](v):
                add_voter(dcells[a["id"]], v)
    data["district"] = {aid: finalize(c) for aid, c in dcells.items()}
    return data


# --- precinct PROFILES: what actually makes each precinct different -----------
# Every metric is real and read from the file, per precinct, vs the district
# average — so the differences (not the similarities) drive the targeting.
PROFILE_METRICS = [
    {"id": "turnout24", "label": "2024 turnout",      "unit": "%", "good": "high",
     "desc": "Share of active voters who cast a 2024 general ballot — baseline reliability."},
    {"id": "dropoff",   "label": "Midterm drop-off",  "unit": "%", "good": "gotv",
     "desc": "Voted a presidential ('20 or '24) but skipped the '22 midterm — the 2026 GOTV pool."},
    {"id": "vbm",       "label": "Vote-by-mail",      "unit": "%", "good": "neutral",
     "desc": "Of 2024 voters, share who voted absentee/by-mail — chase with a ballot program."},
    {"id": "early",     "label": "Early in-person",   "unit": "%", "good": "neutral",
     "desc": "Of 2024 voters, share who voted early in person."},
    {"id": "eday",      "label": "Election Day",      "unit": "%", "good": "neutral",
     "desc": "Of 2024 voters, share who showed up on Election Day — a turnout-day program."},
    {"id": "young",     "label": "Under 35",          "unit": "%", "good": "neutral",
     "desc": "Share of active voters age 18–34."},
    {"id": "senior",    "label": "Age 65+",           "unit": "%", "good": "neutral",
     "desc": "Share of active voters age 65 and older."},
    {"id": "newmover",  "label": "New movers",        "unit": "%", "good": "neutral",
     "desc": "Registered 2023 or later — persuadable, not yet anchored."},
    {"id": "solo",      "label": "Single-voter homes","unit": "%", "good": "neutral",
     "desc": "Live alone on the file (no other active voter at the address) — renters / churn."},
    {"id": "unaff",     "label": "Unaffiliated",      "unit": "%", "good": "high",
     "desc": "Unaffiliated share — the persuasion pool."},
    {"id": "rep",       "label": "Republican",        "unit": "%", "good": "high",
     "desc": "Republican registration share — the base."},
]


def profiles(voters):
    # household sizes (active voters share an address)
    hh_size = Counter(v["hh"] for v in voters)

    def metrics_for(vs):
        n = len(vs)
        if not n:
            return {}
        voted24 = [v for v in vs if v["method24"]]
        nv = len(voted24)
        pres_not_mid = sum(1 for v in vs if (2020 in v["gens"] or 2024 in v["gens"])
                           and 2022 not in v["gens"])
        return {
            "active": n,
            "turnout24": pct(sum(v["v24"] for v in vs), n),
            "dropoff": pct(pres_not_mid, n),
            "vbm": pct(sum(v["method24"] == "Y" for v in voted24), nv),
            "early": pct(sum(v["method24"] == "E" for v in voted24), nv),
            "eday": pct(sum(v["method24"] == "N" for v in voted24), nv),
            "young": pct(sum(v["age"] is not None and v["age"] < 35 for v in vs), n),
            "senior": pct(sum(v["age"] is not None and v["age"] >= 65 for v in vs), n),
            "newmover": pct(sum(bool(v["reg_year"]) and v["reg_year"] >= 2023 for v in vs), n),
            "solo": pct(sum(hh_size[v["hh"]] == 1 for v in vs), n),
            "unaff": pct(sum(v["party"] == "U" for v in vs), n),
            "rep": pct(sum(v["party"] == "R" for v in vs), n),
            "avg_age": round(sum(v["age"] for v in vs if v["age"] is not None)
                             / max(1, sum(v["age"] is not None for v in vs))),
        }

    district = metrics_for(voters)
    by_precinct = {pid: metrics_for([v for v in voters if v["dist"] == pid])
                   for pid in PRECINCT_NAMES}

    # auto-detect each precinct's biggest deviations from the district average
    standouts = {}
    for pid, m in by_precinct.items():
        devs = []
        for mt in PROFILE_METRICS:
            d = m[mt["id"]] - district[mt["id"]]
            devs.append((abs(d), d, mt))
        devs.sort(reverse=True)
        standouts[pid] = [{"id": mt["id"], "label": mt["label"],
                           "delta": round(d, 1), "value": m[mt["id"]]}
                          for _, d, mt in devs[:3]]

    return {"metrics": PROFILE_METRICS, "district": district,
            "byPrecinct": by_precinct, "standouts": standouts}


def main():
    voters = load_voters()
    print(f"loaded {len(voters):,} active voters")

    # district + per-precinct segments
    seg_district = summarize_segments(voters)
    seg_by_precinct = {pid: summarize_segments([v for v in voters if v["dist"] == pid])
                       for pid in PRECINCT_NAMES}

    prof = profiles(voters)
    hist = turnout_history(voters)

    # merge into existing window.HD10 without disturbing the rest
    js = (DATA_DIR / "hd10.js").read_text()
    m = re.search(r"window\.HD10\s*=\s*(\{.*\});\s*$", js, re.S)
    payload = json.loads(m.group(1))

    payload["segments"] = {
        "order": SEG_ORDER,
        "meta": SEG_META,
        "district": seg_district,
        "byPrecinct": seg_by_precinct,
    }
    payload["profiles"] = prof
    payload["turnout_history"] = hist
    payload.pop("issues", None)      # superseded long ago
    payload.pop("audiences", None)   # superseded by precinct profiles

    (DATA_DIR / "hd10.js").write_text(
        "window.HD10 = " + json.dumps(payload, separators=(",", ":")) + ";\n")

    # report
    print("\nTurnout universe (district):")
    for s in SEG_ORDER:
        d = seg_district[s]
        print(f"  {d['label']:<26} {d['n']:>6,}  {d['pct']:>5}%  "
              f"age {d['avg_age']}  D{d['party_pct']['D']} U{d['party_pct']['U']} R{d['party_pct']['R']}")
    print(f"  total {seg_district['_total']:,}")

    print("\nPrecinct profiles (value · Δ vs district):")
    hdr = "  " + "metric".ljust(18) + "dist " + "".join(
        f"{PRECINCT_NAMES[p][:10]:>14}" for p in PRECINCT_NAMES)
    print(hdr)
    for mt in prof["metrics"]:
        row = f"  {mt['label']:<18}{prof['district'][mt['id']]:>4}"
        for p in PRECINCT_NAMES:
            v = prof["byPrecinct"][p][mt["id"]]
            d = v - prof["district"][mt["id"]]
            row += f"   {v:>5}({d:+.0f})"
        print(row)
    for p in PRECINCT_NAMES:
        tags = ", ".join(f"{s['label']} {s['delta']:+.0f}" for s in prof["standouts"][p])
        print(f"  {PRECINCT_NAMES[p]} stands out: {tags}")


if __name__ == "__main__":
    main()
