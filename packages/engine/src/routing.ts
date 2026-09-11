/**
 * Vehicle routing.
 *
 * Allocation says *how much* goes where. Routing says *how*, and it is where the
 * bulk-density constraint stops being a footnote and starts costing money.
 *
 * Two ideas taken from the AWS waste-collector planner and then generalised:
 *   - trucks must return to the receiving facility, so every route is a closed tour;
 *   - vehicle *dimensions* constrain the load, not just the mass rating.
 *
 * The second is the important one. Baled paddy straw is 0.15 t/m3, so a 16 t truck
 * with 58 m3 of deck carries 8.7 t. Every cost and emission per tonne on that arc is
 * therefore 1.8x what a mass-only model would report.
 *
 * Full truckloads are hauled direct — there is nothing to gain by consolidating a
 * load that already fills the vehicle. The residual part-loads are consolidated into
 * milk runs by the Clarke-Wright savings algorithm, then improved with Or-opt. That
 * mirrors how an operator actually dispatches.
 */

import type {
  Allocation,
  Facility,
  GeoPoint,
  NetworkState,
  RouteStop,
  RoutingResult,
  VehicleRoute,
  VehicleType,
  WasteSource,
} from './types.ts';
import { roadDistanceKm } from './geo.ts';
import { DIESEL_WTW_KG_PER_L } from './constants.ts';
import { EMPTY_RETURN_FUEL_RATIO } from './carbon.ts';
import { STREAMS } from './streams.ts';

interface PartialLoad {
  source: WasteSource;
  tonnes: number;
  vehicleId: string;
  payloadT: number;
}

function dist(net: NetworkState, a: GeoPoint, b: GeoPoint, access: WasteSource['access']): number {
  return roadDistanceKm(a, b, net.assumptions.circuityFactor, access);
}

function routeDistance(net: NetworkState, facility: Facility, stops: WasteSource[]): number {
  if (stops.length === 0) return 0;
  let d = dist(net, facility, stops[0], stops[0].access);
  for (let i = 0; i < stops.length - 1; i++) {
    d += dist(net, stops[i], stops[i + 1], stops[i + 1].access);
  }
  d += dist(net, stops[stops.length - 1], facility, stops[stops.length - 1].access);
  return d;
}

/**
 * Or-opt: try relocating each stop to every other position in the tour and keep any
 * move that shortens it. Cheap, deterministic, and enough for tours of the size
 * consolidation produces here (rarely more than five or six stops).
 */
function orOptImprove(
  net: NetworkState,
  facility: Facility,
  stops: WasteSource[],
): { stops: WasteSource[]; passes: number } {
  let current = stops.slice();
  let best = routeDistance(net, facility, current);
  let improved = true;
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes++;
    for (let i = 0; i < current.length; i++) {
      for (let j = 0; j < current.length; j++) {
        if (i === j) continue;
        const trial = current.slice();
        const [moved] = trial.splice(i, 1);
        trial.splice(j, 0, moved);
        const d = routeDistance(net, facility, trial);
        if (d < best - 1e-9) {
          best = d;
          current = trial;
          improved = true;
        }
      }
    }
  }
  return { stops: current, passes };
}

/**
 * Clarke-Wright savings for the part-loads feeding one facility with one vehicle
 * type. Savings s(i,j) = d(f,i) + d(f,j) - d(i,j); merge the highest-saving pair
 * whose combined load still fits both the mass and the volume limit.
 */
function clarkeWright(
  net: NetworkState,
  facility: Facility,
  loads: PartialLoad[],
  vehicle: VehicleType,
): Array<{ stops: PartialLoad[]; distanceKm: number; passes: number }> {
  if (loads.length === 0) return [];

  // Each part-load starts on its own out-and-back route.
  let routes: PartialLoad[][] = loads.map((l) => [l]);

  const loadOf = (r: PartialLoad[]) => r.reduce((s, x) => s + x.tonnes, 0);
  const volumeOf = (r: PartialLoad[]) =>
    r.reduce((s, x) => s + x.tonnes / STREAMS[x.source.stream].bulkDensityTPerM3, 0);

  interface Saving {
    a: number;
    b: number;
    value: number;
  }
  const savings: Saving[] = [];
  for (let i = 0; i < loads.length; i++) {
    for (let j = i + 1; j < loads.length; j++) {
      const si = loads[i].source;
      const sj = loads[j].source;
      const value =
        dist(net, facility, si, si.access) +
        dist(net, facility, sj, sj.access) -
        dist(net, si, sj, sj.access);
      if (value > 0) savings.push({ a: i, b: j, value });
    }
  }
  // Deterministic ordering: value descending, then index, so runs are reproducible.
  savings.sort((x, y) => y.value - x.value || x.a - y.a || x.b - y.b);

  const routeOfLoad = new Map<number, number>();
  loads.forEach((_, i) => routeOfLoad.set(i, i));

  for (const s of savings) {
    const ra = routeOfLoad.get(s.a);
    const rb = routeOfLoad.get(s.b);
    if (ra === undefined || rb === undefined || ra === rb) continue;
    const merged = routes[ra].concat(routes[rb]);
    if (merged.length > 6) continue; // a driver shift will not absorb more stops
    if (loadOf(merged) > vehicle.massCapacityT + 1e-9) continue;
    if (volumeOf(merged) > vehicle.volumeM3 + 1e-9) continue;

    routes[ra] = merged;
    routes[rb] = [];
    for (const [k, v] of routeOfLoad) if (v === rb) routeOfLoad.set(k, ra);
  }

  routes = routes.filter((r) => r.length > 0);

  return routes.map((r) => {
    const improved = orOptImprove(
      net,
      facility,
      r.map((x) => x.source),
    );
    const ordered = improved.stops.map(
      (src) => r.find((x) => x.source.id === src.id) as PartialLoad,
    );
    return {
      stops: ordered,
      distanceKm: routeDistance(net, facility, improved.stops),
      passes: improved.passes,
    };
  });
}

export function planRoutes(net: NetworkState, allocations: Allocation[]): RoutingResult {
  const srcById = new Map(net.sources.map((s) => [s.id, s]));
  const facById = new Map(net.facilities.map((f) => [f.id, f]));
  const vehById = new Map(net.vehicles.map((v) => [v.id, v]));

  const routes: VehicleRoute[] = [];
  let totalDistanceKm = 0;
  let directHaulDistanceKm = 0;
  let totalTrips = 0;
  let vehicleHours = 0;
  let improvementPasses = 0;
  let massEquivalentTrips = 0;
  let volumeLimitedTonnes = 0;
  let movedTonnes = 0;

  // Group part-loads by facility and vehicle type for consolidation.
  const partials = new Map<string, PartialLoad[]>();

  for (const a of allocations) {
    const src = srcById.get(a.sourceId);
    const fac = facById.get(a.facilityId);
    const veh = vehById.get(a.vehicleId);
    if (!src || !fac || !veh) continue;

    const fullTrips = Math.floor(a.tonnes / a.payloadT);
    const remainder = a.tonnes - fullTrips * a.payloadT;

    // How many trips this lot would need if only the axle rating mattered.
    // The gap between that and reality is the cost of hauling fluff.
    massEquivalentTrips += Math.ceil(a.tonnes / veh.massCapacityT);
    movedTonnes += a.tonnes;
    if (a.payloadT < veh.massCapacityT - 1e-6) volumeLimitedTonnes += a.tonnes;

    // Baseline for the consolidation comparison: everything hauled direct.
    directHaulDistanceKm += Math.ceil(a.tonnes / a.payloadT) * a.distanceKm * 2;

    if (fullTrips > 0) {
      const distanceKm = a.distanceKm * 2 * fullTrips;
      totalDistanceKm += distanceKm;
      totalTrips += fullTrips;
      vehicleHours += fullTrips * ((2 * a.distanceKm) / veh.avgSpeedKmh + 1.6);
      const fuelL = veh.dieselLPerKm * a.distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO) * fullTrips;
      routes.push({
        id: `R-${a.sourceId}-${a.facilityId}-direct`,
        facilityId: fac.id,
        facilityName: fac.name,
        vehicleId: veh.id,
        vehicleLabel: veh.label,
        stops: [
          {
            sourceId: src.id,
            name: src.name,
            lat: src.lat,
            lon: src.lon,
            tonnesPicked: fullTrips * a.payloadT,
            cumulativeLoadT: a.payloadT,
          },
        ],
        polyline: [
          { lat: fac.lat, lon: fac.lon },
          { lat: src.lat, lon: src.lon },
          { lat: fac.lat, lon: fac.lon },
        ],
        distanceKm,
        durationH: fullTrips * ((2 * a.distanceKm) / veh.avgSpeedKmh + 1.6),
        loadT: fullTrips * a.payloadT,
        payloadT: a.payloadT,
        utilisationPct: 100,
        limitedBy:
          a.payloadT < veh.massCapacityT - 1e-6 ? 'volume' : 'mass',
        costInr: 0,
        emissionsT: (fuelL * DIESEL_WTW_KG_PER_L) / 1000,
      });
    }

    if (remainder > 0.5) {
      const key = `${a.facilityId}|${a.vehicleId}`;
      const list = partials.get(key) ?? [];
      list.push({ source: src, tonnes: remainder, vehicleId: a.vehicleId, payloadT: a.payloadT });
      partials.set(key, list);
    }
  }

  // Consolidate the part-loads into milk runs.
  for (const [key, loads] of partials) {
    const [facilityId, vehicleId] = key.split('|');
    const fac = facById.get(facilityId);
    const veh = vehById.get(vehicleId);
    if (!fac || !veh) continue;

    const built = clarkeWright(net, fac, loads, veh);
    for (let i = 0; i < built.length; i++) {
      const r = built[i];
      improvementPasses += r.passes;
      const loadT = r.stops.reduce((s, x) => s + x.tonnes, 0);
      const volumeM3 = r.stops.reduce(
        (s, x) => s + x.tonnes / STREAMS[x.source.stream].bulkDensityTPerM3,
        0,
      );
      const limitedBy =
        volumeM3 / veh.volumeM3 > loadT / veh.massCapacityT ? 'volume' : 'mass';
      const utilisationPct =
        limitedBy === 'volume'
          ? (volumeM3 / veh.volumeM3) * 100
          : (loadT / veh.massCapacityT) * 100;

      totalDistanceKm += r.distanceKm;
      totalTrips += 1;
      const durationH = r.distanceKm / veh.avgSpeedKmh + 0.8 * r.stops.length + 0.8;
      vehicleHours += durationH;
      const fuelL = veh.dieselLPerKm * r.distanceKm;

      let cumulative = 0;
      const stops: RouteStop[] = r.stops.map((x) => {
        cumulative += x.tonnes;
        return {
          sourceId: x.source.id,
          name: x.source.name,
          lat: x.source.lat,
          lon: x.source.lon,
          tonnesPicked: x.tonnes,
          cumulativeLoadT: cumulative,
        };
      });

      const polyline: GeoPoint[] = [
        { lat: fac.lat, lon: fac.lon },
        ...r.stops.map((x) => ({ lat: x.source.lat, lon: x.source.lon })),
        { lat: fac.lat, lon: fac.lon },
      ];

      routes.push({
        id: `R-${facilityId}-${vehicleId}-mr${i}`,
        facilityId: fac.id,
        facilityName: fac.name,
        vehicleId: veh.id,
        vehicleLabel: veh.label,
        stops,
        polyline,
        distanceKm: r.distanceKm,
        durationH,
        loadT,
        payloadT: Math.min(veh.massCapacityT, veh.volumeM3 * 0.15),
        utilisationPct,
        limitedBy,
        costInr:
          veh.dieselLPerKm * r.distanceKm * net.assumptions.dieselPriceInrPerL +
          veh.costInrPerKm * r.distanceKm * 0.45 +
          veh.fixedCostInrPerTrip,
        emissionsT: (fuelL * DIESEL_WTW_KG_PER_L) / 1000,
      });
    }
  }

  const fleetCapacityHours = net.vehicles.reduce(
    (s, v) => s + v.fleetSize * v.shiftHours * net.assumptions.windowDays,
    0,
  );

  routes.sort((a, b) => b.distanceKm - a.distanceKm);

  return {
    routes,
    totalDistanceKm,
    directHaulDistanceKm,
    consolidationSavingPct:
      directHaulDistanceKm > 0
        ? ((directHaulDistanceKm - totalDistanceKm) / directHaulDistanceKm) * 100
        : 0,
    totalTrips,
    vehicleDaysUsed: vehicleHours / 10,
    fleetCapacityDays: fleetCapacityHours / 10,
    infeasibleTonnes: Math.max(0, vehicleHours - fleetCapacityHours) / 10,
    improvementPasses,
    massEquivalentTrips,
    extraTripsFromVolume: Math.max(0, totalTrips - massEquivalentTrips),
    volumeLimitedSharePct: movedTonnes > 0 ? (volumeLimitedTonnes / movedTonnes) * 100 : 0,
  };
}
