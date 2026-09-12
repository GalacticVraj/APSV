# TERRAFLUX — The Carbon Module, A to Z

Everything under `/carbon`: what is on each screen, what you can do, what it draws,
what data it runs on, and what it refuses to claim.

Written against the code as it stands. Every figure quoted is a live read from the
running engine on the **Balanced** objective, 30-day window, as of 08 Nov 2026.

---

## 0. In one paragraph

The Carbon module is the workspace of a **Carbon Manager** — the person who has to
stand behind a number. It answers four questions in order: *how much carbon are we
producing, where is it happening, what should I do next, and can I defend it?* Behind
it sits a min-cost-flow optimiser over a 42-source, 18-plant network, a carbon ledger
that keeps removal, avoidance and substitution strictly apart, a two-pool biochar
permanence model, and a 2,000-draw Monte Carlo uncertainty band. Nothing on any
screen is computed in the browser beyond grouping and formatting.

---

## 1. Navigation — four questions, nine views

The rail carries **four groups**, not nine flat items. Each group is named for the
question it answers; the views inside it are tabs.

| Rail label | The question | Views | Route |
|---|---|---|---|
| **Position** | How much, and which way is it moving? | Overview | `/carbon` |
| | | Breakdown | `/carbon/impact` |
| **Where it comes from** | Which plants, which routes, which tonnes? | Plants | `/carbon/facilities` |
| | | Pathways | `/carbon/pathways` |
| | | Trace | `/carbon/ledger` |
| **What to do** | What is the next move worth? | Opportunities | `/carbon/opportunities` |
| | | Scenarios | `/carbon/scenarios` |
| **Can I defend it** | Where did every figure come from? | Method | `/carbon/evidence` |
| | | Brief | `/carbon/report` |

**Why it is shaped this way.** The rail used to list nine peers with abstract noun
names — Impact, Trace, Brief. Two of the nine were the same screen (`/carbon` and
`/carbon/impact` both opened on `+34,921 tCO₂e` as their hero), and no name told you
which one answered the question in your head.

Above every carbon screen sits a **nav strip** (`CarbonNav.tsx`) carrying three things
in reading order: the group's question, its views as tabs, and one sentence saying
what the current view is for. A **CSV button** sits at the right of the tab row on
views that have something to export.

---

## 2. Screen by screen

### 2.1 `/carbon` — Carbon Control Center

Four bands, one dominant idea each.

**Band 1 — Where we stand**
- `NET CARBON IMPACT` — one figure at display size, `+34,921 tCO₂e`, mono, green-700,
  `clamp(46px, 8vw, 92px)`, animated via `CountUp`
- A context line naming the window and objective
- A trend line: `↓ 42.4% against the previous 4-week period` (green if improving, red if not)
- `Why this number?` — a quiet underlined button, not a card
- Three large stacked actions on the right: **Optimize network** (primary, green fill),
  **Simulate shock**, **Follow a tonne** — each with a one-line subtitle
- After a re-solve, a dismissable green strip reports the measured delta

**Band 2 — Where it happens**
- The `NetworkMap` at `clamp(400px, 56vh, 660px)` — the only element allowed to be large
- Live counts: sources · plants · flows · tonnes moving
- After a shock, a **Before / After** toggle flips the same region between two real plans
- Clicking a source, plant or flow opens a **drawer**, never a page

**Band 3 — What to do**
- Exactly one upside card and one risk card, top-bordered green and red respectively
- Each: headline, the figure at 25px mono, the reason, the counter-reason, one button

**Band 4 — How it adds up**
- Five proportional bands — durable removal, avoided emissions, fossil substitution,
  transport, processing — green for adds, red for subtracts, with a Net row on a 2px rule

**Visual devices:** CSS proportional bars, `CountUp` number interpolation, SVG network
map, staggered band reveal (`ccRise`, 0/70/140/200 ms), dash-offset flow animation on
focused arcs only.

---

### 2.2 `/carbon/impact` — Breakdown

The same net figure, opened into its terms.

- Hero figure with the Monte Carlo range beneath it: `29,884–41,105 tCO₂e across 2,000 draws (P5–P95)`
- **Decomposition** — six expandable terms. Each row: name, one-line explanation,
  proportional bar, value, uncertainty ±%. Expanding a term reveals the physical
  quantity, the factor, the citation
- **Carbon flow** — material → processing → outcome
- **Attention** strip
- **Trend** — a real SVG line chart (`trendchart`) over 20 re-solved past weeks, with
  a change narrative

**The one rule this screen enforces visually:** *Durable removal*, *Avoided emissions*
and *Fossil displacement* are on separate rows and are never summed into one headline.
They are different commodities with roughly a twentyfold price gap.

---

### 2.3 `/carbon/facilities` — Carbon Infrastructure

An asymmetric command dashboard, not a facility list.

```
┌────────────────────┬──────────────────┐
│                    │ CARBON POSITION  │
│    LIVE NETWORK    ├──────────────────┤
│   (map, dominant)  │ WHAT MATTERS     │
├──────────┬─────────┴──────────────────┤
│ CAPACITY │ MATERIAL → PATHWAY → CARBON│
└──────────┴────────────────────────────┘
              ↓ below the fold
        full ranking table (18 plants)
```

- **Carbon position** — the network net, then the seven contributing plants as
  proportional bars. Clicking one selects it
- **What matters** — one opportunity, one risk, each with its figure and a button
- **Capacity** — total unused tonnes, the single largest idle block, and how many
  plants are pinned at their ceiling. Two facts, not eighteen utilisation bars
- **Material → pathway → carbon** — grouped by pathway; **re-scopes to whichever plant
  is selected**, which is the moment it stops being a dashboard and becomes an instrument
- **Top actions:** Compare · Follow flow · Simulate

**Facility drawer** (click any plant): four figures, then the engine's own decomposition
— gross benefit, less transport, less processing, to net — as proportional bars; what
it takes in by stream; the written conclusion the facility module composes; its source
arcs each with a **Trace →** action.

**Compare mode:** pick two plants from map or ranking. Shows a three-column table
(A · metric · B) with the winning side inked green, and the engine's one-sentence verdict.

---

### 2.4 `/carbon/pathways` — Pathway choice

For one consignment of material, every conversion route the network can actually
offer it.

- **MaterialBar** — pick the material
- **Ranking** — routes ordered on carbon
- **Composition** and **Breakdown** — what each route does to a tonne
- **BlockedList** — routes that were excluded, and the gate that excluded them
- **WhyAndTradeoff** — the margin given up by choosing the carbon winner
- **Consequence** — a small SVG map inset (`cq-map`) showing the arc, source and plant

---

### 2.5 `/carbon/ledger` — Trace

- **BasisStrip** — window, supply basis, objective, twin version, and a
  `MODELLED ESTIMATE` tag
- **Decomposition** — four kind-groups (durable removal, avoided emissions, fossil
  displacement, emissions caused), each expanding to its lines
- **Evidence** — per-line inputs, factors, citations
- **FollowCarbon / TraceChain** — walks one allocation through seven stages
- **RouteInset** — a small SVG of the haul geometry

**Trace stages** (`TraceStage.key`): `waste → source → route → facility → pathway →
processing → outcome`. Each stage carries a headline quantity, a detail line, and the
carbon booked *at the stage that physically causes it* — or `null` where no carbon
event occurs.

---

### 2.6 `/carbon/opportunities` — What to change

- **Upside** — current net, and the measured headroom above it
- **TopFinding** — one opportunity gets the space: before, change, after, trade-off
- **BeforeAfter**, **Tradeoff**, **Actions**
- **Ranked** — the remaining findings
- **Rejected** — candidates that *lost* carbon, shown rather than hidden

Every item is a real `ScenarioInstance` applied to a clone and re-optimised. The
improvement is the difference between two ledgers from two real solves. Every item
also says **why the optimiser has not already done it** — a binding constraint, or
the objective in force.

---

### 2.7 `/carbon/scenarios` — Shock engine

- **Builder** — 12 scenario kinds, then the specific target
- **Stages** — solve progress
- **Canvas** — the network response
- **Response / Drivers / Objectives / Why** — ledger-line diff decomposition, which
  source now goes to which plant, and how all four objectives cope
- Honest empty state until something is run

**The 12 scenario kinds:** facility outage · capacity derating · supply surge · supply
shortfall · fleet shortage · diesel price move · carbon price move · processing cost
shock · transport disruption · commission new capacity · seasonal shift · change objective

---

### 2.8 `/carbon/evidence` — Method

- **Health** — counts by status: Measured `0`, Estimated `0`, Modelled `13`, Missing `0`.
  Deliberately **not** a trust score. It prints the zeros
- **ModelBasisPanel** — the conditions these numbers were produced under, plus an audit timeline
- **Calibration — "Against published work"** *(see §8)*
- **Register** — every ledger line, selectable, with its inputs classified as
  *published factor* / *model assumption* / *model-derived quantity*
- **RecordDetail** — backward trace to the allocations that produced a line

---

### 2.9 `/carbon/report` — Intelligence Brief

A document, not a dashboard. Masthead · Headline · Position · Flow · Action · Risk ·
Objectives · Contributors · Evidence · Method. Exports to PDF through the browser's
print dialog, with a dedicated print stylesheet that drops all application chrome and
renders a printed cover.

---

## 3. The carbon calculation

### 3.1 The ledger — 14 lines, four kinds plus an adjustment

| Kind | Key | tCO₂e | ± | Label |
|---|---|---:|---:|---|
| removal | `char_gross` | 4,299.1 | 18% | Carbon fixed in biochar (gross) |
| adjustment | `char_permanence` | −786.9 | 15% | Permanence adjustment to 100 years (BC₁₀₀ = 81.7%) |
| avoided | `avoided_open_field_burning` | 1,481.0 | 35% | Avoided: open in-field burning |
| avoided | `avoided_unmanaged_landfill` | 6,761.4 | 40% | Avoided: unmanaged deep landfill |
| avoided | `avoided_open_dumping` | 3,494.0 | 50% | Avoided: open dumping |
| substitution | `sub_cng` | 1,601.1 | 9% | Fossil CNG displaced by bio-CNG |
| substitution | `sub_coal` | 17,961.9 | 7% | Thermal coal displaced by pellet co-firing |
| substitution | `sub_power` | 2,052.4 | 8% | Grid electricity displaced by exported power |
| substitution | `sub_fert` | 89.2 | 30% | Synthetic nitrogen displaced by compost / digestate |
| emission | `em_transport` | −400.8 | 10% | Transport (well-to-wheel, incl. empty return) |
| emission | `em_aggregation` | −79.9 | 25% | Field aggregation (raking, baling, loading) |
| emission | `em_parasitic` | −1,215.2 | 8% | Process electricity from grid |
| emission | `em_ch4_slip` | −336.7 | 55% | Digester fugitive methane (2% slip) |
| **total** | `net` | **34,920.6** | — | Net carbon impact |

Rolled up: durable removal **3,512.1** · avoided **11,736.4** · substitution **21,704.7**
· emissions **2,032.6** → net **34,920.6**.

**Biogenic CO₂ is excluded throughout.** Only the methane and N₂O of the counterfactual
fate count as avoided.

### 3.2 Permanence — two-pool decay

```
BC₁₀₀ = 81.7%      H/C(org) = 0.214      soil 26 °C      reference 14.9 °C
fT = 1.447         Q10 = 1.395           curve = 12 points, plotted
```

Parameterised by the char's H/C(org) molar ratio, Q10-corrected from the harmonised
14.9 °C reference dataset to local soil temperature. Model form after Azzi et al.
(2024); Q10 relation after Woolf et al. (2021).

**`PermanenceBasis` is a required parameter**, not a default:

```ts
export type PermanenceBasis =
  | { kind: 'own' }                            // value this slice on its own char mix
  | { kind: 'inherit'; stream: StreamId | null };  // value it under the whole plan's basis

networkLedger(allocations, facilities, vehicles, assumptions, basis) // basis REQUIRED
```

This exists because deriving the basis silently shipped the same bug five times: a
decomposition valued differently from the whole, so shares would not sum to the network
net. Making it explicit forces every caller to say which question it is asking.

### 3.3 Uncertainty

2,000 Monte Carlo draws, seeded (`20260912`) so the band is reproducible.

```
P5 29,884   P50 34,439   P95 41,105   mean 34,856   σ 3,471   28 histogram bins
```

---

## 4. Data types

### 4.1 The ledger

```ts
interface LedgerLine {
  key: string; label: string;
  valueT: number;                 // tCO₂e, + benefit / − charge
  kind: 'removal' | 'avoided' | 'substitution' | 'emission' | 'adjustment' | 'total';
  basis: string; source: string; uncertaintyPct: number;
}

interface CarbonLedger {
  lines: LedgerLine[];
  durableRemovalT; avoidedEmissionsT; substitutionT; emissionsT; netT: number;
  permanence: PermanenceReport | null;
  uncertainty: UncertaintyBand | null;
}

interface PermanenceReport {
  hcOrgRatio; soilTempC; referenceTempC; q10; fT; bc100: number;
  labileFraction; labileRatePerYr; persistentRatePerYr: number;
  curve: Array<{ year: number; remaining: number }>;
  method: string;
}
```

### 4.2 Per-module types

| Module | Types |
|---|---|
| `carbon.ts` | `PhysicalPerTonne` · `FactorSet` · `CarbonComponents` · `CarbonAggregate` · `PermanenceBasis` |
| `brief.ts` | `CarbonBrief` · `BriefPosition` · `BriefTrend` · `BriefAction` · `BriefRisk` · `BriefFlowBand` · `BriefContributors` · `BriefMethodology` |
| `facility.ts` | `FacilityCarbon` · `FacilityRankRow` · `FacilityArc` · `FacilityOpportunity` · `FacilityComparison` · `FacilityComparisonRow` |
| `trace.ts` | `AllocationTrace` · `TraceCandidate` · `TraceStage` · `ProvenanceRow` |
| `evidence.ts` | `EvidenceRecord` · `EvidenceInput` · `EvidenceHealth` · `LineContributor` · `ModelBasis` · `EvidenceStatus` · `InputBasis` |
| `opportunity.ts` | `Opportunity` · `OpportunityMeasure` · `RejectedCandidate` · `OpportunityReport` |
| `shock.ts` | `ShockResult` · `ShockSide` · `ShockClass` · `LedgerLineDelta` · `GroupDelta` · `ChangedFacility` · `ConstraintChange` · `ObjectiveOutcome` |
| `pathwaychoice.ts` | `PathwayDecision` · `PathwayOption` · `PathwayGate` · `PathwayDriver` · `PathwayDiff` · `MaterialCandidate` |
| `history.ts` | `CarbonHistory` · `CarbonHistoryPoint` · `PeriodComparison` · `ChangeDriver` |

### 4.3 Vocabularies

**9 streams** — paddy straw · wheat straw · cotton stalk · rice husk · sugar mill press
mud · cattle dung · poultry litter · mandi/vegetable market waste · segregated municipal organics

**5 pathways** — slow pyrolysis → biochar · anaerobic digestion → CBG · densification →
pellet co-firing · windrow composting · gasification → power

**4 counterfactuals** — open in-field burning · uncovered solid-storage dung heap ·
unmanaged deep landfill · open dumping

**4 objectives** — Carbon First · Profit First · Balanced · Logistics First

---

## 5. API surface

| Route | Returns |
|---|---|
| `GET /api/carbon` | ledger, aggregate, totals, provenance |
| `GET /api/carbon/history` | 20 re-solved past weeks, comparison, drivers, narrative |
| `GET /api/brief` | the whole position composed — position, trend, flow, action, risk, objectives, contributors, evidence, methodology |
| `GET /api/facilities/carbon` | 18 ranked rows, **network permanence basis** |
| `GET /api/facilities/profile?id=` | one plant: ledger, arcs, streams, shadow price, `why` |
| `GET /api/facilities/compare?a=&b=` | rows, shared sources, one-sentence summary |
| `GET /api/pathways?stream=` | route comparison for a material |
| `GET /api/pathways/decision`, `/diff` | chosen route, and the diff against another |
| `GET /api/materials` | traceable material candidates |
| `GET /api/trace/candidates` | rankable contributions |
| `GET /api/trace?sourceId=&facilityId=` | seven-stage walk |
| `GET /api/evidence`, `/contributors` | register, health, basis; backward trace |
| `GET /api/opportunities` | measured findings + rejected candidates |
| `GET /api/resilience` | N−1 loss per plant, score, grade |
| `POST /api/scenario` | `{...instance, commit}` → `ScenarioResult` with `before` **and** `after` |
| `POST /api/objective` | re-solve the live twin |

---

## 6. Visualisation catalogue

**Everything is hand-built.** No chart library, no map library, no tile server, zero
runtime dependencies.

| Device | Where | How |
|---|---|---|
| **Network map** | Control Center, Facilities | SVG over real district geometry from `region.json` (48 core + 292 context districts), Web-Mercator projection. Source = square sized by tonnage; facility = shape by pathway, fill by state, ring by utilisation; flow = bowed arc, width by tonnage, colour by pathway |
| **Proportional bars** | everywhere | CSS `width` %, `scaleX` grow animation |
| **Decomposition bars** | Breakdown, Facility drawer, Control Center | green add / red subtract, Net on a 2px rule |
| **Trend line chart** | Breakdown | bespoke SVG with grid lines, 20 weeks |
| **Route inset** | Ledger | bespoke SVG haul geometry |
| **Consequence map** | Pathways | bespoke SVG arc + source + facility |
| **Decay curve** | permanence | `DecayCurve` from `Charts.tsx` |
| **Histogram** | uncertainty | `Histogram`, 28 bins |
| **Number interpolation** | Control Center | `CountUp` |
| **Flow animation** | maps | `stroke-dasharray` + `stroke-dashoffset`, **only on a focused selection** |
| **Facility pulse** | maps | opacity keyframe on the highlighted node |

Shared components available in `Charts.tsx`: `ForecastChart` · `BarList` · `Waterfall`
· `ParetoChart` · `Histogram` · `StackedBar` · `Sparkline` · `DecayCurve` · `seriesColor`.

Primitives in `Primitives.tsx`: `Panel` · `SectionHead` · `Stat` · `StatStrip` · `Tag`
· `StatusDot` · `Loading` · `ErrorState` · `Empty` · `MiniBar` · `DataTable<T>` ·
`CountUp` · `Hairline` · `Notice` · `InfoTip` · `ParameterRow` · `DecisionBanner` ·
`ValueFlowChain`.

---

## 7. Design language

```
--surface        #ffffff     --ink     #14181a     --green-900  #10402f
--surface-sunken #f4f2ed     --ink-2   #4e585c     --green-700  #14503a
--rule           #e4e1d9     --ink-3   #7c868a     --green-500  #2e7d5b
--rule-2         #cfcbc1     --ink-4   #a7afb2     --green-300  #7db79b
--rule-strong    #14181a                           --green-100  #e6efe9

--neg #a3412b (risk / charge)   --warn #8a6412 (attention / trade-off)
```

**Meaning of colour:** green = positive carbon outcome · amber = attention or trade-off
· red = risk or a charge against the network. Colour is never decorative.

**Rules kept:** ruled, not carded. Whitespace over borders. One dominant idea per band.
Mono for figures, sans for prose. No gradients, no glassmorphism, no neon, no glow, no
emoji as iconography, no giant rounded cards.

**Motion:** animate meaning, never decoration. Bands arrive once on mount, never on
re-render. Arcs move only on a focused selection — animating all 36 at once is the
"everything moves so nothing means anything" failure. Everything is `transform`/`opacity`
only, and the whole module switches off under `prefers-reduced-motion`.

---

## 8. Calibration — held against published work

`/carbon/evidence` compares seven of the engine's own constants against a compiled
reference of cited sources. Each row links out. **Two of seven disagree, and both are
rendered in amber rather than reconciled away.**

| Verdict | Parameter | This model | Published |
|---|---|---|---|
| Agrees | CH₄ GWP₁₀₀ non-fossil | 27.2 | 27 (IPCC AR6) |
| Different method | Permanence model form | two-pool decay | Woolf linear `Fperm = 1.04 − 0.635·(H/Corg)` |
| **Differs** | **BC₁₀₀ at 14.9 °C** | **82.0–85.8%** | **63–82%** |
| Within | H/C(org) of char | 0.21–0.26 | threshold 0.4 |
| Different method | Q10 correction | continuous, 1.39 | constant 2 |
| **Differs** | **Avoided-emission price** | **₹520/tCO₂e** | **₹850–900 (CCTS 2026)** |
| Within | Landfill baseline | ₹1,500/t | ₹500–1,500 (ULB) |

**What the two disagreements mean.** Our chars retain more at 100 years than the
published band, so the removal figures should **not** be called conservative until that
is understood. Our carbon price runs the other way — we price avoided emissions at about
60% of India's compliance market, so the economics screens *understate* what these tonnes
might fetch.

The comparison is made at **14.9 °C**, the temperature the published band is quoted at.
Using the 26 °C figure would have slid it inside the band for entirely the wrong reason:
warmer soil decays char faster.

Also on that screen, behind a disclosure: **five real, named, cited plants** of these
archetypes operating in these districts — Sangrur (×2), Patiala, Ludhiana, Hoshiarpur —
plus Punjab's 48 allotted CBG projects, 558 t/day capacity, and 1,867,000 t/yr projected
paddy straw consumption. The modelled network is synthetic; these are not, and the screen
says so.

---

## 9. Interactions

| Action | What actually happens |
|---|---|
| **Optimize network** | Re-solves the live twin under a chosen objective. The panel first shows each objective's own measured net: Carbon First 35,195 (+275) · Balanced 34,921 · Profit First 31,765 (−3,156) · Logistics First 30,901 (−4,020) |
| **Simulate shock** | Runs a real `ScenarioInstance` **uncommitted**, keeps `before` and `after`, and the map flips between them. Panipat offline: 36 flows / 34,060 t → 32 flows / 28,060 t |
| **Follow a tonne** | Walks one real allocation through seven stages to its ledger lines |
| **Why this number?** | Opens the decomposition → Ledger → Evidence |
| **Select on map** | Opens a drawer. Never a page |
| **Compare** | Two plants, engine's own verdict sentence |
| **Trace** | Any arc or line → `/carbon/ledger?source=…&facility=…` |
| **Deep links** | `/carbon?do=simulate` (also `optimise`, `follow`, `why`) opens that overlay on arrival |

---

## 10. Exports

One CSV button, same place on every view that has data worth taking.

| View | Exports |
|---|---|
| Trace | ledger lines (14) |
| Plants | plant ranking (18) |
| Opportunities | opportunities (13) |
| Method | evidence register (13) |
| Brief | print / PDF via the browser dialog |

Two rules in `download.ts`: the export closes over **the rows the view actually
rendered**, so file and screen cannot disagree; and every file carries a header block
naming the window, objective, twin version and the fact that this is modelled.

```
# Carbon ledger
# Network as of 2026-11-08 · Planning window 30 days · Objective balanced
# Net 34920.6 tCO2e
# MODELLED ESTIMATE. Not verified, not certified, and not a carbon credit.
```

A UTF-8 BOM is written so Excel on Windows renders `tCO₂e` and `₹` correctly.

---

## 11. What this module never claims

- **Never "verified", "certified", or "a carbon credit."** Every screen carries a
  `MODELLED ESTIMATE` tag, and the CSV header repeats it
- **Never sums removal, avoidance and substitution** into one flattering figure. They
  are different commodities with roughly a twentyfold price gap
- **Never invents a trust score.** Evidence counts what is countable and prints the zeros:
  Measured `0`, Modelled `13`
- **Never fabricates telemetry.** No GPS, no IoT, no vehicle moving down a road, no
  synthetic clock. Arcs animate because material is allocated along them
- **Never re-derives carbon in a component.** An allocation-level sum sits on a different
  permanence basis and disagrees with the Plants screen by about 1.7%. Material, capacity
  and distance are physical and safe to aggregate; carbon is not
- **Honest limitations are published**, on System & Data: supply history is generated
  from a documented crop calendar, permanence is modelled rather than measured, and
  network state lives in memory

---

## 12. Verification

**264 tests**, all passing, run under Node's native test runner with type stripping.

| Suite | Covers |
|---|---|
| `carbon.test.ts` | ledger construction, kinds, biogenic exclusion |
| `permanence.test.ts` | two-pool decay, Q10, the `PermanenceBasis` contract |
| `invariant.test.ts` | cross-module reconciliation |
| `facility.test.ts` | ranking under the network basis, shares summing |
| `trace.test.ts` | provenance matches the aggregate it came from |
| `pathwaychoice.test.ts` | gates, drivers, diffs |
| `opportunity.test.ts` | findings are real re-solves |
| `shock.test.ts` | ledger-line diff decomposition |
| `brief.test.ts` | composition only — the brief computes nothing |
| `history.test.ts` | period comparison, change drivers |
| `validate.test.ts` (API) | scenario parameter validation |

**Live cross-screen reconciliation** — every figure that appears on more than one screen:

```
ledger.netT                        34,920.6
brief.position.netT                34,920.6   same
sum(facilities.netT)               34,920.6   same
sum(facility share %)                 100.0   sums
sum(brief.flow.netT)               34,920.6   same
brief.action vs opportunities[0]    1,410.2   both
brief.risk vs resilience worst      Panipat · 20.15% · Fragile — all three agree
```

---

## 13. File map

```
packages/engine/src/
  carbon.ts         844   ledger, permanence, Monte Carlo, PermanenceBasis
  brief.ts          444   composes the whole position; computes nothing
  facility.ts       604   ranking, profile, comparison
  trace.ts          736   provenance, candidates, seven-stage walk
  evidence.ts       356   register, health, backward trace, model basis
  opportunity.ts    352   findings as real re-solves
  shock.ts          456   scenario diff, objective comparison
  pathwaychoice.ts  620   route options, gates, drivers
  history.ts        388   20-week re-solve, comparison, narrative
  constants.ts      437   factors, prices, markets, baselines, vehicles

packages/web/src/
  pages/CarbonCommand.tsx      1089   Control Center
  pages/Carbon.tsx              887   Breakdown
  pages/CarbonLedger.tsx        961   Trace
  pages/CarbonFacilities.tsx    762   Infrastructure dashboard
  pages/CarbonScenarios.tsx     762   Shock engine
  pages/CarbonPathways.tsx      756   Pathway choice
  pages/CarbonEvidence.tsx      662   Method + calibration
  pages/CarbonReport.tsx        604   Intelligence Brief
  pages/CarbonOpportunities.tsx 532   Opportunities
  components/CarbonNav.tsx      178   four groups, nine views
  components/CarbonExport.tsx    67   one CSV button, registered per view
  components/Drawer.tsx          44   shared inspection drawer
  calibration.ts                224   this model against published work
  download.ts                   111   CSV with its basis carried
  data/reference.json            12K  cited reference dataset
  styles/carbon-command.css     378
  styles/carbon-facilities.css  461
```

---

## 14. A 2-minute demo path

| Time | Do this | They see |
|---|---|---|
| 0:00 | Open `/carbon` | `+34,921 tCO₂e` and the live region |
| 0:15 | Point at the map | 42 sources, 18 plants, 36 flows, 34,060 t moving |
| 0:30 | **Optimize network** → Carbon First | 34,921 → 35,195, measured, with margin cost |
| 0:50 | **Simulate shock** → Panipat offline | Map reroutes: 36 → 32 flows, −7,038 tCO₂e. Flip Before/After |
| 1:15 | **Follow a tonne** | One consignment, field to ledger line |
| 1:35 | **Why this number?** → Trace → Evidence | Every term opens to its factor and citation |
| 1:50 | `/carbon/evidence` → *Against published work* | Two rows disagree, in amber, on purpose |

Closing line: *"TerraFlux doesn't just measure carbon. It understands the network,
decides what should happen, shows what happens when reality changes — and tells you
where its own model disagrees with the literature."*
