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

## Documentation

- `README.md` — how to run it and what it does.
- `ARCHITECTURE.md` — system design and the reasoning behind each choice.
- `ANALYSIS.md` — problem analysis, modelling decisions, algorithm trade-offs, and what
  would need to change for production.
- `RESEARCH.md` — the six-repository study with licence positions and adopt/reject calls.
