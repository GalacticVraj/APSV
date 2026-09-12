/**
 * Client state.
 *
 * A single context holds the bootstrap payload (reference data that never changes)
 * and a version-keyed cache of derived artefacts (which change whenever the
 * objective, the assumptions or a committed scenario changes). Pages declare what
 * they need and get a loading state with a meaningful message rather than a
 * spinner, because the wait is a real computation and saying so is more honest and
 * more interesting than hiding it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Assumptions,
  Bottleneck,
  CarbonLedger,
  Facility,
  NetworkEvent,
  ObjectiveMode,
  OpportunityScore,
  OptimizationResult,
  NetworkTotals,
  ResilienceReport,
  RoutingResult,
  ScenarioDef,
  ScenarioInstance,
  ScenarioResult,
  StrandedLot,
  StreamId,
  VehicleType,
  WasteSource,
} from '../../engine/src/types.ts';
import type { CarbonHistory } from '../../engine/src/history.ts';
import type { OpportunityReport } from '../../engine/src/opportunity.ts';
import type { ObjectiveOutcome, ShockResult } from '../../engine/src/shock.ts';
import type {
  EvidenceHealth,
  EvidenceRecord,
  LineContributor,
  ModelBasis,
} from '../../engine/src/evidence.ts';
import type {
  FacilityCarbon,
  FacilityComparison,
  FacilityRankRow,
} from '../../engine/src/facility.ts';
import type {
  PathwayDecision,
  PathwayDiff,
  MaterialCandidate,
} from '../../engine/src/pathwaychoice.ts';
import type {
  AllocationTrace,
  ProvenanceRow,
  TraceCandidate,
} from '../../engine/src/trace.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      'Cannot reach the TERRAFLUX API. Start it with `npm run dev` from the repository root.',
      0,
    );
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('The API returned a response that was not JSON.', res.status);
  }
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

export const api = {
  bootstrap: () => req<Bootstrap>('/api/bootstrap'),
  state: () => req<StatePayload>('/api/state'),
  optimization: () =>
    req<{ version: number; objective: ObjectiveMode; result: OptimizationResult; baseline: NetworkTotals }>(
      '/api/optimization',
    ),
  routing: () => req<RoutingResult>('/api/routing'),
  carbon: () =>
    req<{
      ledger: CarbonLedger;
      aggregate: unknown;
      totals: NetworkTotals;
      provenance: Record<string, ProvenanceRow[]>;
    }>('/api/carbon'),
  opportunities: () => req<OpportunityReport>('/api/opportunities'),
  shock: (scenario: ScenarioInstance, compareObjectives: boolean) =>
    req<{ shock: ShockResult; objectives: ObjectiveOutcome[] | null }>('/api/shock', {
      method: 'POST',
      body: JSON.stringify({ ...scenario, compareObjectives }),
    }),
  evidence: () =>
    req<{ records: EvidenceRecord[]; health: EvidenceHealth; basis: ModelBasis }>('/api/evidence'),
  lineContributors: (line: string) =>
    req<{ line: string; contributors: LineContributor[]; note: string | null }>(
      `/api/evidence/contributors?line=${encodeURIComponent(line)}`,
    ),
  facilityCarbon: () => req<FacilityRankRow[]>('/api/facilities/carbon'),
  facilityProfile: (id: string) =>
    req<FacilityCarbon>(`/api/facilities/profile?id=${encodeURIComponent(id)}`),
  facilityCompare: (a: string, b: string) =>
    req<FacilityComparison>(
      `/api/facilities/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
    ),
  materials: () => req<MaterialCandidate[]>('/api/materials'),
  pathwayDecision: (sourceId: string, lens: ObjectiveMode) =>
    req<PathwayDecision>(
      `/api/pathways/decision?sourceId=${encodeURIComponent(sourceId)}&lens=${lens}`,
    ),
  pathwayDiff: (sourceId: string, lens: ObjectiveMode, from: string, to: string) =>
    req<PathwayDiff>(
      `/api/pathways/diff?sourceId=${encodeURIComponent(sourceId)}&lens=${lens}` +
        `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  traceCandidates: () => req<TraceCandidate[]>('/api/trace/candidates'),
  trace: (sourceId: string, facilityId: string) =>
    req<AllocationTrace>(
      `/api/trace?sourceId=${encodeURIComponent(sourceId)}&facilityId=${encodeURIComponent(facilityId)}`,
    ),
  carbonHistory: () => req<CarbonHistory>('/api/carbon/history'),
  economics: () => req<EconomicsPayload>('/api/economics'),
  bottlenecks: () =>
    req<{ bottlenecks: Bottleneck[]; stranded: StrandedLot[]; opportunities: OpportunityScore[] }>(
      '/api/bottlenecks',
    ),
  resilience: () => req<ResilienceReport>('/api/resilience'),
  forecast: () => req<ForecastPayload>('/api/forecast'),
  pareto: () => req<ParetoPoint[]>('/api/pareto'),
  pathways: (stream: StreamId) => req<{ stream: StreamId; rows: PathwayRow[] }>(`/api/pathways?stream=${stream}`),
  setObjective: (mode: ObjectiveMode) =>
    req<{ objective: ObjectiveMode; version: number }>('/api/objective', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  setAssumptions: (patch: Partial<Assumptions>) =>
    req<{ assumptions: Assumptions; version: number }>('/api/assumptions', {
      method: 'POST',
      body: JSON.stringify(patch),
    }),
  scenario: (scenario: ScenarioInstance, commit: boolean) =>
    req<{ committed: boolean; version: number; result: ScenarioResult }>('/api/scenario', {
      method: 'POST',
      body: JSON.stringify({ ...scenario, commit }),
    }),
  copilot: (question: string) =>
    req<CopilotAnswer>('/api/copilot', { method: 'POST', body: JSON.stringify({ question }) }),
  reset: () => req<{ ok: boolean; version: number }>('/api/reset', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Payload shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface PathwayRow {
  pathway: string;
  label: string;
  feasible: boolean;
  blockedBy: string;
  suitability: number;
  netCarbonPerT: number;
  durablePerT: number;
  revenuePerT: number;
  marginPerT: number;
  bestFacility: string | null;
  bestDistanceKm: number | null;
  note: string;
}

export interface ParetoPoint {
  weight: number;
  netCarbonT: number;
  marginInr: number;
  divertedT: number;
  isCurrent: boolean;
}

export interface CopilotAnswer {
  answer: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; summary: string }>;
  intent: string;
  engine: string;
  followUps: string[];
}

export interface EconomicsPayload {
  rollup: {
    marginInr: number;
    productRevenueInr: number;
    processingCostInr: number;
    byPathway: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>;
    byFacility: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>;
  };
  totals: NetworkTotals;
  allocations: OptimizationResult['allocations'];
}

export interface ForecastPayload {
  bySource: Record<
    string,
    {
      sourceId: string;
      stream: StreamId;
      points: Array<{
        weekIndex: number;
        date: string;
        actual: number | null;
        predicted: number;
        lower: number;
        upper: number;
      }>;
      backtestMapePct: number;
      r2: number;
      featureNames: string[];
      coefficients: number[];
      model: string;
    }
  >;
  windowTotalT: number;
  windowLowerT: number;
  windowUpperT: number;
  networkMapePct: number;
  peakWeeks: Array<{ date: string; tonnes: number }>;
}

export interface StatePayload {
  version: number;
  objective: ObjectiveMode;
  assumptions: Assumptions;
  asOf: string;
  appliedScenarios: ScenarioInstance[];
  sources: WasteSource[];
  facilities: Facility[];
  vehicles: VehicleType[];
  events: NetworkEvent[];
}

export interface Bootstrap {
  product: { name: string; tagline: string; problemStatement: string; region: string; dataNotice: string };
  network: {
    sources: WasteSource[];
    facilities: Facility[];
    vehicles: VehicleType[];
    assumptions: Assumptions;
    asOf: string;
  };
  reference: {
    streams: Record<string, any>;
    pathways: Record<string, any>;
    counterfactuals: Record<string, any>;
    season: Record<string, any>;
    objectives: Record<string, { label: string; short: string; description: string }>;
    assumptionMeta: Record<string, { label: string; unit: string; min: number; max: number; step: number; note: string }>;
    emissionFactors: Array<{ key: string; label: string; value: number; unit: string; uncertaintyPct: number; source: string; note?: string }>;
    prices: Array<{ product: string; label: string; price: number; unit: string; uncertaintyPct: number; source: string }>;
    carbonMarkets: Record<string, { key: string; label: string; price: number; unit: string; uncertaintyPct: number; source: string }>;
    vehicles: VehicleType[];
  };
  scenarios: ScenarioDef[];
  copilot: { suggested: string[]; tools: Array<{ name: string; description: string }> };
  demo: { totalSeconds: number; steps: DemoStep[] };
}

export interface DemoStep {
  id: string;
  seconds: number;
  route: string;
  title: string;
  say: string;
  action: string;
  command:
    | { kind: 'none' }
    | { kind: 'setObjective'; mode: string }
    | { kind: 'runOptimization' }
    | { kind: 'runScenario'; scenario: string; params: Record<string, string | number> }
    | { kind: 'highlight'; target: string };
  watchFor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface Ctx {
  boot: Bootstrap | null;
  bootError: string | null;
  state: StatePayload | null;
  optimization: { result: OptimizationResult; baseline: NetworkTotals } | null;
  version: number;
  busy: string | null;
  setObjective: (m: ObjectiveMode) => Promise<void>;
  setAssumptions: (p: Partial<Assumptions>) => Promise<void>;
  reoptimize: () => Promise<void>;
  reset: () => Promise<void>;
  commitScenario: (s: ScenarioInstance) => Promise<ScenarioResult>;
  lastScenario: ScenarioResult | null;
  setLastScenario: (s: ScenarioResult | null) => void;
  /** Lookup helpers used everywhere. */
  sourceById: Map<string, WasteSource>;
  facilityById: Map<string, Facility>;
}

const TwinCtx = createContext<Ctx | null>(null);

export function useTwin(): Ctx {
  const c = useContext(TwinCtx);
  if (!c) throw new Error('useTwin must be used inside <TwinProvider>');
  return c;
}

export function TwinProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [state, setState] = useState<StatePayload | null>(null);
  const [optimization, setOptimization] = useState<{
    result: OptimizationResult;
    baseline: NetworkTotals;
  } | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastScenario, setLastScenario] = useState<ScenarioResult | null>(null);

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([api.state(), api.optimization()]);
    setState(s);
    setOptimization({ result: o.result, baseline: o.baseline });
    setVersion(o.version);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api.bootstrap();
        if (cancelled) return;
        setBoot(b);
        await load();
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const withBusy = useCallback(
    async (message: string, fn: () => Promise<void>) => {
      setBusy(message);
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const setObjective = useCallback(
    async (m: ObjectiveMode) => {
      await withBusy('Re-solving the network under the new objective…', async () => {
        await api.setObjective(m);
        await load();
      });
    },
    [load, withBusy],
  );

  const setAssumptionsFn = useCallback(
    async (p: Partial<Assumptions>) => {
      await withBusy('Applying assumptions and recomputing…', async () => {
        await api.setAssumptions(p);
        await load();
      });
    },
    [load, withBusy],
  );

  const reoptimize = useCallback(async () => {
    await withBusy('Optimising network…', load);
  }, [load, withBusy]);

  const reset = useCallback(async () => {
    await withBusy('Restoring baseline network state…', async () => {
      await api.reset();
      setLastScenario(null);
      await load();
    });
  }, [load, withBusy]);

  const commitScenario = useCallback(
    async (s: ScenarioInstance) => {
      let out: ScenarioResult | null = null;
      await withBusy('Applying scenario to live network…', async () => {
        const r = await api.scenario(s, true);
        out = r.result;
        setLastScenario(r.result);
        await load();
      });
      return out as unknown as ScenarioResult;
    },
    [load, withBusy],
  );

  const sourceById = useMemo(
    () => new Map((state?.sources ?? boot?.network.sources ?? []).map((s) => [s.id, s])),
    [state, boot],
  );
  const facilityById = useMemo(
    () => new Map((state?.facilities ?? boot?.network.facilities ?? []).map((f) => [f.id, f])),
    [state, boot],
  );

  const value: Ctx = {
    boot,
    bootError,
    state,
    optimization,
    version,
    busy,
    setObjective,
    setAssumptions: setAssumptionsFn,
    reoptimize,
    reset,
    commitScenario,
    lastScenario,
    setLastScenario,
    sourceById,
    facilityById,
  };

  return <TwinCtx.Provider value={value}>{children}</TwinCtx.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Async resource hook with staged loading messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a derived artefact, re-fetching whenever the twin version changes.
 * `messages` are shown in sequence while the request is in flight, so the user
 * sees what the server is actually doing instead of "Loading...".
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  messages: string[] = ['Loading…'],
): { data: T | null; error: string | null; loading: boolean; message: string; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(messages[0] ?? 'Loading…');
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(messages[0] ?? 'Loading…');

    let i = 0;
    const timer = window.setInterval(() => {
      i = Math.min(i + 1, messages.length - 1);
      if (!cancelled) setMessage(messages[i]);
    }, 420);

    fetcherRef
      .current()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      })
      .finally(() => window.clearInterval(timer));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, message, reload: () => setNonce((n) => n + 1) };
}
