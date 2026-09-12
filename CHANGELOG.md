# CHANGELOG

Implementation milestones for TERRAFLUX, in build order.

---

## Phase 0 — Research and architecture

- Studied the six reference repositories via the GitHub API; recorded findings, licence
  positions and adopt/reject decisions in [RESEARCH.md](RESEARCH.md).
- Established the binding environment constraint: **the target machine has Node 24 and no
  Python interpreter**, making a FastAPI + OR-Tools stack unrunnable. Committed to a pure
  TypeScript, zero-external-dependency architecture.
- Inspected the existing repository contents. The prior branch held a marketplace CRUD
  application (role dashboards, auth, notifications) requiring PostgreSQL, Redis, SMTP and
  an OpenAI key — the "waste marketplace + dashboard + chatbot" shape the brief rules out.
  Retained its emission-factor citations as reference; built the product fresh.

## Phase 1 — Foundation

- `types.ts` — full domain model, written for Node's native type stripping.
- `rng.ts` — seeded mulberry32, Box–Muller normals, lognormal and triangular draws.
  Every stochastic element in the system routes through here.
- `geo.ts` — haversine, road circuity by road class, Web-Mercator projection.
- `streams.ts` — nine feedstocks with full proximate/ultimate analysis; derived biochar
  yield, char carbon content and H/C(org); four counterfactual fates with IPCC factors.
- `pathways.ts` — five conversion pathways with hard gates and soft suitability; yields
  computed from feedstock properties rather than looked up.
- `constants.ts` — every emission factor, price and assumption with its source string and
  published uncertainty. The System & Data screen renders these objects directly.
- `network.ts` — 42 sources and 18 facilities across real Punjab/Haryana/Chandigarh
  district coordinates, deterministically jittered. All entity data synthetic.

## Phase 2 — Core intelligence

- `carbon.ts` — Q10 temperature correction (Woolf 2021), two-pool decay parameterised by
  H/C(org) (Azzi 2024), the full traceable ledger, and seeded Monte Carlo uncertainty.
- `economics.ts` — per-tonne revenue and cost lines mirroring the carbon ledger, sharing
  the same physical inventory so the two can never describe different amounts of material.

## Phase 3 — Optimisation

- `mincostflow.ts` — successive shortest paths with Johnson potentials. First written with
  multi-path DFS blocking augmentation, then **rewritten**: zero-cost cycles in the
  admissible subgraph made that variant able to terminate early on a non-optimal solution.
  The Dijkstra-with-potentials form is provably correct and faster here.
- `optimizer.ts` — arc generation with counted rejection reasons, four-mode objective
  scalarisation, branch and bound over facility operation, shadow prices by
  re-optimisation, and a status-quo baseline for comparison.

## Phase 4 — Model calibration

Two corrections after the first end-to-end solve:

- **Pellet ash gate 14 % → 20 %.** At 14 % paddy straw failed the gate entirely, which
  contradicts Indian co-firing policy (NTPC tenders specifically target paddy straw).
  Raised the gate and let the suitability penalty carry the slagging risk instead. This
  unlocked 15,000 t of pellet capacity and revealed the carbon-versus-profit tension that
  the product is now built around.
- **Composting emission factors.** The IPCC default (4 kg CH₄/t wet) is drawn largely from
  poorly aerated static piles and made composting look worse than the open heap it
  replaces — an artefact of the aeration assumption. Switched to turned-windrow rates
  (1.8 kg CH₄, 0.15 kg N₂O) and documented the change at the point of use.

## Phase 5 — Logistics

- `routing.ts` — volume-limited payload, Clarke–Wright savings on residual part-loads,
  Or-opt improvement, closed tours returning to the receiving facility. Reports the trip
  penalty that low bulk density imposes.

## Phase 6 — Forecasting

- `forecast.ts` — crop-calendar-driven synthetic history with an AR(1) weather shock;
  ridge regression on Fourier harmonics, trend and lags via closed-form Cholesky;
  walk-forward backtest reporting measured MAPE.

## Phase 7 — Digital twin and scenarios

- `bottleneck.ts` — stranding with attributed causes, bottleneck detection with quantified
  consequences and priced actions, N-1 contingency resilience scoring, opportunity scores.
- `scenario.ts` — twelve scenario types, clone-and-re-solve semantics, flow-level diff
  attribution that pairs drops with adds so a re-route reads as a re-route.
- `state.ts` — the Twin: authoritative state with version-keyed memoisation of every
  derived artefact.

## Phase 8 — Copilot and API

- `copilot.ts` — fifteen tools over the Twin, intent classification, entity resolution,
  and grounded answer composition. The language layer never computes a number.
- `packages/api` — Node's built-in HTTP server with a hand-rolled router, zero
  dependencies, allow-list validation on every input.

## Phase 9 — Client

- Design system: ruled rather than carded, one accent colour used only where it encodes
  state, tabular figures throughout. No glassmorphism, gradients, KPI-tile grids or
  rounded cards.
- Custom SVG map over real district geometry (Douglas–Peucker simplified, 131 KB embedded).
- Custom SVG chart set: forecast with uncertainty band, waterfall, Pareto scatter,
  histogram, stacked bar, sparkline, decay curve, marginal abatement cost curve.
- Thirteen screens plus a guided demo that drives the live application.

## Phase 10 — Hardening

- **75 engine tests** across carbon, optimiser, min-cost flow, logistics, economics,
  forecasting, scenarios, bottlenecks, resilience and copilot grounding. All passing.
- Zero TypeScript errors across engine, API and client compiled as one program.
- UI reviewed in-browser and fixed:
  - **Map projection.** Longitude was in degrees while Mercator northing was in radians,
    compressing the map about sixfold. Both axes now share degree-equivalents.
  - **Map layout.** The SVG grid row was auto-sized, so the map fell back to its intrinsic
    aspect height and overflowed the viewport. Row pinned to `minmax(0, 1fr)`.
  - **Map performance.** `vector-effect: non-scaling-stroke` on ~340 district paths stalled
    the compositor. Replaced with explicit zoom-divided stroke widths.
  - **Label collision.** Facility labels overlapped in clustered districts. Added greedy
    label placement: largest plants claim space first, colliding labels are dropped, and
    they reappear as the map zooms.
  - **Overview consistency.** The headline bottleneck and the shadow price beside it could
    describe different facilities. Now pinned to the same asset.
  - **Scenario controls.** The run controls fell below the fold on a short viewport; pinned
    to the bottom of the panel.
  - **Waterfall overflow.** Rotated category labels escaped their panel; chart moved to
    full width with corrected label geometry.
  - **Header degradation.** Status fields now shed from least to most important as width
    tightens, rather than wrapping and stealing vertical space from the map.
  - **Solver telemetry.** Ten-digit scaled objective values rendered with Indian digit
    grouping were noise; shown in exponential form.
- Explained the counterintuitive result rather than hiding it: the optimiser diverts less
  tonnage than the status-quo heuristic *on purpose*, and the Overview now says why.

## Phase 11 — Input validation

- **Scenario parameters were the one unvalidated input.** `/api/scenario` checked the
  scenario kind against the definition list but forwarded `params` untouched. A scenario
  posted without its parameters reached the solver with `undefined` where a price belonged;
  that became NaN, every arc cost became NaN, nothing could be placed, and the API answered
  **200 with a fully formed result claiming carbon had fallen 100%** and a label reading
  "Durable CDR at ₹NaN/tCO₂e". Nothing threw, so nothing surfaced it.
- `packages/api/src/validate.ts` now validates against the scenario definition itself —
  the same metadata the client renders its controls from, so there is no second copy of the
  rules to drift. Unknown keys, non-numeric numbers, out-of-bounds numbers and choices
  outside the declared options are rejected with the reason; an absent parameter falls back
  to the definition's default rather than reaching the solver undefined.
- **10 validation tests**, including two that sweep every scenario: each accepts all of its
  declared choices and both of its numeric bounds, and every parameter is finite when
  nothing is supplied. Engine plus API now stands at **85 tests**; `npm test` runs both.

## Phase 12 — Carbon Home

The Carbon vertical gets its own section. `/carbon` becomes a decision surface; the
existing ledger screen moves intact to `/carbon/ledger`.

- **The missing time axis.** The optimiser solves one window, which answers "how much"
  but not "is this getting better". `history.ts` supplies the axis without inventing it:
  `generateHistory` already produces a real weekly supply series per source, so for each
  of the last twenty weeks the module sets availability to that week's observed rate and
  re-runs **the real optimiser and the real ledger**. Every point on the trend is a genuine
  solve, not a curve drawn through the headline. Twenty solves cost ~350 ms with shadow
  prices and alternatives skipped, memoised on the twin version like every other artefact.
- Each point is expressed **per planning window at that week's supply rate**, so the trend
  and the hero figure can never disagree about what they measure. Only supply varies —
  prices, assumptions and the estate are held, because no history exists for them, and the
  basis string on the page says so rather than letting the reader over-read the line.
- **Change attribution** is a difference of two measured means per ledger group, so the
  drivers reconcile to the net change. The "what changed" sentence is a rendering of that
  list and nothing else: lead driver, the physical throughput shift behind it, and an
  offsetting driver **only when one genuinely pushed the other way**.
- The screen: one hero figure with its Monte Carlo band and period delta; the ledger
  regrouped into six interactive terms that open into contributing material, facilities,
  pathways, transport, factors and citations; a proportional carbon flow that marks where
  tonnes become tCO₂e rather than pretending one ribbon runs throughout; a five-item ruled
  attention strip; and the trend beside the narrative. No KPI card grid.
- Removal, avoidance and substitution stay on separate rows throughout, and every drill-down
  closes with an explicit **"Modelled estimate — not measured, not verified, not a carbon
  credit."**

Caught in review rather than shipped:

- **Two rows, one label, two numbers.** The decomposition's gross removal term and the hero's
  net durable-removal line both read "Durable removal" while showing 4,299 and 3,512. Renamed
  to "Carbon fixed in biochar" and "Durable removal (after permanence)".
- **`.g2` without `.grid`** left the trend at full width, scaling its SVG ~2× so axis labels
  rendered as headings.
- **Three identical bars.** Collection, Transport and Processing all showed the same tonnage.
  The haulage and plant stages now carry their own carbon charge instead.
- Narrative figures printed raw (`12564`); now grouped Indian-style like the rest of the product.

**19 history tests**, including that emission drivers are signed as charges, that drivers
reconcile to the period change, and that an offset is never claimed unless a driver actually
opposed the lead. Engine and API now stand at **104 tests**.

## Phase 13 — Carbon Ledger

Rebuilt from a ledger table into a trace system. The question it answers is "where
exactly did this number come from", and it has to survive someone who does not believe it.

- **The decision that makes it defensible.** Tracing one truckload could have been a
  second, simpler carbon calculation. That would have been the worst option available:
  two calculations drift, and the moment they disagree the product's central claim is
  gone. Instead `trace.ts` runs the same three functions the network ledger uses —
  `physicalPerTonne` → `addToAggregate` → `buildLedger` — with one allocation in the
  aggregate instead of several hundred. Traced lines carry the same keys, bases and
  citations, and **sum into the network lines by construction rather than by agreement**.
  Verified to 1e-6 across all five ledger groups.
- **Permanence is taken from the network's dominant feedstock, not the allocation's own.**
  Using the allocation's own stream gives a marginally better estimate for that load and
  breaks the reconciliation — the first attempt did exactly that and came out 1.67% off on
  durable removal. A trace has to explain the number the network computed, not a better one.
- **Provenance** names the physical input each line consumed, the factor applied and that
  factor's published source, read from the same constants the solver used. Quoted at the
  same scale as the ledger's own basis string (GJ, MWh) so a provenance row can never
  contradict the line above it.
- **Follow carbon** — pick any contribution and it is traced through waste, collection,
  haulage, the receiving plant, conversion and processing, with carbon booked at the stage
  that physically causes it. Stages reveal in causal order and the running total moves as
  each lands, so the reader watches carbon accrue and then be charged rather than being
  handed a finished figure. Following a contribution **dims the ledger lines it does not
  feed** — the link between one truckload and the network total is shown, not asserted.
- Route geometry is drawn from the real coordinates, labelling road distance and straight
  line separately because the carbon was charged on the former.
- Evidence is a contextual panel, never a modal, so a line and its evidence are read
  together. Empty states distinguish "no provenance recorded" from "this did not occur in
  this plan" — different problems, stated differently, neither filled with a guess.

Caught in review:

- **Provenance contradicted its own line.** Coal energy rendered as `18,69,08,180 MJ` under
  a basis line reading `186908 GJ`. Same quantity, two scales, in a panel whose entire job
  is trust. Aligned to the ledger's scales.
- **A stage narrated a cost it did not carry.** Collection described raking and baling while
  that emission is charged under transport. Rewritten to describe the diversion it is
  actually credited for.
- Route distance label clipped at the top of its viewBox on short geometry; dimmed picker
  rows were too faint to still function as controls.

**20 trace tests**, led by the reconciliation check. Also: no carbon booked twice across
stages, every factor row cites a source, provenance never describes a line the plan did not
produce, and the generated explanation never claims verification or measurement. **124 tests.**

## Phase 14 — Carbon Pathways

A decision instrument, not a catalogue of waste-treatment methods. The page answers:
given THIS material at THIS source, under the network as it stands, which feasible
pathway produces the best carbon outcome, and what is given up by choosing it.

- **The decision unit is a source, not a stream.** A stream has no geography; a source
  has a tonnage, a road and a set of reachable plants, which is what makes the question
  answerable at all.
- **Everything is read from the optimiser's own arc set.** `buildArcs` already decides
  which pairs are legal, which gates fail, which vehicle can run the road and what a
  tonne is worth. `pathwaychoice.ts` picks among those arcs under the chosen lens and
  builds the carbon breakdown from `ArcSet.physical` through the same `buildLedger` the
  network ledger uses. The ledger and the arc valuation agree to **2.2e-16**.
- **Lenses reuse the real objective modes** — the same `arcValue` scalarisation the solver
  uses, so switching to Economic genuinely reorders the ranking rather than re-sorting a
  column.
- Infeasible pathways are shown with the gate that excluded them ("Moisture: 13% vs window
  55–95%"), and pathways that pass their gates but have no destination say which of the
  five possible reasons applies. "No result" and "excluded because…" are different answers.
- The flip shows what changed in the network, not just a number: facility, haul distance
  and carbon outcome all move, and only the components that **actually differ** are listed
  as drivers.
- Carbon best and economic best are named separately, with the exchange rate between them
  stated when they diverge. No threshold for "what would change the decision" is asserted,
  because the engine cannot solve for one — the page says so and links to Scenarios.

Caught in review:

- **Avoidance and substitution were double-counted.** `Arc.avoidedPerT` is
  `avoided + substitution` — a sound simplification for ranking arcs, but this screen
  reported avoidance with substitution folded inside it and then reported substitution
  again alongside. The flip showed both drivers with identical values, which is what gave
  it away. Every component now comes from the ledger; components reconcile to net at 2.2e-16.
- `.rk-name > :first-child` styled the **tag row** rather than the pathway name, because
  the name was a bare text node. Found by querying the DOM, not by looking.
- Dimming the unselected row to 0.5 made the comparison hard to read — a comparison that
  dims its alternatives stops being a comparison.
- Source and facility often share a district, so the route drew two dots both labelled
  "Sangrur". The plant is now named.

**22 decision tests**, including that avoidance and substitution are never taken from the
arc field, that an infeasible pathway carries no partial result, that a trade-off is stated
only when the two bests genuinely differ, and that no explanation claims verification or
credits. **146 tests.**

## Phase 15 — Carbon Facilities

The Carbon Manager's lens over the plant network, not a facility operations dashboard.
Which plants help the net figure, which drag on it, and why.

- A facility's ledger is built from the allocations arriving at it, through the network's
  own `buildLedger` under the network's BC₁₀₀ — so the facilities **sum to the network
  figure exactly** and a plant's carbon story is a decomposition rather than a second account.
- **Each feeding arc is built the same way.** The first attempt read `Allocation.netCarbonT`,
  which the optimiser computes with the arc's own permanence: the arcs summed to **84%** of
  their facility, and the same haul would have shown one number here and another in the
  Carbon Ledger. Arcs now sum to 100%, and an arc reads **2770.8029 on both screens**.
- Transport is apportioned across arcs by their own tonne-kilometres — what the emission is
  actually proportional to — not by tonnage or by headcount.
- **Transport vs processing** is the page's central comparison, as a waterfall from gross
  benefit to net, with the dominant charge named in words.
- Opportunities appear **only where the engine can price them**: idle capacity with stranded
  material that has a real arc, and binding capacity where the shadow price was measured by
  re-optimisation. Each carries the reason the optimiser did not already take it — an
  "opportunity" the solver rejected for a good reason is a misleading recommendation
  unless that reason travels with it.
- Comparison is arc-for-arc where two plants share a source, and says plainly when they do
  not: aggregate averages describe different material and are not like-for-like.
- Idle plants report **zero, not nothing** — capacity and reachability are still real.

Cross-linking rather than duplication:

- The router now carries a query string (`path` stays pathname-only, so route lookup cannot
  see it), and the Carbon Ledger accepts `?source=…&facility=…`. Facilities hands a specific
  contribution to the existing trace instead of reimplementing it: the reader lands already
  following that tonne, with the ledger lines it feeds lit.
- `history.ts` now carries per-facility net carbon per week, from the same weekly re-solve
  and under the same basis statement — no new claim about measured history.

**20 facility tests**, led by the two reconciliations (facilities to network, arcs to
facility) and by an explicit cross-check that an arc shows the same figure here as in the
Ledger trace. Also: opportunities only where headroom or a binding constraint actually
exists, offline plants given no advice, and idle plants never implying a result. **166 tests.**

## Phase 16 — Carbon Evidence (MRV)

"Can I defend the basis of this number." Deliberately plainer than the rest of Carbon:
type, rules and status words, because a page about evidence that looks like a marketing
dashboard has already lost the argument.

- **Backward tracing**, the mirror of the Ledger's forward trace. Given a ledger line,
  which allocations produced it and in what proportion — built by running each allocation
  through the same `buildLedger` and reading the same line key, so contributors sum to the
  line exactly (3.6e-12) and shares total 100%.
- **No trust score.** Nothing defensible compresses into a percentage, so the health view
  counts what is countable and says the rest in a sentence. It prints **0 measured, 0
  estimated, 13 modelled, 0 missing** — a page about evidence has to be willing to print zeros.
- What *can* be classified honestly is each **input**: 14 apply a factor with a published
  citation, 1 is a modelling assumption stated at the point of use, 16 are quantities the
  model itself produced. Read off the data rather than hand-tagged.
- The "no gaps" result is stated with its caveat: it checks provenance coverage, not data
  quality, and the absence of a missing-input model is a property of a generated dataset
  rather than a clean bill of health.
- Audit timeline uses the timestamps the twin actually recorded. No history is reconstructed
  for periods the twin did not run.
- The Ledger's evidence panel now links to the same record here — one key, one calculation,
  one trace. Verified end to end: a ledger line opens in Evidence with the same value and the
  same calculation string.

**The trust invariant** (`invariant.test.ts`, 18 cross-module tests) is the important
addition. Per-module suites check each piece is internally consistent; this one checks the
pieces agree with each other, which is the failure they cannot see. It verifies the whole
network reconciles from **three independent decompositions** — by facility, by allocation and
by ledger line — plus the six required components, that avoidance and substitution are never
the same quantity, that transport and processing partition the emission lines with nothing
left over, and that no module reports a charge as a benefit. **184 tests.**

Caught by looking, not by asserting:

- **`button.btn` excluded anchors.** Every `<Link className="btn">` across Pathways,
  Facilities and Evidence — seven of them — rendered as plain text. Only visible in a
  screenshot; no DOM assertion would have flagged it.
- Count chips read "14 published **factor**" and "16 model-derived **quantity**".

## Phase 17 — Carbon Opportunities

"Where can the network create more net carbon, and what change would do it."

- **An opportunity is a scenario.** Not a heuristic, not a threshold rule, not a score.
  Each candidate is a real `ScenarioInstance` that the existing scenario engine applies to a
  clone of the network and re-optimises; the improvement is the difference between two
  ledgers built from two real solves. 15 candidates, ~300 ms, memoised.
- Three consequences: nothing is extrapolated; **"Simulate" cannot drift**, because the
  Scenarios screen receives the identical instance that was measured; and rejected
  candidates keep their measured figure. "Solving on Profit First would cost 3,156 tCO₂e"
  is useful and would be dishonest to hide behind a list of only the wins.
- Every item states **why the optimiser has not already taken it**, read from real state —
  a binding capacity constraint, or the objective in force. An opportunity without that is
  a misleading recommendation.
- The top finding on this network: **+1,410 tCO₂e from 40 t/day more at Jagraon Pellet
  Plant**, which also earns ₹27.05 L. Re-solving on Carbon First gains +275 tCO₂e but costs
  ₹50.21 L — shown with an amber verdict rather than presented as a free win.
- Deep link `/scenarios?kind=…&params` so the change carries into simulation; Scenarios
  adopts it once, then behaves normally.

**Two real bugs found while building it**, both the same class and both caught by an
invariant rather than by eye:

- **`totals.netCarbonT` is not the ledger figure.** The optimiser aggregates each
  allocation under its own permanence and reads **31,736** against the ledger's **34,921**.
  Every "share of network net carbon" divided by it — in Facilities and in the Ledger's
  trace candidates — was inflated by about a tenth, and nothing looked wrong. A new
  `networkLedger()` helper now gives one authoritative denominator.
- **The Ledger's candidate list disagreed with the trace it opened.** A row read 2,290 while
  the trace behind it read 2,771, for the same haul, for the same reason. Candidates now
  carry their own per-allocation ledger.

**18 opportunity tests**, including that re-running a handed-over scenario reproduces the
reported delta exactly, that the after-state equals the ledger of the re-optimised plan,
that a change costing carbon is never listed, and that no text claims a guaranteed
reduction. Plus a new cross-module invariant that shares total 100% against the ledger.
**203 tests.**

## Phase 18 — Carbon Scenarios (shock engine)

The screen that proves this is a twin rather than a report: change one real constraint,
and the whole network re-solves into a different physical decision.

- **No new simulation.** `runScenario` already clones the network, applies a
  `ScenarioInstance` and re-optimises; `shock.ts` adds the carbon reading of that result.
  All twelve existing scenario types work, unchanged.
- **The decomposition is a ledger diff.** Rather than attributing the change to categories
  invented for the chart, the two ledgers are differenced line by line — so the drivers sum
  to the net change by construction, with no residual and no "other" bucket. Verified to 1e-11.
- **Objectives are each measured against their own baseline.** Comparing a carbon-first
  scenario against a balanced baseline would charge the objective switch to the shock. The
  four rows start from four different numbers, visibly.
- The network response leads with what physically moved: source, plant before, plant after,
  distance change, carbon change — each row tracing into the Ledger.
- Constraints that flipped are read from the optimiser's own shadow prices before and after,
  not inferred from utilisation.

**The bug this module was built on top of.** `buildDeltas` read
`OptimizationResult.totals.netCarbonT`, so the Scenarios screen reported **+1,174 tCO₂e**
for the same capacity change Carbon Opportunities measured at **+1,410** — a 20% disagreement
between two screens about one change, live in the product. A facility outage was 620 tCO₂e
apart. `buildDeltas` now takes the network and uses `networkLedger()`; every carbon figure
in the scenario engine is the ledger's.

**21 shock tests**, led by the two that matter most: a shock never mutates the baseline
network, and never mutates the baseline solve. Also that an opportunity and its simulation
report the identical change, that drivers reconcile with no residual, that avoidance and
substitution stay separate across the diff, and that a constraint is only reported as
flipped when the optimiser says it flipped. **224 tests.**

## Phase 19 — Carbon Intelligence Brief

The synthesis layer. A judge should be able to answer six questions here in a minute
without opening another screen, then open the module that owns each detail.

- **The brief computes nothing.** Every figure is read from the module that already owns
  it — ledger, history, opportunity sweep, shock engine, facility ranking, evidence
  register, N-1 resilience. A report that recomputes anything is a second opinion with
  editorial authority, and it will eventually disagree with the screen it summarises.
- Written as a document rather than a dashboard: one column, editorial rules, capped
  measure, and a reading order that matches how the decision is made. No cards, no KPI grid.
- The resilience section reuses the existing N-1 analysis for **selection** and the shock
  engine for **measurement**, so the figure shown is ledger-based.
- Empty states are honest and tested: with no opportunity, no contingency and no history,
  the brief says so in three specific sentences rather than rendering blanks.

**A third instance of the permanence-basis bug, and a fourth.**

- `resilienceReport` ranked contingencies on `totals.netCarbonT`, so it reported the worst
  case as a **18.3%** loss where the ledger says **20.2%**. The winner was unchanged
  (Panipat either way), but the figure would have contradicted the tCO₂e beside it. Now
  ledger-based.
- **The pathway bands did not sum to the network** — 34,866 against 34,921. `networkLedger()`
  derives the dominant biochar feedstock from whatever slice it is handed, so each band
  picked its own BC₁₀₀. It now takes an optional permanence override: callers decomposing a
  whole pass the whole's feedstock, callers evaluating a plan in its own right omit it.
  Caught by the reconciliation test, not by eye.

**19 brief tests**, every one asserting that the brief's number *is* the owning module's
number: net carbon is `networkLedger()`, the action is the top opportunity including its
`ScenarioInstance`, the action's CTA simulates to the figure printed beside it, the risk is
the shock engine's, facility values are Carbon Facilities', evidence counts are MRV's, the
trend is Carbon Home's, and the objective sweep is the shock engine's. Plus: the brief never
mutates the network or the solve. **243 tests.**

## Phase 20 — Permanence-basis hardening

Root-cause fix for a defect that shipped four times. BC₁₀₀ is derived from the dominant
biochar feedstock, so a ledger built over a **slice** of a plan is valued differently from
the plan it belongs to — and the result still looks like a plausible number. Only the
reconciliation fails, and nothing checks a reconciliation unless someone writes the test.

- `networkLedger()` now takes a **required** `PermanenceBasis`, a discriminated union with
  no default: `{ kind: 'own' }` for a complete plan valued on its own feedstock mix, or
  `{ kind: 'inherit', stream }` for a slice that must inherit the whole's. The previous
  optional override made it *possible* to be correct; a required parameter makes it hard to
  be wrong, because the compiler asks at every call site.
- Helpers `OWN_BASIS` and `inheritFrom(wholePlan)` keep the call sites short without
  reintroducing a default.
- **All 24 call sites updated explicitly** — 17 in src, 7 in tests. The compiler found every
  one.
- **Tests are now type-checked.** `tsconfig` covered only `src`, so the seven test call
  sites were invisible to `tsc`. Adding `packages/engine/tests` and `packages/api/tests`
  also surfaced a stale fixture in `history.test.ts` missing `netByFacility`.
- One further latent instance fixed: `shock.ts` `changedFacilities()` valued each plant's
  slice on its own feedstock rather than its plan's. Measured difference on this dataset:
  **0.00** — the plants whose intake changes are pellet and CBG sites with no durable
  removal, so BC₁₀₀ never applied. Real in principle, dormant in this data.

**17 permanence tests** (`permanence.test.ts`) proving the contract rather than the code:
that the parameter is load-bearing (own and inherited genuinely disagree on a divergent
slice), that **own-basis slices do NOT sum to the whole** — the counter-example that makes
the rule necessary — and that every decomposition the product performs does: per-allocation,
per-pathway, per-facility, evidence contributors, brief bands, shock facility deltas.

**No values changed.** A 26-key snapshot across Carbon Home, Ledger, Pathways, Facilities,
Opportunities, Scenarios, Evidence and the Brief was captured before the refactor and
compared after: **26 identical, 0 changed.** **260 tests.**

## Phase 21 — Carbon Command (UX transformation)

The eight Carbon modules were correct but presented as eight dashboards. This turns them
into one workspace. No calculation, endpoint or module was added — the command surface
reads `/api/brief`, which already composes everything.

- **Two workspaces, not one menu.** Selecting CARBON makes the whole rail carbon-first:
  *Carbon Command* as the single primary surface, with the eight analytical modules beneath
  it under *Explore*. The structure is extensible — Generator, Facility, Economics and
  Director workspaces slot in beside these without touching the shell.
- **`/carbon` is now the Command Center**; the previous Carbon Home moved intact to
  `/carbon/impact`. Nothing was deleted.
- The signature visual is the **existing** `NetworkMap` over real district geometry, drawing
  the real allocation set. Its arcs already redraw when the plan changes — so the "live"
  feeling is the optimiser's own output moving, not an animation loop. Selecting a plant,
  source or flow opens the module that owns it.
- **Depth is opt-in.** Level 1 is four numbers and a map. "Why this number?" opens the
  decomposition in a drawer; that opens the Ledger; that opens Evidence. Nothing technical
  appears until asked for.
- **Optimise for carbon** is a real mutation: it re-solves the live twin on the carbon
  objective and reports the measured difference. Verified end to end from a real click —
  **34,921 → 35,195 (+275 tCO₂e)**, objective Balanced → Carbon First, and the map went from
  **36 to 41 flows**. The opportunity sweep then re-ranked itself against the new baseline
  (+1,410 → +1,379), which is the whole system responding coherently to one click.
- **Follow a tonne** reuses the Ledger's trace endpoint verbatim — the stages, figures and
  wording are the engine's; the drawer is a shortcut into that experience, not a copy.
- The **Carbon Pulse** is the twin's recorded event log with real timestamps. Not a ticker,
  and nothing is fabricated: no GPS, no telemetry, no sensor readings.

No calculation logic touched. **260 tests** unchanged and passing.

## Phase 22 — Export, and motion with a job

Final presentation pass. Held to the brief's own golden rule: better presentation over
more features. Two things were added and nothing else.

**Export (the one real gap).** There were no print styles anywhere. The brief now carries
an *Export brief* control and a print stylesheet that turns it into a document rather than
a screenshot of a dashboard: a cover with the wordmark, title, network, objective, planning
window, generation stamp and twin version; app chrome removed; sections that never orphan a
heading; colour preserved because the greens and charge reds carry meaning. Verified by
lifting the `@media print` block onto the screen and looking at it — not by assuming.
Browser print → Save as PDF, so it works everywhere with no new dependency, and the control
says exactly that rather than implying a bespoke renderer.

**Motion that reports something.** The hero position now interpolates via the existing
`CountUp`, so a re-optimisation reads as a value moving rather than swapped underneath the
reader. Sections rise once on mount in reading order. Selecting a plant focuses the map:
**34 of 36 arcs dim, the 2 connected routes flow**, and the receiving plant pulses — motion
bounded to what was selected, because animating all 36 is the "everything moving" failure
and costs compositor time for nothing.

`prefers-reduced-motion` already neutralised every animation globally with `!important`,
so the new ones are covered regardless of cascade order — confirmed in the built CSS.

No engine, endpoint, module or calculation touched. **260 tests** unchanged and passing.

## Documentation

- `README.md` — how to run it and what it does.
- `ARCHITECTURE.md` — system design and the reasoning behind each choice.
- `ANALYSIS.md` — problem analysis, modelling decisions, algorithm trade-offs, and what
  would need to change for production.
- `RESEARCH.md` — the six-repository study with licence positions and adopt/reject calls.
