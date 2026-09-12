import React, { useEffect, useState } from 'react';
import { Plus, Leaf, TrendingUp, Package, Clock, CheckCircle2, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import AppLayout from '../../components/layout/AppLayout';
import AIChatPanel from '../../components/ai/AIChatPanel';
import apiClient from '../../api/client';

interface Listing {
  id: string;
  waste_type: string;
  volume_t: number;
  status: string;
  frequency: string;
  pickup_window_start: string;
  created_at: string;
}

interface Match {
  id: string;
  listing_id: string;
  score: number;
  status: string;
  facility_name: string;
  facility_city: string;
  conversion_type: string;
  explanation_text: string;
  waste_type: string;
  volume_t: number;
}

interface Pickup {
  id: string;
  status: string;
  scheduled_at: string;
  waste_type: string;
  volume_t: number;
  facility_name: string;
  co2_sequestered_t: number;
}

interface Impact {
  total_co2_t: number;
  total_waste_diverted_t: number;
  completed_pickups: number;
  monthly_trend: { month: string; co2: number }[];
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  matched: 'Matched',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusClasses: Record<string, string> = {
  open: 'badge-green',
  matched: 'badge-yellow',
  completed: 'badge bg-blue-100 text-blue-700',
  cancelled: 'badge-red',
};

const pickupStatusClasses: Record<string, string> = {
  requested: 'status-requested',
  scheduled: 'status-scheduled',
  in_transit: 'status-in_transit',
  delivered: 'status-delivered',
  verified: 'status-verified',
  cancelled: 'status-cancelled',
};

const conversionLabels: Record<string, string> = {
  biochar_pyrolysis: 'Biochar',
  anaerobic_digestion: 'Biogas',
  aerobic_composting: 'Compost',
  vermicomposting: 'Vermicompost',
};

const WASTE_TYPES = [
  { value: 'food_organic', label: 'Food Organic' },
  { value: 'agricultural_biomass', label: 'Agricultural Biomass' },
  { value: 'industrial_biomass', label: 'Industrial Biomass' },
  { value: 'municipal_organic', label: 'Municipal Organic' },
  { value: 'food_processing', label: 'Food Processing' },
  { value: 'restaurant_waste', label: 'Restaurant Waste' },
];

function CreateListingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    waste_type: 'agricultural_biomass',
    volume_t: '',
    frequency: 'monthly',
    pickup_window_start: '',
    pickup_window_end: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/api/listings', {
        ...form,
        volume_t: parseFloat(form.volume_t),
      });
      toast.success('Listing created. Matches are being computed...');
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-panel w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-200">
          <h3 className="font-bold text-charcoal-900">Create Waste Listing</h3>
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-700 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Waste type</label>
            <select className="select" value={form.waste_type}
              onChange={(e) => setForm((p) => ({ ...p, waste_type: e.target.value }))}>
              {WASTE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Volume (tonnes)</label>
              <input className="input" type="number" min="0.1" required placeholder="50"
                value={form.volume_t} onChange={(e) => setForm((p) => ({ ...p, volume_t: e.target.value }))} />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select className="select" value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}>
                <option value="one_time">One time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pickup from</label>
              <input className="input" type="datetime-local" required
                value={form.pickup_window_start}
                onChange={(e) => setForm((p) => ({ ...p, pickup_window_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Pickup by</label>
              <input className="input" type="datetime-local" required
                value={form.pickup_window_end}
                onChange={(e) => setForm((p) => ({ ...p, pickup_window_end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Special handling, access instructions..."
              value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GeneratorDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listingsRes, matchesRes, pickupsRes, impactRes] = await Promise.all([
        apiClient.get('/api/listings?limit=5'),
        apiClient.get('/api/matches?limit=5'),
        apiClient.get('/api/pickups?limit=5'),
        apiClient.get('/api/stats/my-impact'),
      ]);
      setListings(listingsRes.data.listings);
      setMatches(matchesRes.data.matches);
      setPickups(pickupsRes.data.pickups);
      setImpact(impactRes.data.impact);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAcceptMatch = async (matchId: string) => {
    // Generators can't accept - only view. Toast informs user.
    toast('Only the facility can accept a match. You will be notified when they respond.', { icon: 'ℹ️' });
  };

  const chartData = impact?.monthly_trend?.map((d) => ({
    month: format(new Date(d.month), 'MMM'),
    co2: parseFloat(d.co2?.toString() || '0'),
  })) || [];

  return (
    <AppLayout>
      <div className="p-8 space-y-10 max-w-[1400px] mx-auto animate-fade-in">
        {/* Header & Impact Summary - Stark, high-density */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-charcoal-200">
          <div>
            <h1 className="text-3xl font-bold text-charcoal-900 tracking-tight">Generator Operations</h1>
            <p className="text-sm text-charcoal-500 mt-2 max-w-2xl">
              Track your waste supply chain, routing decisions, and verified carbon abatement.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Net Carbon Sequestered</p>
              <div className="flex items-baseline gap-2 justify-end">
                <p className="text-3xl font-bold text-forest-700">{impact ? impact.total_co2_t.toFixed(2) : '...'}</p>
                <span className="text-sm font-semibold text-forest-700">tCO₂e</span>
              </div>
            </div>
            <div className="h-10 w-px bg-charcoal-200" />
            <div className="text-right">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Total Diverted</p>
              <div className="flex items-baseline gap-2 justify-end">
                <p className="text-3xl font-bold text-charcoal-900">{impact ? impact.total_waste_diverted_t.toFixed(1) : '...'}</p>
                <span className="text-sm font-semibold text-charcoal-500">t</span>
              </div>
            </div>
            <div className="h-10 w-px bg-charcoal-200" />
            <div className="flex gap-3">
              <button onClick={() => setShowAI(!showAI)} className="btn-secondary">
                Copilot
              </button>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                New Listing
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Supply Chain & Matches Table (2 columns) */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">Active Supply Chain</h2>
                {listings.length > 0 && <span className="text-xs text-charcoal-500">{listings.length} nodes</span>}
              </div>
              
              {listings.length === 0 ? (
                <div className="border border-charcoal-200 bg-charcoal-50 rounded-sm p-8 text-center">
                  <p className="text-sm font-semibold text-charcoal-900 mb-1">No active listings</p>
                  <p className="text-xs text-charcoal-500 mb-4">You have no waste scheduled for network routing.</p>
                  <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">Inject Supply</button>
                </div>
              ) : (
                <div className="border border-charcoal-200 rounded-sm overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-charcoal-50 border-b border-charcoal-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-charcoal-600 w-1/4">Source Stream</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-charcoal-600 w-1/6">Volume</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-charcoal-600 w-1/4">Time Window</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-charcoal-600 text-right">Routing Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal-100">
                      {listings.map((listing) => (
                        <tr key={listing.id} className="hover:bg-charcoal-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-semibold text-charcoal-900 capitalize">{listing.waste_type.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-charcoal-500 capitalize">{listing.frequency.replace('_', ' ')}</div>
                          </td>
                          <td className="py-4 px-4 font-mono text-charcoal-800">{listing.volume_t} t</td>
                          <td className="py-4 px-4 text-xs text-charcoal-600">
                            {format(new Date(listing.pickup_window_start), 'dd MMM yyyy')}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-bold border ${
                              listing.status === 'open' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                              listing.status === 'matched' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              'bg-forest-50 text-forest-800 border-forest-200'
                            }`}>
                              {listing.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Verified Pickups / Abatement */}
            <section>
              <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4">Verified Abatement Ledger</h2>
              {pickups.length === 0 ? (
                <div className="border border-charcoal-200 rounded-sm p-6 text-center bg-white">
                  <p className="text-xs text-charcoal-500">No completed pickups registered.</p>
                </div>
              ) : (
                <div className="border border-charcoal-200 rounded-sm bg-white divide-y divide-charcoal-100">
                  {pickups.map((pickup) => (
                    <div key={pickup.id} className="p-4 flex items-center justify-between hover:bg-charcoal-50">
                      <div className="flex items-center gap-6">
                        <div className="w-24">
                          <p className="text-xs font-mono text-charcoal-500">{format(new Date(pickup.scheduled_at || Date.now()), 'dd MMM')}</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-charcoal-900">{pickup.facility_name || 'Network Facility'}</p>
                          <p className="text-xs text-charcoal-500 capitalize">{pickup.waste_type?.replace(/_/g, ' ')} • {pickup.volume_t} t</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-xs font-bold text-charcoal-600 uppercase">{pickup.status.replace(/_/g, ' ')}</span>
                        {pickup.co2_sequestered_t > 0 ? (
                          <div className="text-right min-w-[80px]">
                            <p className="text-sm font-bold text-forest-700">+{pickup.co2_sequestered_t.toFixed(2)} t</p>
                            <p className="text-[10px] uppercase text-charcoal-400 font-semibold">CO₂e</p>
                          </div>
                        ) : (
                          <div className="min-w-[80px] text-right">
                            <span className="text-xs text-charcoal-400">Pending calc</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar / Match Proposals */}
          <div className="space-y-8">
            <section className="bg-white border border-charcoal-200 rounded-sm p-5">
              <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4">Routing Proposals</h2>
              <p className="text-xs text-charcoal-500 mb-4 leading-relaxed">
                The network engine has computed the following optimal sinks for your listed supply based on proximity and conversion efficiency.
              </p>
              
              {matches.length === 0 ? (
                <div className="p-4 bg-charcoal-50 border border-charcoal-100 rounded-sm text-center">
                  <p className="text-xs text-charcoal-500">No active proposals.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.slice(0, 4).map((match) => (
                    <div key={match.id} className="p-3 border border-forest-200 bg-forest-50/30 rounded-sm">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-forest-900">{match.facility_name}</p>
                        <span className="text-xs font-mono font-bold text-forest-700 bg-forest-100 px-1.5 py-0.5 rounded-sm">
                          Score {Math.round(match.score)}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-600 mb-2 leading-relaxed">
                        {match.explanation_text || `Optimal routing to ${conversionLabels[match.conversion_type]} in ${match.facility_city}.`}
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-forest-100/50">
                        <span className="text-[10px] uppercase font-bold text-charcoal-500">{match.status}</span>
                        <button onClick={() => handleAcceptMatch(match.id)} className="text-[10px] font-bold text-forest-700 hover:text-forest-900 uppercase tracking-wide">
                          View details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateListingModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); fetchData(); }} />
      )}

      {showAI && (
        <div className="fixed bottom-6 right-6 z-40 shadow-panel">
          <AIChatPanel onClose={() => setShowAI(false)} />
        </div>
      )}
    </AppLayout>
  );
}

