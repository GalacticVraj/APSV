/**
 * Bottleneck detection, stranding attribution, resilience and opportunity scoring.
 *
 * The difference between a dashboard and an operating system is that a dashboard
 * reports what happened and an operating system says what to do about it. Every
 * finding here carries a quantified consequence and a recommended action, because
 * "Facility 3 is at 98% utilisation" is not information an operator can act on,
 * whereas "one more tonne per day at Facility 3 is worth Rs 1,240, and 4,100 t of
 * paddy straw is stranded within 40 km of it" is.
 */

import type {
  Bottleneck,
  NetworkState,
  ObjectiveMode,
  OpportunityScore,
  OptimizationResult,
  PathwayId,
  ResilienceReport,
  StrandedLot,
} from './types.ts';
import { COUNTERFACTUALS, STREAMS, dryFraction } from './streams.ts';
import { PATHWAYS, suitability } from './pathways.ts';
import { buildArcs, objectiveScale, optimize, type ArcSet } from './optimizer.ts';
import { cloneNetwork } from './network.ts';
import { networkLedger, OWN_BASIS } from './carbon.ts';
import { roadDistanceKm } from './geo.ts';

function inr(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stranding, with an attributed reason
// ─────────────────────────────────────────────────────────────────────────────

export function strandedLots(
  net: NetworkState,
  result: OptimizationResult,
  arcSet?: ArcSet,
): StrandedLot[] {
  const arcs = arcSet ?? buildArcs(net);
  const allocatedBySource = new Map<string, number>();
  for (const a of result.allocations) {
    allocatedBySource.set(a.sourceId, (allocatedBySource.get(a.sourceId) ?? 0) + a.tonnes);
  }

  const windowDays = net.assumptions.windowDays;
  const loadByFacility = new Map<string, number>();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }

  const out: StrandedLot[] = [];

  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const allocated = allocatedBySource.get(src.id) ?? 0;
    const stranded = src.availableT - allocated;
    if (stranded <= 1) continue;

    const stream = STREAMS[src.stream];
    const row = arcs.bySource[i];

    let reason: StrandedLot['reason'] = 'facility_capacity';
    let reasonText = '';
    let nearestKm: number | null = null;

    if (row.length === 0) {
      // Nothing feasible at all: work out which gate did it.
      const gateFailures = net.facilities.filter(
        (f) => !suitability(stream, PATHWAYS[f.pathway]).feasible,
      ).length;
      const nearestAny = Math.min(
        ...net.facilities.map((f) =>
          roadDistanceKm(src, f, net.assumptions.circuityFactor, src.access),
        ),
      );
      nearestKm = Number.isFinite(nearestAny) ? nearestAny : null;

      if (gateFailures === net.facilities.length) {
        reason = 'pathway_mismatch';
        const limiting = suitability(stream, PATHWAYS[net.facilities[0].pathway]).limitingFactor;
        reasonText = `No pathway in the network accepts ${stream.label.toLowerCase()}. Limiting property: ${limiting} (C:N ${stream.cnRatio}:1, moisture ${stream.moisturePct}%).`;
      } else if (nearestKm !== null && nearestKm > net.assumptions.maxHaulKm) {
        reason = 'haul_uneconomic';
        reasonText = `Nearest compatible facility is ${nearestKm.toFixed(0)} km away, beyond the ${net.assumptions.maxHaulKm} km economic haul limit.`;
      } else {
        reason = 'pathway_mismatch';
        reasonText = 'No facility in range both accepts this stream and passes its pathway gates.';
      }
    } else {
      const distances = row.map((r) => arcs.arcs[r.arcIndex].distanceKm);
      nearestKm = Math.min(...distances);

      // Is there headroom anywhere this lot could legally go?
      let headroom = 0;
      let bestValueArc = -Infinity;
      for (const r of row) {
        const fac = net.facilities[r.facility];
        const cap = fac.capacityTpd * fac.availability * windowDays;
        headroom += Math.max(0, cap - (loadByFacility.get(fac.id) ?? 0));
        bestValueArc = Math.max(bestValueArc, arcs.arcs[r.arcIndex].marginInrPerT);
      }

      if (headroom < 1) {
        reason = 'facility_capacity';
        reasonText = `Every compatible facility within ${net.assumptions.maxHaulKm} km is at capacity. Nearest is ${nearestKm.toFixed(0)} km.`;
      } else if (bestValueArc < 0) {
        reason = 'haul_uneconomic';
        reasonText = `Capacity exists but the best available route loses ${inr(-bestValueArc)}/t. The optimiser left it in the field rather than destroy value.`;
      } else {
        reason = 'facility_capacity';
        reasonText = `Outbid for capacity by higher-value feedstock. ${headroom.toFixed(0)} t of headroom exists but is committed to better arcs.`;
      }
    }

    out.push({
      sourceId: src.id,
      name: src.name,
      stream: src.stream,
      tonnes: stranded,
      reason,
      reasonText,
      nearestFacilityKm: nearestKm,
      counterfactualEmissionsT:
        stranded * dryFraction(stream) * COUNTERFACTUALS[stream.counterfactual].tco2ePerTDry,
    });
  }

  return out.sort((a, b) => b.tonnes - a.tonnes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottlenecks
// ─────────────────────────────────────────────────────────────────────────────

export function detectBottlenecks(
  net: NetworkState,
  result: OptimizationResult,
  arcSet?: ArcSet,
): Bottleneck[] {
  const arcs = arcSet ?? buildArcs(net);
  const out: Bottleneck[] = [];
  const windowDays = net.assumptions.windowDays;

  const loadByFacility = new Map<string, number>();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }

  // ── 1. Binding facility capacity, priced by its shadow price ──────────────
  //
  // Most facilities in a tight network run at capacity, so listing every one of
  // them as a separate "critical" finding is noise. We surface the three with the
  // highest measured marginal value and roll the rest into a single line, because
  // an operator can only act on the top of the list anyway.
  const shadowByFacility = new Map(result.shadowPrices.map((s) => [s.facilityId, s]));
  const stranded = strandedLots(net, result, arcs);
  const capacityFindings: Bottleneck[] = [];

  for (const f of net.facilities) {
    if (f.status === 'offline') continue;
    const cap = f.capacityTpd * f.availability * windowDays;
    const load = loadByFacility.get(f.id) ?? 0;
    if (cap <= 0) continue;
    const util = (load / cap) * 100;
    if (util < 97) continue;

    // How much compatible feedstock is stranded within reach of this plant?
    let reachableStranded = 0;
    for (const lot of stranded) {
      const srcIdx = net.sources.findIndex((s) => s.id === lot.sourceId);
      if (srcIdx < 0) continue;
      const hasArc = arcs.bySource[srcIdx].some((r) => net.facilities[r.facility].id === f.id);
      if (hasArc) reachableStranded += lot.tonnes;
    }
    if (reachableStranded < 50) continue;

    const sp = shadowByFacility.get(f.id);
    const marginalCarbon = sp?.carbonPerExtraTonne ?? 0;
    const marginalMargin = sp?.marginPerExtraTonne ?? 0;

    capacityFindings.push({
      id: `bn-cap-${f.id}`,
      kind: 'facility_capacity',
      severity: reachableStranded > 3000 ? 'critical' : reachableStranded > 1200 ? 'high' : 'moderate',
      title: `${f.name} is capacity-bound`,
      detail: `Running at ${util.toFixed(0)}% of nameplate (${f.capacityTpd} t/day). ${reachableStranded.toFixed(0)} t of compatible feedstock sits stranded within its catchment.`,
      carbonAtRiskT: marginalCarbon > 0 ? marginalCarbon * reachableStranded : reachableStranded * estimateCarbonPerT(net, arcs, f.id),
      valueAtRiskInr:
        marginalMargin > 0
          ? marginalMargin * reachableStranded
          : reachableStranded * Math.max(0, estimateMarginPerT(net, arcs, f.id)),
      entityIds: [f.id],
      recommendation:
        marginalCarbon > 0 || marginalMargin > 0
          ? `Add throughput here. Ten more tonnes per day is worth ${(marginalCarbon * 10 * windowDays).toFixed(0)} tCO₂e and ${inr(marginalMargin * 10 * windowDays)} per window.`
          : `Capacity is binding but marginal value is flat — the real constraint is feedstock quality or geography, not tonnage.`,
      quantifiedUpside:
        sp && sp.binding
          ? `Measured by re-optimisation: ${marginalCarbon.toFixed(3)} tCO₂e and ${inr(marginalMargin)} per additional tonne of throughput.`
          : `Roughly ${(reachableStranded * estimateCarbonPerT(net, arcs, f.id)).toFixed(0)} tCO₂e and ${inr(reachableStranded * Math.max(0, estimateMarginPerT(net, arcs, f.id)))} per window are unreachable at current throughput.`,
    });
  }

  capacityFindings.sort((a, b) => b.carbonAtRiskT - a.carbonAtRiskT);
  out.push(...capacityFindings.slice(0, 3));
  if (capacityFindings.length > 3) {
    const rest = capacityFindings.slice(3);
    out.push({
      id: 'bn-cap-rest',
      kind: 'facility_capacity',
      severity: 'moderate',
      title: `${rest.length} further facilities are at capacity`,
      detail: rest.map((r) => r.title.replace(' is capacity-bound', '')).join(', ') + '.',
      carbonAtRiskT: rest.reduce((s, r) => s + r.carbonAtRiskT, 0),
      valueAtRiskInr: rest.reduce((s, r) => s + r.valueAtRiskInr, 0),
      entityIds: rest.flatMap((r) => r.entityIds),
      recommendation:
        'These are saturated but have lower marginal value than the three above. Debottleneck them only after the top three.',
      quantifiedUpside: `Together worth ${rest.reduce((s, r) => s + r.carbonAtRiskT, 0).toFixed(0)} tCO₂e per window if their catchments could be served.`,
    });
  }

  // ── 2. Streams with no viable pathway at all ──────────────────────────────
  const byReason = new Map<string, StrandedLot[]>();
  for (const lot of stranded) {
    const key = `${lot.reason}|${lot.stream}`;
    const list = byReason.get(key) ?? [];
    list.push(lot);
    byReason.set(key, list);
  }

  for (const [key, lots] of byReason) {
    const [reason, streamId] = key.split('|');
    const tonnes = lots.reduce((s, l) => s + l.tonnes, 0);
    if (tonnes < 200) continue;
    const stream = STREAMS[streamId as keyof typeof STREAMS];
    const counterfactualT = lots.reduce((s, l) => s + l.counterfactualEmissionsT, 0);

    if (reason === 'pathway_mismatch') {
      out.push({
        id: `bn-path-${streamId}`,
        kind: 'pathway_mismatch',
        severity: tonnes > 1000 ? 'high' : 'moderate',
        title: `${stream.label} has no viable pathway`,
        detail: lots[0].reasonText,
        carbonAtRiskT: counterfactualT,
        valueAtRiskInr: 0,
        entityIds: lots.map((l) => l.sourceId),
        recommendation: recommendForMismatch(streamId as keyof typeof STREAMS),
        quantifiedUpside: `${tonnes.toFixed(0)} t per window currently goes to ${COUNTERFACTUALS[stream.counterfactual].label.toLowerCase()}, worth ${counterfactualT.toFixed(0)} tCO₂e of avoidable emissions.`,
      });
    } else if (reason === 'haul_uneconomic') {
      out.push({
        id: `bn-haul-${streamId}`,
        kind: 'haul_uneconomic',
        severity: 'moderate',
        title: `${stream.label} stranded by geography`,
        detail: lots[0].reasonText,
        carbonAtRiskT: counterfactualT,
        valueAtRiskInr: 0,
        entityIds: lots.map((l) => l.sourceId),
        recommendation: `A satellite densification or pre-processing unit near these sources would raise bulk density and bring the haul inside the economic radius.`,
        quantifiedUpside: `${tonnes.toFixed(0)} t per window. At ${stream.bulkDensityTPerM3} t/m³ these loads are volume-limited; densifying to 0.55 t/m³ would cut transport cost per tonne by roughly 60%.`,
      });
    }
  }

  // ── 3. Fleet ──────────────────────────────────────────────────────────────
  if (result.totals.fleetUtilisationPct > 85) {
    out.push({
      id: 'bn-fleet',
      kind: 'fleet_capacity',
      severity: result.totals.fleetUtilisationPct > 98 ? 'critical' : 'high',
      title: 'Fleet is the binding constraint',
      detail: `Vehicle-days required are ${result.totals.fleetUtilisationPct.toFixed(0)}% of the available fleet over the ${windowDays}-day window. ${result.totals.vehicleTrips.toLocaleString('en-IN')} trips are scheduled.`,
      carbonAtRiskT: 0,
      valueAtRiskInr: 0,
      entityIds: [],
      recommendation:
        'Add trucks or shift low-density loads to higher-volume trailers before adding processing capacity — plant headroom cannot be used without vehicles to fill it.',
      quantifiedUpside: `Low-density feedstock means most trucks are volume-limited, not mass-limited. Baling to a higher density adds effective fleet capacity without buying vehicles.`,
    });
  }

  // ── 4. Facilities that cannot reach minimum viable feed ───────────────────
  for (const f of net.facilities) {
    if (f.status === 'offline') continue;
    const load = loadByFacility.get(f.id) ?? 0;
    if (load > 0.5) continue;
    if (!result.idleFacilities.includes(f.id)) continue;
    const minWindow = f.minFeedTpd * windowDays;
    out.push({
      id: `bn-minfeed-${f.id}`,
      kind: 'min_feed_unmet',
      severity: 'moderate',
      title: `${f.name} is idle`,
      detail: `The optimiser chose not to operate this site. Its minimum viable feed is ${f.minFeedTpd} t/day (${minWindow.toFixed(0)} t per window); running it below that would not cover fixed costs.`,
      carbonAtRiskT: 0,
      valueAtRiskInr: f.capexAmortInrPerT * minWindow,
      entityIds: [f.id],
      recommendation: `Either secure a committed feedstock contract of at least ${f.minFeedTpd} t/day within its catchment, or mothball the asset for this window.`,
      quantifiedUpside: `Idle capital charge is approximately ${inr(f.capexAmortInrPerT * minWindow)} per window.`,
    });
  }

  const order = { critical: 0, high: 1, moderate: 2, low: 3 };
  return out.sort(
    (a, b) => order[a.severity] - order[b.severity] || b.carbonAtRiskT - a.carbonAtRiskT,
  );
}

function recommendForMismatch(streamId: keyof typeof STREAMS): string {
  const s = STREAMS[streamId];
  if (s.cnRatio < 12) {
    return `C:N of ${s.cnRatio}:1 is below the stable window for both digestion and composting. Co-digest with a high-carbon feedstock — blending 1 part this stream to 2.5 parts press mud lifts the mixture above C:N 15 and makes the existing CBG capacity usable.`;
  }
  if (s.cnRatio > 45) {
    return `C:N of ${s.cnRatio}:1 is too carbon-rich to compost efficiently. Route to a thermal pathway, or blend with a nitrogen-rich stream.`;
  }
  if (s.moisturePct > 50) {
    return `At ${s.moisturePct}% moisture this stream cannot be pyrolysed or pelletised. Anaerobic digestion is the only viable route; add digester capacity in its catchment.`;
  }
  return `Add a pathway compatible with this feedstock's properties within its catchment.`;
}

function estimateCarbonPerT(net: NetworkState, arcs: ArcSet, facilityId: string): number {
  const matching = arcs.arcs.filter((a) => a.facilityId === facilityId);
  if (matching.length === 0) return 0;
  return matching.reduce((s, a) => s + a.netCarbonPerT, 0) / matching.length;
}

function estimateMarginPerT(net: NetworkState, arcs: ArcSet, facilityId: string): number {
  const matching = arcs.arcs.filter((a) => a.facilityId === facilityId);
  if (matching.length === 0) return 0;
  return matching.reduce((s, a) => s + a.marginInrPerT, 0) / matching.length;
}


// ─────────────────────────────────────────────────────────────────────────────
// Resilience: N-1 contingency analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Borrowed from power-system planning: take every operating facility out, one at a
 * time, re-optimise, and measure how much of the network's output survives.
 *
 * A network whose output collapses when one plant trips is not a network, it is a
 * single plant with logistics attached. The score makes that visible before it
 * happens rather than after.
 */
export function resilienceReport(
  net: NetworkState,
  base: OptimizationResult,
  mode: ObjectiveMode,
): ResilienceReport {
  // The ledger's net, not `totals.netCarbonT`: the optimiser's aggregate uses
  // per-arc permanence and reads about a tenth lower, which would make the loss
  // percentages here disagree with the tCO₂e figures every Carbon screen shows.
  // The ranking is unaffected — Panipat is worst either way — but the numbers are not.
  // Both sides are complete plans, so each is valued on its own feedstock mix.
  const baseCarbon = networkLedger(
    base.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS,
  ).netT;
  const n1: ResilienceReport['n1Results'] = [];

  const operating = net.facilities.filter((f) => base.openFacilities.includes(f.id));

  for (const f of operating) {
    const trial = cloneNetwork(net);
    const target = trial.facilities.find((x) => x.id === f.id);
    if (!target) continue;
    target.status = 'offline';
    target.availability = 0;

    const r = optimize(trial, mode, {
      maxNodes: 40,
      skipShadowPrices: true,
      skipAlternatives: true,
    });
    const trialCarbon = networkLedger(
      r.allocations,
      trial.facilities,
      trial.vehicles,
      trial.assumptions,
      OWN_BASIS,
    ).netT;
    const lossPct =
      baseCarbon > 0 ? Math.max(0, ((baseCarbon - trialCarbon) / baseCarbon) * 100) : 0;

    // Which facilities picked up the slack?
    const beforeByFac = new Map<string, number>();
    for (const a of base.allocations) {
      beforeByFac.set(a.facilityId, (beforeByFac.get(a.facilityId) ?? 0) + a.tonnes);
    }
    const absorbedBy: string[] = [];
    const afterByFac = new Map<string, number>();
    for (const a of r.allocations) {
      afterByFac.set(a.facilityId, (afterByFac.get(a.facilityId) ?? 0) + a.tonnes);
    }
    for (const [fid, after] of afterByFac) {
      const before = beforeByFac.get(fid) ?? 0;
      if (after - before > 50) absorbedBy.push(fid);
    }

    n1.push({
      facilityId: f.id,
      facilityName: f.name,
      lossPct,
      strandedT: r.totals.strandedT - base.totals.strandedT,
      absorbedBy,
    });
  }

  n1.sort((a, b) => b.lossPct - a.lossPct);
  const worst = n1[0] ?? { facilityId: '', facilityName: 'none', lossPct: 0 };
  const meanLoss = n1.length > 0 ? n1.reduce((s, x) => s + x.lossPct, 0) / n1.length : 0;

  // Redundancy: what share of allocated tonnage has a viable second home?
  const arcs = buildArcs(net);
  let redundantT = 0;
  let totalT = 0;
  const loadByFacility = new Map<string, number>();
  for (const a of base.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }
  for (const a of base.allocations) {
    totalT += a.tonnes;
    const srcIdx = net.sources.findIndex((s) => s.id === a.sourceId);
    if (srcIdx < 0) continue;
    const alternatives = arcs.bySource[srcIdx].filter((r) => {
      const fac = net.facilities[r.facility];
      if (fac.id === a.facilityId) return false;
      const cap = fac.capacityTpd * fac.availability * net.assumptions.windowDays;
      return cap - (loadByFacility.get(fac.id) ?? 0) > a.tonnes * 0.5;
    });
    if (alternatives.length > 0) redundantT += a.tonnes;
  }
  const redundancyPct = totalT > 0 ? (redundantT / totalT) * 100 : 0;
  const fleetHeadroomPct = Math.max(0, 100 - base.totals.fleetUtilisationPct);

  const components = [
    {
      label: 'Single-point exposure',
      value: Math.max(0, 100 - Math.min(100, worst.lossPct * 2.5)),
      weight: 0.45,
      note: `Worst single-facility outage costs ${worst.lossPct.toFixed(1)}% of net carbon (${worst.facilityName}).`,
    },
    {
      label: 'Average contingency loss',
      value: Math.max(0, 100 - Math.min(100, meanLoss * 6)),
      weight: 0.2,
      note: `Mean loss across ${n1.length} single-facility outages is ${meanLoss.toFixed(1)}%.`,
    },
    {
      label: 'Feedstock re-routability',
      value: redundancyPct,
      weight: 0.2,
      note: `${redundancyPct.toFixed(0)}% of allocated tonnage has a second facility with enough headroom to take it.`,
    },
    {
      label: 'Fleet headroom',
      value: fleetHeadroomPct,
      weight: 0.15,
      note: `${fleetHeadroomPct.toFixed(0)}% of vehicle-days are unused and available to absorb re-routing.`,
    },
  ];

  const score = components.reduce((s, c) => s + c.value * c.weight, 0);
  const grade =
    score >= 80 ? 'Strong' : score >= 65 ? 'Adequate' : score >= 50 ? 'Fragile' : 'Critical';

  return {
    score,
    grade,
    worstCaseFacilityId: worst.facilityId,
    worstCaseFacilityName: worst.facilityName,
    worstCaseLossPct: worst.lossPct,
    meanLossPct: meanLoss,
    n1Results: n1,
    components,
    method:
      'N-1 contingency analysis: every operating facility is taken offline in turn and the network re-optimised. The score is a weighted blend of single-point exposure, average contingency loss, feedstock re-routability and fleet headroom.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Opportunity scoring
// ─────────────────────────────────────────────────────────────────────────────

export function opportunityScores(
  net: NetworkState,
  result: OptimizationResult,
): OpportunityScore[] {
  const arcs = buildArcs(net);
  const sc = objectiveScale(arcs.arcs);
  const windowDays = net.assumptions.windowDays;
  const maxVolume = Math.max(...net.sources.map((s) => s.availableT), 1);

  const loadByFacility = new Map<string, number>();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }

  const out: OpportunityScore[] = [];

  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const row = arcs.bySource[i];

    if (row.length === 0) {
      out.push({
        sourceId: src.id,
        name: src.name,
        stream: src.stream,
        score: 0,
        tonnes: src.availableT,
        components: {
          volume: src.availableT / maxVolume,
          proximity: 0,
          carbonPotential: 0,
          conversionValue: 0,
          transportBurden: 0,
          facilityAvailability: 0,
        },
        bestPathway: 'composting',
        bestFacilityId: null,
        headroomT: 0,
        note: 'No feasible pathway in range. This lot cannot currently be served by the network.',
      });
      continue;
    }

    let best = row[0];
    let bestScore = -Infinity;
    for (const r of row) {
      const a = arcs.arcs[r.arcIndex];
      const v = a.netCarbonPerT / sc.maxCarbon + a.marginInrPerT / sc.maxMargin;
      if (v > bestScore) {
        bestScore = v;
        best = r;
      }
    }
    const bestArc = arcs.arcs[best.arcIndex];
    const nearestKm = Math.min(...row.map((r) => arcs.arcs[r.arcIndex].distanceKm));

    let headroom = 0;
    for (const r of row) {
      const fac = net.facilities[r.facility];
      const cap = fac.capacityTpd * fac.availability * windowDays;
      headroom += Math.max(0, cap - (loadByFacility.get(fac.id) ?? 0));
    }

    const components = {
      volume: src.availableT / maxVolume,
      proximity: Math.max(0, 1 - nearestKm / net.assumptions.maxHaulKm),
      carbonPotential: Math.max(0, bestArc.netCarbonPerT / sc.maxCarbon),
      conversionValue: Math.max(0, bestArc.marginInrPerT / sc.maxMargin),
      transportBurden: Math.max(0, 1 - bestArc.tkmPerT / sc.maxTkm),
      facilityAvailability: Math.min(1, headroom / Math.max(1, src.availableT)),
    };

    const score =
      100 *
      (0.18 * components.volume +
        0.14 * components.proximity +
        0.26 * components.carbonPotential +
        0.22 * components.conversionValue +
        0.1 * components.transportBurden +
        0.1 * components.facilityAvailability);

    const allocated = result.allocations
      .filter((a) => a.sourceId === src.id)
      .reduce((s, a) => s + a.tonnes, 0);

    out.push({
      sourceId: src.id,
      name: src.name,
      stream: src.stream,
      score,
      tonnes: src.availableT,
      components,
      bestPathway: bestArc.pathway as PathwayId,
      bestFacilityId: bestArc.facilityId,
      headroomT: headroom,
      note:
        allocated >= src.availableT - 1
          ? 'Fully allocated in the current plan.'
          : allocated > 0
            ? `${(src.availableT - allocated).toFixed(0)} t still unplaced.`
            : `Unplaced. Best theoretical route is ${PATHWAYS[bestArc.pathway].short} at ${bestArc.distanceKm.toFixed(0)} km.`,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
