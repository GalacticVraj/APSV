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
      <div className="p-8 space-y-10 max-w-[1400px] mx-auto animate-fade-in">
        {/* Header & Impact Summary - Stark, high-density */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-charcoal-200">
          <div>
            <h1 className="text-3xl font-bold text-charcoal-900 tracking-tight">Facility Operations</h1>
            <p className="text-sm text-charcoal-500 mt-2">
              {facility ? `${facility.name} — ${conversionLabels[facility.conversion_type]} Node` : 'Loading facility profile...'}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Total Output</p>
              <div className="flex items-baseline gap-2 justify-end">
                <p className="text-3xl font-bold text-forest-700">{impact ? impact.total_co2_t.toFixed(2) : '...'}</p>
                <span className="text-sm font-semibold text-forest-700">tCO₂e</span>
              </div>
            </div>
            <div className="h-10 w-px bg-charcoal-200" />
            <div className="text-right">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Node Utilization</p>
              <div className="flex items-baseline gap-2 justify-end">
                <p className="text-3xl font-bold text-charcoal-900">{capacityPct}</p>
                <span className="text-sm font-semibold text-charcoal-500">%</span>
              </div>
            </div>
            <div className="h-10 w-px bg-charcoal-200" />
            <div className="flex gap-3">
              <button onClick={() => setShowAI(!showAI)} className="btn-secondary">
                Copilot
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Throughput Pipeline (2 columns) */}
          <div className="lg:col-span-2 space-y-8">
            <section className="border border-charcoal-200 rounded-sm bg-white overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50">
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">Throughput Capacity Engine</h2>
                <span className="text-xs font-mono text-charcoal-500">{facility?.capacity_t_month} t/mo baseline limit</span>
              </div>
              
              <div className="p-8">
                {/* Visual Capacity Bar */}
                <div className="mb-6 relative">
                  <div className="flex justify-between text-xs font-bold text-charcoal-600 uppercase mb-2">
                    <span>Allocated Volume</span>
                    <span>{facility ? (facility.capacity_t_month - facility.remaining_capacity_t).toFixed(0) : 0} t</span>
                  </div>
                  <div className="h-4 bg-charcoal-100 rounded-sm overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-1000 ${capacityPct > 90 ? 'bg-red-600' : capacityPct > 70 ? 'bg-yellow-500' : 'bg-forest-600'}`}
                      style={{ width: `${Math.min(capacityPct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-charcoal-400 font-mono mt-2">
                    <span>0 t</span>
                    <span>{facility?.remaining_capacity_t.toFixed(0)} t remaining headroom</span>
                    <span>{facility?.capacity_t_month} t max</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 border-t border-charcoal-100 pt-6 mt-6">
                  <div>
                    <h3 className="text-xs font-bold text-charcoal-900 uppercase mb-4">Pending Routing Decisions</h3>
                    {matches.length === 0 ? (
                      <p className="text-xs text-charcoal-500">No pending requests.</p>
                    ) : (
                      <div className="space-y-3">
                        {matches.map((match) => (
                          <div key={match.id} className="p-3 border border-charcoal-200 bg-charcoal-50 rounded-sm">
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-xs font-bold text-charcoal-900">{match.generator_name}</p>
                              <span className="text-[10px] font-mono bg-charcoal-200 px-1.5 py-0.5 rounded-sm">+{match.volume_t} t</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button 
                                onClick={() => respondToMatch(match.id, 'accept')}
                                disabled={respondingMatch === match.id}
                                className="flex-1 bg-forest-800 text-white text-[10px] font-bold uppercase py-1.5 rounded-sm hover:bg-forest-900 transition-colors"
                              >
                                Accept Flow
                              </button>
                              <button 
                                onClick={() => respondToMatch(match.id, 'decline')}
                                disabled={respondingMatch === match.id}
                                className="flex-1 border border-charcoal-300 text-charcoal-600 text-[10px] font-bold uppercase py-1.5 rounded-sm hover:bg-charcoal-100 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-charcoal-900 uppercase mb-4">Verified Logistics Output</h3>
                    {pickups.length === 0 ? (
                      <p className="text-xs text-charcoal-500">No active deliveries.</p>
                    ) : (
                      <div className="space-y-3">
                        {pickups.map((pickup) => (
                          <div key={pickup.id} className="p-3 border border-forest-100 bg-white rounded-sm flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-charcoal-900">{pickup.generator_name}</p>
                              <p className="text-[10px] text-charcoal-500 capitalize">{pickup.waste_type.replace(/_/g, ' ')} • {pickup.volume_t} t</p>
                            </div>
                            <div className="text-right">
                              {pickup.co2_sequestered_t > 0 ? (
                                <>
                                  <p className="text-xs font-bold text-forest-700">+{pickup.co2_sequestered_t.toFixed(2)} t</p>
                                  <p className="text-[9px] uppercase font-bold text-charcoal-400">CO₂e Output</p>
                                </>
                              ) : (
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
                                  pickup.status === 'in_transit' ? 'bg-yellow-100 text-yellow-800' : 'bg-charcoal-100 text-charcoal-600'
                                }`}>
                                  {pickup.status.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar / Abatement Curve */}
          <div className="space-y-8">
            <section className="bg-white border border-charcoal-200 rounded-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-charcoal-100 bg-charcoal-50">
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">Abatement Output</h2>
              </div>
              <div className="p-5">
                {chartData.length > 0 ? (
                  <div className="h-48 w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="fco2Gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#166534" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                          formatter={(v: number) => [`${v.toFixed(2)} t CO2e`]} 
                        />
                        <Area type="step" dataKey="co2" stroke="#166534" strokeWidth={2} fill="url(#fco2Gradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-charcoal-400 text-center px-4">
                    Process allocations to establish baseline abatement history.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {showAI && (
        <div className="fixed bottom-6 right-6 z-40 shadow-panel">
          <AIChatPanel onClose={() => setShowAI(false)} />
        </div>
      )}
    </AppLayout>
  );
}
