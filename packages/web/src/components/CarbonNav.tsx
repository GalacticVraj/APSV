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
    key: 'control',
    label: 'Control',
    question: 'What is happening?',
    views: [
      {
        to: '/carbon',
        label: 'Control Center',
        blurb:
          'The carbon position of the network currently in force, on the network itself.',
      },
      {
        to: '/carbon/impact',
        label: 'Breakdown',
        blurb:
          'The same number opened into its six terms, with how it moved against the previous period.',
      },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    question: 'Where is it happening?',
    views: [
      {
        to: '/carbon/facilities',
        label: 'Plants',
        blurb:
          'Which plants create the carbon, which drag on it, and where material can still be placed.',
      },
      {
        to: '/carbon/pathways',
        label: 'Pathways',
        blurb:
          'For one consignment, every conversion route the network can actually offer it — ranked on carbon, with the gate that excluded the rest.',
      },
    ],
  },
  {
    key: 'decisions',
    label: 'Decisions',
    question: 'What should change?',
    views: [
      {
        to: '/carbon/opportunities',
        label: 'Opportunities',
        blurb:
          'Each finding was measured by applying the change and re-running the optimiser — the difference between two real solves, with the reason it has not already been taken.',
      },
    ],
  },
  {
    key: 'simulate',
    label: 'Simulate',
    question: 'What happens if reality changes?',
    views: [
      {
        to: '/carbon/scenarios',
        label: 'Scenarios',
        blurb:
          'Change one real constraint and the whole network re-solves. The live network is never modified.',
      },
    ],
  },
  {
    key: 'trace',
    label: 'Trace',
    question: 'Why should I trust this number?',
    views: [
      {
        to: '/carbon/ledger',
        label: 'Ledger',
        blurb:
          'Every figure resolves to a physical quantity, a published factor and a citation. Follow one contribution from the field to the net result.',
      },
      {
        to: '/carbon/evidence',
        label: 'Evidence',
        blurb:
          'What each figure was built from, which allocations produced it, and where this model agrees or disagrees with published work.',
      },
    ],
  },
  {
    key: 'report',
    label: 'Report',
    question: 'What should I communicate?',
    views: [
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
