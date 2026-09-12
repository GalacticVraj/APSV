/**
 * Network Map — the primary operational interface.
 *
 * The map is the screen, not an illustration on one. Selecting any object opens a
 * contextual inspector that answers the question that object raises: for a source,
 * where can this go and what is it worth; for a facility, what is it taking and how
 * full is it; for a flow, what does this specific movement cost in carbon and cash.
 */

import { useMemo, useState } from 'react';
import { useTwin } from '../store.tsx';
import { NetworkMap, PATHWAY_SHORT, type Selection } from '../components/NetworkMap.tsx';
import { Loading, Tag, StatusDot, Empty } from '../components/Primitives.tsx';
import { inr, num, pct, km, tonnes } from '../format.ts';
import type { PathwayId, StreamId } from '../../../engine/src/types.ts';

export default function MapPage() {
  const { boot, state, optimization } = useTwin();
  const [selection, setSelection] = useState<Selection>(null);
  const [showFlows, setShowFlows] = useState(true);
  const [streamFilter, setStreamFilter] = useState<StreamId | 'all'>('all');

  const allocations = optimization?.result.allocations ?? [];

  const filtered = useMemo(
    () => (streamFilter === 'all' ? allocations : allocations.filter((a) => a.stream === streamFilter)),
    [allocations, streamFilter],
  );

  if (!boot || !state || !optimization) return <Loading message="Loading network topology…" />;

  const streams = boot.reference.streams as Record<string, { label: string }>;
  const pathways = boot.reference.pathways as Record<string, { label: string; short: string; description: string }>;

  return (
    <div className="page flush" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head">
        <div>
          <h1>Network Map</h1>
          <div className="lede">
            {num(state.sources.length)} sources, {num(state.facilities.length)} facilities,{' '}
            {num(allocations.length)} active flows moving {num(optimization.result.totals.divertedT)} t.
            Scroll to zoom, drag to pan, click anything to inspect it.
          </div>
        </div>
        <div className="head-actions">
          <select
            className="inp"
            style={{ width: 190 }}
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value as StreamId | 'all')}
            aria-label="Filter flows by feedstock stream"
          >
            <option value="all">All feedstock streams</option>
            {Object.keys(streams).map((s) => (
              <option key={s} value={s}>
                {streams[s].label}
              </option>
            ))}
          </select>
          <div className="seg">
            <button aria-pressed={showFlows} onClick={() => setShowFlows(true)}>
              Flows
            </button>
            <button aria-pressed={!showFlows} onClick={() => setShowFlows(false)}>
              Assets only
            </button>
          </div>
        </div>
      </div>

      <div className="mapwrap">
        <NetworkMap
          sources={state.sources}
          facilities={state.facilities}
          allocations={filtered}
          selection={selection}
          onSelect={setSelection}
          showFlows={showFlows}
        />

        <aside className="mapinspect">
          <Inspector selection={selection} onSelect={setSelection} />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Inspector({
  selection,
  onSelect,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const { boot, state, optimization, sourceById, facilityById } = useTwin();
  if (!boot || !state || !optimization) return null;

  const allocations = optimization.result.allocations;
  const streams = boot.reference.streams as Record<string, any>;
  const pathways = boot.reference.pathways as Record<string, any>;
  const windowDays = state.assumptions.windowDays;

  if (!selection) {
    const T = optimization.result.totals;
    return (
      <div>
        <div className="inspect-head">
          <div className="kind">Network</div>
          <h3>Nothing selected</h3>
          <div className="sub">Click a source, a facility or a flow.</div>
        </div>
        <div style={{ padding: 14 }}>
          <dl className="kv">
            <dt>Supply available</dt>
            <dd>{num(T.suppliedT)} t</dd>
            <dt>Allocated</dt>
            <dd>{num(T.divertedT)} t</dd>
            <dt>Stranded</dt>
            <dd>{num(T.strandedT)} t</dd>
            <dt>Active flows</dt>
            <dd>{num(allocations.length)}</dd>
            <dt>Net carbon</dt>
            <dd>{num(T.netCarbonT)} tCO₂e</dd>
            <dt>Operating margin</dt>
            <dd>{inr(T.marginInr)}</dd>
          </dl>
          <hr className="hairline" />
          <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
            Source squares are filled in proportion to how much of their available tonnage the
            network collects. A hollow square is material the optimiser could not place. The ring
            around a facility is its utilisation; it turns amber at capacity.
          </p>
        </div>
      </div>
    );
  }

  if (selection.kind === 'source') {
    const s = sourceById.get(selection.id);
    if (!s) return <Empty title="Source not found" body="This source is no longer in the network." />;
    const stream = streams[s.stream];
    const mine = allocations.filter((a) => a.sourceId === s.id);
    const allocated = mine.reduce((x, a) => x + a.tonnes, 0);
    const unplaced = s.availableT - allocated;

    return (
      <div>
        <div className="inspect-head">
          <div className="kind">Waste source · {s.kind.replace(/_/g, ' ')}</div>
          <h3>{s.name}</h3>
          <div className="sub">
            {s.district}, {s.state} · {s.clusterCount} collection point
            {s.clusterCount === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <dl className="kv">
            <dt>Feedstock</dt>
            <dd>{stream.label}</dd>
            <dt>Available this window</dt>
            <dd>{num(s.availableT)} t</dd>
            <dt>Allocated</dt>
            <dd>{num(allocated)} t</dd>
            <dt>Unplaced</dt>
            <dd className={unplaced > 1 ? 'neg' : ''}>{num(Math.max(0, unplaced))} t</dd>
            <dt>Annual generation</dt>
            <dd>{num(s.annualT)} t</dd>
            <dt>Road access</dt>
            <dd>{s.access.replace(/_/g, ' ')}</dd>
          </dl>

          <hr className="hairline" />
          <div className="stat-label">Feedstock properties</div>
          <dl className="kv" style={{ marginTop: 6 }}>
            <dt>Moisture</dt>
            <dd>{stream.moisturePct}%</dd>
            <dt>Ash</dt>
            <dd>{stream.ashPct}%</dd>
            <dt>Lignin</dt>
            <dd>{stream.ligninPct}%</dd>
            <dt>C:N ratio</dt>
            <dd>{stream.cnRatio}:1</dd>
            <dt>Bulk density</dt>
            <dd>{stream.bulkDensityTPerM3} t/m³</dd>
            <dt>Gate price</dt>
            <dd>{inr(stream.gatePriceInrPerT)}/t</dd>
          </dl>
          <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 8 }}>
            {stream.notes}
          </p>

          <hr className="hairline" />
          <div className="stat-label">Destinations</div>
          {mine.length === 0 ? (
            <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>
              Nothing from this source is being collected. Open the Bottlenecks screen for the
              attributed reason.
            </p>
          ) : (
            <div className="flowlist" style={{ marginTop: 4 }}>
              {mine
                .slice()
                .sort((a, b) => b.tonnes - a.tonnes)
                .map((a) => {
                  const f = facilityById.get(a.facilityId);
                  return (
                    <div
                      className="fl-row"
                      key={a.facilityId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelect({ kind: 'facility', id: a.facilityId })}
                    >
                      <div className="fl-t">{num(a.tonnes)} t</div>
                      <div className="fl-d">
                        <b>{f?.name ?? a.facilityId}</b>
                        <br />
                        {PATHWAY_SHORT[a.pathway as PathwayId]} · {km(a.distanceKm)} ·{' '}
                        {num(a.netCarbonT / Math.max(1, a.tonnes), 2)} tCO₂e/t ·{' '}
                        {inr(a.marginInr / Math.max(1, a.tonnes))}/t
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selection.kind === 'facility') {
    const f = facilityById.get(selection.id);
    if (!f) return <Empty title="Facility not found" body="This facility is no longer in the network." />;
    const p = pathways[f.pathway];
    const feeds = allocations.filter((a) => a.facilityId === f.id);
    const load = feeds.reduce((x, a) => x + a.tonnes, 0);
    const cap = f.capacityTpd * f.availability * windowDays;
    const util = cap > 0 ? (load / cap) * 100 : 0;
    const sp = optimization.result.shadowPrices.find((x) => x.facilityId === f.id);
    const carbon = feeds.reduce((x, a) => x + a.netCarbonT, 0);
    const margin = feeds.reduce((x, a) => x + a.marginInr, 0);

    return (
      <div>
        <div className="inspect-head">
          <div className="kind">
            Facility · {p.short} <StatusDot status={f.status} />
          </div>
          <h3>{f.name}</h3>
          <div className="sub">
            {f.operator} · {f.district}, {f.state} · commissioned {f.commissioned}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <dl className="kv">
            <dt>Nameplate capacity</dt>
            <dd>{num(f.capacityTpd)} t/day</dd>
            <dt>Availability</dt>
            <dd>{pct(f.availability * 100, 0)}</dd>
            <dt>Window capacity</dt>
            <dd>{num(cap)} t</dd>
            <dt>Allocated</dt>
            <dd>{num(load)} t</dd>
            <dt>Utilisation</dt>
            <dd className={util >= 97 ? 'warnc' : util > 0 ? 'pos' : 'muted'}>{pct(util, 0)}</dd>
            <dt>Minimum viable feed</dt>
            <dd>{num(f.minFeedTpd)} t/day</dd>
          </dl>

          <div style={{ position: 'relative', height: 8, background: 'var(--surface-sunken)', marginTop: 10 }}>
            <i
              style={{
                position: 'absolute',
                inset: '0 auto 0 0',
                width: `${Math.min(100, util)}%`,
                background: util >= 97 ? 'var(--warn)' : 'var(--green-500)',
                transition: 'width var(--t-med)',
              }}
            />
          </div>

          {sp?.binding && (
            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Capacity is binding here.</strong> One more tonne per day is worth{' '}
              {sp.carbonPerExtraTonne.toFixed(2)} tCO₂e and {inr(sp.marginPerExtraTonne)}, measured
              by re-optimising the whole network with the extra headroom.
            </div>
          )}

          <hr className="hairline" />
          <div className="stat-label">Performance this window</div>
          <dl className="kv" style={{ marginTop: 6 }}>
            <dt>Net carbon</dt>
            <dd>{num(carbon)} tCO₂e</dd>
            <dt>Carbon intensity</dt>
            <dd>{load > 0 ? `${(carbon / load).toFixed(2)} tCO₂e/t` : '—'}</dd>
            <dt>Operating margin</dt>
            <dd>{inr(margin)}</dd>
            <dt>Margin per tonne</dt>
            <dd>{load > 0 ? `${inr(margin / load)}` : '—'}</dd>
            <dt>Opex</dt>
            <dd>{inr(f.opexInrPerT)}/t</dd>
            <dt>Capital charge</dt>
            <dd>{inr(f.capexAmortInrPerT)}/t</dd>
          </dl>

          <hr className="hairline" />
          <div className="stat-label">Technology</div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 6 }}>
            {p.description}
          </p>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>{p.maturity}</p>

          <hr className="hairline" />
          <div className="stat-label">Incoming feedstock ({feeds.length})</div>
          {feeds.length === 0 ? (
            <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>
              This facility is idle. The optimiser could not assemble{' '}
              {num(f.minFeedTpd * windowDays)} t of compatible feedstock within its catchment, which
              is its minimum viable feed.
            </p>
          ) : (
            <div className="flowlist" style={{ marginTop: 4 }}>
              {feeds
                .slice()
                .sort((a, b) => b.tonnes - a.tonnes)
                .map((a) => {
                  const s = sourceById.get(a.sourceId);
                  return (
                    <div
                      className="fl-row"
                      key={a.sourceId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelect({ kind: 'source', id: a.sourceId })}
                    >
                      <div className="fl-t">{num(a.tonnes)} t</div>
                      <div className="fl-d">
                        <b>{s?.name ?? a.sourceId}</b>
                        <br />
                        {streams[a.stream].label} · {km(a.distanceKm)} · {num(a.trips)} trips
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Flow
  const a = allocations.find(
    (x) => x.sourceId === selection.sourceId && x.facilityId === selection.facilityId,
  );
  if (!a) return <Empty title="Flow not found" body="This flow is not part of the current plan." />;
  const s = sourceById.get(a.sourceId);
  const f = facilityById.get(a.facilityId);
  const veh = state.vehicles.find((v) => v.id === a.vehicleId);
  const stream = streams[a.stream];
  const massLimited = veh ? a.payloadT >= veh.massCapacityT - 1e-6 : true;

  return (
    <div>
      <div className="inspect-head">
        <div className="kind">Material flow</div>
        <h3>
          {s?.name} → {f?.name}
        </h3>
        <div className="sub">
          {stream.label} · {PATHWAY_SHORT[a.pathway as PathwayId]}
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <dl className="kv">
          <dt>Tonnage</dt>
          <dd>{num(a.tonnes)} t</dd>
          <dt>Road distance</dt>
          <dd>{km(a.distanceKm)}</dd>
          <dt>Vehicle</dt>
          <dd>{veh?.label ?? a.vehicleId}</dd>
          <dt>Payload achieved</dt>
          <dd>{num(a.payloadT, 1)} t</dd>
          <dt>Trips required</dt>
          <dd>{num(a.trips)}</dd>
          <dt>Tonne-kilometres</dt>
          <dd>{num(a.tkm)}</dd>
        </dl>

        {!massLimited && veh && (
          <div className="notice" style={{ marginTop: 10 }}>
            <strong>Volume-limited.</strong> At {stream.bulkDensityTPerM3} t/m³ this load fills the{' '}
            {num(veh.volumeM3)} m³ deck at {num(a.payloadT, 1)} t, well below the vehicle's{' '}
            {num(veh.massCapacityT)} t rating. That is {num(a.trips)} trips instead of{' '}
            {num(Math.ceil(a.tonnes / veh.massCapacityT))}.
          </div>
        )}

        <hr className="hairline" />
        <div className="stat-label">Carbon</div>
        <dl className="kv" style={{ marginTop: 6 }}>
          <dt>Durable removal</dt>
          <dd className="pos">{num(a.durableT, 1)} tCO₂e</dd>
          <dt>Avoided + substitution</dt>
          <dd className="pos">{num(a.avoidedT, 1)} tCO₂e</dd>
          <dt>Emissions caused</dt>
          <dd className="neg">−{num(a.emittedT, 1)} tCO₂e</dd>
          <dt>
            <strong>Net</strong>
          </dt>
          <dd>
            <strong>{num(a.netCarbonT, 1)} tCO₂e</strong>
          </dd>
          <dt>Per tonne</dt>
          <dd>{(a.netCarbonT / Math.max(1, a.tonnes)).toFixed(3)} tCO₂e/t</dd>
        </dl>

        <hr className="hairline" />
        <div className="stat-label">Economics</div>
        <dl className="kv" style={{ marginTop: 6 }}>
          <dt>Revenue</dt>
          <dd className="pos">{inr(a.revenueInr)}</dd>
          <dt>Cost</dt>
          <dd className="neg">−{inr(a.costInr)}</dd>
          <dt>
            <strong>Margin</strong>
          </dt>
          <dd>
            <strong className={a.marginInr >= 0 ? 'pos' : 'neg'}>{inr(a.marginInr)}</strong>
          </dd>
          <dt>Per tonne</dt>
          <dd>{inr(a.marginInr / Math.max(1, a.tonnes))}/t</dd>
        </dl>

        <div style={{ marginTop: 12, display: 'flex', gap: 7 }}>
          <button className="btn sm" onClick={() => onSelect({ kind: 'source', id: a.sourceId })}>
            Inspect source
          </button>
          <button className="btn sm" onClick={() => onSelect({ kind: 'facility', id: a.facilityId })}>
            Inspect facility
          </button>
        </div>
      </div>
    </div>
  );
}
