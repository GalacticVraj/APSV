import React, { useEffect, useState } from 'react';
import { Factory, TrendingUp, CheckCircle2, Clock, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import AppLayout from '../../components/layout/AppLayout';
import AIChatPanel from '../../components/ai/AIChatPanel';
import apiClient from '../../api/client';

interface Match {
  id: string;
  score: number;
  status: string;
  waste_type: string;
  volume_t: number;
  generator_name: string;
  generator_city: string;
  pickup_window_start: string;
  pickup_window_end: string;
  explanation_text: string;
}

interface Pickup {
  id: string;
  status: string;
  scheduled_at: string;
  waste_type: string;
  volume_t: number;
  generator_name: string;
  co2_sequestered_t: number;
}

interface Facility {
  id: string;
  name: string;
  capacity_t_month: number;
  remaining_capacity_t: number;
  conversion_type: string;
  efficiency_pct: number;
}

interface Impact {
  total_co2_t: number;
  total_throughput_t: number;
  capacity_utilization_pct: number;
  monthly_trend: { month: string; co2: number }[];
}

const conversionLabels: Record<string, string> = {
  biochar_pyrolysis: 'Biochar Pyrolysis',
  anaerobic_digestion: 'Anaerobic Digestion (Biogas)',
  aerobic_composting: 'Aerobic Composting',
  vermicomposting: 'Vermicomposting',
};

export default function FacilityDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [respondingMatch, setRespondingMatch] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matchesRes, pickupsRes, facilityRes, impactRes] = await Promise.all([
        apiClient.get('/api/matches?limit=10'),
        apiClient.get('/api/pickups?limit=5'),
        apiClient.get('/api/facilities/my'),
        apiClient.get('/api/stats/my-impact'),
      ]);
      setMatches(matchesRes.data.matches.filter((m: Match) => m.status === 'pending'));
      setPickups(pickupsRes.data.pickups);
      setFacility(facilityRes.data.facility);
      setImpact(impactRes.data.impact);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const respondToMatch = async (matchId: string, action: 'accept' | 'decline') => {
    setRespondingMatch(matchId);
    try {
      await apiClient.post(`/api/matches/${matchId}/${action}`);
      toast.success(action === 'accept' ? 'Match accepted. Pickup created.' : 'Match declined.');
      fetchData();
    } catch {
      toast.error('Action failed');
    } finally {
      setRespondingMatch(null);
    }
  };

  const chartData = impact?.monthly_trend?.map((d) => ({
    month: format(new Date(d.month), 'MMM'),
    co2: parseFloat(d.co2?.toString() || '0'),
  })) || [];

  const capacityPct = facility
    ? Math.round(((facility.capacity_t_month - facility.remaining_capacity_t) / facility.capacity_t_month) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Facility Dashboard</h1>
            {facility && (
              <p className="page-subtitle">{facility.name} - {conversionLabels[facility.conversion_type]}</p>
            )}
          </div>
          <button onClick={() => setShowAI(!showAI)} className="btn-secondary">
            <span className="text-lg">AI</span> Ask CarbonLoop AI
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'CO2 Sequestered', value: impact ? `${impact.total_co2_t.toFixed(2)} t` : '...', icon: TrendingUp, color: 'text-forest-700' },
            { label: 'Total Throughput', value: impact ? `${impact.total_throughput_t.toFixed(1)} t` : '...', icon: Factory, color: 'text-sage-700' },
            { label: 'Capacity Used', value: `${capacityPct}%`, icon: CheckCircle2, color: 'text-blue-600' },
            { label: 'Pending Requests', value: matches.length.toString(), icon: Clock, color: 'text-yellow-600' },
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

        {/* Capacity ring + chart */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card flex flex-col items-center justify-center py-6">
            <p className="text-xs font-semibold text-charcoal-500 mb-5">Capacity utilization</p>
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={capacityPct > 90 ? '#dc2626' : capacityPct > 70 ? '#f59e0b' : '#166534'}
                  strokeWidth="12"
                  strokeDasharray={`${capacityPct * 2.64} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-charcoal-900">{capacityPct}%</span>
                <span className="text-[10px] text-charcoal-400">used</span>
              </div>
            </div>
            {facility && (
              <div className="mt-4 text-center">
                <p className="text-sm text-charcoal-600">
                  <span className="font-bold text-charcoal-900">{facility.remaining_capacity_t.toFixed(0)} t</span> available
                </p>
                <p className="text-xs text-charcoal-400">of {facility.capacity_t_month.toFixed(0)} t/month</p>
              </div>
            )}
          </div>

          <div className="card lg:col-span-2">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Monthly CO2 Sequestered (tonnes)</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fco2Gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#166534" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} t CO2`, 'Sequestered']} />
                  <Area type="monotone" dataKey="co2" stroke="#166534" strokeWidth={2} fill="url(#fco2Gradient)" dot={{ r: 3, fill: '#166534' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-charcoal-400">
                Complete pickups to see your CO2 trend
              </div>
            )}
          </div>
        </div>

        {/* Pending match requests */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-charcoal-900">Incoming Match Requests</h2>
            {matches.length > 0 && (
              <span className="badge-yellow">{matches.length} pending</span>
            )}
          </div>
          {matches.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
              <p className="text-sm text-charcoal-400">No pending requests. You will be notified when generators match to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="border border-charcoal-200 rounded-xl p-4 hover:border-forest-200 hover:bg-forest-50/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                          match.score >= 80 ? 'bg-forest-100 text-forest-800' :
                          match.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-charcoal-100 text-charcoal-700'
                        }`}>
                          {Math.round(match.score)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-charcoal-900">{match.generator_name || 'Generator'}</p>
                          <p className="text-xs text-charcoal-500">{match.generator_city} - {match.waste_type?.replace(/_/g, ' ')} - {match.volume_t} t</p>
                        </div>
                      </div>
                      {match.explanation_text && (
                        <p className="text-xs text-charcoal-500 mb-3 bg-charcoal-50 rounded-lg px-3 py-2 leading-relaxed">
                          {match.explanation_text}
                        </p>
                      )}
                      <p className="text-xs text-charcoal-400">
                        Window: {format(new Date(match.pickup_window_start), 'dd MMM')} - {format(new Date(match.pickup_window_end), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => respondToMatch(match.id, 'decline')}
                        disabled={respondingMatch === match.id}
                        className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        title="Decline"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => respondToMatch(match.id, 'accept')}
                        disabled={respondingMatch === match.id}
                        className="px-4 py-2 rounded-xl bg-forest-800 text-white text-sm font-semibold hover:bg-forest-900 transition-colors flex items-center gap-2"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent pickups */}
        <div className="card">
          <h2 className="text-sm font-bold text-charcoal-900 mb-4">Recent Pickups</h2>
          {pickups.length === 0 ? (
            <p className="text-sm text-charcoal-400 text-center py-6">No pickups yet</p>
          ) : (
            <div className="divide-y divide-charcoal-100">
              {pickups.map((pickup) => (
                <div key={pickup.id} className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-charcoal-900">{pickup.generator_name || 'Generator'}</p>
                    <p className="text-xs text-charcoal-500 capitalize">
                      {pickup.waste_type?.replace(/_/g, ' ')} - {pickup.volume_t} t
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    pickup.status === 'verified' ? 'bg-forest-100 text-forest-800' :
                    pickup.status === 'in_transit' ? 'bg-yellow-100 text-yellow-800' :
                    pickup.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-charcoal-100 text-charcoal-600'
                  }`}>
                    {pickup.status.replace(/_/g, ' ')}
                  </span>
                  {pickup.co2_sequestered_t > 0 && (
                    <p className="text-sm font-bold text-forest-700">{pickup.co2_sequestered_t.toFixed(2)} t CO2</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAI && (
        <div className="fixed bottom-6 right-6 z-40">
          <AIChatPanel onClose={() => setShowAI(false)} />
        </div>
      )}
    </AppLayout>
  );
}
