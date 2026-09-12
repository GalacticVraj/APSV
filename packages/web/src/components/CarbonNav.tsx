/**
 * Carbon navigation — four questions, not nine nouns.
 *
 * The rail used to list nine peers: Impact, Network, Pathways, Trace,
 * Opportunities, Scenarios, Evidence, Brief, and Carbon Command above them. Two
 * problems with that, both measured rather than guessed:
 *
 *   1. Two of the nine were the same screen. /carbon and /carbon/impact both
 *      opened on "+34,921 tCO2e" as their hero. A reader cannot tell which one
 *      is home, so neither is.
 *
 *   2. The names are abstract nouns. "Trace", "Brief" and "Impact" do not tell
 *      a carbon manager which one answers the question in their head, so the
 *      only way to find anything is to click all nine.
 *
 * So the rail now carries four groups, each named for the question it answers,
 * and the views inside a group are tabs rather than peers. Nine destinations
 * become four decisions, and the nine screens are all still reachable in one
 * more click than before — from a label that says what they are for.
 *
 * The group is derived from the path, so a deep link still lands in the right
 * place with the right tab lit.
 */

import { Link, useRouter } from '../router.tsx';
import { CarbonExportButton } from './CarbonExport.tsx';

export interface CarbonView {
  to: string;
  label: string;
  /** what this view is for, in the reader's words — shown under the tab strip */
  blurb: string;
}

export interface CarbonGroup {
  key: string;
  /** the question a carbon manager is actually holding */
  question: string;
  /** the rail label — short, because the rail is narrow */
  label: string;
  views: CarbonView[];
}

export const CARBON_GROUPS: CarbonGroup[] = [
  {
    key: 'position',
    label: 'Position',
    question: 'How much, and which way is it moving?',
    views: [
      {
        to: '/carbon',
        label: 'Overview',
        blurb:
          'The number in force on the live network, with the map and the flows it came off.',
      },
      {
        to: '/carbon/impact',
        label: 'Breakdown',
        blurb:
          'The net atmospheric effect of the plan currently in force, and the arithmetic behind it. Every term opens into the physical quantities, factors and citations it was built from.',
      },
    ],
  },
  {
    key: 'sources',
    label: 'Where it comes from',
    question: 'Which plants, which routes, which tonnes?',
    views: [
      {
        to: '/carbon/facilities',
        label: 'Plants',
        blurb:
          'Plants are carbon decision points: a haul distance, a conversion efficiency and a feedstock chemistry meeting at one gate. Which of them help the net figure, and which drag on it.',
      },
      {
        to: '/carbon/pathways',
        label: 'Pathways',
        blurb:
          'For one consignment of material, every conversion route the network can actually offer it — ranked on carbon, with the gate that excluded the rest and the margin given up by choosing the carbon winner.',
      },
      {
        to: '/carbon/ledger',
        label: 'Trace',
        blurb:
          'Every figure here resolves to a physical quantity, a published factor and a citation. Open any line for its evidence, or follow a single contribution from the field to the net result.',
      },
    ],
  },
  {
    key: 'actions',
    label: 'What to do',
    question: 'What is the next move worth?',
    views: [
      {
        to: '/carbon/opportunities',
        label: 'Opportunities',
        blurb:
          'Each finding was measured by applying the change and re-running the optimiser. The improvement is the difference between two real solves — and every one says why the optimiser has not already taken it.',
      },
      {
        to: '/carbon/scenarios',
        label: 'Scenarios',
        blurb:
          'Change one real constraint and the whole network re-solves. Everything here is the difference between two full optimiser runs, including which source now goes to which plant.',
      },
    ],
  },
  {
    key: 'defend',
    label: 'Can I defend it',
    question: 'Where did every figure come from?',
    views: [
      {
        to: '/carbon/evidence',
        label: 'Method',
        blurb:
          'Every carbon figure in this system is a model output. What each one was built from, which allocations produced it, and where the factors came from — so the basis can be inspected rather than taken on trust.',
      },
      {
        to: '/carbon/report',
        label: 'Brief',
        blurb:
          'The whole position as a document: position, drivers, actions, risks and method, ready to print or hand over.',
      },
    ],
  },
];

/** The group a carbon path belongs to. Exact matches first, so /carbon does not
 *  swallow /carbon/facilities. */
export function carbonGroupFor(path: string): CarbonGroup | null {
  for (const g of CARBON_GROUPS) {
    if (g.views.some((v) => v.to === path)) return g;
  }
  return null;
}

export function carbonViewFor(path: string): CarbonView | null {
  for (const g of CARBON_GROUPS) {
    const v = g.views.find((x) => x.to === path);
    if (v) return v;
  }
  return null;
}

/**
 * The strip that sits above every carbon screen: the question this group
 * answers, then its views as tabs. A single view group still shows its tab —
 * consistency is worth more than the pixels saved by hiding it.
 */
export function CarbonNav() {
  const { path } = useRouter();
  const group = carbonGroupFor(path);
  if (!group) return null;

  const view = carbonViewFor(path);

  return (
    <div className="cnav">
      <div className="cnav-q">{group.question}</div>
      <div className="cnav-tabs" role="tablist" aria-label={group.label}>
        {group.views.map((v) => (
          <Link
            key={v.to}
            to={v.to}
            className={`cnav-tab${v.to === path ? ' on' : ''}`}
            aria-current={v.to === path ? 'page' : undefined}
          >
            {v.label}
          </Link>
        ))}
        <span className="cnav-spacer" />
        <CarbonExportButton />
      </div>
      {view && <div className="cnav-blurb">{view.blurb}</div>}
    </div>
  );
}
