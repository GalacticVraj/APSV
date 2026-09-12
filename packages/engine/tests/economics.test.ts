import test from 'node:test';
import assert from 'node:assert';
import {
  levelizedCostOfProcessing,
  expansionNpv,
  lifeCycleAvoidedCost,
  abatementCost
} from '../src/economics.ts';
import type { Facility } from '../src/types.ts';

test('Levelized Cost of Processing (LCOP) computes correctly', () => {
  // Dummy facility
  const fac: Facility = {
    id: 'fac1',
    name: 'Test Fac',
    operator: 'Op',
    district: 'D',
    state: 'S',
    lat: 0,
    lon: 0,
    pathway: 'pyrolysis_biochar',
    capacityTpd: 100, // 33000 tonnes/year
    minFeedTpd: 50,
    availability: 1.0,
    status: 'online',
    acceptedStreams: [],
    efficiency: 1.0,
    opexInrPerT: 2000,
    capexAmortInrPerT: 1000, // Implies a certain capex based on crf
    commissioned: 2024,
    powerSource: 'grid'
  };
  
  // WACC 10%
  const lcop = levelizedCostOfProcessing(fac, 0.10, 20);
  
  // If we reconstructed Capex correctly and discount both cost and throughput at 10%, 
  // the LCOP should roughly equal opexInrPerT + capexAmortInrPerT if throughput is constant.
  // We expect LCOP to be exactly 3000 in this simplified mathematical formulation.
  assert.ok(Math.abs(lcop - 3000) < 1.0, `Expected ~3000, got ${lcop}`);
});

test('Discounted Cash Flow (DCF) for Expansion computes correctly', () => {
  // Shadow price = ₹1000 per extra tonne per day
  // Capex to add 1 tpd = ₹2,000,000
  // Discount rate 10%, 10 years
  // Annual cash flow = 1000 * 330 = ₹330,000
  // NPV = -2,000,000 + PV(330k, 10yrs, 10%)
  // PV = 330,000 * (1 - (1.1)^-10) / 0.10 = 330,000 * 6.144567 = 2,027,707.15
  // NPV should be around 27,707
  
  const result = expansionNpv(1000, 2000000, 0.10, 10);
  assert.ok(result.npv > 27700 && result.npv < 27710, `Expected ~27707, got ${result.npv}`);
  assert.equal(result.realOptionWaitValue, 0, 'Should not recommend waiting if NPV > 0');
  
  const badResult = expansionNpv(500, 2000000, 0.10, 10);
  assert.ok(badResult.npv < -900000, `Expected negative NPV, got ${badResult.npv}`);
  assert.ok(badResult.realOptionWaitValue > 0, 'Should have positive wait value for negative NPV');
});

test('Life Cycle Costing (LCC) baseline', () => {
  const avoided = lifeCycleAvoidedCost(100, 1500);
  assert.equal(avoided, 150000);
});

test('Marginal Abatement Cost (MACC)', () => {
  // Negative margin implies a cost.
  // e.g. Cost is ₹1000, abate 2 tonnes -> Abatement cost = ₹500/tCO2e
  const mac1 = abatementCost(-1000, 2);
  assert.equal(mac1, 500); // 1000 / 2 = 500
  
  // Positive margin implies profit.
  // e.g. Profit is ₹2000, abate 2 tonnes -> Abatement cost = -₹1000/tCO2e
  const mac2 = abatementCost(2000, 2);
  assert.equal(mac2, -1000);
});
