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
      <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Generator Dashboard</h1>
            <p className="page-subtitle">Track your waste listings, matches, and carbon impact</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAI(!showAI)} className="btn-secondary">
              <span className="text-lg">AI</span> Ask CarbonLoop AI
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Listing
            </button>
          </div>
        </div>

        {/* Impact KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'CO2 Sequestered', value: impact ? `${impact.total_co2_t.toFixed(2)} t` : '...', icon: Leaf, color: 'text-forest-700' },
            { label: 'Waste Diverted', value: impact ? `${impact.total_waste_diverted_t.toFixed(1)} t` : '...', icon: Package, color: 'text-sage-700' },
            { label: 'Completed Pickups', value: impact ? impact.completed_pickups.toString() : '...', icon: CheckCircle2, color: 'text-blue-600' },
            { label: 'Active Listings', value: listings.filter((l) => l.status === 'open').length.toString(), icon: Clock, color: 'text-yellow-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-charcoal-500">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* CO2 trend chart */}
          <div className="card lg:col-span-2">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Monthly CO2 Sequestered (tonnes)</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#166534" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} t CO2`, 'Sequestered']} />
                  <Area type="monotone" dataKey="co2" stroke="#166534" strokeWidth={2}
                    fill="url(#co2Gradient)" dot={{ r: 3, fill: '#166534' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-charcoal-400">
                Complete pickups to see your CO2 trend
              </div>
            )}
          </div>

          {/* Recent matches */}
          <div className="card">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Recent Matches</h2>
            {matches.length === 0 ? (
              <p className="text-sm text-charcoal-400 text-center py-8">No matches yet. Create a listing to get matched.</p>
            ) : (
              <div className="space-y-3">
                {matches.slice(0, 4).map((match) => (
                  <div key={match.id} className="flex items-start gap-3 p-3 rounded-xl bg-charcoal-50 border border-charcoal-100">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      match.score >= 80 ? 'bg-forest-100 text-forest-800' :
                      match.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-charcoal-100 text-charcoal-700'
                    }`}>
                      {Math.round(match.score)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-charcoal-900 truncate">{match.facility_name}</p>
                      <p className="text-xs text-charcoal-500">{match.facility_city} - {conversionLabels[match.conversion_type]}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                        match.status === 'accepted' ? 'bg-forest-100 text-forest-800' :
                        match.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-charcoal-100 text-charcoal-600'
                      }`}>{match.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Listings table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-charcoal-900">Your Listings</h2>
            <button onClick={() => setShowCreate(true)} className="text-xs text-forest-700 font-semibold hover:text-forest-900 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add new
            </button>
          </div>
          {listings.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-charcoal-300 mx-auto mb-3" />
              <p className="text-sm text-charcoal-500 mb-4">No listings yet</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                Create your first listing
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal-100">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Waste type</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Volume</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Frequency</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Window</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-charcoal-50 transition-colors">
                      <td className="py-3 px-3 font-medium capitalize">{listing.waste_type.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-3 text-charcoal-600">{listing.volume_t} t</td>
                      <td className="py-3 px-3 text-charcoal-600 capitalize">{listing.frequency.replace('_', ' ')}</td>
                      <td className="py-3 px-3 text-charcoal-500 text-xs">
                        {format(new Date(listing.pickup_window_start), 'dd MMM')}
                      </td>
                      <td className="py-3 px-3">
                        <span className={statusClasses[listing.status] || 'badge-gray'}>
                          {statusLabels[listing.status] || listing.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pickups */}
        <div className="card">
          <h2 className="text-sm font-bold text-charcoal-900 mb-4">Recent Pickups</h2>
          {pickups.length === 0 ? (
            <p className="text-sm text-charcoal-400 text-center py-8">No pickups yet</p>
          ) : (
            <div className="space-y-3">
              {pickups.map((pickup) => (
                <div key={pickup.id} className="flex items-center gap-4 p-3 rounded-xl border border-charcoal-100 hover:border-charcoal-200 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-charcoal-900">{pickup.facility_name || 'Facility'}</p>
                      <span className={pickupStatusClasses[pickup.status] || 'status-requested'}>
                        {pickup.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-500 capitalize">
                      {pickup.waste_type?.replace(/_/g, ' ')} - {pickup.volume_t} t
                      {pickup.scheduled_at && ` - ${format(new Date(pickup.scheduled_at), 'dd MMM')}`}
                    </p>
                  </div>
                  {pickup.co2_sequestered_t > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-forest-700">{pickup.co2_sequestered_t.toFixed(2)} t</p>
                      <p className="text-[10px] text-charcoal-400">CO2 sequestered</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateListingModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); fetchData(); }} />
      )}

      {showAI && (
        <div className="fixed bottom-6 right-6 z-40">
          <AIChatPanel onClose={() => setShowAI(false)} />
        </div>
      )}
    </AppLayout>
  );
}
