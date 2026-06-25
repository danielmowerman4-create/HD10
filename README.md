# HD 10 · Chris Tierrini — Campaign Intelligence

A standalone, browser-based campaign intelligence dashboard for **Connecticut
State House District 10** (East Hartford). General-election **open-seat pickup**
posture: the long-serving Democratic incumbent is not running, and Chris Tierrini
contested the seat in 2024.

It runs entirely on your computer. The official Connecticut SOTS statewide voter
file is the master source; every metric shown is derived from that file. No voter
data is uploaded anywhere, and nothing about election outcomes or vote choice is
invented. The framing treats every figure as a map of **where to test and organize
first**, not a prediction of the result.

This product is a sibling of the HD 48 dashboard. The two are deliberately
separate repos so campaign data can never blend between districts.

## 1. Prepare the data

Place the extracted **`SOTS Voter Files/`** directory (containing `EXT1`–`EXT4`)
beside this folder or in `~/Documents`, then:

```bash
python3 build/prepare_data.py --force     # streams ~2.5M statewide rows, filters to HD10
python3 build/build_geometry.py           # writes the East Hartford boundary for the map
```

This writes the `data/*.js` files the dashboard reads:
`meta.js`, `voters.js`, `towns.js`, `precincts.js`, `health.js`, `geometry.js`.

Requires `geopandas` for the geometry step (`pip install geopandas`). The data
step is pure standard-library Python.

## 2. Open the dashboard

```bash
./serve.command          # → http://localhost:8010/
```

## 3. What's inside

| Section | What it answers |
|---|---|
| **Overview** | Where the Republican path realistically exists; unaffiliated opportunity |
| **Geography** | East Hartford precinct tables + town boundary map, drill-downs |
| **Historical Elections** | SOTS participation timeline; slot for the 2024 baseline + CT SOS returns |
| **Voter Universe** | Fast, filterable table with named universes + CSV/XLSX export |
| **Opportunity** | Transparent scoring → Turnout / Persuasion / Build base / Long shot |
| **Walk Lists** | Filterable canvass-list builder with CSV/XLSX export + print view |
| **Data Health** | Field coverage, loaded datasets, what's still needed. CSV/XLSX/XLS only — no PDF |

## 4. Data notes specific to HD 10

- East Hartford is a single municipality split into multiple **precincts**; the
  geography and walk-list tools work at precinct level.
- HD 10 may initially ship with an **email-only or partial L2 export**. The
  dashboard auto-detects field coverage: if street address, precinct, voter ID,
  or party fields are missing, the affected tools explain the limitation and the
  walk-list builder disables export until a complete file is loaded.
- Precinct polygons are not yet bundled, so the map is shown at town level; all
  precinct **analysis** remains fully data-driven.

## 5. Tests

```bash
python3 -m pytest tests/ -q
```

Covers turnout scoring, vote-method tendency, town/party normalization, history
parsing, opportunity classification, walk-list eligibility, and campaign isolation.
