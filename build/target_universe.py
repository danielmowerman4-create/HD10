#!/usr/bin/env python3
"""
HD-10 (East Hartford) — Republican Campaign TARGET UNIVERSE builder.

Reads the Connecticut SOTS voter file for House District 10 and flags every
ACTIVE voter who belongs in the 2026 Republican target universe, using the
exact rules below. A voter is in the universe if they meet ANY segment.

Segments (non-exclusive; a voter can satisfy several):
  1. seg_R          All registered Republicans (PARTY == 'R')
  2. seg_U_with_R   Unaffiliated sharing a household with >=1 Republican
  3. seg_U_highprop Unaffiliated who voted 3 or 4 of the last 4 generals
  4. seg_U_recent   Unaffiliated who voted in BOTH 2024 and 2022 generals
  5. seg_U_newer    Unaffiliated registered 2023+ who have voted at least once
  6. seg_U_sel2     Unaffiliated who voted exactly 2 of 4 generals AND whose
                    household has 0 or 1 Democrat (excluded if 2+ Democrats)

Household = group of voters sharing (ADDR_NUM, ADDR_UNIT, STREET, TOWN).
Household party counts are computed over ACTIVE voters only (the targetable
universe). Last 4 generals: 2024-11-05, 2022-11-08, 2020-11-03, 2018-11-06.

Then:
  * Target Universe   = any segment true
  * Projected Vote U. = target voters with >=2 of last 4 generals (likely 2026)
  * High-Priority GOTV = target voters with <=1 of last 4 generals (need push)

Outputs a summary to stdout and writes:
  * exports/hd10_target_universe.csv   (full file + flag columns)
  * data/target.js                     (window.HD10_TARGET for the dashboard)

Usage:  python3 build/target_universe.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

APP_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = Path.home() / "Documents" / "SOTS Voter Files" / "HD10_voters.csv"
CURRENT_YEAR = 2026

# The four most-recent major general elections (date strings as they appear).
GENERALS = {2024: "11/05/2024", 2022: "11/08/2022",
            2020: "11/03/2020", 2018: "11/06/2018"}
PRECINCT_NAMES = {"004": "Silver Lane", "005": "Hockanum", "006": "Goodwin"}


# ---------------------------------------------------------------------------
# 1. Load the file carefully (SOTS exports are latin-1-ish; fall back safely).
# ---------------------------------------------------------------------------
def load_file() -> pd.DataFrame:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            df = pd.read_csv(CSV_PATH, dtype=str, encoding=enc,
                             keep_default_na=False, low_memory=False)
            print(f"Loaded {len(df):,} rows with encoding={enc}")
            return df
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    raise RuntimeError("Could not decode the voter file with common encodings.")


# ---------------------------------------------------------------------------
# 2. Derive helper columns: party, age, reg year, generals voted.
# ---------------------------------------------------------------------------
def derive(df: pd.DataFrame) -> pd.DataFrame:
    # Normalize party to D / R / U / O.
    party = df["PARTY"].str.strip().str.upper().replace("", "U")
    df["P"] = party.where(party.isin(["D", "R", "U"]), "O")

    # Gender to M / F / X.
    g = df["GENDER"].str.strip().str.upper().str[:1]
    df["G"] = g.where(g.isin(["M", "F"]), "X")

    # Age from BIRTH_YEAR (guard against blanks / junk).
    by = pd.to_numeric(df["BIRTH_YEAR"], errors="coerce")
    df["AGE"] = (CURRENT_YEAR - by).where((by > 1900) & (by <= CURRENT_YEAR))

    # Registration year (last 4 chars of the m/d/Y date).
    reg_year = pd.to_datetime(df["REG_DATE"], errors="coerce", format="%m/%d/%Y")
    df["REG_YEAR"] = reg_year.dt.year

    # Active flag.
    df["ACTIVE"] = df["STATUS"].str.strip().str.upper().str.startswith("A")

    # ---- Count participation in the last 4 generals -----------------------
    # Vote history is repeating (ELECk_DATE, ELECk_TYPE, ELECk_ABSENTEE).
    date_cols = [c for c in df.columns if c.endswith("_DATE") and c.startswith("ELEC")]
    type_cols = [c.replace("_DATE", "_TYPE") for c in date_cols]

    gen_dates = set(GENERALS.values())
    voted_in = {y: pd.Series(False, index=df.index) for y in GENERALS}
    ever_voted = pd.Series(False, index=df.index)

    for dcol, tcol in zip(date_cols, type_cols):
        d = df[dcol].str.strip()
        t = df[tcol].str.strip().str.upper() if tcol in df.columns else ""
        ever_voted |= d.ne("")
        is_general = t.eq("E")
        for y, gd in GENERALS.items():
            voted_in[y] |= is_general & d.eq(gd)

    for y in GENERALS:
        df[f"V{y}"] = voted_in[y]
    df["GEN_COUNT"] = sum(voted_in[y].astype(int) for y in GENERALS)  # 0..4
    df["EVER_VOTED"] = ever_voted
    return df


# ---------------------------------------------------------------------------
# 3. Household party composition (active voters only).
# ---------------------------------------------------------------------------
def household_counts(df: pd.DataFrame) -> pd.DataFrame:
    df["HH_KEY"] = (df["ADDR_NUM"].str.strip() + "|" + df["ADDR_UNIT"].str.strip()
                    + "|" + df["STREET"].str.strip().str.upper()
                    + "|" + df["TOWN"].str.strip().str.upper())
    active = df[df["ACTIVE"]]
    hh_R = active[active["P"].eq("R")].groupby("HH_KEY").size()
    hh_D = active[active["P"].eq("D")].groupby("HH_KEY").size()
    df["HH_R"] = df["HH_KEY"].map(hh_R).fillna(0).astype(int)
    df["HH_D"] = df["HH_KEY"].map(hh_D).fillna(0).astype(int)
    return df


# ---------------------------------------------------------------------------
# 4. Build the six segment flags + the TARGET_UNIVERSE flag.
# ---------------------------------------------------------------------------
def build_segments(df: pd.DataFrame) -> pd.DataFrame:
    A = df["ACTIVE"]
    U = df["P"].eq("U")

    df["seg_R"] = A & df["P"].eq("R")
    df["seg_U_with_R"] = A & U & df["HH_R"].ge(1)
    df["seg_U_highprop"] = A & U & df["GEN_COUNT"].ge(3)
    df["seg_U_recent"] = A & U & df["V2024"] & df["V2022"]
    df["seg_U_newer"] = A & U & df["REG_YEAR"].ge(2023) & df["EVER_VOTED"]
    df["seg_U_sel2"] = A & U & df["GEN_COUNT"].eq(2) & df["HH_D"].le(1)

    seg_cols = ["seg_R", "seg_U_with_R", "seg_U_highprop",
                "seg_U_recent", "seg_U_newer", "seg_U_sel2"]
    df["TARGET_UNIVERSE"] = df[seg_cols].any(axis=1)

    # Sub-universes within the target.
    df["PROJECTED_VOTE"] = df["TARGET_UNIVERSE"] & df["GEN_COUNT"].ge(2)
    df["HIGH_PRIORITY_GOTV"] = df["TARGET_UNIVERSE"] & df["GEN_COUNT"].le(1)
    return df, seg_cols


SEG_LABELS = {
    "seg_R": "Registered Republicans",
    "seg_U_with_R": "Unaffiliated in a Republican household",
    "seg_U_highprop": "High-Propensity Unaffiliated (3–4 of 4)",
    "seg_U_recent": "Recent Strong Unaffiliated (’24 + ’22)",
    "seg_U_newer": "Newer Persuadables (reg ’23+, voted ≥1)",
    "seg_U_sel2": "Selective 2/4 Unaffiliated (≤1 Dem in HH)",
}


# ---------------------------------------------------------------------------
# 5. Summaries + report.
# ---------------------------------------------------------------------------
def pct(n, d):
    return round(100 * n / d, 1) if d else 0.0


def report(df: pd.DataFrame, seg_cols: list[str]) -> dict:
    active = df[df["ACTIVE"]]
    tgt = df[df["TARGET_UNIVERSE"]]
    n_active, n_tgt = len(active), len(tgt)

    # Per-segment counts (overlapping) and their unique contribution.
    seg_summary = {}
    for c in seg_cols:
        seg_summary[c] = {
            "label": SEG_LABELS[c],
            "n": int(df[c].sum()),
            "pct_of_target": pct(int(df[c].sum()), n_tgt),
        }

    party = tgt["P"].value_counts().to_dict()
    gender = tgt["G"].value_counts().to_dict()
    dist = (tgt["VOTING_DIST"].str.strip().value_counts()
            .rename(index=lambda k: f"{k} {PRECINCT_NAMES.get(k, '')}".strip())
            .to_dict())

    # ---- propensity makeup of MY universe (cross target x turnout) ---------
    # Locked-in = voted 3-4 of the last 4 generals (turn out no matter what).
    gc = tgt["GEN_COUNT"]
    locked = int((gc >= 3).sum())     # high-propensity, reliable
    mid = int((gc == 2).sum())        # likely but not certain (2 of 4)
    low = int((gc <= 1).sum())        # need a turnout push (0-1 of 4)

    out = {
        "active_voters": n_active,
        "target_size": n_tgt,
        "target_pct_active": pct(n_tgt, n_active),
        "projected_vote": int(df["PROJECTED_VOTE"].sum()),
        "gotv": int(df["HIGH_PRIORITY_GOTV"].sum()),
        # the two clear numbers: locked-in voters in MY universe, and the
        # share of my universe they make up.
        "locked_in": locked,
        "locked_in_pct": pct(locked, n_tgt),
        "universe_turnout": {
            "locked": {"n": locked, "pct": pct(locked, n_tgt)},
            "mid": {"n": mid, "pct": pct(mid, n_tgt)},
            "low": {"n": low, "pct": pct(low, n_tgt)},
        },
        "segments": seg_summary,
        "party": {k: int(party.get(k, 0)) for k in ("R", "U", "D", "O")},
        "party_pct": {k: pct(int(party.get(k, 0)), n_tgt) for k in ("R", "U", "D", "O")},
        "gender": {k: int(gender.get(k, 0)) for k in ("M", "F", "X")},
        "avg_age": round(float(tgt["AGE"].mean()), 1) if tgt["AGE"].notna().any() else None,
        "by_district": dist,
    }

    # ---- pretty console table --------------------------------------------
    line = "─" * 64
    print(f"\n{line}\nHD-10 REPUBLICAN TARGET UNIVERSE — 2026\n{line}")
    print(f"Active voters (STATUS=A) ........ {n_active:>7,}")
    print(f"TARGET UNIVERSE ................. {n_tgt:>7,}  ({out['target_pct_active']}% of active)")
    print(f"  ├─ LOCKED-IN (3-4 of 4) ....... {out['locked_in']:>7,}  ({out['locked_in_pct']}% of your universe — turn out no matter what)")
    print(f"  ├─ Mid-propensity (2 of 4) .... {out['universe_turnout']['mid']['n']:>7,}  ({out['universe_turnout']['mid']['pct']}% of your universe)")
    print(f"  ├─ Projected Vote (>=2 of 4) .. {out['projected_vote']:>7,}  (likely 2026 voters)")
    print(f"  └─ High-Priority GOTV (<=1/4) . {out['gotv']:>7,}  ({out['universe_turnout']['low']['pct']}% — in target, need turnout push)")
    print(f"\nSegments (overlapping — voter may be in several):")
    for c in seg_cols:
        s = seg_summary[c]
        print(f"  {s['label']:<46} {s['n']:>6,}  {s['pct_of_target']:>5}% of target")
    print(f"\nTarget party mix:  R {out['party_pct']['R']}%  ·  U {out['party_pct']['U']}%  ·  D {out['party_pct']['D']}%")
    print(f"Target gender:     M {out['gender']['M']:,}  ·  F {out['gender']['F']:,}  ·  X {out['gender']['X']:,}")
    print(f"Target avg age:    {out['avg_age']}")
    print(f"\nTop voting districts in target:")
    for k, v in sorted(dist.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<22} {v:>6,}  ({pct(v, n_tgt)}%)")
    print(line)
    return out


def main():
    df = load_file()
    df = derive(df)
    df = household_counts(df)
    df, seg_cols = build_segments(df)
    out = report(df, seg_cols)

    # Write the flagged file (active voters; key columns + flags).
    exports = APP_DIR / "exports"
    exports.mkdir(exist_ok=True)
    keep = ["VOTER_ID", "LAST_NAME", "FIRST_NAME", "VOTING_DIST", "STREET",
            "P", "AGE", "G", "REG_YEAR", "GEN_COUNT"] + seg_cols + \
           ["TARGET_UNIVERSE", "PROJECTED_VOTE", "HIGH_PRIORITY_GOTV"]
    df[df["ACTIVE"]][keep].to_csv(exports / "hd10_target_universe.csv", index=False)
    print(f"\nWrote exports/hd10_target_universe.csv "
          f"({int(df['TARGET_UNIVERSE'].sum()):,} flagged)")

    # Write dashboard data block.
    (APP_DIR / "data" / "target.js").write_text(
        "window.HD10_TARGET = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print("Wrote data/target.js (window.HD10_TARGET)")


if __name__ == "__main__":
    main()
