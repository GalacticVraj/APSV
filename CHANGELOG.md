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

## Documentation

- `README.md` — how to run it and what it does.
- `ARCHITECTURE.md` — system design and the reasoning behind each choice.
- `ANALYSIS.md` — problem analysis, modelling decisions, algorithm trade-offs, and what
  would need to change for production.
- `RESEARCH.md` — the six-repository study with licence positions and adopt/reject calls.
