import React, { useEffect, useState } from 'react';
import { Truck, Route, Clock, CheckCircle2, MapPin, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import AppLayout from '../../components/layout/AppLayout';
import apiClient from '../../api/client';

interface Pickup {
  id: string;
  status: string;
  scheduled_at: string;
  waste_type: string;
  volume_t: number;
  generator_name: string;
  generator_city: string;
  generator_lat: number;
  generator_lng: number;
  facility_name: string;
  facility_city: string;
}

interface LogisticsRoute {
  id: string;
  total_distance_km: number;
  total_time_min: number;
  stops: { pickup_id: string; order: number; lat: number; lng: number; eta_min: number }[];
  created_at: string;
}

const STATUS_NEXT: Record<string, string> = {
  requested: 'scheduled',
  scheduled: 'in_transit',
  in_transit: 'delivered',
  delivered: 'verified',
};

export default function LogisticsDashboard() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [routes, setRoutes] = useState<LogisticsRoute[]>([]);
  const [updatingPickup, setUpdatingPickup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pickupsRes, routesRes] = await Promise.all([
        apiClient.get('/api/pickups?limit=20'),
        apiClient.get('/api/logistics-routes?limit=5'),
      ]);
      setPickups(pickupsRes.data.pickups);
      setRoutes(routesRes.data.routes);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const advanceStatus = async (pickup: Pickup) => {
    const nextStatus = STATUS_NEXT[pickup.status];
    if (!nextStatus) return;

    setUpdatingPickup(pickup.id);
    try {
      await apiClient.patch(`/api/pickups/${pickup.id}/status`, {
        status: nextStatus,
        ...(nextStatus === 'scheduled' ? { scheduled_at: new Date().toISOString() } : {}),
      });
      toast.success(`Pickup marked as "${nextStatus.replace('_', ' ')}"`);
      fetchData();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingPickup(null);
    }
  };

  const activePickups = pickups.filter((p) => !['verified', 'cancelled'].includes(p.status));
  const completedPickups = pickups.filter((p) => p.status === 'verified');

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Logistics Dashboard</h1>
            <p className="page-subtitle">Manage and advance your assigned pickups</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Pickups', value: activePickups.length.toString(), icon: Truck, color: 'text-yellow-600' },
            { label: 'Completed Pickups', value: completedPickups.length.toString(), icon: CheckCircle2, color: 'text-forest-700' },
            { label: 'Scheduled Routes', value: routes.length.toString(), icon: Route, color: 'text-blue-600' },
            { label: 'Pending Assignment', value: pickups.filter((p) => p.status === 'requested').length.toString(), icon: Clock, color: 'text-charcoal-500' },
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

        {/* Active pickups with status advance buttons */}
        <div className="card">
          <h2 className="text-sm font-bold text-charcoal-900 mb-4">Active Pickups</h2>
          {activePickups.length === 0 ? (
            <div className="text-center py-10">
              <Truck className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
              <p className="text-sm text-charcoal-400">No active pickups assigned to you</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activePickups.map((pickup) => {
                const nextStatus = STATUS_NEXT[pickup.status];
                const isUpdating = updatingPickup === pickup.id;
                return (
                  <div key={pickup.id} className="border border-charcoal-200 rounded-xl p-4 hover:border-forest-200 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            pickup.status === 'requested' ? 'bg-charcoal-100 text-charcoal-700' :
                            pickup.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            pickup.status === 'in_transit' ? 'bg-yellow-100 text-yellow-800' :
                            pickup.status === 'delivered' ? 'bg-sage-100 text-sage-800' :
                            'bg-charcoal-100 text-charcoal-600'
                          }`}>
                            {pickup.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-1.5 text-charcoal-500 text-xs mb-0.5">
                              <MapPin className="w-3 h-3" /> Pickup from
                            </div>
                            <p className="font-semibold text-charcoal-900 text-xs">{pickup.generator_name || 'Generator'}</p>
                            <p className="text-charcoal-500 text-xs">{pickup.generator_city}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-charcoal-500 text-xs mb-0.5">
                              <Package className="w-3 h-3" /> Deliver to
                            </div>
                            <p className="font-semibold text-charcoal-900 text-xs">{pickup.facility_name || 'Facility'}</p>
                            <p className="text-charcoal-500 text-xs">{pickup.facility_city}</p>
                          </div>
                        </div>
                        <p className="text-xs text-charcoal-400 mt-2 capitalize">
                          {pickup.waste_type?.replace(/_/g, ' ')} - {pickup.volume_t} t
                          {pickup.scheduled_at && ` - Scheduled: ${format(new Date(pickup.scheduled_at), 'dd MMM HH:mm')}`}
                        </p>
                      </div>
                      {nextStatus && (
                        <button
                          onClick={() => advanceStatus(pickup)}
                          disabled={isUpdating}
                          className="btn-primary text-xs px-4 py-2 flex-shrink-0"
                        >
                          {isUpdating ? '...' : `Mark ${nextStatus.replace('_', ' ')}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Optimized routes history */}
        {routes.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Recent Optimized Routes</h2>
            <div className="divide-y divide-charcoal-100">
              {routes.map((route) => (
                <div key={route.id} className="py-3 flex items-center gap-4">
                  <Route className="w-4 h-4 text-charcoal-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-charcoal-900">
                      {route.stops?.length || 0} stops - {route.total_distance_km.toFixed(1)} km
                    </p>
                    <p className="text-xs text-charcoal-400">
                      Est. time: {Math.round(route.total_time_min)} min -
                      {format(new Date(route.created_at), ' dd MMM yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
