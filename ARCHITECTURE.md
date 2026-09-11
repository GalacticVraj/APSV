# ARCHITECTURE

## The constraint that determined everything

The target machine has **Node v24.19.0 and no Python interpreter**. Four of the six
reference repositories for this problem are Python. A FastAPI + OR-Tools + scikit-learn
stack — the conventional answer — cannot execute here at all.

Rather than treat that as a limitation to work around, it became the design principle:
**the product must start and run with nothing but `npm install`.** No Python, no Docker,
no PostgreSQL, no Redis, no message broker, no external API, no tile server, no
credentials. A demo that cannot start is worth zero regardless of what is inside it.

Everything below follows from that.

---

## Shape

```
┌──────────────────────────────────────────────────────────────────┐
│  packages/web        React + Vite                                │
│    · custom SVG map over embedded district geometry              │
│    · custom SVG charts (no charting library)                     │
│    · 60-line router, React context for state                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │  JSON over HTTP (Vite proxy in dev)
┌───────────────────────────────┴──────────────────────────────────┐
│  packages/api        node:http + a hand-rolled router            │
│    · zero dependencies                                           │
│    · holds one Twin instance                                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │  direct function calls
┌───────────────────────────────┴──────────────────────────────────┐
│  packages/engine     pure TypeScript, zero runtime dependencies  │
│                                                                  │
│   streams ─┐                                                     │
│   pathways ─┼─► optimizer ─► mincostflow                         │
│   network ──┤       │                                            │
│   carbon ───┤       ├──► routing                                 │
│   economics ┘       ├──► bottleneck ──► resilience               │
│   forecast ─────────┤                                            │
│   scenario ─────────┘                                            │
│   state (Twin) ── memoises every derived artefact                │
│   copilot  ────── tools over the Twin                            │
└──────────────────────────────────────────────────────────────────┘
```

### One engine, consumed as source

The engine is imported **as TypeScript source** by both sides:

- the **API** runs it through Node's native type stripping (`--experimental-strip-types`),
  so there is no build step for the backend at all;
- the **client** imports the same files and Vite compiles them.

This is why the copilot and the screens can never disagree about a number: there is one
implementation of the domain model, and no compiled artefact between them that could go
stale. It also means editing a model file hot-reloads both processes.

The cost is a constraint on how the engine is written — no enums, no namespaces, no
parameter properties, and explicit `.ts` extensions on every import. That is a small price.

---

## The optimiser

### Problem structure

Choose which facilities operate (binary), then how much of each source's feedstock goes
to each operating facility (continuous). A facility runs above its **minimum viable feed**
or not at all — semi-continuous throughput. Formally a capacitated facility-location
problem with semi-continuous variables.

### Method

**Branch and bound over the facility on/off decisions. Each node's relaxation solved
exactly by min-cost flow.**

```
root: every online facility available, no lower bounds
  └─ solve by min-cost flow  → LP bound
     └─ any facility running below its minimum viable feed?
          no  → integer-feasible, candidate incumbent
          yes → branch on the worst violator:
                  child A: that facility does not run  (capacity → 0)
                  child B: that facility must reach its minimum feed
```

Best-first expansion, pruned against the incumbent. Typically converges in **1–7 nodes**
on this network.

### Why min-cost flow and not a metaheuristic

Once the operating set is fixed, allocation is a transportation problem: linear, with an
integral optimal solution. Min-cost flow solves it **exactly**. A genetic algorithm or
particle swarm would solve the same problem approximately, more slowly, and with no bound.

The bound is not academic. It buys three things a heuristic cannot:

1. an honest optimality gap on screen rather than an unfalsifiable claim;
2. **shadow prices** — the single most actionable output in the product;
3. reproducibility, because there is a unique optimum to land on.

Implementation: successive shortest paths with **Johnson potentials**. Arc costs are
negative (we maximise value), so the potentials are seeded with one SPFA pass and every
subsequent shortest path is found by Dijkstra on non-negative reduced costs.

### Determinism

Objective values are scaled to **integers** before reaching the solver. Floating-point
tie-breaks are the classic source of "the same seed gave a different answer"; integer
comparison removes the failure mode entirely. Every stochastic element in the system —
synthetic history, Monte Carlo draws, entity jitter — derives from one seed.

### Multi-objective handling

Four modes, scalarised against normalisation constants derived from the arc set:

| Mode | Objective |
|---|---|
| Carbon First | max net tCO₂e, with a margin term four orders of magnitude below it purely to break ties |
| Profit First | max operating margin |
| Balanced | 0.5 × normalised carbon + 0.5 × normalised margin |
| Logistics First | normalised carbon − 0.55 × normalised tonne-km + 0.15 × normalised margin |

The Pareto frontier is generated by sweeping the weight from 0 to 1 in eleven steps,
**re-solving at each point**. It is not an interpolation between two endpoints.

### Shadow prices by re-optimisation

For each binding facility: add one tonne per day of headroom, re-solve the entire network,
record the difference in objective, in net tCO₂e and in rupees.

This is deliberately *not* an LP dual read off a single basis. With binary facility
decisions in play, a dual describes the current basis only; re-optimisation captures the
knock-on reallocations that actually determine whether extra capacity is worth building.
Cost: 12–18 extra solves, about 50 ms.

---

## Carbon

Three commitments, each of which costs a headline number and buys defensibility:

**Biogenic CO₂ is not counted.** Residue carbon that burns returns to the atmosphere it
came from in the same growing season. Only CH₄ and N₂O are a genuine addition. This is why
avoided-burning credit lands near 0.07 tCO₂e per tonne, not the ~1 tCO₂e frequently
claimed for stubble diversion.

**Durable removal and avoided emissions are never summed.** They are different
commodities with roughly a twentyfold price gap (₹10,800/t vs ₹520/t). They are reported
on separate lines and priced separately in the economics.

**Permanence is computed, not assumed.** Two-pool first-order decay parameterised by the
char's H/C(org) ratio, with decay rates Q10-corrected from the harmonised 14.9 °C
reference dataset to the local soil temperature. At 26 °C the rate ratio is 1.447 — biochar
decays about 45 % faster in Indian soil than the European default implies.

### Computation path

```
feedstock properties ─► pathway yields ─► PhysicalPerTonne inventory
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
                 per-arc evaluation                         network aggregate
             (prices arcs for the solver)                  (builds the ledger)
```

Both paths consume the same physical inventory and are asserted equal in the test suite.
Separating physical quantities from emission factors is what lets the Monte Carlo perturb
2,000 factor sets without re-running any process model.

### Uncertainty

Every factor carries a published relative uncertainty. Draws are **lognormal** — emission
factors are strictly positive and right-skewed, and a normal draw can go negative and
silently produce nonsense. Seeded, so the band is reproducible.

---

## Logistics

The constraint that actually binds is **volume, not mass**. Baled paddy straw is
0.15 t/m³, so a 16-tonne truck with a 58 m³ deck carries 8.7 t.

```
achievable payload = min(mass rating, deck volume × feedstock bulk density)
```

This propagates into transport cost per tonne, transport emissions per tonne, trip counts
and fleet utilisation. A mass-only model over-states fleet capacity by 40 %+ on crop
residue. The Logistics screen reports the trip penalty explicitly.

Vehicle choice is not hard-coded: the optimiser picks whichever legal vehicle minimises
cost per tonne on each arc, which is why tractor-trolleys win short rural hauls and trucks
win highway hauls as an emergent result.

Routing: full truckloads go direct (a full load gains nothing from an extra stop);
residual part-loads are consolidated by **Clarke–Wright savings** under both mass and
volume limits, then improved with **Or-opt**. Every tour returns to the receiving facility.

---

## Forecasting

Ridge regression on three Fourier seasonal harmonics, a linear trend and two
autoregressive lags, solved in closed form by Cholesky decomposition of the regularised
normal equations. Trains in under a millisecond per source.

A gradient-boosted model would forecast marginally better and explain itself considerably
worse. When someone asks why the forecast says what it says, inspectable coefficients are
worth more than a fraction of a point of accuracy.

Accuracy is **measured** by walk-forward backtest over twelve folds and reported as MAPE.
Nothing in the product asserts an accuracy it has not measured.

---

## The digital twin

`Twin` holds authoritative network state and memoises every derived artefact against a
version counter. Changing the objective, an assumption, or committing a scenario bumps the
version and invalidates the cache.

State is in-process memory. There is no database because there is nothing to persist: the
network is seeded deterministically, and a restart producing exactly the baseline state is
a feature, not a gap. A database would add a failure mode and buy nothing a demo needs.

---

## Scenarios

A scenario mutates a **clone** of network state and the result is re-optimised from
scratch. Nothing is patched incrementally, so the after-state is exactly what the optimiser
would have produced had the world always looked that way.

The diff then attributes flow by flow, pairing drops with adds of similar size so a
genuine re-route is reported as a re-route rather than as an unrelated drop plus an
unrelated add.

Preview does not touch live state; Apply does, and the header shows the network is off
baseline until reset.

---

## Copilot

**The language layer never computes a number.** It classifies intent, resolves entities
against real network objects, calls tools, and assembles an answer from what they return.
Every response ships with its tool-call trace, so the chain from question to figure is
auditable.

Fifteen tools over the Twin — the same functions the screens call. Because there is one
source of truth, an answer cannot disagree with a chart.

The deterministic path is the product and works entirely offline. An LLM could be layered
over the identical tool set; the numbers would be identical because they come from the
same tools, and only the phrasing would differ.

---

## Client

**Custom SVG map.** Real district geometry for Punjab, Haryana and Chandigarh plus
surrounding states, simplified with Douglas–Peucker and embedded in the bundle (131 KB).
No tile server, so the map cannot fail in front of an audience, and we keep complete
control over how flows animate.

Two details worth noting. Web-Mercator northing is expressed in degree-equivalents
(the 180/π factor) so both axes share one uniform scale — without it the map is squashed
sixfold. And `vector-effect: non-scaling-stroke` is deliberately *not* used on the ~340
district paths, because recomputing stroke geometry per path per frame stalls the
compositor; stroke widths are divided by the zoom factor instead.

**Custom SVG charts.** No charting library. The page must work offline, the visual
language has to match the rest of the product exactly, and each chart answers one specific
analytical question — a general-purpose charting API would mostly be in the way.

**Loading states name the computation.** "Running 2,000 Monte Carlo draws over every
emission factor" rather than a spinner. The wait is real work; saying so is both more
honest and more interesting.

---

## Security

Environment variables for configuration, no hard-coded secrets, no credentials anywhere in
the product. Request bodies are size-capped and JSON-validated. Every API input is
validated against an allow-list — objective modes, scenario kinds, and assumption keys
with explicit numeric bounds — and rejected with a specific message rather than a stack
trace. CORS is restricted to localhost origins. Static file serving is confined to the
build directory with path normalisation. Errors are logged server-side; clients receive a
message, never a stack.

There is no authentication because there is no multi-tenancy, no user data and no
persistence — adding auth would be security theatre rather than security.

---

## Performance

| Operation | Time |
|---|---|
| Full network optimisation | 25–180 ms |
| Shadow prices (12–18 re-solves) | ~50 ms |
| Monte Carlo, 2,000 draws | ~25 ms |
| Forecast, 42 sources with backtests | ~45 ms |
| Scenario: baseline + mutate + re-solve + diff + re-scan | ~150 ms |
| N-1 resilience over the operating set | ~60 ms |
| Cold API start including first solve | ~150 ms |

The client memoises derived views and the Twin memoises derived artefacts, so navigating
between screens triggers no recomputation.
