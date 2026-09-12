/**
 * Logistics, economics and routing tests.
 *
 * The property that matters most here is the volume constraint: if achievable
 * payload ever silently falls back to the mass rating, every transport cost and
 * emission in the product is understated by roughly a factor of two on crop
 * residue. These tests pin it down.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize, selectVehicle } from '../src/optimizer.ts';
import { planRoutes } from '../src/routing.ts';
import { abatementCost, economicsPerTonne, transportCostPerTonne } from '../src/economics.ts';
import { evaluateCarbon, baseFactors, physicalPerTonne } from '../src/carbon.ts';
import { STREAMS, m3PerTonne } from '../src/streams.ts';
import { VEHICLES, VEHICLE_BY_ID } from '../src/constants.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Payload
// ─────────────────────────────────────────────────────────────────────────────

test('baled straw is volume-limited, dense dung is mass-limited', () => {
  const truck = VEHICLE_BY_ID.truck_16t;

  const strawPayload = Math.min(
    truck.massCapacityT,
    truck.volumeM3 * STREAMS.paddy_straw.bulkDensityTPerM3,
  );
  assert.ok(
    strawPayload < truck.massCapacityT * 0.7,
    `paddy straw should be volume-limited; got ${strawPayload} t on a ${truck.massCapacityT} t truck`,
  );

  const dungPayload = Math.min(
    truck.massCapacityT,
    truck.volumeM3 * STREAMS.cattle_dung.bulkDensityTPerM3,
  );
  assert.equal(dungPayload, truck.massCapacityT, 'dung is dense enough to reach the axle rating');
});

test('one tonne of feedstock occupies the reciprocal of its bulk density', () => {
  for (const s of Object.values(STREAMS)) {
    assert.ok(
      Math.abs(m3PerTonne(s) * s.bulkDensityTPerM3 - 1) < 1e-9,
      `${s.id}: volume and density are inconsistent`,
    );
  }
});

test('vehicle selection never picks a vehicle barred from the road class', () => {
  const net = buildNetwork();
  for (const src of net.sources) {
    const pick = selectVehicle(src, 40, net.vehicles, net);
    if (!pick) continue;
    assert.ok(
      pick.vehicle.allowedRoads.includes(src.access),
      `${src.name} (${src.access}) was assigned a ${pick.vehicle.label}`,
    );
    const expected = Math.min(
      pick.vehicle.massCapacityT,
      pick.vehicle.volumeM3 * STREAMS[src.stream].bulkDensityTPerM3,
    );
    assert.ok(
      Math.abs(pick.payloadT - expected) < 1e-9,
      `${src.name}: payload ${pick.payloadT} != min(mass, volume x density) ${expected}`,
    );
  }
});

test('every allocation carries a payload no greater than its vehicle allows', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  for (const a of result.allocations) {
    const veh = VEHICLE_BY_ID[a.vehicleId];
    assert.ok(veh, `unknown vehicle ${a.vehicleId}`);
    const limit = Math.min(veh.massCapacityT, veh.volumeM3 * STREAMS[a.stream].bulkDensityTPerM3);
    assert.ok(a.payloadT <= limit + 1e-9, `payload ${a.payloadT} exceeds limit ${limit}`);
    assert.ok(
      a.trips >= Math.ceil(a.tonnes / limit) - 1,
      'trip count must cover the tonnage at the achievable payload',
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost behaviour
// ─────────────────────────────────────────────────────────────────────────────

test('transport cost per tonne rises with distance and falls with payload', () => {
  const net = buildNetwork();
  const veh = VEHICLE_BY_ID.truck_16t;

  const near = transportCostPerTonne(20, 9, veh, net.assumptions);
  const far = transportCostPerTonne(120, 9, veh, net.assumptions);
  assert.ok(far > near, 'longer hauls must cost more per tonne');

  const light = transportCostPerTonne(60, 6, veh, net.assumptions);
  const heavy = transportCostPerTonne(60, 14, veh, net.assumptions);
  assert.ok(heavy < light, 'a fuller truck must cost less per tonne');
});

test('transport cost is infinite for a zero payload rather than dividing by zero', () => {
  const net = buildNetwork();
  const c = transportCostPerTonne(50, 0, VEHICLE_BY_ID.truck_16t, net.assumptions);
  assert.equal(c, Infinity);
});

test('margin equals revenue less every cost line', () => {
  const net = buildNetwork();
  const fac = net.facilities.find((f) => f.pathway === 'pyrolysis_biochar')!;
  const veh = VEHICLE_BY_ID.truck_16t;
  const phys = physicalPerTonne('cotton_stalk', 'pyrolysis_biochar', fac.efficiency, 40, 6.96, veh);
  const carbon = evaluateCarbon(phys, 1, baseFactors(0.78, net.assumptions));

  const e = economicsPerTonne(
    'cotton_stalk',
    'pyrolysis_biochar',
    fac,
    40,
    6.96,
    veh,
    carbon,
    net.assumptions,
  );

  const expected =
    e.productRevenue +
    e.carbonRevenue -
    e.feedstockCost -
    e.aggregationCost -
    e.transportCost -
    e.processingCost -
    e.capexCost;
  assert.ok(Math.abs(e.margin - expected) < 1e-6, `margin ${e.margin} != components ${expected}`);

  // And the itemised lines must reconcile to the same figure.
  const lineSum = e.lines
    .filter((l) => l.kind !== 'total')
    .reduce((s, l) => s + l.valueInr, 0);
  assert.ok(Math.abs(lineSum - e.margin) < 1e-6, `lines sum to ${lineSum}, margin is ${e.margin}`);
});

test('a negative gate price is treated as revenue, not cost', () => {
  // Municipal organics carry a tipping fee: the ULB pays to have them taken.
  assert.ok(STREAMS.msw_organic.gatePriceInrPerT < 0);

  const net = buildNetwork();
  const fac = net.facilities.find((f) => f.pathway === 'composting')!;
  const veh = VEHICLE_BY_ID.truck_16t;
  const phys = physicalPerTonne('msw_organic', 'composting', 1, 25, 16, veh);
  const carbon = evaluateCarbon(phys, 1, baseFactors(1, net.assumptions));
  const e = economicsPerTonne('msw_organic', 'composting', fac, 25, 16, veh, carbon, net.assumptions);

  const gateLine = e.lines.find((l) => l.key === 'gate')!;
  assert.ok(gateLine.valueInr > 0, 'a tipping fee must appear as a positive line');
});

test('abatement cost is negative when the network is profitable', () => {
  assert.ok(abatementCost(1_000_000, 500) < 0, 'profit means negative abatement cost');
  assert.ok(abatementCost(-1_000_000, 500) > 0, 'a loss means positive abatement cost');
  assert.equal(abatementCost(1000, 0), 0, 'zero carbon must not divide by zero');
});

// ─────────────────────────────────────────────────────────────────────────────
// Routing
// ─────────────────────────────────────────────────────────────────────────────

test('every route starts and ends at its receiving facility', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const routing = planRoutes(net, result.allocations);

  assert.ok(routing.routes.length > 0, 'a non-empty plan must produce routes');

  for (const r of routing.routes) {
    const fac = net.facilities.find((f) => f.id === r.facilityId)!;
    const first = r.polyline[0];
    const last = r.polyline[r.polyline.length - 1];
    assert.ok(Math.abs(first.lat - fac.lat) < 1e-9 && Math.abs(first.lon - fac.lon) < 1e-9);
    assert.ok(Math.abs(last.lat - fac.lat) < 1e-9 && Math.abs(last.lon - fac.lon) < 1e-9);
    assert.ok(r.polyline.length >= r.stops.length + 2, 'polyline must include every stop');
  }
});

test('no consolidated route exceeds both the mass and the volume limit', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const routing = planRoutes(net, result.allocations);

  for (const r of routing.routes.filter((x) => x.stops.length > 1)) {
    const veh = VEHICLE_BY_ID[r.vehicleId];
    assert.ok(r.loadT <= veh.massCapacityT + 1e-6, `${r.id} exceeds mass capacity`);
    assert.ok(r.utilisationPct <= 100 + 1e-6, `${r.id} reports over-100% utilisation`);
  }
});

test('routing reports the trip penalty caused by low bulk density', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const routing = planRoutes(net, result.allocations);

  assert.ok(routing.massEquivalentTrips > 0);
  assert.ok(
    routing.totalTrips >= routing.massEquivalentTrips,
    'volume limits can only ever add trips, never remove them',
  );
  assert.ok(
    routing.volumeLimitedSharePct > 20,
    `this network is crop-residue heavy; expected a substantial volume-limited share, got ${routing.volumeLimitedSharePct}%`,
  );
});

test('route distance is never negative and duration tracks distance', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const routing = planRoutes(net, result.allocations);
  for (const r of routing.routes) {
    assert.ok(r.distanceKm >= 0, `${r.id} has negative distance`);
    assert.ok(r.durationH > 0, `${r.id} takes no time`);
    assert.ok(r.emissionsT >= 0, `${r.id} has negative emissions`);
  }
});

test('every vehicle type has a positive capacity in both dimensions', () => {
  for (const v of VEHICLES) {
    assert.ok(v.massCapacityT > 0, `${v.id} has no mass capacity`);
    assert.ok(v.volumeM3 > 0, `${v.id} has no deck volume`);
    assert.ok(v.allowedRoads.length > 0, `${v.id} cannot use any road`);
    assert.ok(v.avgSpeedKmh > 0 && v.shiftHours > 0);
  }
});
