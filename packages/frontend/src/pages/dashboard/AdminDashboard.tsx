import React, { useEffect, useState } from 'react';
import { Users, Shield, BarChart2, CheckCircle2, Clock, Leaf } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import apiClient from '../../api/client';

interface AdminAnalytics {
  summary: {
    total_users: number;
    pending_verifications: number;
    total_listings: number;
    active_listings: number;
    total_pickups: number;
    completed_pickups: number;
    total_co2_sequestered_t: number;
  };
  top_generators: { org_name: string; site_name: string; total_volume: string }[];
  top_facilities: { name: string; city: string; total_co2: string }[];
  recent_pickups: { id: string; status: string; waste_type: string; volume_t: number; co2_sequestered_t: number }[];
}

interface PendingUser {
  id: string;
  email: string;
  role: string;
  org_name: string;
  city: string;
  state: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingUser, setVerifyingUser] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, pendingRes] = await Promise.all([
        apiClient.get('/api/admin/analytics'),
        apiClient.get('/api/admin/users?verified=false&limit=10'),
      ]);
      setAnalytics(analyticsRes.data);
      setPendingUsers(pendingRes.data.users);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const verifyUser = async (userId: string, action: 'verify' | 'reject') => {
    setVerifyingUser(userId);
    try {
      await apiClient.post(`/api/admin/users/${userId}/${action}`);
      toast.success(`User ${action === 'verify' ? 'verified' : 'rejected'}`);
      fetchData();
    } catch {
      toast.error('Action failed');
    } finally {
      setVerifyingUser(null);
    }
  };

  const topGeneratorsData = analytics?.top_generators.map((g) => ({
    name: g.org_name.length > 15 ? g.org_name.slice(0, 15) + '...' : g.org_name,
    volume: parseFloat(g.total_volume || '0'),
  })) || [];

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Platform-wide oversight, verification, and analytics</p>
          </div>
        </div>

        {/* Platform KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total CO2 Sequestered', value: `${analytics?.summary.total_co2_sequestered_t?.toFixed(2) || '0'} t`, icon: Leaf, color: 'text-forest-700' },
            { label: 'Total Users', value: analytics?.summary.total_users.toString() || '0', icon: Users, color: 'text-blue-600' },
            { label: 'Pending Verifications', value: analytics?.summary.pending_verifications.toString() || '0', icon: Clock, color: 'text-yellow-600' },
            { label: 'Completed Pickups', value: analytics?.summary.completed_pickups.toString() || '0', icon: CheckCircle2, color: 'text-sage-700' },
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

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top generators chart */}
          <div className="card">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Top Waste Generators (tonnes)</h2>
            {topGeneratorsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topGeneratorsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" width={100} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)} t`, 'Volume']} />
                  <Bar dataKey="volume" fill="#166534" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-charcoal-400">No data yet</div>
            )}
          </div>

          {/* Top facilities */}
          <div className="card">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Top Facilities by CO2 Sequestered</h2>
            {analytics?.top_facilities && analytics.top_facilities.length > 0 ? (
              <div className="space-y-3">
                {analytics.top_facilities.slice(0, 5).map((facility, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-forest-100 text-forest-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-charcoal-900 truncate">{facility.name}</p>
                      <p className="text-xs text-charcoal-500">{facility.city}</p>
                    </div>
                    <span className="text-sm font-bold text-forest-700">
                      {parseFloat(facility.total_co2 || '0').toFixed(1)} t CO2
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-charcoal-400">No verified pickups yet</div>
            )}
          </div>
        </div>

        {/* Pending verification queue */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-forest-700" />
            <h2 className="text-sm font-bold text-charcoal-900">Verification Queue</h2>
            {analytics?.summary.pending_verifications && analytics.summary.pending_verifications > 0 && (
              <span className="badge-yellow">{analytics.summary.pending_verifications} pending</span>
            )}
          </div>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-8 h-8 text-forest-400 mx-auto mb-2" />
              <p className="text-sm text-charcoal-400">All users are verified. Great work.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal-100">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Organization</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Role</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Location</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-charcoal-500">Email</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-charcoal-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50">
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-charcoal-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-charcoal-900">{user.org_name}</td>
                      <td className="py-3 px-3">
                        <span className="badge-gray capitalize">{user.role.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-3 text-charcoal-500 text-xs">
                        {[user.city, user.state].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="py-3 px-3 text-charcoal-500 text-xs">{user.email}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => verifyUser(user.id, 'reject')}
                            disabled={verifyingUser === user.id}
                            className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => verifyUser(user.id, 'verify')}
                            disabled={verifyingUser === user.id}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            {verifyingUser === user.id ? '...' : 'Verify'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
