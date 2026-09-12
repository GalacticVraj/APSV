# TERRAFLUX

**Circular Carbon Network Operating System**
HackOut'26 · PS11 — Waste-to-Carbon Value Chain · Punjab · Haryana · Chandigarh

For every available tonne of residue, decide the highest-value carbon-positive
pathway: where it should go, how it should get there, how it should be processed,
what carbon and economic value that creates — and what happens when conditions change.

---

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

That is the whole setup. No Python, no Docker, no PostgreSQL, no Redis, no API keys,
and no network access required at runtime — the map geometry is embedded in the bundle
and every model runs in-process.

| Command | What it does |
|---|---|
| `npm run dev` | API on :5174 and the client on :5173, with hot reload on both |
| `npm test` | 184 tests (carbon, optimiser, logistics, forecasting, scenarios, copilot, carbon history, traceability, pathway choice, facility carbon, evidence, cross-module invariants, API validation) |
| `npm run typecheck` | Type-checks engine, API and client as one program |
| `npm run build` | Production client bundle |
| `npm start` | Builds the client and serves everything from the API on :5174 |

**Requires Node 22.6 or newer** (the API runs TypeScript directly via Node's native
type stripping — there is no build step for the backend). Verified on Node 24.19.

---

## What it does

**Optimises.** A capacitated facility-location problem with semi-continuous
throughput: a plant either runs above its minimum viable feed or does not run at all.
Branch and bound over the facility on/off decisions, with each node's relaxation solved
*exactly* by min-cost flow. The reported optimality gap is a real bound, not decoration.
The whole network solves in **25–180 ms**.

**Prices capacity.** For every binding facility the optimiser is re-run with one extra
tonne per day of headroom and the whole network re-solved. The difference is the true
marginal value of capacity — in tCO₂e *and* in rupees — including every knock-on
reallocation. It answers "where should the next rupee of capital go", which is the only
question a utilisation percentage cannot.

**Accounts honestly.** Biogenic CO₂ is excluded. Durable removal and avoided emissions
are never summed. Biochar permanence is computed from the char's H/C(org) ratio and
Q10-corrected from the 14.9 °C reference dataset to Indian soil at 26 °C, where biochar
decays about 45 % faster. Every emission factor carries its published uncertainty and a
seeded Monte Carlo reports P5/P50/P95 rather than a single fake-precision number.

**Simulates shocks.** Twelve scenario types — outage, derating, supply surge or
shortfall, fleet shortage, fuel and carbon price moves, processing cost shocks, corridor
severance, new capacity, seasonal shift, objective change. Each one mutates network state
and re-optimises **from scratch**; nothing is patched onto the previous answer. The
difference is then attributed flow by flow.

**Explains itself.** The copilot never computes a number. It selects tools, the tools
read the same twin the screens read, and every answer ships with its tool-call trace.

---

## The trade-off the product exists to expose

Paddy straw can go to pyrolysis or to pellet co-firing. Pyrolysis locks roughly 40 % of
the feedstock carbon into char that survives a century. Co-firing displaces coal
one-for-one on an energy basis.

| Paddy straw, per tonne | Net carbon | Operating margin |
|---|---:|---:|
| Slow pyrolysis → biochar | ~0.69 tCO₂e | ~₹6,100 |
| Densification → pellet co-firing | ~1.15 tCO₂e | ~₹2,500 |

**Co-firing delivers more carbon. Pyrolysis delivers more money.** Switching the
objective from Profit First to Carbon First genuinely re-routes the straw and redraws the
map — it is not a filter on a list. The Pareto frontier on the Optimization screen prices
that trade-off: moving from pure profit to pure carbon costs about **₹2,600 per tCO₂e**,
which is what you compare against the ₹10,800/t removal price to decide which
configuration is actually the profitable one.

---

## Screens

| | |
|---|---|
| **Overview** | What is happening, what changed against the status-quo baseline, and the one thing to do next with its price attached |
| **Network Map** | 42 sources, 18 facilities, live flows over real district geometry. Click anything |
| **Network Activity** | Every solve, scenario, alert and forecast refresh, in order |
| **Waste Sources** | Inventory, feedstock properties, and a per-source supply forecast with measured backtest error |
| **Facilities** | Utilisation, carbon intensity, unit economics, and whether capacity is the binding constraint |
| **Logistics** | Routes, fleet, and the trip penalty low bulk density imposes |
| **Optimization** | Search space, rejection reasons, solver telemetry, Pareto frontier, rejected alternatives |
| **Scenarios** | Controls left, live network centre, impact right, before/after along the bottom |
| **Bottlenecks** | Shadow prices, stranding with attributed causes, N-1 resilience |
| **Copilot** | Grounded operational Q&A with a visible tool-call trace |
| **Carbon** | The ledger, permanence model and uncertainty band |
| **Economics** | Margin by pathway and facility, and the marginal abatement cost curve |
| **System & Data** | Live assumptions you can move, every factor with its citation, and stated limitations |

Press **Demo** in the header for the guided three-minute walkthrough. It drives the real
application — switching objectives, running scenarios — rather than playing a recording.

---

## Architecture

```
packages/engine    Domain model, carbon science, optimiser, forecasting.
                   Pure TypeScript. Zero runtime dependencies. 184 tests.
packages/api       HTTP API on Node's built-in server. Zero dependencies.
packages/web       React + Vite client. Custom SVG map and charts, no chart library.
```

The engine is consumed **as source** by both the API (via Node's native type stripping)
and the client (via Vite), so there is exactly one implementation of the domain model and
no build step between them to fall out of sync. The copilot and the screens read the same
twin, which is why a number cannot differ between a chart and an answer.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design, [ANALYSIS.md](ANALYSIS.md)
for the modelling decisions and their justification, and [RESEARCH.md](RESEARCH.md) for
the study of the six reference repositories and what was adopted from each.

---

## Honesty notes

- **All entity names, volumes and capacities are synthetic.** District coordinates are
  real. No claim is made about any real operator.
- Emission factors, prices and scientific relations are cited from published sources at
  the point of use in the code and reproduced on the System & Data screen.
- Road distances are great-circle × a documented circuity factor, not routed over a road
  network.
- Supply history is generated from a documented crop calendar. The forecasting model is
  real and its accuracy is honestly measured — against generated data.
- Biochar permanence is modelled, not measured. A real credit would require analysis of
  the actual char.
- Network state lives in the API process's memory. Restarting the API resets it to
  baseline, which is also what the Reset button does.

Full list on the System & Data screen under *Honest limitations*.
