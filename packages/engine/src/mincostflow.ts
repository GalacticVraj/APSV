/**
 * Minimum-cost maximum-flow.
 *
 * The network allocation problem — which tonne goes to which facility by which
 * pathway — is a transportation problem. Once the set of operating facilities is
 * fixed, it is a *linear* problem with an integral optimal solution, and min-cost
 * flow solves it exactly rather than approximately.
 *
 * This matters for more than correctness. An exact solve gives us a genuine
 * optimality bound, so the UI can report a real branch-and-bound gap rather than
 * asserting optimality it cannot demonstrate, and it lets us measure the marginal
 * value of facility capacity by re-optimisation — the most actionable number the
 * whole system produces.
 *
 * Implementation: successive shortest paths with Johnson potentials. Arc costs are
 * negative (we maximise value), so the potentials are initialised with one
 * Bellman-Ford/SPFA pass; every subsequent shortest path is found with Dijkstra on
 * non-negative reduced costs.
 */

export interface McfEdge {
  to: number;
  cap: number;
  cost: number;
  flow: number;
}

/** Binary min-heap keyed by number, storing node ids. */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.vals.length;
  }

  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.vals.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(p, i);
      i = p;
    }
  }

  pop(): { key: number; val: number } {
    const key = this.keys[0];
    const val = this.vals[0];
    const lastK = this.keys.pop() as number;
    const lastV = this.vals.pop() as number;
    if (this.vals.length > 0) {
      this.keys[0] = lastK;
      this.vals[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.vals.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.vals.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(m, i);
        i = m;
      }
    }
    return { key, val };
  }

  private swap(a: number, b: number): void {
    const k = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = k;
    const v = this.vals[a];
    this.vals[a] = this.vals[b];
    this.vals[b] = v;
  }
}

export class MinCostFlow {
  n: number;
  graph: number[][];
  edges: McfEdge[];
  /** Johnson potentials after the final iteration — the LP duals on node balance. */
  potentials: number[];
  iterations: number;

  constructor(n: number) {
    this.n = n;
    this.graph = Array.from({ length: n }, () => [] as number[]);
    this.edges = [];
    this.potentials = new Array(n).fill(0);
    this.iterations = 0;
  }

  /** Adds a directed arc plus its residual twin. Returns the forward edge index. */
  addEdge(from: number, to: number, cap: number, cost: number): number {
    const idx = this.edges.length;
    this.edges.push({ to, cap, cost, flow: 0 });
    this.graph[from].push(idx);
    this.edges.push({ to: from, cap: 0, cost: -cost, flow: 0 });
    this.graph[to].push(idx + 1);
    return idx;
  }

  flowOn(edgeIndex: number): number {
    return this.edges[edgeIndex].flow;
  }

  /** SPFA over the initial (possibly negative-cost) graph to seed the potentials. */
  private seedPotentials(s: number): void {
    const INF = Number.POSITIVE_INFINITY;
    const h = new Array(this.n).fill(INF);
    h[s] = 0;
    const inQueue = new Uint8Array(this.n);
    const queue: number[] = [s];
    inQueue[s] = 1;
    let head = 0;
    let guard = 0;
    const limit = this.n * this.edges.length + 16;
    while (head < queue.length && guard++ < limit) {
      const u = queue[head++];
      inQueue[u] = 0;
      for (const ei of this.graph[u]) {
        const e = this.edges[ei];
        if (e.cap - e.flow <= 0) continue;
        const nd = h[u] + e.cost;
        if (nd < h[e.to] - 1e-9) {
          h[e.to] = nd;
          if (!inQueue[e.to]) {
            inQueue[e.to] = 1;
            queue.push(e.to);
          }
        }
      }
      if (head > 8192 && head * 2 > queue.length) {
        queue.splice(0, head);
        head = 0;
      }
    }
    for (let i = 0; i < this.n; i++) this.potentials[i] = h[i] === INF ? 0 : h[i];
  }

  /**
   * Runs min-cost max-flow from s to t.
   * Returns the total flow pushed and the total (true, un-reduced) cost.
   */
  run(s: number, t: number): { flow: number; cost: number } {
    this.seedPotentials(s);

    const INF = Number.POSITIVE_INFINITY;
    const dist = new Array(this.n).fill(0);
    const prevEdge = new Int32Array(this.n);
    const done = new Uint8Array(this.n);
    const h = this.potentials;

    let totalFlow = 0;
    let totalCost = 0;

    for (;;) {
      dist.fill(INF);
      prevEdge.fill(-1);
      done.fill(0);
      dist[s] = 0;

      const heap = new Heap();
      heap.push(0, s);
      while (heap.size > 0) {
        const { key, val: u } = heap.pop();
        if (done[u]) continue;
        if (key > dist[u] + 1e-9) continue;
        done[u] = 1;
        for (const ei of this.graph[u]) {
          const e = this.edges[ei];
          if (e.cap - e.flow <= 0) continue;
          const v = e.to;
          if (done[v]) continue;
          // Reduced cost is non-negative once the potentials are valid.
          const rc = e.cost + h[u] - h[v];
          const nd = dist[u] + (rc > 0 ? rc : 0);
          if (nd < dist[v] - 1e-9) {
            dist[v] = nd;
            prevEdge[v] = ei;
            heap.push(nd, v);
          }
        }
      }

      this.iterations++;
      if (dist[t] === INF) break;

      for (let i = 0; i < this.n; i++) {
        if (dist[i] < INF) h[i] += dist[i];
      }

      // Bottleneck along the discovered path.
      let push = Number.MAX_SAFE_INTEGER;
      for (let v = t; v !== s; ) {
        const ei = prevEdge[v];
        const e = this.edges[ei];
        const residual = e.cap - e.flow;
        if (residual < push) push = residual;
        v = this.edges[ei ^ 1].to;
      }
      if (push <= 0) break;

      for (let v = t; v !== s; ) {
        const ei = prevEdge[v];
        this.edges[ei].flow += push;
        this.edges[ei ^ 1].flow -= push;
        totalCost += push * this.edges[ei].cost;
        v = this.edges[ei ^ 1].to;
      }
      totalFlow += push;

      // Far above anything a real network of this size reaches; a safety net only.
      if (this.iterations > 50000) break;
    }

    return { flow: totalFlow, cost: totalCost };
  }
}

/**
 * Problem statement handed to the solver by the optimiser.
 *
 * Values are integers: the optimiser scales its objective (rupees, or tCO2e, or a
 * normalised blend) by a fixed factor before handing it over. Integer arithmetic
 * keeps shortest-path comparisons exact and avoids floating-point tie-break drift,
 * which is what would otherwise make two runs with the same seed disagree.
 */
export interface TransportProblem {
  supplies: number[];
  /** capacity per facility for the whole window, in the same unit as supplies */
  capacities: number[];
  /** minimum throughput per facility if it operates at all; 0 = no minimum */
  lowerBounds: number[];
  /** arcs[i] = list of (facilityIndex, integerValuePerUnit) for source i */
  arcs: Array<Array<{ facility: number; value: number }>>;
}

export interface TransportSolution {
  /** flow[i][k] matches arcs[i][k] */
  flow: number[][];
  facilityLoad: number[];
  /** total value achieved, in the caller's scaled integer units */
  value: number;
  unallocated: number[];
  iterations: number;
  lowerBoundsMet: boolean[];
}

/**
 * Bonus applied to the mandatory segment of a facility's outflow when the
 * branch-and-bound decides to keep that facility open. Any solution that *can*
 * reach the minimum viable feed will do so; the bonus never reaches the reported
 * objective, which is recomputed from the arc flows.
 *
 * Sized well above the largest per-unit objective value (about 2e6) and well below
 * the safe-integer ceiling once multiplied by the largest possible flow.
 */
const FORCE_BONUS = 100_000_000;

export function solveTransport(p: TransportProblem): TransportSolution {
  const nS = p.supplies.length;
  const nF = p.capacities.length;
  const S = 0;
  const srcBase = 1;
  const facBase = 1 + nS;
  const T = 1 + nS + nF;
  const mcf = new MinCostFlow(T + 1);

  for (let i = 0; i < nS; i++) {
    const s = Math.max(0, Math.round(p.supplies[i]));
    mcf.addEdge(S, srcBase + i, s, 0);
    // "Not allocated" arc: lets the solver leave material in the field rather
    // than forcing a loss-making or carbon-negative movement.
    mcf.addEdge(srcBase + i, T, s, 0);
  }

  const arcEdgeIndex: number[][] = [];
  for (let i = 0; i < nS; i++) {
    const row: number[] = [];
    for (const a of p.arcs[i]) {
      const cap = Math.min(Math.round(p.supplies[i]), Math.round(p.capacities[a.facility]));
      if (cap <= 0) {
        row.push(-1);
        continue;
      }
      // Maximising value is minimising negative value.
      row.push(mcf.addEdge(srcBase + i, facBase + a.facility, cap, -a.value));
    }
    arcEdgeIndex.push(row);
  }

  const forcedEdges: number[] = new Array(nF).fill(-1);
  for (let j = 0; j < nF; j++) {
    const cap = Math.max(0, Math.round(p.capacities[j]));
    const lb = Math.max(0, Math.min(cap, Math.round(p.lowerBounds[j])));
    if (lb > 0) {
      forcedEdges[j] = mcf.addEdge(facBase + j, T, lb, -FORCE_BONUS);
      if (cap - lb > 0) mcf.addEdge(facBase + j, T, cap - lb, 0);
    } else if (cap > 0) {
      mcf.addEdge(facBase + j, T, cap, 0);
    }
  }

  mcf.run(S, T);

  const flow: number[][] = [];
  const facilityLoad = new Array(nF).fill(0);
  const unallocated = new Array(nS).fill(0);
  let value = 0;

  for (let i = 0; i < nS; i++) {
    const row: number[] = [];
    let assigned = 0;
    for (let k = 0; k < p.arcs[i].length; k++) {
      const ei = arcEdgeIndex[i][k];
      const fl = ei < 0 ? 0 : mcf.flowOn(ei);
      row.push(fl);
      assigned += fl;
      facilityLoad[p.arcs[i][k].facility] += fl;
      value += fl * p.arcs[i][k].value;
    }
    flow.push(row);
    unallocated[i] = Math.max(0, Math.round(p.supplies[i]) - assigned);
  }

  const lowerBoundsMet = new Array(nF).fill(true);
  for (let j = 0; j < nF; j++) {
    if (forcedEdges[j] >= 0) {
      const e = mcf.edges[forcedEdges[j]];
      lowerBoundsMet[j] = e.flow >= e.cap;
    }
  }

  return {
    flow,
    facilityLoad,
    value,
    unallocated,
    iterations: mcf.iterations,
    lowerBoundsMet,
  };
}
