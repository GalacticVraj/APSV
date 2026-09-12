/**
 * The digital twin.
 *
 * Holds the authoritative network state and every derived artefact, with explicit
 * invalidation. Derived results are memoised against a state version so the UI can
 * ask for anything at any time without triggering redundant solves, and so the
 * copilot reads exactly the same numbers the screens display — there is one source
 * of truth, not a screen model and a chat model that can drift apart.
 */

import type {
  Assumptions,
  Bottleneck,
  CarbonLedger,
  NetworkEvent,
  NetworkState,
  ObjectiveMode,
  OpportunityScore,
  OptimizationResult,
  ResilienceReport,
  RoutingResult,
  ScenarioInstance,
  ScenarioResult,
  Severity,
  StrandedLot,
} from './types.ts';
import { buildNetwork } from './network.ts';
import { optimize, baselineResult, buildArcs, arcValueWeighted, objectiveScale } from './optimizer.ts';
import { planRoutes } from './routing.ts';
import {
  aggregateAllocations,
  buildLedger,
  dominantBiocharStream,
  permanenceFor,
} from './carbon.ts';
import {
  detectBottlenecks,
  opportunityScores,
  resilienceReport,
  strandedLots,
} from './bottleneck.ts';
import { forecastNetwork, type NetworkForecast } from './forecast.ts';
import { carbonHistory, type CarbonHistory } from './history.ts';
import { applyScenario, runScenario } from './scenario.ts';
import { rollupEconomics, type EconAggregate } from './economics.ts';
import { solveTransport } from './mincostflow.ts';
import { materialiseAllocations, computeTotals } from './optimizer.ts';

export interface TwinSnapshot {
  version: number;
  asOf: string;
  objective: ObjectiveMode;
  network: NetworkState;
  result: OptimizationResult;
  baseline: OptimizationResult;
  routing: RoutingResult;
  ledger: CarbonLedger;
  economics: EconAggregate;
  bottlenecks: Bottleneck[];
  stranded: StrandedLot[];
  opportunities: OpportunityScore[];
}

export interface ParetoPoint {
  weight: number;
  netCarbonT: number;
  marginInr: number;
  divertedT: number;
  isCurrent: boolean;
}

export class Twin {
  private state: NetworkState;
  private objective: ObjectiveMode = 'balanced';
  private version = 0;
  private events: NetworkEvent[] = [];

  private cacheResult: OptimizationResult | null = null;
  private cacheBaseline: OptimizationResult | null = null;
  private cacheRouting: RoutingResult | null = null;
  private cacheLedger: CarbonLedger | null = null;
  private cacheBottlenecks: Bottleneck[] | null = null;
  private cacheStranded: StrandedLot[] | null = null;
  private cacheOpportunities: OpportunityScore[] | null = null;
  private cacheResilience: ResilienceReport | null = null;
  private cacheForecast: NetworkForecast | null = null;
  private cachePareto: ParetoPoint[] | null = null;
  private cacheHistory: CarbonHistory | null = null;
  private lastScenario: ScenarioResult | null = null;

  constructor() {
    this.state = buildNetwork();
    this.log('system', 'info', 'Network initialised', `${this.state.sources.length} sources, ${this.state.facilities.length} facilities, window ${this.state.assumptions.windowDays} days`, []);
  }

  // ── State access ──────────────────────────────────────────────────────────

  getState(): NetworkState {
    return this.state;
  }

  getObjective(): ObjectiveMode {
    return this.objective;
  }

  getVersion(): number {
    return this.version;
  }

  private invalidate(keepForecast = true): void {
    this.version++;
    this.cacheResult = null;
    this.cacheBaseline = null;
    this.cacheRouting = null;
    this.cacheLedger = null;
    this.cacheBottlenecks = null;
    this.cacheStranded = null;
    this.cacheOpportunities = null;
    this.cacheResilience = null;
    this.cachePareto = null;
    // History re-solves against the live estate and assumptions, so anything that
    // changes the plan changes the trend too.
    this.cacheHistory = null;
    if (!keepForecast) this.cacheForecast = null;
  }

  setObjective(mode: ObjectiveMode): void {
    if (mode === this.objective) return;
    const prev = this.objective;
    this.objective = mode;
    this.invalidate();
    this.log(
      'optimization',
      'info',
      'Objective changed',
      `Optimisation objective switched from ${prev} to ${mode}. Network re-solved.`,
      [],
    );
  }

  updateAssumptions(patch: Partial<Assumptions>): void {
    const changedSeason =
      patch.windowDays !== undefined && patch.windowDays !== this.state.assumptions.windowDays;
    this.state.assumptions = { ...this.state.assumptions, ...patch };
    this.invalidate(!changedSeason);
    this.log(
      'system',
      'info',
      'Assumptions updated',
      Object.entries(patch)
        .map(([k, v]) => `${k} = ${v}`)
        .join(', '),
      [],
    );
  }

  reset(): void {
    this.state = buildNetwork();
    this.objective = 'balanced';
    this.invalidate(false);
    this.lastScenario = null;
    this.events = [];
    this.log('system', 'info', 'Network reset', 'All scenario mutations cleared, baseline state restored.', []);
  }

  // ── Derived artefacts ─────────────────────────────────────────────────────

  getResult(): OptimizationResult {
    if (!this.cacheResult) {
      this.cacheResult = optimize(this.state, this.objective);
      this.log(
        'optimization',
        'info',
        'Network optimised',
        `${this.cacheResult.telemetry.arcsFeasible} feasible arcs, ${this.cacheResult.telemetry.bnbNodesExplored} branch-and-bound nodes, ${this.cacheResult.totals.divertedT.toFixed(0)} t allocated in ${this.cacheResult.telemetry.solveMs} ms`,
        [],
      );
    }
    return this.cacheResult;
  }

  getBaseline(): OptimizationResult {
    if (!this.cacheBaseline) {
      this.cacheBaseline = baselineResult(this.state, this.objective);
    }
    return this.cacheBaseline;
  }

  getRouting(): RoutingResult {
    if (!this.cacheRouting) {
      this.cacheRouting = planRoutes(this.state, this.getResult().allocations);
    }
    return this.cacheRouting;
  }

  getLedger(): CarbonLedger {
    if (!this.cacheLedger) {
      const result = this.getResult();
      const agg = aggregateAllocations(
        result.allocations,
        this.state.facilities,
        this.state.vehicles,
        this.state.assumptions,
      );
      const dominant = dominantBiocharStream(result.allocations);
      const permanence = dominant
        ? permanenceFor(dominant, this.state.assumptions.soilTempC)
        : null;
      this.cacheLedger = buildLedger(agg, this.state.assumptions, permanence, true);
    }
    return this.cacheLedger;
  }

  getCarbonAggregate() {
    const result = this.getResult();
    return aggregateAllocations(
      result.allocations,
      this.state.facilities,
      this.state.vehicles,
      this.state.assumptions,
    );
  }

  getEconomics(): EconAggregate {
    return rollupEconomics(this.getResult().allocations);
  }

  getBottlenecks(): Bottleneck[] {
    if (!this.cacheBottlenecks) {
      this.cacheBottlenecks = detectBottlenecks(this.state, this.getResult());
      for (const b of this.cacheBottlenecks.slice(0, 3)) {
        if (b.severity === 'critical' || b.severity === 'high') {
          this.log('alert', b.severity as Severity, b.title, b.detail, b.entityIds);
        }
      }
    }
    return this.cacheBottlenecks;
  }

  getStranded(): StrandedLot[] {
    if (!this.cacheStranded) {
      this.cacheStranded = strandedLots(this.state, this.getResult());
    }
    return this.cacheStranded;
  }

  getOpportunities(): OpportunityScore[] {
    if (!this.cacheOpportunities) {
      this.cacheOpportunities = opportunityScores(this.state, this.getResult());
    }
    return this.cacheOpportunities;
  }

  getResilience(): ResilienceReport {
    if (!this.cacheResilience) {
      this.cacheResilience = resilienceReport(this.state, this.getResult(), this.objective);
      this.log(
        'system',
        'info',
        'Resilience assessed',
        `N-1 contingency analysis over ${this.cacheResilience.n1Results.length} facilities. Score ${this.cacheResilience.score.toFixed(0)}/100 (${this.cacheResilience.grade}).`,
        [],
      );
    }
    return this.cacheResilience;
  }

  /**
   * Carbon over the trailing weeks, each point a real re-solve on that week's
   * observed supply. Memoised like every other derived artefact: twenty solves is
   * cheap enough to compute on demand but not cheap enough to repeat per request.
   */
  getCarbonHistory(): CarbonHistory {
    if (!this.cacheHistory) {
      this.cacheHistory = carbonHistory(this.state, this.objective);
    }
    return this.cacheHistory;
  }
  getForecast(): NetworkForecast {
    if (!this.cacheForecast) {
      this.cacheForecast = forecastNetwork(
        this.state.sources,
        this.state.asOf,
        this.state.assumptions.windowDays,
      );
      this.log(
        'forecast',
        'info',
        'Supply forecast refreshed',
        `Ridge model retrained on ${this.state.sources.length} sources. Network backtest MAPE ${this.cacheForecast.networkMapePct.toFixed(1)}%.`,
        [],
      );
    }
    return this.cacheForecast;
  }

  /**
   * Carbon-versus-profit Pareto frontier, swept by re-solving the allocation at a
   * range of objective weights. Each point is a real optimisation, not a
   * interpolation between two endpoints.
   */
  getPareto(): ParetoPoint[] {
    if (this.cachePareto) return this.cachePareto;
    const arcSet = buildArcs(this.state);
    const sc = objectiveScale(arcSet.arcs);
    const windowDays = this.state.assumptions.windowDays;
    const points: ParetoPoint[] = [];

    for (let i = 0; i <= 10; i++) {
      const w = i / 10;
      const values = arcSet.arcs.map((a) => arcValueWeighted(a, w, sc));
      const sol = solveTransport({
        supplies: this.state.sources.map((s) => s.availableT),
        capacities: this.state.facilities.map((f) =>
          f.status === 'offline' ? 0 : f.capacityTpd * f.availability * windowDays,
        ),
        lowerBounds: this.state.facilities.map(() => 0),
        arcs: arcSet.bySource.map((row) =>
          row.map((r) => ({ facility: r.facility, value: values[r.arcIndex] })),
        ),
      });
      const allocations = materialiseAllocations(this.state, arcSet, sol.flow);
      const totals = computeTotals(this.state, allocations);
      points.push({
        weight: w,
        netCarbonT: totals.netCarbonT,
        marginInr: totals.marginInr,
        divertedT: totals.divertedT,
        isCurrent: false,
      });
    }

    // Mark the point closest to the active objective.
    const current = this.getResult().totals;
    let bestIdx = 0;
    let bestGap = Infinity;
    points.forEach((p, i) => {
      const gap =
        Math.abs(p.netCarbonT - current.netCarbonT) / Math.max(1, current.netCarbonT) +
        Math.abs(p.marginInr - current.marginInr) / Math.max(1, Math.abs(current.marginInr));
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    });
    if (points[bestIdx]) points[bestIdx].isCurrent = true;

    this.cachePareto = points;
    return points;
  }

  snapshot(): TwinSnapshot {
    return {
      version: this.version,
      asOf: this.state.asOf,
      objective: this.objective,
      network: this.state,
      result: this.getResult(),
      baseline: this.getBaseline(),
      routing: this.getRouting(),
      ledger: this.getLedger(),
      economics: this.getEconomics(),
      bottlenecks: this.getBottlenecks(),
      stranded: this.getStranded(),
      opportunities: this.getOpportunities(),
    };
  }

  // ── Scenarios ─────────────────────────────────────────────────────────────

  /** Runs a scenario without committing it — a preview, not a state change. */
  previewScenario(scenario: ScenarioInstance): ScenarioResult {
    const res = runScenario(this.state, scenario, this.objective, this.getResult());
    this.lastScenario = res;
    this.log(
      'scenario',
      'info',
      `Scenario simulated: ${res.label}`,
      res.narrative.slice(1, 3).join(' '),
      res.affectedEntityIds,
    );
    return res;
  }

  /** Applies a scenario permanently to the live network state. */
  commitScenario(scenario: ScenarioInstance): ScenarioResult {
    const res = this.previewScenario(scenario);
    const out = applyScenario(this.state, scenario, this.objective);
    this.state = out.state;
    if (out.objective) this.objective = out.objective;
    this.invalidate(scenario.kind !== 'seasonal_shift');
    this.log(
      'scenario',
      'high',
      `Scenario committed: ${out.label}`,
      'Live network state mutated. All downstream results recomputed.',
      out.affectedEntityIds,
    );
    return res;
  }

  getLastScenario(): ScenarioResult | null {
    return this.lastScenario;
  }

  // ── Event log ─────────────────────────────────────────────────────────────

  private log(
    kind: NetworkEvent['kind'],
    severity: NetworkEvent['severity'],
    title: string,
    detail: string,
    entityIds: string[],
  ): void {
    this.events.unshift({
      id: `EV-${Date.now().toString(36)}-${this.events.length}`,
      ts: new Date().toISOString(),
      kind,
      severity,
      title,
      detail,
      entityIds,
    });
    if (this.events.length > 200) this.events.length = 200;
  }

  getEvents(): NetworkEvent[] {
    return this.events;
  }
}
