import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Leaf, Factory, Filter, X, MapPin, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

// Fix Leaflet default icon path (Vite issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const generatorIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#166534;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

const facilityIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:8px;background:#0f766e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 9l9-6 9 6"/><line x1="9" y1="21" x2="9" y2="12"/><line x1="15" y1="21" x2="15" y2="12"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

interface Generator {
  id: string;
  site_name: string;
  lat: number;
  lng: number;
  waste_types: string[] | string;
  avg_volume_t_month: number;
  city: string;
  state: string;
  org_name: string;
}

interface Facility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  conversion_type: string;
  capacity_t_month: number;
  remaining_capacity_t: number;
  service_radius_km: number;
  accepted_waste_types: string[] | string;
  city: string;
  state: string;
  org_name: string;
  verified: boolean;
  efficiency_pct: number;
}

const CONVERSION_COLORS: Record<string, string> = {
  biochar_pyrolysis: '#166534',
  anaerobic_digestion: '#0369a1',
  aerobic_composting: '#b45309',
  vermicomposting: '#7c3aed',
};

const CONVERSION_LABELS: Record<string, string> = {
  biochar_pyrolysis: 'Biochar Pyrolysis',
  anaerobic_digestion: 'Anaerobic Digestion',
  aerobic_composting: 'Aerobic Composting',
  vermicomposting: 'Vermicomposting',
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 5);
  }, []);
  return null;
}

function GeneratorPopup({ generator }: { generator: Generator }) {
  const types = typeof generator.waste_types === 'string'
    ? JSON.parse(generator.waste_types)
    : generator.waste_types;

  return (
    <div className="min-w-[200px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-forest-100 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-forest-700" />
        </div>
        <div>
          <p className="text-xs font-bold text-charcoal-900">{generator.site_name}</p>
          <p className="text-[10px] text-charcoal-500">{generator.org_name}</p>
        </div>
      </div>
      <p className="text-xs text-charcoal-500 mb-2">{generator.city}, {generator.state}</p>
      <p className="text-xs font-semibold text-charcoal-700 mb-1">{generator.avg_volume_t_month} t/month</p>
      <div className="flex flex-wrap gap-1">
        {(types as string[]).map((t: string) => (
          <span key={t} className="text-[9px] bg-forest-50 text-forest-700 border border-forest-200 px-1.5 py-0.5 rounded-full font-medium">
            {t.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

function FacilityPopup({ facility }: { facility: Facility }) {
  const capacityUsed = Math.round(
    ((facility.capacity_t_month - facility.remaining_capacity_t) / facility.capacity_t_month) * 100
  );

  return (
    <div className="min-w-[220px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
          <Factory className="w-3.5 h-3.5 text-teal-700" />
        </div>
        <div>
          <p className="text-xs font-bold text-charcoal-900">{facility.name}</p>
          <p className="text-[10px] text-charcoal-500">{facility.city}, {facility.state}</p>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <p className="text-charcoal-600">
          <span className="font-semibold">{CONVERSION_LABELS[facility.conversion_type]}</span>
        </p>
        <p className="text-charcoal-600">
          Capacity: <span className="font-semibold">{facility.remaining_capacity_t.toFixed(0)} t</span> available / {facility.capacity_t_month} t/month
        </p>
        <p className="text-charcoal-600">
          Efficiency: <span className="font-semibold">{facility.efficiency_pct}%</span>
        </p>
        <p className="text-charcoal-600">
          Service radius: <span className="font-semibold">{facility.service_radius_km} km</span>
        </p>
        {/* Capacity bar */}
        <div className="mt-2">
          <div className="h-1.5 bg-charcoal-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${capacityUsed}%`,
                background: capacityUsed > 90 ? '#dc2626' : capacityUsed > 70 ? '#f59e0b' : '#166534',
              }}
            />
          </div>
          <p className="text-[9px] text-charcoal-400 mt-0.5">{capacityUsed}% capacity used</p>
        </div>
        {!facility.verified && (
          <span className="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
            Pending verification
          </span>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  const [generators, setGenerators] = useState<Generator[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showGenerators, setShowGenerators] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showServiceRadius, setShowServiceRadius] = useState(false);
  const [selectedConversionType, setSelectedConversionType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/generators?limit=200'),
      apiClient.get('/api/facilities?limit=200'),
    ]).then(([genRes, facRes]) => {
      setGenerators(genRes.data.generators);
      setFacilities(facRes.data.facilities);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filteredFacilities = selectedConversionType
    ? facilities.filter((f) => f.conversion_type === selectedConversionType)
    : facilities;

  return (
    <div className="h-screen flex flex-col">
      {/* Navbar */}
      <div className="bg-white border-b border-charcoal-200 px-6 h-14 flex items-center justify-between flex-shrink-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-charcoal-900">CarbonLoop</span>
          <span className="text-xs text-charcoal-400 ml-1">Map</span>
        </Link>
        <Link to="/dashboard" className="btn-secondary text-xs py-1.5 px-3">Dashboard</Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar controls */}
        <div className="w-72 bg-white border-r border-charcoal-200 p-4 overflow-y-auto flex-shrink-0 space-y-5">
          <div>
            <p className="text-xs font-bold text-charcoal-500 uppercase tracking-wider mb-3">Map Layers</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={showGenerators} onChange={(e) => setShowGenerators(e.target.checked)}
                  className="rounded border-charcoal-300 text-forest-700 focus:ring-forest-500" />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-forest-800 border-2 border-white shadow" />
                  <span className="text-sm font-medium text-charcoal-700">Waste Generators ({generators.length})</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)}
                  className="rounded border-charcoal-300 text-forest-700 focus:ring-forest-500" />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-teal-700 border-2 border-white shadow" />
                  <span className="text-sm font-medium text-charcoal-700">Facilities ({facilities.length})</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={showServiceRadius} onChange={(e) => setShowServiceRadius(e.target.checked)}
                  className="rounded border-charcoal-300 text-forest-700 focus:ring-forest-500" />
                <span className="text-sm font-medium text-charcoal-700">Service Radius</span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-charcoal-500 uppercase tracking-wider mb-3">Filter by Conversion Type</p>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedConversionType('')}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${!selectedConversionType ? 'bg-charcoal-100 font-semibold text-charcoal-900' : 'text-charcoal-600 hover:bg-charcoal-50'}`}
              >
                All types
              </button>
              {Object.entries(CONVERSION_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSelectedConversionType(value === selectedConversionType ? '' : value)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${value === selectedConversionType ? 'font-semibold text-charcoal-900' : 'text-charcoal-600 hover:bg-charcoal-50'}`}
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CONVERSION_COLORS[value] }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-charcoal-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-charcoal-700 mb-2">Visible</p>
            <div className="space-y-1 text-xs text-charcoal-500">
              {showGenerators && <p>{generators.length} generators</p>}
              {showFacilities && <p>{filteredFacilities.length} facilities</p>}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-forest-800 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-charcoal-500">Loading map data...</p>
              </div>
            </div>
          )}
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            className="w-full h-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showGenerators && generators.map((gen) => (
              <Marker
                key={gen.id}
                position={[gen.lat, gen.lng]}
                icon={generatorIcon}
              >
                <Popup closeButton={false}>
                  <GeneratorPopup generator={gen} />
                </Popup>
              </Marker>
            ))}

            {showFacilities && filteredFacilities.map((facility) => (
              <React.Fragment key={facility.id}>
                <Marker
                  position={[facility.lat, facility.lng]}
                  icon={facilityIcon}
                >
                  <Popup closeButton={false}>
                    <FacilityPopup facility={facility} />
                  </Popup>
                </Marker>
                {showServiceRadius && (
                  <Circle
                    center={[facility.lat, facility.lng]}
                    radius={facility.service_radius_km * 1000}
                    pathOptions={{
                      color: CONVERSION_COLORS[facility.conversion_type] || '#166534',
                      fillColor: CONVERSION_COLORS[facility.conversion_type] || '#166534',
                      fillOpacity: 0.05,
                      weight: 1.5,
                      dashArray: '6 4',
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
