# TERRAFLUX — Full Project Context

> **Waste-to-Carbon Intelligence & Circular Value Chain Platform**
> Team: Last Commit | Track: Waste-to-Carbon Value Chain Tracker | HackOut '26 PS11

---

## 1. What This Is

TerraFlux is an **enterprise-grade, deterministic Waste-to-Carbon Intelligence Platform** — not a marketplace or dashboard, but a full **operating system for organic-waste networks**. It takes every tonne of biomass from gate to grid: chemical characterisation, pathway filtering, multi-objective optimisation, carbon permanence accounting, logistics routing, and downstream digestate matching in a single deterministic pass.

The tracker falls out as a by-product. The core product is the **decision** that happens before anything is tracked: which tonne goes where, by which conversion pathway, and exactly why.

---

## 2. The Problem

Organic waste rotting in landfills and agricultural stubble burning are among the largest unmitigated sources of atmospheric CH₄ and N₂O.

- **~20 Mt of paddy straw** burned annually in the Punjab–Haryana belt in a narrow 20-day window
- Methane has GWP₁₀₀ = 27–30 × CO₂; GWP₂₀ > 80 ×
- Existing biochar/biogas plants operate at **~40% capacity** due to feedstock incompatibility and logistical blindness
- Current software attempts "Tinder for Waste" — simple proximity matching that fails on chemistry, volumetrics, and downstream accounting

**Why proximity matching fails:**
1. High-moisture waste (>70%) destroys pyrolysis energy balance
2. Baled straw at 0.15 t/m³ — a 16-tonne truck carries only 8.7 t (volume-limited, not mass-limited)
3. European biochar permanence models assume 14.9 °C soil; Indian soils average 26 °C — decay is 45% faster
4. Chains terminate at the conversion gate; digestate/FOM is ignored

---

## 3. The Core Insight

> *"The nearest facility is not necessarily the best destination."*

For every candidate pathway `p` connecting waste stream `i` to facility `j`:

```
Score(i,j,p) = w_val·NetValue + w_carb·NetCarbon − w_log·LogisticsCost − w_proc·ProcessingCost − w_risk·RiskFactor
```

The solver maximises this across the entire network simultaneously — not greedily per-tonne.

---

## 4. Setup & Running

### Requirements
- **Node ≥ 22.6.0** (no Python, no Docker, no PostgreSQL, no Redis, no external API)
- npm (comes with Node)

### One-command start
```bash
npm install
npm run dev
```

| Service | URL |
|---|---|
| Web Dashboard | http://localhost:5173 |
| API | http://127.0.0.1:5174 |

> The `.env.example` lists optional env vars (Gemini API key, SMTP, DB). None are required for the demo — the engine is fully self-contained with synthetic seeded data.

### Optional: AI Copilot
Set `GEMINI_API_KEY` in a `.env` file at the root to enable natural-language querying via Gemini. The copilot calls the same 15 tools the UI does — answers are always numerically identical to what the screens show.

---

## 5. Monorepo Structure

```
APSV/
├── packages/
│   ├── engine/        # Pure TypeScript deterministic twin engine (zero runtime deps)
│   │   └── src/
│   │       ├── types.ts          # Full domain model
│   │       ├── streams.ts        # 9 feedstocks with full proximate/ultimate analysis
│   │       ├── pathways.ts       # 5 conversion pathways, hard gates + soft suitability
│   │       ├── network.ts        # 42 sources, 18 facilities (Punjab/Haryana/Chandigarh)
│   │       ├── optimizer.ts      # Branch-and-bound + min-cost flow, 4 objective modes
│   │       ├── mincostflow.ts    # Successive shortest paths, Johnson potentials
│   │       ├── carbon.ts         # Q10-corrected two-pool decay, Monte Carlo uncertainty
│   │       ├── economics.ts      # Per-tonne revenue/cost mirroring carbon ledger
│   │       ├── routing.ts        # Volume-limited CVRP, Clarke-Wright + Or-opt
│   │       ├── forecast.ts       # Ridge regression, Fourier harmonics, walk-forward MAPE
│   │       ├── bottleneck.ts     # Stranding with attributed causes, N-1 resilience
│   │       ├── scenario.ts       # Clone-and-re-solve, flow diff attribution
│   │       ├── state.ts          # Twin: memoised derived artefacts, version counter
│   │       ├── copilot.ts        # 15 tools over the Twin, intent classification
│   │       ├── geo.ts            # Haversine, circuity, Web-Mercator projection
│   │       ├── rng.ts            # Seeded mulberry32, Box-Muller, lognormal draws
│   │       └── constants.ts      # Every emission factor + price with source citation
│   ├── api/           # Node.js native HTTP gateway (zero dependencies)
│   └── web/           # React + Vite frontend
│       └── src/
│           └── pages/ # 27 screens (Overview, Carbon, Optimization, Logistics, etc.)
├── scripts/
│   └── dev.mjs        # Concurrent API + Vite launcher (no concurrently package)
├── README.md          # Full project brief + mathematical specifications
├── ARCHITECTURE.md    # Detailed system design rationale
├── ANALYSIS.md        # Modelling decisions and reasoning
├── RESEARCH.md        # Reference repository study, adopt/reject decisions
├── CHANGELOG.md       # Build-order implementation milestones
└── package.json       # Workspace root, Node >=22.6 requirement
```

---

## 6. Engine Architecture

### One Engine, Two Consumers
The engine is imported **as TypeScript source** by both the API (Node native type stripping — no build step) and the web client (Vite compilation). One implementation, no compiled artefact between them that can go stale. Editing a model file hot-reloads both processes.

### Digital Twin (`state.ts`)
`Twin` holds authoritative network state and memoises every derived artefact against a version counter. Changing the objective, an assumption, or committing a scenario bumps the version and invalidates the cache. State is **in-process memory** — no database, because the network seeds deterministically.

### The Optimiser
**Problem:** Capacitated facility-location with semi-continuous throughput — facilities run above minimum viable feed or not at all (binary), then continuous allocation across operating facilities.

**Method:** Branch-and-bound over facility on/off decisions; each node's relaxation solved exactly by min-cost flow.

```
root: every facility available
  └─ solve by min-cost flow → LP bound
     └─ any facility below minimum viable feed?
          no  → integer-feasible, candidate incumbent
          yes → branch on worst violator:
                  child A: facility does not run
                  child B: facility must reach minimum feed
```

Converges in **1–7 nodes** on this network. Best-first, pruned against incumbent.

**Why not a metaheuristic?** Once the operating set is fixed, allocation is a transportation LP — linear, integral optimal solution. Min-cost flow solves it **exactly**. A genetic algorithm would solve the same problem approximately, more slowly, with no optimality bound. The bound buys: (1) an honest gap, (2) shadow prices, (3) reproducibility.

**Implementation:** Successive shortest paths with Johnson potentials. SPFA seeds potentials; Dijkstra finds subsequent paths on non-negative reduced costs.

**Objective modes:**

| Mode | Objective |
|---|---|
| Carbon First | max net tCO₂e |
| Profit First | max operating margin |
| Balanced | 0.5 × normalised carbon + 0.5 × normalised margin |
| Logistics First | normalised carbon − 0.55 × tonne-km + 0.15 × margin |

**Shadow prices:** For each binding facility, add 1 t/day headroom, re-solve entire network, record objective delta. Deliberately *not* LP dual read-off — with binary decisions in play, duals describe current basis only.

---

## 7. Carbon Accounting

### Three Core Commitments

**1. Biogenic CO₂ is not counted.**
Only CH₄ and N₂O are a genuine atmospheric addition. Avoided-burning credit = **0.082 tCO₂e/dry tonne** (IPCC AR6: CH₄ 2.7 g/kg DM, N₂O 0.07 g/kg DM, combustion factor 0.89). Not the ~1 tCO₂e/t frequently claimed.

**2. Removal and avoidance are never summed.**
Different commodities: durable CDR ~₹10,800/tCO₂e vs VCM avoidance ~₹520/tCO₂e (~20x gap). Separate ledger lines, priced separately.

**3. Permanence is computed, India-calibrated.**
Two-pool first-order decay parameterised by H/C(org) ratio, Q10-corrected from harmonised 14.9 °C reference (northern Europe) to Indian soil 26 °C:

```
f(T) = Q10^((26.0 - 14.9) / 10) = 2.0^1.11 ~ 2.158
```

Biochar decays **~45% faster in Indian soil** than European default models assume.

| Feedstock | BC₁₀₀ @ 14.9 °C | BC₁₀₀ @ 26 °C |
|---|---:|---:|
| Paddy straw | 82.0% | **77.1%** |

Source: Woolf (2021), Azzi et al. (2024) *Geoderma 441, 116761*.

### Monte Carlo Uncertainty
2,000 seeded lognormal draws over every emission factor and yield parameter → UI reports **P5 / P50 / P95**, never a fake-precision point estimate.

---

## 8. Feedstock Modelling

Every feedstock carries full proximate/ultimate analysis — not a lookup table. Pathway yields are **derived from properties**:

```
biochar yield (dry)  = 0.20 + 0.0055 x lignin% + 0.0045 x ash%
char carbon content  = feedstock C% x 0.50 / biochar yield
char H/C(org)        = feedstock H:C molar x (0.19 - 0.0022 x lignin%)
achievable payload   = min(mass rating, deck volume x bulk density)
```

### Hard Pathway Gates

| Gate | Pathway | Reason |
|---|---|---|
| moisture <= 25% | Pyrolysis | Drying 70%-moisture feed costs more energy than char is worth |
| moisture >= 55% | Digestion | Below this, digester needs dilution water |
| C:N 15–40 | Digestion | <15 = ammonia inhibition; >40 = nitrogen-limited |
| ash <= 20% | Pellets | High-silica straw slags boiler tubes |
| ash <= 16% | Gasification | Ash and tar loading |
| C:N 12–45 | Composting | Outside range, windrow won't run |

### Network
- **42 waste sources** — crop residue, dairy, agro-processing, municipal wet waste
- **18 conversion facilities** — CBG plants, biochar pyrolysis, pellet mills, gasifiers, composting
- Real district coordinates for Punjab, Haryana, Chandigarh; synthetic entity data

---

## 9. Logistics

The binding constraint is **volume, not mass**. Baled paddy straw = 0.15 t/m³. A 16-tonne truck with 58 m³ deck carries **8.7 t** — mass-only routing overstates fleet capacity by >40%.

```
achievable payload = min(mass rating, deck volume x bulk density)
```

**Vehicle selection:** solver picks whichever vehicle minimises cost/tonne per arc — tractor-trolleys win short rural hauls, trucks win highway hauls, as an emergent result.

**Routing:** Full truckloads go direct. Residual part-loads consolidated by **Clarke-Wright savings** under both mass and volume limits, improved with **Or-opt**. All tours return to receiving facility.

---

## 10. Forecasting

Ridge regression on three Fourier seasonal harmonics + linear trend + two AR lags, solved in closed form via **Cholesky decomposition** of regularised normal equations. Trains in <1 ms per source.

Accuracy measured by **walk-forward backtest over 12 folds**, reported as MAPE. Nothing asserts accuracy it hasn't measured.

---

## 11. Frontend (React + Vite) — Screen-by-Screen

All 27 screens read from the shared `Twin` via `useTwin()`. No screen has its own data model.

---

### Navigation Structure

```
Landing / TrueLanding / PersonaLanding  (entry points by role)
├── Overview              — network-level summary, before/after vs baseline
├── Map                   — interactive SVG spatial map, flow arcs, source/facility hover
├── Optimization          — objective mode switcher, Pareto frontier, solver stats
├── Scenarios             — clone-mutate-resolve, diff view, commit to live twin
├── Bottlenecks           — stranding analysis, N-1 resilience, shadow price table
├── Carbon                — full carbon ledger hub
│   ├── CarbonLedger      — per-arc traceable ledger (removal vs avoidance, separate)
│   ├── CarbonPathways    — pathway-level carbon breakdown
│   ├── CarbonFacilities  — facility-level carbon, linked to FacilityCommand
│   ├── CarbonEvidence    — source citations, uncertainty bands, P5/P50/P95
│   ├── CarbonReport      — printable carbon accounting summary
│   ├── CarbonOpportunities — highest-value unallocated tonnes by carbon value
│   └── CarbonScenarios   — carbon-specific what-if scenarios
├── CarbonCommand         — natural-language carbon querying (Copilot over carbon tools)
├── Facilities            — *** the fleet-level facility view (see detail below) ***
├── FacilityCommand       — *** single-facility drill-down (see detail below) ***
├── Sources               — all 42 source sites, feedstock properties, allocation status
├── Logistics             — volume-limited routing, trip counts, fleet utilisation
├── Economics             — per-tonne revenue/cost breakdown, DCF, LCOP, MACC
├── Copilot               — full natural-language interface (requires GEMINI_API_KEY)
├── Activity              — event log, recent optimisation history
└── System                — every assumption and emission factor with source citations
```

---

### Facilities Page (`/facilities`)

**Primary question: where is capacity available and where is it constrained?**

Two top-level mode tabs:

**Fleet Operations mode:**
- **Fleet Health Ring** — SVG donut: Healthy / Constrained / Idle counts at a glance
- **Decision Banner** — fleet state stated in words before any chart (e.g. "11 of 18 facilities active, 3 binding constraints")
- **FleetBar** — proportional capacity bar across all facilities, sorted by nameplate capacity, coloured by utilisation, with binding-constraint flags
- **Pathway × District Heatmap** — grid showing utilisation per pathway per district; reveals regional bottlenecks instantly
- **Card grid / Table toggle:**
  - **Cards view** — one card per facility, shows: pathway type, district, capacity t/day, utilisation %, remaining capacity, status dot, carbon intensity, margin/t, binding flag. Click → FacilityCommand
  - **Table view** — sortable columns for all the same fields

**Site Planning mode (Municipal Siting Screener):**
- Embedded `MunicipalSitingScreener` component
- Helps evaluate where to site a new facility given waste supply density and pathway fit

Route: `/facilities`

---

### FacilityCommand Page (`/facility-command?id=<facilityId>`)

**Per-facility operational control view — the deepest drill-down in the product.**

**Header:** facility name, pathway type, district, status dot, capacity t/day, current utilisation gauge.

**Three tabs:**

**1. Overview tab:**
- **Capacity Gauge** — SVG arc showing used vs remaining vs total capacity
- **Allocation Flow** (`AllocationFlow` chart) — ranked bar list of all source sites currently feeding this facility, each showing: feedstock type, allocated tonnes, haul distance, trip count, margin contribution. Click any source → side panel with full breakdown
- **Feedstock Outlook Chart** — 12-week forward supply forecast from `forecast.ts` for the district, with historical actuals overlay
- **Source Score Bar** — ranked scoring of every candidate source site against this facility (distance, pathway fit, economics, carbon)

**2. What-If Analysis tab:**
- **Supply shock slider** (−30% to +30%) — simulates a district-wide supply surge or shortage
- **Facility capacity derate slider** (0–30%) — simulates partial capacity loss (equipment failure)
- On slider move: debounced call to `api.scenario()` with `commit: false` — **real network re-optimisation in the background, live twin untouched**
- **Before → After panel** (`WhatIfBars`) — throughput t/d, facility margin, carbon outcome
- **Network effect panel** — reallocated tonnes, total network margin delta, total network carbon delta
- **Narrative** — auto-generated plain-language explanation from the scenario engine

**3. Parameters tab:**
- All facility assumptions (gate thresholds, min viable feed, availability %, downtime history, risk factor)
- Shadow price for this facility: tCO₂e and Rs. value of one additional tonne/day of capacity

All data comes from `useTwin()` — no new API endpoints are called that aren't already used by other screens.

Route: `/facility-command?id=<facilityId>` (navigated to by clicking any card on the Facilities page or any facility row on CarbonFacilities)

---

### Custom SVG map (`MapPage`)
Real district geometry for Punjab, Haryana, Chandigarh + surrounding states. Simplified with Douglas-Peucker and embedded in bundle (131 KB). No tile server — map cannot fail in front of an audience. Flow arcs animate between sources and facilities, coloured by pathway. Both axes share one uniform scale using Web-Mercator degree-equivalents (180/π factor prevents sixfold squash). Stroke widths divided by zoom factor (not `vector-effect: non-scaling-stroke`) to avoid compositor stalls on ~340 district paths.

---

### Custom SVG charts (used across all screens)
No charting library. Every chart in the product is hand-written SVG — FleetBar, CapacityGauge, AllocationFlow, FeedstockOutlookChart, WhatIfBars, SourceScoreBar, CapacityHeatmap, Pareto frontier, Monte Carlo bands, MACC curve. Each answers one specific analytical question and matches the product's visual language exactly.

**Loading states name the computation:** "Running 2,000 Monte Carlo draws over every emission factor" — not a spinner.

---

## 12. Key Numbers

| Metric | Value |
|---|---|
| Network | 42 sources, 18 facilities, Punjab · Haryana · Chandigarh |
| Feedstock types | 9 (paddy straw, dairy dung, rice husk, wheat straw, food waste, sugarcane bagasse, cotton stalk, municipal wet waste, poultry litter) |
| Conversion pathways | 5 (biochar pyrolysis, CBG anaerobic digestion, pelletisation, gasification, composting) |
| Total supply modelled | ~57,700 t/planning window |
| Facility nameplate capacity | ~48,150 t (not fungible across feedstock types) |

### Performance (measured)

| Operation | Time |
|---|---|
| Full network optimisation | 25–180 ms |
| Shadow prices (12–18 re-solves) | ~50 ms |
| Monte Carlo 2,000 draws | ~25 ms |
| Forecast 42 sources + backtests | ~45 ms |
| Scenario: baseline + mutate + re-solve + diff | ~150 ms |
| N-1 resilience over operating set | ~60 ms |
| Cold API start including first solve | ~150 ms |

---

## 13. Central Trade-off

Per tonne of paddy straw:

| Pathway | Net Carbon | Margin | Why |
|---|---:|---:|---|
| Pyrolysis → biochar | ~0.69 tCO₂e | ~Rs. 6,100 | Locks ~40% of feedstock carbon; earns CDR credits at Rs. 10,800/t |
| Pellets → co-firing | ~1.15 tCO₂e | ~Rs. 2,500 | Displaces coal 1:1 on energy; earns only avoidance credits at Rs. 520/t |

Co-firing wins on **carbon**. Pyrolysis wins on **money**. Switching the objective mode visibly re-routes the entire network. The Pareto frontier prices the trade-off at ~Rs. 2,600/tCO₂e to move from pure profit to pure carbon.

---

## 14. Notable Model Findings

1. **Poultry litter has no viable pathway** — C:N of 9 is below the stable window for digestion and composting; moisture rules out every thermal route. Bottleneck engine names this and recommends co-digestion with press mud (1:2.5 ratio lifts C:N above 15).

2. **Optimiser diverts less tonnage than a proximity heuristic — and this is correct.** Sending every lot to the closest willing facility includes loss-making tonnes. Dropping them yields +27% net carbon and +41% margin on 17% less transport.

3. **41% of supply is stranded** — not a modelling failure. Crop residue can only go to pellets/pyrolysis/gasification (~22,950 t capacity) but represents ~37,000 t of supply. Shadow price of the most constrained plant: **0.80 tCO₂e and Rs. 5,637 per additional tonne of throughput**.

4. **Composting cattle dung is carbon-negative** — windrow composting emits more CH₄ and N₂O than the open heap it replaces avoids. Model strands dung once digestion capacity is full. Finding: digest dung, do not compost it.

---

## 15. Design Decisions and What Was Rejected

| Chosen | Rejected | Reason |
|---|---|---|
| Min-cost flow + branch-and-bound | Genetic algorithm, PSO, ACO | Inner problem is a transportation LP — exact beats approximate, gives bound + duals |
| Shadow prices by re-optimisation | LP duals from single basis | Binary facility decisions make single-basis duals misleading |
| Ridge regression (Cholesky) | XGBoost / LightGBM | No dependency-free JS equivalent; inspectable coefficients > marginal MAPE gain |
| Clarke-Wright + Or-opt | OR-Tools CVRP | No Python; residual part-load problem is small after full loads removed |
| Lognormal Monte Carlo | Normal draws | Emission factors strictly positive; normal draws can go negative silently |
| Integer objective scaling | Float comparison | Float tie-breaks cause non-reproducible optimal answers |
| Haversine x circuity factor | Live routing API | Live demo cannot depend on external service |
| In-process seeded state | PostgreSQL + Redis | Nothing to persist; restart = same deterministic baseline |

---

## 16. Reference Research Summary

Six repositories studied; no source code copied. Scientific formulae cited at point of use.

| Repo | Licence | Key adoption |
|---|---|---|
| `puro-earth/PuroBiocharPersistenceEdition2025` | CC BY-SA 4.0 | Q10 two-pool decay, re-calibrated to Indian soil temperature |
| `aws-samples/wastecollector-planner` | MIT-0 | Volume-limited CVRP (not just mass) |
| `RishvinReddy/EcoBin-Smart-Waste-Management-System` | NOASSERTION | Forecast-then-optimise architecture; stranding-with-reason |
| `akshaya-borugadda/intelligent-waste-management` | None | Mandatory baseline comparison on every result |
| `SwolfPy-Project/swolfpy` | GPL-2.0 | Seeded Monte Carlo uncertainty; removal != avoidance |
| `pimct/MIRA_project` | MIT | Multi-objective mode switching; feedstock-specific yields; Pareto frontier |

---

## 17. What Would Need to Change for Production

1. **Real road routing** — OSRM over OSM extract replaces circuity factor
2. **Real supply telemetry** — forecasting architecture unchanged; only input data source differs
3. **Persistence** — scenarios and plan versions need a database
4. **Measured char analysis** — permanence modelled; a real credit needs measured H/C(org) on actual char
5. **Facility-level process models** — ANN surrogates over thermodynamic simulations for yield refinement
6. **Temporal coupling** — real feedstock is contracted, not spot-allocated

---

## 18. Data & Citations

All demo data is **synthetic and seeded**. Emission factors and prices drawn from:

- IPCC 2006/2019 Guidelines (CH₄, N₂O emission factors)
- Woolf (2021) ES&T — Q10 biochar permanence relation
- Azzi et al. (2024) *Geoderma 441, 116761* — two-pool harmonised decay model
- CEA CO₂ Baseline Database — grid emission factor
- MNRE / SATAT tariffs — CBG prices
- European Biochar Certificate (EBC) — H/C(org) permanence thresholds

---

*TerraFlux — Built for High-Impact Circular Carbon Logistics*
