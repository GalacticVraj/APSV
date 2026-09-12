/**
 * The operations copilot.
 *
 * Design rule, and the reason this is not a chatbot in a corner: **the language
 * layer never computes a number**. It selects tools, the tools read the same twin
 * the screens read, and the answer is assembled from those returned values. If a
 * figure appears in an answer, it appeared first in a tool result, and the tool
 * calls are shown alongside the answer so the chain is auditable.
 *
 * Two execution paths:
 *   - Deterministic (default, always available offline): intent classification over
 *     the question, entity resolution against real network objects, then a grounded
 *     response composed from tool output.
 *   - LLM-assisted (only if ANTHROPIC_API_KEY is present): the same tools are
 *     offered to Claude for tool use. The tools are identical, so the numbers are
 *     identical; only the phrasing differs.
 *
 * The deterministic path is the product. The LLM path is an enhancement.
 */

import type {
  ObjectiveMode,
  PathwayId,
  ScenarioInstance,
  StreamId,
} from './types.ts';
import type { Twin } from './state.ts';
import { STREAMS } from './streams.ts';
import { PATHWAYS, pathwayYield, suitability } from './pathways.ts';
import { CARBON_MARKETS, OBJECTIVE_META, PRICES } from './constants.ts';
import { permanenceFor } from './carbon.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

const nf = (n: number, d = 0) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

function inr(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${nf(abs)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool layer
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'get_network_state',
    description: 'Current network: source count, facility count, objective, window, assumptions.',
    parameters: {},
  },
  {
    name: 'get_optimization_result',
    description: 'The current optimal plan: totals, open facilities, solver telemetry.',
    parameters: {},
  },
  {
    name: 'get_waste_sources',
    description: 'Waste sources, optionally filtered by stream or district.',
    parameters: {
      stream: { type: 'string', description: 'Feedstock stream id' },
      district: { type: 'string', description: 'District name' },
    },
  },
  {
    name: 'get_facilities',
    description: 'Processing facilities with utilisation and current allocation.',
    parameters: { pathway: { type: 'string', description: 'Pathway id' } },
  },
  {
    name: 'explain_facility_selection',
    description: 'Why a given facility was selected, what it receives and from where.',
    parameters: {
      facilityId: { type: 'string', description: 'Facility id', required: true },
    },
  },
  {
    name: 'get_carbon_ledger',
    description: 'Full carbon ledger with every line, permanence report and uncertainty band.',
    parameters: {},
  },
  {
    name: 'get_economics',
    description: 'Revenue, cost and margin rollup by pathway and facility.',
    parameters: {},
  },
  {
    name: 'get_bottlenecks',
    description: 'Detected bottlenecks with severity, quantified consequence and recommendation.',
    parameters: {},
  },
  {
    name: 'get_stranded',
    description: 'Feedstock the network cannot place, with an attributed reason per lot.',
    parameters: {},
  },
  {
    name: 'get_shadow_prices',
    description: 'Marginal value of one extra tonne/day of capacity at each facility.',
    parameters: {},
  },
  {
    name: 'get_resilience',
    description: 'N-1 contingency analysis and resilience score.',
    parameters: {},
  },
  {
    name: 'get_forecast',
    description: 'Supply forecast with backtest accuracy, optionally for one source.',
    parameters: { sourceId: { type: 'string', description: 'Source id' } },
  },
  {
    name: 'compare_pathways',
    description: 'Carbon, cost, revenue and feasibility of every pathway for one feedstock.',
    parameters: { stream: { type: 'string', description: 'Feedstock stream id', required: true } },
  },
  {
    name: 'run_scenario',
    description: 'Simulate a disruption or market change and return the before/after difference.',
    parameters: {
      kind: { type: 'string', description: 'Scenario kind', required: true },
      params: { type: 'object', description: 'Scenario parameters' },
    },
  },
  {
    name: 'get_opportunities',
    description: 'Opportunity score per source with its component breakdown.',
    parameters: {},
  },
];

export function callTool(
  twin: Twin,
  name: string,
  args: Record<string, unknown>,
): { result: unknown; summary: string } {
  const net = twin.getState();
  const result = twin.getResult();

  switch (name) {
    case 'get_network_state':
      return {
        result: {
          sources: net.sources.length,
          facilities: net.facilities.length,
          objective: twin.getObjective(),
          asOf: net.asOf,
          windowDays: net.assumptions.windowDays,
          assumptions: net.assumptions,
          appliedScenarios: net.appliedScenarios,
        },
        summary: `${net.sources.length} sources, ${net.facilities.length} facilities, objective ${twin.getObjective()}`,
      };

    case 'get_optimization_result':
      return {
        result: {
          totals: result.totals,
          openFacilities: result.openFacilities,
          idleFacilities: result.idleFacilities,
          telemetry: result.telemetry,
        },
        summary: `${nf(result.totals.divertedT)} t diverted, ${nf(result.totals.netCarbonT)} tCO2e net, margin ${inr(result.totals.marginInr)}`,
      };

    case 'get_waste_sources': {
      let rows = net.sources;
      if (args.stream) rows = rows.filter((s) => s.stream === args.stream);
      if (args.district) rows = rows.filter((s) => s.district === args.district);
      const allocated = new Map<string, number>();
      for (const a of result.allocations) {
        allocated.set(a.sourceId, (allocated.get(a.sourceId) ?? 0) + a.tonnes);
      }
      return {
        result: rows.map((s) => ({
          id: s.id,
          name: s.name,
          district: s.district,
          stream: s.stream,
          availableT: s.availableT,
          allocatedT: allocated.get(s.id) ?? 0,
        })),
        summary: `${rows.length} sources matched`,
      };
    }

    case 'get_facilities': {
      let rows = net.facilities;
      if (args.pathway) rows = rows.filter((f) => f.pathway === args.pathway);
      const load = new Map<string, number>();
      for (const a of result.allocations) {
        load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
      }
      return {
        result: rows.map((f) => {
          const cap = f.capacityTpd * f.availability * net.assumptions.windowDays;
          const l = load.get(f.id) ?? 0;
          return {
            id: f.id,
            name: f.name,
            pathway: f.pathway,
            district: f.district,
            capacityTpd: f.capacityTpd,
            status: f.status,
            allocatedT: l,
            utilisationPct: cap > 0 ? (l / cap) * 100 : 0,
          };
        }),
        summary: `${rows.length} facilities matched`,
      };
    }

    case 'explain_facility_selection': {
      const f = net.facilities.find((x) => x.id === args.facilityId);
      if (!f) return { result: null, summary: 'facility not found' };
      const feeds = result.allocations.filter((a) => a.facilityId === f.id);
      const cap = f.capacityTpd * f.availability * net.assumptions.windowDays;
      const total = feeds.reduce((s, a) => s + a.tonnes, 0);
      const sp = result.shadowPrices.find((s) => s.facilityId === f.id);
      return {
        result: {
          facility: f,
          capacityWindowT: cap,
          allocatedT: total,
          utilisationPct: cap > 0 ? (total / cap) * 100 : 0,
          shadowPrice: sp,
          feeds: feeds
            .map((a) => ({
              sourceId: a.sourceId,
              sourceName: net.sources.find((s) => s.id === a.sourceId)?.name ?? a.sourceId,
              stream: a.stream,
              tonnes: a.tonnes,
              distanceKm: a.distanceKm,
              netCarbonPerT: a.netCarbonT / Math.max(1e-9, a.tonnes),
              marginPerT: a.marginInr / Math.max(1e-9, a.tonnes),
            }))
            .sort((a, b) => b.tonnes - a.tonnes),
        },
        summary: `${f.name}: ${nf(total)} t from ${feeds.length} sources`,
      };
    }

    case 'get_carbon_ledger': {
      const l = twin.getLedger();
      return {
        result: l,
        summary: `net ${nf(l.netT)} tCO2e (durable ${nf(l.durableRemovalT)}, avoided ${nf(l.avoidedEmissionsT)})`,
      };
    }

    case 'get_economics': {
      const e = twin.getEconomics();
      return { result: e, summary: `margin ${inr(e.marginInr)}` };
    }

    case 'get_bottlenecks': {
      const b = twin.getBottlenecks();
      return { result: b, summary: `${b.length} bottlenecks detected` };
    }

    case 'get_stranded': {
      const s = twin.getStranded();
      return {
        result: s,
        summary: `${nf(s.reduce((x, y) => x + y.tonnes, 0))} t stranded across ${s.length} lots`,
      };
    }

    case 'get_shadow_prices':
      return {
        result: result.shadowPrices,
        summary: `${result.shadowPrices.filter((s) => s.binding).length} binding capacity constraints`,
      };

    case 'get_resilience': {
      const r = twin.getResilience();
      return { result: r, summary: `score ${r.score.toFixed(0)}/100 (${r.grade})` };
    }

    case 'get_forecast': {
      const f = twin.getForecast();
      if (args.sourceId) {
        const one = f.bySource[String(args.sourceId)];
        return {
          result: one,
          summary: one ? `MAPE ${one.backtestMapePct.toFixed(1)}%` : 'source not found',
        };
      }
      return {
        result: {
          windowTotalT: f.windowTotalT,
          windowLowerT: f.windowLowerT,
          windowUpperT: f.windowUpperT,
          networkMapePct: f.networkMapePct,
          peakWeeks: f.peakWeeks,
        },
        summary: `${nf(f.windowTotalT)} t expected, backtest MAPE ${f.networkMapePct.toFixed(1)}%`,
      };
    }

    case 'compare_pathways': {
      const rows = comparePathways(twin, String(args.stream) as StreamId);
      return { result: rows, summary: `${rows.length} pathways evaluated` };
    }

    case 'run_scenario': {
      const scenario: ScenarioInstance = {
        kind: args.kind as ScenarioInstance['kind'],
        params: (args.params as Record<string, string | number>) ?? {},
      };
      const r = twin.previewScenario(scenario);
      return {
        result: {
          label: r.label,
          narrative: r.narrative,
          deltas: r.deltas,
          flowChanges: r.flowChanges.slice(0, 12),
          newBottlenecks: r.newBottlenecks,
        },
        summary: r.label,
      };
    }

    case 'get_opportunities': {
      const o = twin.getOpportunities();
      return { result: o, summary: `${o.length} sources scored` };
    }

    default:
      return { result: null, summary: `unknown tool ${name}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pathway comparison (used by both the copilot and the Pathways screen)
// ─────────────────────────────────────────────────────────────────────────────

export interface PathwayRow {
  pathway: PathwayId;
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

export function comparePathways(twin: Twin, streamId: StreamId): PathwayRow[] {
  const net = twin.getState();
  const stream = STREAMS[streamId];
  const result = twin.getResult();

  // Use real arcs where they exist, so the comparison reflects actual geography
  // rather than an abstract per-tonne calculation.
  const rows: PathwayRow[] = [];

  for (const pid of Object.keys(PATHWAYS) as PathwayId[]) {
    const p = PATHWAYS[pid];
    const suit = suitability(stream, p);

    if (!suit.feasible) {
      const failed = suit.gates.find((g) => !g.pass);
      rows.push({
        pathway: pid,
        label: p.short,
        feasible: false,
        blockedBy: failed ? `${failed.gate}: ${failed.detail}` : suit.limitingFactor,
        suitability: 0,
        netCarbonPerT: 0,
        durablePerT: 0,
        revenuePerT: 0,
        marginPerT: 0,
        bestFacility: null,
        bestDistanceKm: null,
        note: `Excluded by the ${suit.limitingFactor} gate.`,
      });
      continue;
    }

    const allocs = result.allocations.filter((a) => a.stream === streamId && a.pathway === pid);
    let netCarbonPerT = 0;
    let durablePerT = 0;
    let marginPerT = 0;
    let bestFacility: string | null = null;
    let bestDistanceKm: number | null = null;

    if (allocs.length > 0) {
      const t = allocs.reduce((s, a) => s + a.tonnes, 0);
      netCarbonPerT = allocs.reduce((s, a) => s + a.netCarbonT, 0) / t;
      durablePerT = allocs.reduce((s, a) => s + a.durableT, 0) / t;
      marginPerT = allocs.reduce((s, a) => s + a.marginInr, 0) / t;
      const biggest = allocs.slice().sort((a, b) => b.tonnes - a.tonnes)[0];
      bestFacility = net.facilities.find((f) => f.id === biggest.facilityId)?.name ?? null;
      bestDistanceKm = biggest.distanceKm;
    }

    const y = pathwayYield(stream, pid, 1);
    let revenuePerT = 0;
    revenuePerT += y.biocharT * PRICES.biochar.price;
    revenuePerT += y.cbgKg * PRICES.bio_cng.price;
    revenuePerT += y.pelletT * PRICES.pellets.price;
    revenuePerT += y.compostT * PRICES.compost.price;
    revenuePerT += y.digestateT * PRICES.digestate.price;
    if (y.netKwh > 0) revenuePerT += y.netKwh * PRICES.electricity.price;

    rows.push({
      pathway: pid,
      label: p.short,
      feasible: true,
      blockedBy: '',
      suitability: suit.score,
      netCarbonPerT,
      durablePerT,
      revenuePerT,
      marginPerT,
      bestFacility,
      bestDistanceKm,
      note:
        allocs.length > 0
          ? `${nf(allocs.reduce((s, a) => s + a.tonnes, 0))} t currently routed this way.`
          : `Feasible but not selected under the ${OBJECTIVE_META[twin.getObjective()].label} objective. Limiting factor: ${suit.limitingFactor}.`,
    });
  }

  return rows.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.netCarbonPerT - a.netCarbonPerT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity resolution
// ─────────────────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Resolved {
  facilityId?: string;
  facilityName?: string;
  sourceId?: string;
  sourceName?: string;
  stream?: StreamId;
  pathway?: PathwayId;
  district?: string;
}

function resolveEntities(twin: Twin, question: string): Resolved {
  const q = normalise(question);
  const net = twin.getState();
  const out: Resolved = {};

  let bestFac: { id: string; name: string; score: number } | null = null;
  for (const f of net.facilities) {
    const tokens = normalise(f.name).split(' ').filter((t) => t.length > 3);
    let score = 0;
    for (const t of tokens) if (q.includes(t)) score += t.length;
    if (q.includes(f.id.toLowerCase())) score += 50;
    if (score > 4 && (!bestFac || score > bestFac.score)) {
      bestFac = { id: f.id, name: f.name, score };
    }
  }
  if (bestFac) {
    out.facilityId = bestFac.id;
    out.facilityName = bestFac.name;
  }

  let bestSrc: { id: string; name: string; score: number } | null = null;
  for (const s of net.sources) {
    const tokens = normalise(s.name).split(' ').filter((t) => t.length > 3);
    let score = 0;
    for (const t of tokens) if (q.includes(t)) score += t.length;
    if (q.includes(s.id.toLowerCase())) score += 50;
    if (score > 5 && (!bestSrc || score > bestSrc.score)) {
      bestSrc = { id: s.id, name: s.name, score };
    }
  }
  if (bestSrc) {
    out.sourceId = bestSrc.id;
    out.sourceName = bestSrc.name;
  }

  for (const sid of Object.keys(STREAMS) as StreamId[]) {
    const label = normalise(STREAMS[sid].label);
    if (q.includes(label) || q.includes(normalise(sid.replace(/_/g, ' ')))) {
      out.stream = sid;
      break;
    }
  }
  if (!out.stream) {
    if (/\bstraw\b/.test(q) && /\bpaddy|rice\b/.test(q)) out.stream = 'paddy_straw';
    else if (/\bstubble\b/.test(q)) out.stream = 'paddy_straw';
    else if (/\bdung|manure|cattle\b/.test(q)) out.stream = 'cattle_dung';
    else if (/\bmsw|municipal|city waste\b/.test(q)) out.stream = 'msw_organic';
  }

  for (const pid of Object.keys(PATHWAYS) as PathwayId[]) {
    const p = PATHWAYS[pid];
    if (q.includes(normalise(p.short)) || q.includes(normalise(p.label))) {
      out.pathway = pid;
      break;
    }
  }
  if (!out.pathway) {
    if (/\bbiochar|pyrolys/.test(q)) out.pathway = 'pyrolysis_biochar';
    else if (/\bcbg|bio ?cng|biogas|digest/.test(q)) out.pathway = 'anaerobic_digestion_cbg';
    else if (/\bpellet|co ?fir/.test(q)) out.pathway = 'pellet_cofiring';
    else if (/\bcompost/.test(q)) out.pathway = 'composting';
    else if (/\bgasif/.test(q)) out.pathway = 'gasification_power';
  }

  for (const d of new Set(net.sources.map((s) => s.district))) {
    if (q.includes(normalise(d))) {
      out.district = d;
      break;
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification
// ─────────────────────────────────────────────────────────────────────────────

type Intent =
  | 'why_facility'
  | 'what_if_shutdown'
  | 'underutilised'
  | 'bottleneck'
  | 'carbon_explain'
  | 'carbon_change'
  | 'best_pathway'
  | 'forecast'
  | 'economics'
  | 'resilience'
  | 'shadow_price'
  | 'stranded'
  | 'compare_objectives'
  | 'permanence'
  | 'overview';

const INTENT_PATTERNS: Array<{ intent: Intent; patterns: RegExp[]; weight: number }> = [
  { intent: 'why_facility', patterns: [/why (was|is|did).*(facility|plant|site|selected|chosen|picked)/, /why.*(send|route|go).*(to)/, /explain.*(selection|choice)/], weight: 3 },
  { intent: 'what_if_shutdown', patterns: [/what happens if/, /what if.*(shut|close|offline|down|fail|trip)/, /if.*(shuts? down|goes offline|breaks)/, /simulate/], weight: 4 },
  { intent: 'underutilised', patterns: [/under ?utilis|under ?util|idle|spare capacity|not being used|unused/], weight: 3 },
  { intent: 'bottleneck', patterns: [/bottleneck|constraint|limiting|blocked|what.*holding|choke/], weight: 3 },
  { intent: 'carbon_explain', patterns: [/how (much|is).*(carbon|co2|tco2)/, /carbon (ledger|breakdown|accounting|impact)/, /where.*carbon.*(come|from)/, /net carbon/], weight: 2 },
  { intent: 'carbon_change', patterns: [/why did.*(carbon|co2).*(drop|fall|decrease|increase|rise|change)/, /carbon.*(went|down|up)/], weight: 4 },
  { intent: 'best_pathway', patterns: [/which pathway|best pathway|highest (profit|carbon|value)|what should.*(do with|happen to)|compare pathway/], weight: 3 },
  { intent: 'forecast', patterns: [/forecast|predict|next (month|week|quarter)|how much.*(will|expect)|upcoming|seasonal/], weight: 3 },
  { intent: 'economics', patterns: [/margin|profit|revenue|cost|money|economics|rupee|payback|abatement cost/], weight: 2 },
  { intent: 'resilience', patterns: [/resilien|robust|fragile|single point|n-?1|contingency/], weight: 3 },
  { intent: 'shadow_price', patterns: [/shadow price|marginal value|where.*(invest|expand|add capacity)|worth (adding|expanding)/], weight: 4 },
  { intent: 'stranded', patterns: [/stranded|left over|not (collected|processed|placed)|unallocated|burn(ed|ing)? anyway|wasted/], weight: 3 },
  { intent: 'compare_objectives', patterns: [/carbon.*(vs|versus|compared).*(profit|margin)/, /objective|trade.?off|switch.*(mode|objective)/], weight: 3 },
  { intent: 'permanence', patterns: [/permanen|durab|bc100|how long.*(last|stay|store)|q10|soil temperature/], weight: 4 },
  { intent: 'overview', patterns: [/overview|summary|status|how are we doing|what.?s happening|brief/], weight: 2 },
];

function classify(question: string): Intent {
  const q = normalise(question);
  let best: Intent = 'overview';
  let bestScore = 0;
  for (const row of INTENT_PATTERNS) {
    let score = 0;
    for (const p of row.patterns) if (p.test(q)) score += row.weight;
    if (score > bestScore) {
      bestScore = score;
      best = row.intent;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answering
// ─────────────────────────────────────────────────────────────────────────────

export interface CopilotAnswer {
  answer: string;
  toolCalls: ToolCall[];
  intent: string;
  entities: Resolved;
  engine: 'deterministic' | 'claude';
  followUps: string[];
}

export function ask(twin: Twin, question: string): CopilotAnswer {
  const intent = classify(question);
  const entities = resolveEntities(twin, question);
  const toolCalls: ToolCall[] = [];

  const use = (name: string, args: Record<string, unknown> = {}) => {
    const { result, summary } = callTool(twin, name, args);
    toolCalls.push({ name, args, summary });
    return result as any;
  };

  const net = twin.getState();
  const objectiveLabel = OBJECTIVE_META[twin.getObjective()].label;
  let answer = '';
  let followUps: string[] = [];

  switch (intent) {
    case 'why_facility': {
      const fid = entities.facilityId ?? twin.getResult().openFacilities[0];
      const info = use('explain_facility_selection', { facilityId: fid });
      if (!info) {
        answer = 'I could not identify which facility you mean. Try naming it, for example "Why was Sangrur Biochar Works selected?".';
        break;
      }
      const f = info.facility;
      const p = PATHWAYS[f.pathway as PathwayId];
      const lines: string[] = [];
      lines.push(
        `**${f.name}** runs the ${p.label.toLowerCase()} pathway at ${f.capacityTpd} t/day. Under the ${objectiveLabel} objective it is allocated **${nf(info.allocatedT)} t** this window — ${info.utilisationPct.toFixed(0)}% of its available capacity.`,
      );
      if (info.feeds.length > 0) {
        lines.push('\nIt was selected for these flows because of what each one is worth on arrival:\n');
        lines.push('| Source | Stream | Tonnes | Haul | Net carbon | Margin |');
        lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
        for (const fd of info.feeds.slice(0, 6)) {
          lines.push(
            `| ${fd.sourceName} | ${STREAMS[fd.stream as StreamId].label} | ${nf(fd.tonnes)} t | ${fd.distanceKm.toFixed(0)} km | ${fd.netCarbonPerT.toFixed(2)} tCO₂e/t | ${inr(fd.marginPerT)}/t |`,
          );
        }
      }
      if (info.shadowPrice?.binding) {
        lines.push(
          `\nCapacity here is **binding**. The marginal value of one more tonne per day is ${info.shadowPrice.valuePerExtraTonne.toFixed(3)} ${info.shadowPrice.unit} — which is why the optimiser fills it before cheaper alternatives.`,
        );
      } else {
        lines.push(
          `\nCapacity here is not binding, so the allocation is set by arc value rather than by scarcity.`,
        );
      }
      answer = lines.join('\n');
      followUps = [
        `What happens if ${f.name} shuts down?`,
        'Where should we add capacity next?',
      ];
      break;
    }

    case 'what_if_shutdown': {
      const fid =
        entities.facilityId ??
        (use('get_shadow_prices') as any[]).find((s) => s.binding)?.facilityId ??
        twin.getResult().openFacilities[0];
      const fac = net.facilities.find((f) => f.id === fid);
      const sc = use('run_scenario', { kind: 'facility_offline', params: { facilityId: fid } });
      const carbon = sc.deltas.find((d: any) => d.key === 'netCarbonT');
      const margin = sc.deltas.find((d: any) => d.key === 'marginInr');
      const stranded = sc.deltas.find((d: any) => d.key === 'strandedT');

      const lines: string[] = [];
      lines.push(`I simulated taking **${fac?.name ?? fid}** offline and re-optimised the entire network.\n`);
      lines.push('| Metric | Before | After | Change |');
      lines.push('| --- | ---: | ---: | ---: |');
      for (const d of [carbon, margin, stranded].filter(Boolean)) {
        const fmt = (v: number) => (d.unit === '₹' ? inr(v) : `${nf(v)} ${d.unit}`);
        lines.push(
          `| ${d.label} | ${fmt(d.before)} | ${fmt(d.after)} | ${d.delta >= 0 ? '+' : ''}${d.deltaPct.toFixed(1)}% |`,
        );
      }
      lines.push('');
      for (const n of sc.narrative.slice(1)) lines.push(`- ${n}`);
      const reroutes = sc.flowChanges.filter((f: any) => f.changeType === 'rerouted');
      if (reroutes.length > 0) {
        lines.push('\nLargest re-routes:\n');
        for (const r of reroutes.slice(0, 5)) {
          lines.push(
            `- ${nf(r.tonnes)} t from **${r.sourceName}**: ${r.fromFacilityName} → ${r.toFacilityName} (${r.distanceDeltaKm >= 0 ? '+' : ''}${r.distanceDeltaKm.toFixed(0)} km)`,
          );
        }
      }
      answer = lines.join('\n');
      followUps = ['How resilient is the network overall?', 'Which bottleneck should we fix first?'];
      break;
    }

    case 'underutilised': {
      const facs = use('get_facilities') as any[];
      const sources = use('get_waste_sources') as any[];
      const idle = facs.filter((f) => f.utilisationPct < 60).sort((a, b) => a.utilisationPct - b.utilisationPct);
      const under = sources
        .filter((s) => s.allocatedT < s.availableT * 0.5 && s.availableT > 200)
        .sort((a, b) => b.availableT - a.availableT - (b.allocatedT - a.allocatedT));

      const lines: string[] = [];
      if (under.length > 0) {
        lines.push(`**${under.length} sources** are running below half their available tonnage:\n`);
        lines.push('| Source | Stream | Available | Allocated | Unused |');
        lines.push('| --- | --- | ---: | ---: | ---: |');
        for (const s of under.slice(0, 8)) {
          lines.push(
            `| ${s.name} | ${STREAMS[s.stream as StreamId].label} | ${nf(s.availableT)} t | ${nf(s.allocatedT)} t | ${nf(s.availableT - s.allocatedT)} t |`,
          );
        }
      }
      if (idle.length > 0) {
        lines.push(`\n**Facilities with spare capacity:**\n`);
        for (const f of idle.slice(0, 6)) {
          lines.push(
            `- ${f.name} (${PATHWAYS[f.pathway as PathwayId].short}) at ${f.utilisationPct.toFixed(0)}% — ${nf(f.capacityTpd * net.assumptions.windowDays - f.allocatedT)} t of headroom`,
          );
        }
        lines.push(
          `\nSpare plant capacity alongside unplaced feedstock usually means a *compatibility* or *distance* problem rather than a tonnage problem. Ask about stranded feedstock to see the attributed reason per lot.`,
        );
      }
      answer = lines.join('\n') || 'Everything is running near capacity; no meaningful slack in the network.';
      followUps = ['Why is that feedstock stranded?', 'Which pathway would suit it?'];
      break;
    }

    case 'bottleneck': {
      const bs = use('get_bottlenecks') as any[];
      if (bs.length === 0) {
        answer = 'No bottlenecks currently detected at the configured thresholds.';
        break;
      }
      const lines = [`I found **${bs.length} bottlenecks**. In order of severity:\n`];
      for (const b of bs.slice(0, 5)) {
        lines.push(`**${b.title}** — ${b.severity.toUpperCase()}`);
        lines.push(`${b.detail}`);
        if (b.carbonAtRiskT > 1) lines.push(`Carbon at risk: ${nf(b.carbonAtRiskT)} tCO₂e per window.`);
        lines.push(`*Recommendation:* ${b.recommendation}`);
        lines.push(`*Upside:* ${b.quantifiedUpside}\n`);
      }
      answer = lines.join('\n');
      followUps = ['Where should we add capacity next?', 'What happens if the biggest plant fails?'];
      break;
    }

    case 'carbon_explain': {
      const l = use('get_carbon_ledger') as any;
      const lines = [
        `Net carbon impact for this window is **${nf(l.netT)} tCO₂e**, built up like this:\n`,
        '| Line | tCO₂e | Basis |',
        '| --- | ---: | --- |',
      ];
      for (const line of l.lines) {
        if (line.kind === 'total') continue;
        lines.push(`| ${line.label} | ${line.valueT >= 0 ? '+' : ''}${nf(line.valueT)} | ${line.basis} |`);
      }
      lines.push(`| **Net** | **${nf(l.netT)}** | |`);
      lines.push(
        `\nThe two carbon products are deliberately kept apart: **${nf(l.durableRemovalT)} tCO₂e of durable removal** (biochar, priced at ${inr(CARBON_MARKETS.durableCdr.price)}/t) and **${nf(l.avoidedEmissionsT)} tCO₂e of avoided emissions** (priced at ${inr(CARBON_MARKETS.avoidedEmission.price)}/t). They are not fungible and are never summed into one headline.`,
      );
      if (l.uncertainty) {
        lines.push(
          `\nMonte Carlo over ${nf(l.uncertainty.draws)} draws of every emission factor gives a 90% interval of **${nf(l.uncertainty.p5)} to ${nf(l.uncertainty.p95)} tCO₂e** (median ${nf(l.uncertainty.p50)}).`,
        );
      }
      answer = lines.join('\n');
      followUps = ['How durable is the biochar carbon?', 'What is the abatement cost per tonne?'];
      break;
    }

    case 'permanence': {
      const l = use('get_carbon_ledger') as any;
      const perm = l.permanence;
      if (!perm) {
        answer = 'No biochar is being produced in the current plan, so there is no permanence figure to report.';
        break;
      }
      const euro = permanenceFor(
        (twin.getResult().allocations.find((a) => a.durableT > 0)?.stream ?? 'paddy_straw') as StreamId,
        14.9,
      );
      answer = [
        `Biochar carbon in this plan is modelled with a two-pool first-order decay, parameterised by the char's H/C(org) ratio of **${perm.hcOrgRatio.toFixed(2)}** — comfortably inside the < 0.7 durability gate that both the European Biochar Certificate and the Puro Standard require.`,
        ``,
        `The important correction is temperature. The harmonised biochar decomposition dataset is reported at **${perm.referenceTempC} °C** soil temperature, which is northern Europe. Indian agricultural soils sit near **${perm.soilTempC} °C**. Applying the published Q10 relation gives Q10 = ${perm.q10.toFixed(2)} and a decay-rate ratio of **${perm.fT.toFixed(3)}** — biochar decays about ${((perm.fT - 1) * 100).toFixed(0)}% faster here.`,
        ``,
        `| | 100-year permanence (BC₁₀₀) |`,
        `| --- | ---: |`,
        `| At the ${perm.referenceTempC} °C reference | ${(euro.bc100 * 100).toFixed(1)}% |`,
        `| At ${perm.soilTempC} °C (this network) | **${(perm.bc100 * 100).toFixed(1)}%** |`,
        ``,
        `Using the European default here would overstate durable removal by roughly ${(((euro.bc100 - perm.bc100) / perm.bc100) * 100).toFixed(1)}%. The ledger applies the India-calibrated figure.`,
      ].join('\n');
      followUps = ['Show me the full carbon ledger', 'What would happen if CDR prices doubled?'];
      break;
    }

    case 'carbon_change': {
      const last = twin.getLastScenario();
      if (!last) {
        answer =
          'No scenario has been run in this session yet, so there is no before/after to compare. Run a scenario — a facility outage or a price move — and I will attribute the change flow by flow.';
        break;
      }
      const carbon = last.deltas.find((d) => d.key === 'netCarbonT');
      const lines = [`The last change was: **${last.label}**.\n`];
      if (carbon) {
        lines.push(
          `Net carbon moved from ${nf(carbon.before)} to ${nf(carbon.after)} tCO₂e, a change of ${carbon.delta >= 0 ? '+' : ''}${nf(carbon.delta)} (${carbon.deltaPct.toFixed(1)}%).\n`,
        );
      }
      const contributors = last.flowChanges
        .filter((f) => Math.abs(f.carbonDeltaT) > 1)
        .slice(0, 6);
      if (contributors.length > 0) {
        lines.push('Largest contributions to that change:\n');
        for (const c of contributors) {
          lines.push(
            `- **${c.sourceName}** ${c.changeType}: ${nf(c.tonnes)} t, ${c.carbonDeltaT >= 0 ? '+' : ''}${c.carbonDeltaT.toFixed(0)} tCO₂e${c.toFacilityName ? ` (→ ${c.toFacilityName})` : ''}`,
          );
        }
      }
      answer = lines.join('\n');
      break;
    }

    case 'best_pathway': {
      const stream = entities.stream ?? 'paddy_straw';
      const rows = use('compare_pathways', { stream }) as PathwayRow[];
      const s = STREAMS[stream];
      const lines = [
        `Pathway comparison for **${s.label}** (moisture ${s.moisturePct}%, ash ${s.ashPct}%, C:N ${s.cnRatio}:1, lignin ${s.ligninPct}%, bulk density ${s.bulkDensityTPerM3} t/m³):\n`,
        '| Pathway | Feasible | Net carbon | Durable | Margin | Note |',
        '| --- | --- | ---: | ---: | ---: | --- |',
      ];
      for (const r of rows) {
        lines.push(
          `| ${r.label} | ${r.feasible ? 'yes' : '**no**'} | ${r.feasible ? `${r.netCarbonPerT.toFixed(2)} tCO₂e/t` : '—'} | ${r.feasible ? `${r.durablePerT.toFixed(2)}` : '—'} | ${r.feasible ? `${inr(r.marginPerT)}/t` : '—'} | ${r.feasible ? r.note : r.blockedBy} |`,
        );
      }
      const bestCarbon = rows.filter((r) => r.feasible).sort((a, b) => b.netCarbonPerT - a.netCarbonPerT)[0];
      const bestMargin = rows.filter((r) => r.feasible).sort((a, b) => b.marginPerT - a.marginPerT)[0];
      if (bestCarbon && bestMargin) {
        if (bestCarbon.pathway === bestMargin.pathway) {
          lines.push(`\n**${bestCarbon.label}** wins on both carbon and margin for this feedstock — an unusually easy call.`);
        } else {
          lines.push(
            `\nThis feedstock has a genuine trade-off: **${bestCarbon.label}** delivers the most carbon (${bestCarbon.netCarbonPerT.toFixed(2)} tCO₂e/t) while **${bestMargin.label}** delivers the most margin (${inr(bestMargin.marginPerT)}/t). Which one the optimiser picks is decided by the active objective, currently ${objectiveLabel}.`,
          );
        }
      }
      answer = lines.join('\n');
      followUps = ['Compare carbon-first against profit-first', 'Show the Pareto frontier'];
      break;
    }

    case 'forecast': {
      const f = use('get_forecast', entities.sourceId ? { sourceId: entities.sourceId } : {}) as any;
      if (entities.sourceId && f) {
        const future = f.points.filter((p: any) => p.actual === null).slice(0, 8);
        const lines = [
          `Supply forecast for **${entities.sourceName}** (${STREAMS[f.stream as StreamId].label}).`,
          `Model: ${f.model}`,
          `Walk-forward backtest MAPE: **${f.backtestMapePct.toFixed(1)}%**, in-sample R² ${f.r2.toFixed(3)}.\n`,
          '| Week of | Forecast | 95% interval |',
          '| --- | ---: | --- |',
        ];
        for (const p of future) {
          lines.push(`| ${p.date} | ${nf(p.predicted)} t | ${nf(p.lower)} – ${nf(p.upper)} t |`);
        }
        answer = lines.join('\n');
      } else {
        answer = [
          `Across all ${net.sources.length} sources, expected supply over the next ${net.assumptions.windowDays} days is **${nf(f.windowTotalT)} t** (90% interval ${nf(f.windowLowerT)} to ${nf(f.windowUpperT)} t).`,
          ``,
          `Forecast accuracy is measured, not assumed: a walk-forward backtest across the network gives a weighted MAPE of **${f.networkMapePct.toFixed(1)}%**.`,
          ``,
          `Peak supply weeks ahead:`,
          ...f.peakWeeks.map((p: any) => `- ${p.date}: ${nf(p.tonnes)} t`),
        ].join('\n');
      }
      followUps = ['What happens at the wheat harvest?', 'Do we have capacity for the peak?'];
      break;
    }

    case 'economics': {
      const e = use('get_economics') as any;
      const r = use('get_optimization_result') as any;
      const lines = [
        `Under the ${objectiveLabel} objective, the network turns ${nf(r.totals.divertedT)} t of residue into an operating margin of **${inr(r.totals.marginInr)}** over ${net.assumptions.windowDays} days — ${inr(r.totals.marginPerTonneInr)} per tonne.\n`,
        `Carbon revenue alone is ${inr(r.totals.carbonRevenueInr)}, of which the durable-removal share is what carries the biochar case.\n`,
        '| Pathway | Tonnes | Revenue | Margin | Margin/t |',
        '| --- | ---: | ---: | ---: | ---: |',
      ];
      for (const [pid, v] of Object.entries(e.byPathway) as Array<[string, any]>) {
        lines.push(
          `| ${PATHWAYS[pid as PathwayId].short} | ${nf(v.tonnes)} | ${inr(v.revenue)} | ${inr(v.margin)} | ${inr(v.margin / Math.max(1, v.tonnes))} |`,
        );
      }
      lines.push(
        `\nMarginal abatement cost is **${inr(r.totals.abatementCostInrPerTco2e)} per tCO₂e**. A negative figure means the abatement pays for itself before any carbon revenue.`,
      );
      answer = lines.join('\n');
      followUps = ['Which pathway has the best abatement cost?', 'What if diesel hits ₹120?'];
      break;
    }

    case 'resilience': {
      const r = use('get_resilience') as any;
      const lines = [
        `**Network resilience: ${r.score.toFixed(0)}/100 — ${r.grade}**\n`,
        r.method,
        '',
        '| Component | Score | Weight | Note |',
        '| --- | ---: | ---: | --- |',
      ];
      for (const c of r.components) {
        lines.push(`| ${c.label} | ${c.value.toFixed(0)} | ${(c.weight * 100).toFixed(0)}% | ${c.note} |`);
      }
      lines.push(
        `\nThe worst single-facility contingency is **${r.worstCaseFacilityName}**, whose loss would cost ${r.worstCaseLossPct.toFixed(1)}% of net carbon. Average loss across all ${r.n1Results.length} contingencies is ${r.meanLossPct.toFixed(1)}%.`,
      );
      answer = lines.join('\n');
      followUps = [`What happens if ${r.worstCaseFacilityName} shuts down?`];
      break;
    }

    case 'shadow_price': {
      const sp = use('get_shadow_prices') as any[];
      const binding = sp.filter((s) => s.binding);
      if (binding.length === 0) {
        answer = 'No facility capacity constraint is currently binding, so additional capacity has no marginal value at present. The limiting factor is elsewhere — check bottlenecks.';
        break;
      }
      const lines = [
        `Capacity constraints are measured by re-optimisation: I add one tonne per day of headroom at each binding facility and re-solve the whole network. The difference is the true marginal value, including every knock-on reallocation.\n`,
        '| Facility | Utilisation | Marginal carbon | Marginal margin | Per 10 t/day added |',
        '| --- | ---: | ---: | ---: | ---: |',
      ];
      const windowDays = net.assumptions.windowDays;
      for (const s of binding.slice(0, 8)) {
        lines.push(
          `| ${s.facilityName} | ${s.utilisationPct.toFixed(0)}% | ${s.carbonPerExtraTonne.toFixed(2)} tCO₂e/t | ${inr(s.marginPerExtraTonne)}/t | ${nf(s.carbonPerExtraTonne * 10 * windowDays)} tCO₂e, ${inr(s.marginPerExtraTonne * 10 * windowDays)} |`,
        );
      }
      const top = binding[0];
      lines.push(
        `\nCapital should go to **${top.facilityName}** first. Adding 10 t/day there is worth ${nf(top.carbonPerExtraTonne * 10 * windowDays)} tCO₂e and ${inr(top.marginPerExtraTonne * 10 * windowDays)} per ${windowDays}-day window. Everywhere else in the network, an extra tonne of capacity is worth less.`,
      );
      answer = lines.join('\n');
      followUps = [`Simulate adding 40 t/day at ${binding[0].facilityName}`];
      break;
    }

    case 'stranded': {
      const st = use('get_stranded') as any[];
      const total = st.reduce((s, l) => s + l.tonnes, 0);
      const byReason = new Map<string, { t: number; text: string }>();
      for (const l of st) {
        const e = byReason.get(l.reason) ?? { t: 0, text: l.reasonText };
        e.t += l.tonnes;
        byReason.set(l.reason, e);
      }
      const lines = [
        `**${nf(total)} t** of the ${nf(twin.getResult().totals.suppliedT)} t available cannot be placed this window. Every lot has an attributed reason rather than being lumped into "unallocated":\n`,
        '| Reason | Tonnes | What it means |',
        '| --- | ---: | --- |',
      ];
      for (const [reason, v] of [...byReason.entries()].sort((a, b) => b[1].t - a[1].t)) {
        lines.push(`| ${reason.replace(/_/g, ' ')} | ${nf(v.t)} t | ${v.text} |`);
      }
      const co2 = st.reduce((s, l) => s + l.counterfactualEmissionsT, 0);
      lines.push(
        `\nIf nothing changes, that material goes to its counterfactual fate, which carries **${nf(co2)} tCO₂e** of avoidable emissions this window.`,
      );
      lines.push(`\nLargest individual lots:\n`);
      for (const l of st.slice(0, 5)) {
        lines.push(`- ${nf(l.tonnes)} t at **${l.name}** (${STREAMS[l.stream as StreamId].label}) — ${l.reasonText}`);
      }
      answer = lines.join('\n');
      followUps = ['Which bottleneck causes the most stranding?', 'Where should we add capacity?'];
      break;
    }

    case 'compare_objectives': {
      const pareto = twin.getPareto();
      toolCalls.push({
        name: 'get_pareto_frontier',
        args: {},
        summary: `${pareto.length} weighted re-solves`,
      });
      const pure0 = pareto[0];
      const pure1 = pareto[pareto.length - 1];
      const lines = [
        `The trade-off is real and measurable. I re-solved the network at ${pareto.length} objective weights between pure profit and pure carbon:\n`,
        '| Weight on carbon | Net carbon | Margin | Diverted |',
        '| ---: | ---: | ---: | ---: |',
      ];
      for (const p of pareto.filter((_, i) => i % 2 === 0)) {
        lines.push(
          `| ${(p.weight * 100).toFixed(0)}% | ${nf(p.netCarbonT)} tCO₂e | ${inr(p.marginInr)} | ${nf(p.divertedT)} t |`,
        );
      }
      const carbonGain = pure1.netCarbonT - pure0.netCarbonT;
      const marginLoss = pure0.marginInr - pure1.marginInr;
      lines.push(
        `\nGoing from pure profit to pure carbon buys **${nf(carbonGain)} tCO₂e** and costs **${inr(marginLoss)}** — an implied switching cost of ${inr(marginLoss / Math.max(1, carbonGain))} per tCO₂e. Compare that against the ${inr(CARBON_MARKETS.durableCdr.price)}/t removal price to decide whether the carbon-first configuration is actually the profitable one.`,
      );
      answer = lines.join('\n');
      followUps = ['Switch to carbon first', 'What drives the difference?'];
      break;
    }

    default: {
      const r = use('get_optimization_result') as any;
      const b = use('get_bottlenecks') as any[];
      const st = use('get_stranded') as any[];
      const lines = [
        `**Network status — ${net.asOf}, ${net.assumptions.windowDays}-day window, ${objectiveLabel} objective**\n`,
        `- ${nf(r.totals.divertedT)} t of ${nf(r.totals.suppliedT)} t diverted (${r.totals.divertedPct.toFixed(1)}%)`,
        `- Net carbon **${nf(r.totals.netCarbonT)} tCO₂e**, of which ${nf(r.totals.durableRemovalT)} t is durable removal`,
        `- Operating margin **${inr(r.totals.marginInr)}** (${inr(r.totals.marginPerTonneInr)}/t)`,
        `- ${r.openFacilities.length} of ${net.facilities.length} facilities operating`,
        `- Solver: ${nf(r.telemetry.arcsFeasible)} feasible arcs, ${r.telemetry.bnbNodesExplored} branch-and-bound nodes, ${r.telemetry.gapPct.toFixed(2)}% bound gap, ${r.telemetry.solveMs} ms`,
        ``,
        b.length > 0
          ? `The binding issue right now is **${b[0].title}**. ${b[0].recommendation}`
          : `No bottlenecks detected.`,
        ``,
        `${nf(st.reduce((s, l) => s + l.tonnes, 0))} t remains unplaced.`,
      ];
      answer = lines.join('\n');
      followUps = [
        'Which bottleneck should we fix first?',
        'What happens if the largest plant goes offline?',
        'Where should we add capacity?',
      ];
    }
  }

  return {
    answer,
    toolCalls,
    intent,
    entities,
    engine: 'deterministic',
    followUps,
  };
}

/** Questions surfaced in the UI as starting points. */
export const SUGGESTED_QUESTIONS = [
  'What is the network doing right now?',
  'Why was that facility selected?',
  'What happens if the largest plant goes offline?',
  'Which waste sources are underutilised?',
  'What is our highest-carbon-impact bottleneck?',
  'How durable is the biochar carbon we are producing?',
  'Which pathway gives the highest profit for paddy straw?',
  'Where should we add capacity next?',
  'How much carbon could we sequester next month?',
  'Show me carbon versus profit across objectives',
  'Why is feedstock being stranded?',
  'How resilient is the network?',
];
