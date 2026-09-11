/**
 * The demo script.
 *
 * A deterministic, three-minute walkthrough that the UI can drive step by step.
 * Every step declares which screen to show, what to do, and what the presenter
 * should be saying — so the demo is a feature of the product rather than a
 * rehearsal artefact, and it cannot drift out of sync with the build.
 */

export interface DemoStep {
  id: string;
  seconds: number;
  route: string;
  title: string;
  /** what the presenter says */
  say: string;
  /** what the operator does on screen */
  action: string;
  /** the action the UI should perform automatically, if any */
  command:
    | { kind: 'none' }
    | { kind: 'setObjective'; mode: string }
    | { kind: 'runOptimization' }
    | { kind: 'runScenario'; scenario: string; params: Record<string, string | number> }
    | { kind: 'highlight'; target: string };
  /** the number the audience should be looking at */
  watchFor: string;
}

export const DEMO_SCRIPT: { totalSeconds: number; steps: DemoStep[] } = {
  totalSeconds: 180,
  steps: [
    {
      id: 'step-1',
      seconds: 25,
      route: '/map',
      title: 'The network exists',
      say: 'This is a real waste-to-carbon network across Punjab and Haryana. Forty-two aggregation points, eighteen processing facilities, five conversion pathways. Fifty-seven thousand tonnes of residue available in this thirty-day window — most of which, today, gets burned in the field.',
      action: 'Network Map loads. Sources, facilities and active flows draw in.',
      command: { kind: 'none' },
      watchFor: 'Supply available and the density of unserved sources',
    },
    {
      id: 'step-2',
      seconds: 30,
      route: '/optimization',
      title: 'The system decides',
      say: 'The optimiser is not scoring a list. It builds every feasible source-facility-pathway arc, prices each one in carbon and in rupees, and solves the allocation exactly with min-cost flow inside a branch and bound over which plants run at all. It reports its own optimality gap.',
      action: 'Run the optimiser. Watch the stages and the solver telemetry.',
      command: { kind: 'runOptimization' },
      watchFor: 'Feasible arcs, branch-and-bound nodes, bound gap, solve time',
    },
    {
      id: 'step-3',
      seconds: 25,
      route: '/carbon',
      title: 'Every number is traceable',
      say: 'The carbon ledger shows the arithmetic, not a headline. Biogenic CO2 is excluded. Durable removal and avoided emissions are never added together. And biochar permanence is corrected from the European reference soil temperature to twenty-six degrees — biochar decays about forty-five percent faster in Indian soil, which most accounting in this space gets wrong.',
      action: 'Open the ledger and expand the permanence panel.',
      command: { kind: 'none' },
      watchFor: 'BC100 at 26 °C versus 14.9 °C, and the P5–P95 uncertainty band',
    },
    {
      id: 'step-4',
      seconds: 25,
      route: '/optimization',
      title: 'The objective changes the network',
      say: 'Switch from Profit First to Carbon First. Nothing physical changes — but paddy straw stops going to pyrolysis and starts going to pellet co-firing, because displacing coal beats locking forty percent of the carbon in char. The map redraws. That is a real trade-off, not a filter.',
      action: 'Switch objective to Carbon First.',
      command: { kind: 'setObjective', mode: 'carbon_first' },
      watchFor: 'Net carbon up, margin down, and the pathway mix inverting',
    },
    {
      id: 'step-5',
      seconds: 45,
      route: '/scenarios',
      title: 'Something breaks',
      say: 'Now take the largest pellet plant offline. The network re-optimises from scratch — not a patch, a full re-solve. Watch the routes redraw, the waste reallocate, and the system tell you exactly which flows moved, how far, and what it cost in carbon and rupees.',
      action: 'Run the facility-outage scenario on Panipat Co-firing Feed Plant.',
      command: {
        kind: 'runScenario',
        scenario: 'facility_offline',
        params: { facilityId: 'FAC-PL-03' },
      },
      watchFor: 'Routes animating to new destinations; the before/after delta bar',
    },
    {
      id: 'step-6',
      seconds: 20,
      route: '/bottlenecks',
      title: 'And it tells you what to do',
      say: 'The system does not stop at reporting damage. It measures the marginal value of capacity by re-optimising with one extra tonne per day at every binding facility, and ranks where the next rupee of capital should go. That is the difference between a dashboard and an operating system.',
      action: 'Open Bottlenecks and read the top shadow price.',
      command: { kind: 'none' },
      watchFor: 'Marginal tCO2e and rupees per additional tonne of capacity',
    },
    {
      id: 'step-7',
      seconds: 10,
      route: '/copilot',
      title: 'Ask it anything',
      say: 'And every one of those numbers is available to the copilot, which answers from the same engine the screens read. It never invents a figure — it calls a tool, and shows you which one.',
      action: 'Ask: "Where should we add capacity next?"',
      command: { kind: 'none' },
      watchFor: 'The tool-call trace beneath the answer',
    },
  ],
};
