# RESEARCH.md — Reference repository study

**Rule applied:** study the ideas, verify the licences, re-implement cleanly in our own
architecture. No source code was copied from any studied repository. Scientific *formulae*
taken from the peer-reviewed literature are cited inline at the point of use in the code.

Studied 2026-09-12 via the GitHub REST API and raw source inspection.

---

## The environment constraint that shaped every decision

The build machine has **Node v24.19.0 / npm 11.17.0 and no Python interpreter at all**
(`python`, `python3` and `py` are all absent). Four of the six reference repositories are
Python/Jupyter. A Python + FastAPI + OR-Tools stack — the "obvious" architecture for this
problem — **cannot execute on this machine**, and a hackathon demo that will not start is
worth zero.

Consequence: every algorithm below was re-implemented in dependency-free TypeScript. The
whole product runs on `npm install && npm run dev` with no Python, no Docker, no PostgreSQL,
no Redis, and no external API call.

---

## 1. `puro-earth/PuroBiocharPersistenceEdition2025`

|  |  |
|---|---|
| Licence | **CC BY-SA 4.0** (share-alike) |
| Language | Jupyter / Python — a fork of `SLU-biochar/biocharStability` |
| Underlying paper | Azzi, Li, Cederlund, Karltun, Sundberg (2024), *Modelling biochar long-term carbon storage in soil with harmonized analysis of decomposition data*, **Geoderma 441, 116761** |

**What it actually contains.** A database of biochar incubation experiments plus curve-fitting
code (`biocharStability/analyse.py`) that fits single/double/triple-exponential and Zimmerman
power decay models to measured carbon-remaining timeseries, re-calibrates the fitted decay
constants from the incubation temperature to a target soil temperature via a Q10 function,
and reports **BC100** — the fraction of biochar carbon still present after 100 years.

| Concept | Adopt? | Why / how |
|---|---|---|
| Two-pool exponential decay of biochar carbon | **Yes** | `engine/src/carbon.ts` → `twoPoolRemaining()`. A labile pool plus a persistent pool with separate first-order rates is the model form the Geoderma analysis settles on. |
| **Q10 soil-temperature correction** (Woolf 2021 ES&T relation) | **Yes — the single most valuable idea taken** | Puro's library defaults to a **14.9 °C** target soil temperature (northern Europe). Indian agricultural soils sit near **26 °C** mean annual. Applying the same published Q10 relation at 26 °C *materially lowers* 100-year permanence. Our ledger therefore reports an India-calibrated permanence factor rather than importing a European default — a correction most carbon accounting in this space silently gets wrong. Implemented as `q10Factor()` / `fT()`. |
| H/C(org) ratio as the property driving persistence | **Yes** | Sets the persistent-pool fraction per feedstock in `engine/src/streams.ts`. H/Corg is the gate both EBC and Puro use (< 0.7 required, < 0.4 = highest durability class). |
| The incubation `.xlsx` database itself | **No** | 66 MB of experimental data, and CC BY-SA share-alike would propagate to the repository. We take the *published model form and the published Q10 relation* — equations and facts, not copyrightable expression — and cite the papers. |
| Their Panel dashboard | **No** | Not relevant to this UI. |

**Licence handling:** no Puro/SLU code or data file is redistributed. The Q10 relation and
decay model forms are cited to Woolf (2021) and Azzi et al. (2024) in `carbon.ts`.

---

## 2. `aws-samples/wastecollector-planner`

|  |  |
|---|---|
| Licence | **MIT-0** — the most permissive of the six |
| Language | Jupyter / Python, Amazon Location Service + SageMaker |

**What it contains.** A blog-post companion: place bins on a map, place a depot, set fleet size
and truck dimensions, call Amazon Location Service *matrix routing* for a real road-distance
matrix, then solve a CVRP in which trucks must return to the depot.

| Concept | Adopt? | Why / how |
|---|---|---|
| Depot-returning CVRP over a **distance matrix**, not straight-line distances | **Yes, adapted** | `engine/src/routing.ts` builds a source↔source / source↔facility matrix and solves a capacitated vehicle routing problem with mandatory return to the receiving facility. |
| Vehicle **dimension** constraints (height/width/mass), not merely vehicle count | **Yes, and upgraded — the best idea in the repo** | Generalised into a volume constraint that actually binds: baled paddy straw has a bulk density near 0.15 t/m³, so a 16 t truck with 60 m³ of deck is **volume-limited to about 9 t**, not mass-limited. `effectivePayload = min(massCapacity, volume × bulkDensity)` is enforced in `routing.ts` and feeds directly back into transport emissions and cost. Models that skip this over-state truck utilisation by 40 % and more. |
| Amazon Location Service for road distances | **No** | A hard external dependency needing AWS credentials; breaks the offline demo requirement. Replaced by haversine distance × a documented road-circuity factor (1.28 for the Indian NH/SH network), with the factor exposed as a tunable assumption in the UI. |
| SageMaker-hosted solver | **No** | Same reason. The solver runs in-process. |

---

## 3. `RishvinReddy/EcoBin-Smart-Waste-Management-System`

|  |  |
|---|---|
| Licence | **NOASSERTION** — GitHub could not identify a licence |
| Language | TypeScript + Python (FastAPI, XGBoost, OR-Tools, React, PostgreSQL, Docker) |

**What it contains.** Simulated IoT bin sensors → XGBoost/Ridge forecast of tomorrow's fill
level → overflow-risk flags → OR-Tools CVRP → dark-themed React dashboard.

| Concept | Adopt? | Why / how |
|---|---|---|
| Forecast **first**, then optimise against the forecast rather than today's snapshot | **Yes** | The right architectural instinct, kept intact: `forecast.ts` runs before `optimizer.ts`, so allocation is made against *expected* supply for the planning window with the prediction interval carried through. |
| Ridge regression as the forecasting workhorse | **Yes** | XGBoost has no dependency-free JS equivalent. We implemented **ridge regression solved in closed form (normal equations + Cholesky)** over Fourier seasonal harmonics, a trend term and lag features — `forecast.ts`. It trains in-process at boot, and we report walk-forward backtest MAPE so the accuracy claim is measured rather than asserted. |
| Bin-level "overflow risk" | **Reframed** | Overflowing bins is a municipal-collection framing. The equivalent failure in a carbon network is *feedstock stranding* — waste that will be burned in-field because no feasible, economic pathway exists for it. `bottleneck.ts` reports stranded tonnes **with an attributed reason** (no capacity in radius / incompatible / uneconomic haul / fleet-limited). |
| Dark-themed card-grid dashboard | **Explicitly rejected** | Precisely the generic-AI-dashboard look this brief rules out. |
| Their source code | **No — licence unresolved** | Without a licence grant, copying is not permitted. Concepts only. |

---

## 4. `akshaya-borugadda/intelligent-waste-management`

|  |  |
|---|---|
| Licence | **None granted** |
| Size | 79 KB — effectively a README plus notebooks |

| Concept | Adopt? | Why / how |
|---|---|---|
| Compare the optimised result against the **status-quo baseline** and quantify the delta | **Yes — kept and made central** | The repo's strongest contribution. The entire demo rests on visible before/after deltas, and every optimisation result carries a `baseline` computed from a nearest-feasible-facility heuristic, which is what an operator actually does today. |
| Genetic algorithm / ACO for routing | **No** | Metaheuristics with no optimality bound. We use exact min-cost flow for allocation — which *does* give a bound and dual prices — plus Clarke–Wright with Or-opt for the vehicle layer. Strictly better and faster here. |
| IoT sensor / GPS ingestion | **Partially** | Real IoT hardware is out of scope. Sources carry a telemetry-freshness field and the System Status page states data vintage honestly rather than pretending sensors exist. |
| Their source code | **No — no licence** | |

---

## 5. `SwolfPy-Project/swolfpy`

|  |  |
|---|---|
| Licence | **GPL-2.0** (strong copyleft) |
| Language | Python, built on Brightway2 |
| Paper | *Journal of Industrial Ecology*, doi:10.1111/jiec.13236 |

**What it contains.** A full solid-waste LCA framework: process models for collection,
treatment and disposal wired into a network, with built-in parametric sensitivity and
**Monte Carlo uncertainty analysis**, plus optimisation over the waste network.

| Concept | Adopt? | Why / how |
|---|---|---|
| **Monte Carlo uncertainty on every LCA result** | **Yes — a major adoption** | Single-point carbon numbers are the credibility failure of nearly every hackathon sustainability project. `carbon.ts` runs a seeded Monte Carlo (2,000 draws) over the distributions of every emission factor and yield parameter, and the UI reports **P5 / P50 / P95** rather than a fake-precision point estimate. |
| Treating collection, treatment and disposal as one connected network with the counterfactual disposal route modelled explicitly | **Yes** | Our ledger always computes against an explicit counterfactual (in-field burning / open dung heap / landfill). Without one, an avoided-emission claim means nothing. |
| Separating *avoided emissions* from *durable removals* | **Yes — and enforced throughout** | These are not fungible. They are reported on separate lines and priced at separate market rates (durable CDR vs. VCM avoidance). Most tools in this space simply add them together, which is wrong. |
| Brightway2 / ecoinvent integration | **No** | Licensed database, multi-gigabyte, impossible offline. |
| Their source code | **No — GPL-2.0 would force the entire product to GPL** | Concepts and the uncertainty *methodology* only. |

---

## 6. `pimct/MIRA_project`

|  |  |
|---|---|
| Licence | **MIT** |
| Language | Python (ANN surrogates + PSO + Aspen Plus via COM automation) |
| Paper | Nimmanterdwong et al., *An Intelligent Plant-Wide Decision-Support Framework for Waste Valorization: Optimizing Hydrochar Production and Energy Recovery* |

**The most directly relevant of the six.** MIRA optimises hydrochar production and energy
recovery across waste streams using ANN surrogates of Aspen Plus process models driven by
particle swarm optimisation, under **CO₂-focused, revenue-focused and balanced** objectives.

| Concept | Adopt? | Why / how |
|---|---|---|
| **The three-objective framing: CO₂-focused / revenue-focused / balanced** | **Yes — adopted as the product's primary control** | Exactly the right way to expose the trade-off to an operator. We ship four modes — Carbon First, Profit First, Balanced, Logistics First — and switching them visibly re-solves the whole network. |
| **Feedstock-specific optimisation** (household-waste digestate, MSW and agricultural residue behave differently) | **Yes** | `streams.ts` carries a full proximate/ultimate analysis per feedstock (moisture, ash, C/H/N, lignin, LHV, C:N, bulk density), and pathway yields are computed *from those properties* rather than read from a flat lookup table. |
| The **`x_char` routing-fraction** decision variable — how much of the carbon stream goes to char versus to energy | **Yes, lifted to network scale** | MIRA optimises this inside a single plant. We optimise the analogous split *across an entire network*: which tonne goes to pyrolysis, AD, pellets or compost. Same idea, network level. |
| Pareto-front generation (`run_pareto.py`) | **Yes** | The Optimization screen plots a carbon-versus-profit Pareto frontier by sweeping the objective weight, so the trade-off is visible rather than asserted. |
| Particle swarm optimisation | **No** | PSO is the right tool for MIRA's continuous, non-convex, ANN-surrogate process variables. Our network allocation problem is a linear transportation problem with binary facility-opening decisions — a structure PSO would solve **worse, slower, and with no optimality bound**. We use exact min-cost flow plus branch and bound. Matching the problem structure matters more than mirroring their algorithm. |
| ANN surrogates of Aspen Plus | **No** | No Aspen Plus, no training data, and plant-level thermodynamics sits below the resolution a network optimiser needs. |

---

## Summary of what was adopted

| From | Adopted into |
|---|---|
| Puro / Azzi 2024 | Q10-corrected two-pool biochar persistence, **re-calibrated to Indian soil temperature** → `carbon.ts` |
| AWS planner | Depot-returning CVRP over a distance matrix, **generalised to volume-limited payload** → `routing.ts` |
| EcoBin | Forecast-then-optimise architecture; ridge regression → `forecast.ts`; stranding-with-reason → `bottleneck.ts` |
| intelligent-waste-management | A mandatory status-quo baseline comparison on every result |
| SwolfPy | Seeded **Monte Carlo uncertainty** (P5/P50/P95); explicit counterfactual; removals kept separate from avoided emissions |
| MIRA | **Multi-objective mode switching**; feedstock-specific pathway yields; network-scale char-routing fraction; Pareto frontier |

## Explicitly rejected

Amazon Location Service · SageMaker · OR-Tools · XGBoost · Brightway2 / ecoinvent · Aspen Plus ·
particle swarm optimisation · genetic algorithms · ant colony optimisation · PostgreSQL · Redis ·
Docker · dark card-grid dashboards.

Every rejection is either (a) unrunnable on the target machine, (b) a fragile external
dependency that would break a live demo, (c) algorithmically inferior for our problem
structure, or (d) the generic visual language the brief rules out.

## Licence position

The product contains **no code** from any studied repository. Scientific relations drawn from
the peer-reviewed literature (Woolf 2021; Azzi et al. 2024; IPCC 2006 / 2019; CEA CO₂ Baseline
Database; MNRE / SATAT tariffs) are cited at the point of use in the source. All demo data is
synthetic and is labelled as such in the UI.
