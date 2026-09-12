# ANALYSIS

Problem analysis, modelling decisions, and the reasoning behind each one.

---

## 1. Reframing the problem statement

PS11 asks for a "waste-to-carbon value chain tracker". A tracker records what happened.
The decision that actually creates value happens *before* anything is tracked: **which
tonne goes where, by which pathway, and why.**

That decision is a constrained optimisation over a network, and it is genuinely hard:
feedstocks have incompatible properties, facilities have minimum viable throughput,
transport is volume-limited, carbon and money disagree about the answer, and the whole
thing changes when a plant trips. Tracking is what you do afterwards.

So the product is an **operating system for the network**, and the tracker falls out of it
as a by-product.

---

## 2. Why Punjab–Haryana

Every feedstock class the problem statement mentions exists in one corridor:

- **crop residue at scale** — ~20 Mt of paddy straw a year in Punjab alone, with a ~20-day
  window between the paddy harvest and wheat sowing, which is the entire reason burning
  happens rather than a failure of goodwill;
- **dairy** — large, continuous, dense, wet;
- **agro-processing** — rice mills and co-operative sugar mills, already concentrated at
  the gate;
- **urban organics** — municipal wet waste and mandi waste with a landfill counterfactual.

It is also where the problem is politically live. Stubble burning is a public-health
emergency, and a system that can say "these 4,100 tonnes will burn, here is exactly why,
and here is what fixing it costs" is addressing the real constraint.

---

## 3. Feedstock modelling: properties, not lookup tables

The usual approach is a table of (waste type → tCO₂e per tonne). We rejected it.

Every feedstock carries a full proximate and ultimate analysis — moisture, ash, carbon,
hydrogen, nitrogen, lignin, C:N ratio, lower heating value, volatile solids, biochemical
methane potential, bulk density. Pathway yields are **derived from those properties**.

This matters because it makes the model argue back. Change a feedstock's lignin content
and biochar yield, char carbon content, methane potential and truck payload all move
together, in the directions the chemistry requires. A lookup table cannot do that, and
cannot explain why a pathway is wrong for a feedstock.

### Derived relations

```
biochar yield (dry)  = 0.20 + 0.0055 × lignin% + 0.0045 × ash%
char carbon content  = feedstock C% × 0.50 / biochar yield
char H/C(org)        = feedstock H:C molar × (0.19 − 0.0022 × lignin%)
achievable payload   = min(mass rating, deck volume × bulk density)
```

The second relation is the important one: it means a high-ash feedstock **necessarily**
produces a lower-carbon char, because silica dilutes it. Rice husk biochar comes out near
47 % carbon and cotton stalk biochar near 66 % — which is what the literature reports,
arrived at from properties rather than asserted.

### Pathway gates

Each pathway imposes hard gates (moisture, ash, C:N) and soft suitability factors. A
combination failing a hard gate is never generated as an arc, and the rejection is
**counted and reported** rather than silently dropped.

| Gate | Pathway | Reason |
|---|---|---|
| moisture ≤ 25 % | pyrolysis | drying a 70 %-moisture feed costs more energy than the char is worth |
| moisture ≥ 55 % | digestion | below this the digester needs dilution water it may not have |
| C:N 15–40 | digestion | below 15 ammonia inhibition destabilises it; above 40 it is nitrogen-limited |
| ash ≤ 20 % | pellets | high-silica straw slags and fouls boiler tubes |
| ash ≤ 16 % | gasification | ash and tar loading |
| C:N 12–45 | composting | outside this the windrow will not run efficiently |

This produces a genuinely useful finding rather than a tidy one: **poultry litter has no
viable pathway in this network.** Its C:N of 9 is below the stable window for both
digestion and composting, and its moisture puts it outside every thermal route. Rather
than hiding that, the bottleneck engine names it and recommends the fix — co-digestion
with press mud at about 1:2.5 lifts the mixture above C:N 15 and makes the existing CBG
capacity usable.

---

## 4. Carbon: the three decisions that cost us headline numbers

### Biogenic CO₂ is excluded

Residue carbon that burns returns to the atmosphere it came from in the same growing
season. Only CH₄ and N₂O represent a genuine atmospheric addition.

Consequence: avoided-burning credit is **0.082 tCO₂e per tonne of dry matter**, computed
from IPCC EFs (CH₄ 2.7 g/kg DM, N₂O 0.07 g/kg DM, combustion factor 0.89) at AR6 GWP₁₀₀.
Not the ~1 tCO₂e per tonne frequently claimed for stubble diversion. That claim counts
biogenic CO₂, and an auditor will find it.

We lose an order of magnitude on a headline and keep a number that survives review.

### Removal and avoidance are never summed

They are different commodities. Durable biochar removal clears around ₹10,800/tCO₂e;
voluntary-market avoidance around ₹520/tCO₂e — roughly twentyfold. Summing them into one
"carbon saved" figure is the most common error in this sector and it is precisely what
makes a business case unfinanceable when someone looks closely.

They are on separate ledger lines and priced separately in the economics. The price gap is
also *why* the objective modes diverge, so keeping them apart is what makes the product
interesting as well as what makes it correct.

### Permanence is computed, and corrected for Indian soil

This is the single most valuable thing taken from the reference repositories.

The Puro/SLU biochar persistence library harmonises decomposition data to a **14.9 °C**
soil temperature — northern Europe. Indian agricultural soils sit near **26 °C**. Applying
the published Woolf (2021) Q10 relation:

```
Q10(14.9 → 26) = 1.395
f(T)           = 1.447      ← decay rates are 45% faster
```

| Feedstock | BC₁₀₀ at 14.9 °C | BC₁₀₀ at 26 °C |
|---|---:|---:|
| Paddy straw | 82.0 % | **77.1 %** |

Importing the European default would overstate durable removal by about 6 %. Small in
percentage terms, fatal in a credit audit, and nobody else in this space seems to do it.

### What is deliberately not counted

- **Soil N₂O suppression from biochar** — literature contested, effect not durable.
  Including it would flatter the result.
- **Embodied carbon of the plant** — correct to exclude for an operating-period
  allocation decision; incorrect for a full LCA, and we say so.
- **PM₂.₅** — diverting crop residue avoids ~7.4 kg of PM₂.₅ per dry tonne, which is the
  reason stubble burning is a public-health emergency. It is reported as a health
  co-benefit and **never converted into CO₂e**, because it is not a greenhouse gas.

### Uncertainty

Every factor carries a published relative uncertainty; a seeded Monte Carlo over 2,000
draws propagates them through the whole ledger. The UI reports P5/P50/P95. A single-point
carbon number is a claim this model cannot support, so it does not make one.

---

## 5. The central trade-off

Paddy straw, per tonne:

| | Net carbon | Margin | Why |
|---|---:|---:|---|
| Pyrolysis → biochar | ~0.69 tCO₂e | ~₹6,100 | locks ~40 % of feedstock carbon for a century; earns removal credits at ₹10,800/t |
| Pellets → co-firing | ~1.15 tCO₂e | ~₹2,500 | displaces coal 1:1 on energy; earns only avoidance credits at ₹520/t |

Burning biomass in place of coal avoids **100 %** of the coal CO₂. Pyrolysis locks only
about 40 % of the biomass carbon. So co-firing wins on carbon while pyrolysis wins on
money — a real, counterintuitive, literature-supported result, and the reason the
objective switch visibly re-routes the network instead of merely re-sorting a list.

The Pareto frontier prices it: moving from pure profit to pure carbon costs about
**₹2,600 per tCO₂e**. Compare that with the ₹10,800/t removal price and the interesting
question becomes whether the carbon-first configuration is in fact the profitable one.

---

## 6. Logistics: bulk density is the binding constraint

Baled paddy straw is 0.15 t/m³. A 16-tonne truck with a 58 m³ deck carries **8.7 t**.

```
achievable payload = min(mass rating, deck volume × bulk density)
```

Transport cost per tonne, transport emissions per tonne, trip counts and fleet utilisation
all flow from this. A mass-only model over-states fleet capacity by more than 40 % on crop
residue and under-states cost and emissions per tonne by the same factor.

The Logistics screen reports the trip penalty explicitly, because the actionable insight
is not "transport is expensive" but "densifying straw at the field edge is a fleet
intervention as much as a handling one".

Cattle dung at 0.85 t/m³ is the opposite — mass-limited — which is why the two streams
behave differently under a fleet shortage.

---

## 7. Why the diverted tonnage falls versus the baseline

The optimiser routinely diverts **less** material than the nearest-facility heuristic, and
this is correct.

The heuristic sends every lot to the closest site that will take it, regardless of what
the lot is worth on arrival. Some of those tonnes lose money, and some lose carbon once
transport and process emissions are charged. Dropping them buys **+27 % net carbon** and
**+41 % margin** on 17 % *less* transport.

Tonnage diverted is an activity metric. Carbon and margin are outcome metrics. The
Overview screen states this explicitly rather than hiding an awkward-looking number,
because a judge who spots it unexplained will assume it is a bug.

---

## 8. Why 41 % of supply is stranded

This is the network's real state, not a modelling failure, and it is the most useful thing
the system says.

Total supply is ~57,700 t per window against ~48,150 t of nameplate capacity — but the
binding constraint is tighter than that, because capacity is not fungible across
feedstocks. Crop residue and rice husk (~37,000 t) can only go to pellets, pyrolysis or
gasification (~22,950 t of capacity). Wet streams can only go to digestion or composting.

The system responds by pricing the fix rather than reporting the symptom. The measured
marginal value of capacity at the most constrained plant is **0.80 tCO₂e and ₹5,637 per
additional tonne of throughput** — so 10 t/day of expansion there is worth 240 tCO₂e and
₹16.9 lakh per window. That is a capital allocation decision, derived rather than asserted.

---

## 9. Composting is carbon-negative for cattle dung

Windrow composting of dung emits more CH₄ and N₂O than the open heap it replaces avoids.
The IPCC composting default (4 kg CH₄/t wet) comes largely from poorly aerated static
piles; we use the turned-windrow figures (1.8 kg CH₄, 0.15 kg N₂O per tonne wet) and say so
— but even then, avoided open-heap methane is only ~0.035 tCO₂e/t against ~0.09 tCO₂e/t of
windrow emissions.

The model therefore strands dung rather than composting it once digestion capacity is
full. That is a defensible finding and the system reports it as one: **digest dung, do not
compost it.**

---

## 10. Algorithm choices and what was rejected

| Chosen | Rejected | Why |
|---|---|---|
| Min-cost flow for allocation | Genetic algorithm, PSO, ACO | The inner problem is a transportation LP. Exact beats approximate, and gives a bound and duals. |
| Branch and bound over facility on/off | Relaxing minimum viable feed | Without it, plants "run" at 3 t/day, which is not a plan an operator can execute. |
| Shadow prices by re-optimisation | LP duals from a single basis | With binary facility decisions, duals describe the current basis only and miss knock-on reallocation. |
| Ridge regression | XGBoost / LightGBM | No dependency-free JS equivalent, and inspectable coefficients are worth more than a fraction of a point of MAPE. |
| Clarke–Wright + Or-opt | OR-Tools CVRP | Unavailable without Python; and after full truckloads are removed, the residual problem is small. |
| Lognormal Monte Carlo | Normal draws | Emission factors are strictly positive; a normal draw can go negative and silently produce nonsense. |
| Integer objective scaling | Floating-point comparison | Float tie-breaks are the classic cause of non-reproducible "optimal" answers. |
| Haversine × circuity factor | Live routing API | A live demo cannot depend on an external service. Real routing would move individual hauls a few percent and change no allocation. |

---

## 11. What would need to change for production

1. **Real road routing** — an OSRM instance over an OSM extract would replace the circuity
   factor. Changes haul distances by a few percent; changes no structural conclusion.
2. **Real supply telemetry** — the forecasting architecture is unchanged; only the input
   data source differs. The model would be re-validated against actual history.
3. **Persistence** — scenarios and plan versions would need a database. Deliberately
   absent here because there is nothing worth persisting in a seeded demo.
4. **Char analysis** — permanence is modelled. A real credit needs measured H/C(org) on
   the actual char, which the model already takes as its primary input.
5. **Facility-level process models** — the MIRA approach of ANN surrogates over
   thermodynamic simulations would refine yields. Below the resolution a network optimiser
   needs, but it would matter for plant design.
6. **Contracts and commitments** — real feedstock is contracted, not spot-allocated.
   That adds temporal coupling the current single-window model does not represent.
