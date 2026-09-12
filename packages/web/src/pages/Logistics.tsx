/**
 * Logistics.
 *
 * The finding this screen exists to make unmissable: baled crop residue is so light
 * that trucks fill by volume long before they fill by mass. A 16-tonne truck
 * carrying paddy straw at 0.15 t/m³ hauls about 8.7 t. Every model that skips this
 * over-states fleet capacity by a wide margin and under-states transport cost and
 * emissions per tonne by the same factor.
 */

import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Empty,
  ErrorState,
  Loading,
  MiniBar,
  Notice,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
} from '../components/Primitives.tsx';
import { BarList } from '../components/Charts.tsx';
import { inr, num, pct, km } from '../format.ts';

export default function Logistics() {
  const { boot, state, optimization, version } = useTwin();
  const rt = useResource(() => api.routing(), [version], [
    'Splitting allocations into full loads and part-loads…',
    'Running Clarke–Wright savings on part-loads…',
    'Improving tours with Or-opt…',
  ]);

  if (!boot || !state || !optimization) return <Loading message="Loading…" />;
  if (rt.loading) return <Loading message={rt.message} />;
  if (rt.error) return <ErrorState message={rt.error} onRetry={rt.reload} />;
  if (!rt.data) return null;

  const R = rt.data;
  const T = optimization.result.totals;
  const streams = boot.reference.streams as Record<string, any>;

  const volumeLimited = R.routes.filter((r) => r.limitedBy === 'volume');
  const multiStop = R.routes.filter((r) => r.stops.length > 1);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Logistics</h1>
          <div className="lede">
            {num(R.totalTrips)} vehicle trips covering {num(R.totalDistanceKm)} km, planned as
            closed tours returning to the receiving facility.
          </div>
        </div>
      </div>

      <div className="section">
        <StatStrip>
          <Stat label="Trips" value={num(R.totalTrips)} sub={`${num(R.routes.length)} route groups`} />
          <Stat label="Distance" value={num(R.totalDistanceKm)} unit="km" sub={`${num(T.tkm / 1000)}k tonne-km`} />
          <Stat
            label="Fleet utilisation"
            value={pct((R.vehicleDaysUsed / Math.max(1, R.fleetCapacityDays)) * 100, 0)}
            sub={`${num(R.vehicleDaysUsed)} of ${num(R.fleetCapacityDays)} vehicle-days`}
            tone={R.vehicleDaysUsed / Math.max(1, R.fleetCapacityDays) > 0.9 ? 'warnc' : undefined}
          />
          <Stat
            label="Volume-limited tonnage"
            value={pct(R.volumeLimitedSharePct, 0)}
            sub="deck fills before the axle does"
            tone="warnc"
          />
          <Stat
            label="Extra trips from low density"
            value={num(R.extraTripsFromVolume)}
            sub={`vs ${num(R.massEquivalentTrips)} if mass-limited`}
            tone="neg"
          />
          <Stat
            label="Transport emissions"
            value={num(T.transportEmissionsT)}
            unit="tCO₂e"
            sub={`${pct((T.transportEmissionsT / Math.max(1, T.netCarbonT)) * 100, 1)} of net carbon`}
          />
        </StatStrip>
      </div>

      <div className="section">
        <Notice>
          <strong>Bulk density, not the axle rating, is what limits this fleet.</strong>{' '}
          {pct(R.volumeLimitedSharePct, 0)} of the tonnage moved travels on loads that fill the deck
          before reaching the vehicle's mass capacity. That costs{' '}
          <strong>{num(R.extraTripsFromVolume)} additional trips</strong> —{' '}
          {pct((R.extraTripsFromVolume / Math.max(1, R.massEquivalentTrips)) * 100, 0)} more than a
          mass-only model would predict — and the same proportional penalty applies to transport
          cost and emissions per tonne. Densifying straw at the field edge is therefore a fleet
          intervention as much as a handling one.
        </Notice>
      </div>

      <div className="section">
        <div className="grid g-3-2">
          <Panel title="Route groups" flush>
            <DataTable
              rows={R.routes}
              rowKey={(r) => r.id}
              initialSort="dist"
              maxHeight={480}
              columns={[
                {
                  key: 'fac',
                  header: 'To facility',
                  render: (r) => <span className="name">{r.facilityName}</span>,
                  sort: (r) => r.facilityName,
                },
                {
                  key: 'stops',
                  header: 'Stops',
                  render: (r) =>
                    r.stops.length === 1 ? (
                      <span className="muted">direct · {r.stops[0].name}</span>
                    ) : (
                      <>
                        <Tag tone="green">milk run</Tag>{' '}
                        <span className="muted">{r.stops.map((s) => s.name).join(' → ')}</span>
                      </>
                    ),
                },
                { key: 'veh', header: 'Vehicle', render: (r) => r.vehicleLabel, sort: (r) => r.vehicleId },
                { key: 'load', header: 'Load', num: true, sort: (r) => r.loadT, render: (r) => `${num(r.loadT, 1)} t` },
                {
                  key: 'limit',
                  header: 'Limited by',
                  render: (r) => (
                    <Tag tone={r.limitedBy === 'volume' ? 'amber' : undefined}>{r.limitedBy}</Tag>
                  ),
                  sort: (r) => r.limitedBy,
                },
                {
                  key: 'util',
                  header: 'Utilisation',
                  num: true,
                  sort: (r) => r.utilisationPct,
                  render: (r) => (
                    <>
                      {pct(r.utilisationPct, 0)}
                      <MiniBar value={r.utilisationPct} max={100} />
                    </>
                  ),
                },
                { key: 'dist', header: 'Distance', num: true, sort: (r) => r.distanceKm, render: (r) => km(r.distanceKm) },
                {
                  key: 'em',
                  header: 'Emissions',
                  num: true,
                  sort: (r) => r.emissionsT,
                  render: (r) => `${num(r.emissionsT, 1)} t`,
                },
              ]}
            />
          </Panel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title="Fleet">
              <DataTable
                rows={state.vehicles.map((v) => ({
                  ...v,
                  used: R.routes.filter((r) => r.vehicleId === v.id).length,
                }))}
                rowKey={(v) => v.id}
                columns={[
                  { key: 'label', header: 'Type', render: (v) => <span className="name">{v.label}</span> },
                  { key: 'mass', header: 'Mass cap', num: true, render: (v) => `${num(v.massCapacityT)} t` },
                  { key: 'vol', header: 'Deck', num: true, render: (v) => `${num(v.volumeM3)} m³` },
                  { key: 'fleet', header: 'Fleet', num: true, render: (v) => num(v.fleetSize) },
                  { key: 'used', header: 'Route groups', num: true, render: (v) => num(v.used) },
                ]}
              />
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 9, lineHeight: 1.5 }}>
                Achievable payload is min(mass capacity, deck volume × feedstock bulk density). The
                optimiser picks whichever vehicle minimises cost per tonne on each arc, which is why
                tractor-trolleys win short rural hauls and trucks win highway hauls without either
                rule being hard-coded.
              </p>
            </Panel>

            <Panel title="Payload by feedstock">
              <BarList
                rows={Object.keys(streams).map((s) => {
                  const density = streams[s].bulkDensityTPerM3;
                  const truck = state.vehicles.find((v) => v.id === 'truck_16t');
                  const payload = truck
                    ? Math.min(truck.massCapacityT, truck.volumeM3 * density)
                    : 0;
                  return {
                    label: streams[s].label,
                    value: payload,
                    sub: `${density} t/m³ · ${payload >= (truck?.massCapacityT ?? 99) - 0.01 ? 'mass-limited' : 'volume-limited'}`,
                  };
                })}
                format={(v) => `${num(v, 1)} t`}
                colorFor={(r) => (r.value >= 15.99 ? 'var(--green-500)' : 'var(--warn)')}
              />
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
                Achievable payload on a 16 t rigid truck with a 58 m³ deck, by feedstock. Anything
                below 16 t is volume-limited.
              </p>
            </Panel>

            <Panel title="Consolidation">
              <dl className="kv">
                <dt>Multi-stop milk runs</dt>
                <dd>{num(multiStop.length)}</dd>
                <dt>Direct full-load hauls</dt>
                <dd>{num(R.routes.length - multiStop.length)}</dd>
                <dt>Or-opt improvement passes</dt>
                <dd>{num(R.improvementPasses)}</dd>
                <dt>Distance saved by consolidation</dt>
                <dd className={R.consolidationSavingPct > 0 ? 'pos' : 'muted'}>
                  {pct(R.consolidationSavingPct, 1)}
                </dd>
              </dl>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 9, lineHeight: 1.5 }}>
                Consolidation only helps part-loads: a load that already fills the vehicle has
                nothing to gain from an extra stop. With most arcs moving many full loads, the
                saving here is small — which is the honest answer, not a reason to inflate it.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
