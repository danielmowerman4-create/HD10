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
from collections import defaultdict
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
    "birth_year": 37, "party": 39, "gender": 41, "reg_date": 42,
}
HIST_START = 43  # repeating (DATE, TYPE, ABSENTEE) triples to col 102

# --- the four most-recent major general elections ----------------------------
GENERALS = {2024: "11/05/2024", 2022: "11/08/2022",
            2020: "11/03/2020", 2018: "11/06/2018"}
GEN_DATES = {d: y for y, d in GENERALS.items()}

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
            voted_local = False    # any S/R/T/P participation
            ever = False
            for i in range(HIST_START, min(len(row), 103), 3):
                date = clean(row[i])
                if not date:
                    continue
                ever = True
                etype = clean(row[i + 1]).upper() if i + 1 < len(row) else ""
                if etype == "E" and date in GEN_DATES:
                    gens.add(GEN_DATES[date])
                if etype in LOCAL_TYPES:
                    voted_local = True

            voters.append({
                "dist": clean(row[C["dist"]]),
                "party": party, "gender": gender, "age": age,
                "abucket": age_bucket(age), "reg_year": reg_year,
                "gens": gens, "voted_local": voted_local, "ever": ever,
                "v24": 2024 in gens,
            })
    return voters


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


# --- issue audiences: real party + turnout per precinct ----------------------
# Each issue is a transparent age-defined audience. Counts under it are real.
ISSUES = [
    {"id": "safety",  "name": "Public Safety",   "who": "All active voters",
     "buckets": ["young", "parent", "mid", "senior"]},
    {"id": "cost",    "name": "Cost of Living",  "who": "Age 18–49",
     "buckets": ["young", "parent"]},
    {"id": "taxes",   "name": "Taxes & Spending", "who": "Age 50+",
     "buckets": ["mid", "senior"]},
    {"id": "schools", "name": "Schools",          "who": "Age 35–49",
     "buckets": ["parent"]},
    {"id": "jobs",    "name": "Jobs & Economy",   "who": "Under 35",
     "buckets": ["young"]},
    {"id": "seniors", "name": "Senior Services",  "who": "Age 65+",
     "buckets": ["senior"]},
]


def blank_cell():
    return {"n": 0, "D": 0, "R": 0, "U": 0, "O": 0,
            "v24": 0, "age_sum": 0, "age_n": 0}


def crosstab(voters):
    """precinct -> agebucket -> real party / turnout / age cell."""
    tab = defaultdict(lambda: defaultdict(blank_cell))
    for v in voters:
        if v["abucket"] is None:
            continue
        c = tab[v["dist"]][v["abucket"]]
        c["n"] += 1
        c[v["party"]] += 1
        if v["v24"]:
            c["v24"] += 1
        if v["age"] is not None:
            c["age_sum"] += v["age"]
            c["age_n"] += 1
    return tab


def issue_rows(voters):
    tab = crosstab(voters)
    precincts = sorted(tab.keys())
    data = {"defs": [{"id": i["id"], "name": i["name"], "who": i["who"]} for i in ISSUES],
            "byPrecinct": {}}
    for pid in precincts:
        per_issue = {}
        for issue in ISSUES:
            agg = blank_cell()
            for bk in issue["buckets"]:
                c = tab[pid][bk]
                for k in ("n", "D", "R", "U", "O", "v24", "age_sum", "age_n"):
                    agg[k] += c[k]
            per_issue[issue["id"]] = {
                "aud": agg["n"], "persuade": agg["U"],
                "D": agg["D"], "R": agg["R"],
                "v24": agg["v24"], "v24_pct": pct(agg["v24"], agg["n"]),
                "avg_age": round(agg["age_sum"] / agg["age_n"]) if agg["age_n"] else None,
            }
        data["byPrecinct"][pid] = per_issue
    # district totals
    dist_issue = {}
    for issue in ISSUES:
        agg = blank_cell()
        for pid in precincts:
            for bk in issue["buckets"]:
                c = tab[pid][bk]
                for k in ("n", "D", "R", "U", "O", "v24", "age_sum", "age_n"):
                    agg[k] += c[k]
        dist_issue[issue["id"]] = {
            "aud": agg["n"], "persuade": agg["U"], "D": agg["D"], "R": agg["R"],
            "v24": agg["v24"], "v24_pct": pct(agg["v24"], agg["n"]),
            "avg_age": round(agg["age_sum"] / agg["age_n"]) if agg["age_n"] else None,
        }
    data["district"] = dist_issue
    return data


def main():
    voters = load_voters()
    print(f"loaded {len(voters):,} active voters")

    # district + per-precinct segments
    seg_district = summarize_segments(voters)
    seg_by_precinct = {pid: summarize_segments([v for v in voters if v["dist"] == pid])
                       for pid in PRECINCT_NAMES}

    issues = issue_rows(voters)

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
    payload["issues"] = issues

    (DATA_DIR / "hd10.js").write_text(
        "window.HD10 = " + json.dumps(payload, separators=(",", ":")) + ";\n")

    # report
    print("\nTurnout universe (district):")
    for s in SEG_ORDER:
        d = seg_district[s]
        print(f"  {d['label']:<26} {d['n']:>6,}  {d['pct']:>5}%  "
              f"age {d['avg_age']}  D{d['party_pct']['D']} U{d['party_pct']['U']} R{d['party_pct']['R']}")
    print(f"  total {seg_district['_total']:,}")


if __name__ == "__main__":
    main()
