/**
 * Network Activity — the operational event log.
 *
 * Every optimisation, scenario, alert and forecast refresh is recorded by the twin
 * as it happens. This is the audit trail: what the system did, when, and why.
 */

import { useState } from 'react';
import { useTwin } from '../store.tsx';
import { DataTable, Empty, Loading, Panel, SectionHead, Tag, DecisionBanner } from '../components/Primitives.tsx';
import { timeShort, titleCase } from '../format.ts';
import type { NetworkEvent } from '../../../engine/src/types.ts';

const KIND_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | undefined> = {
  optimization: 'green',
  scenario: 'amber',
  alert: 'red',
  forecast: 'blue',
  system: undefined,
};

export default function Activity() {
  const { state } = useTwin();
  const [kind, setKind] = useState<string>('all');

  if (!state) return <Loading message="Loading event log…" />;

  const events: NetworkEvent[] = state.events.filter((e) => kind === 'all' || e.kind === kind);
  const kinds = ['all', ...new Set(state.events.map((e) => e.kind))];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Network Activity</h1>
          <div className="lede">
            Everything the engine has done this session, newest first. Solves, scenario
            applications, alerts raised by the bottleneck scanner and forecast refreshes.
          </div>
        </div>
        <div className="head-actions">
          <div className="seg">
            {kinds.map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <DecisionBanner
          badge="Audit Trail & Telemetry State"
          happening={
            <>
              Recorded <strong>{state.events.length} system events</strong> this session across solver executions, scenario shocks, and forecast updates.
            </>
          }
          why="Every state mutation is logged deterministically with its timestamp, seed, and tool-call attribution."
          action="Review latest solver telemetry or run scenarios to observe real-time audit logging."
          actionLabel="Run Optimization →"
          to="/optimization"
        />

        <SectionHead title="Event log" note={`${events.length} events`} />
        <Panel flush>
          {events.length === 0 ? (
            <Empty
              title="No events yet"
              body="The log fills as the engine works. Change the objective, run a scenario, or open the Carbon screen to trigger a computation."
            />
          ) : (
            <DataTable
              rows={events}
              rowKey={(e) => e.id}
              columns={[
                {
                  key: 'ts',
                  header: 'Time',
                  render: (e) => <span className="num">{timeShort(e.ts)}</span>,
                  width: 90,
                },
                {
                  key: 'kind',
                  header: 'Kind',
                  render: (e) => <Tag tone={KIND_TONE[e.kind]}>{titleCase(e.kind)}</Tag>,
                  width: 110,
                },
                {
                  key: 'title',
                  header: 'Event',
                  render: (e) => <span className="name">{e.title}</span>,
                },
                {
                  key: 'detail',
                  header: 'Detail',
                  render: (e) => (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {e.detail}
                    </span>
                  ),
                },
                {
                  key: 'entities',
                  header: 'Entities',
                  num: true,
                  render: (e) =>
                    e.entityIds.length > 0 ? (
                      <span className="muted">{e.entityIds.length}</span>
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
              ]}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
