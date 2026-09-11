import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Leaf, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

const WASTE_TYPES = [
  { value: 'food_organic', label: 'Food (Organic)' },
  { value: 'agricultural_biomass', label: 'Agricultural Biomass' },
  { value: 'industrial_biomass', label: 'Industrial Biomass' },
  { value: 'municipal_organic', label: 'Municipal Organic' },
  { value: 'food_processing', label: 'Food Processing Waste' },
  { value: 'restaurant_waste', label: 'Restaurant Waste' },
];

const CONVERSION_TYPES = [
  { value: 'biochar_pyrolysis', label: 'Biochar Pyrolysis', co2: '~0.80-1.00 t CO2/t' },
  { value: 'anaerobic_digestion', label: 'Anaerobic Digestion (Biogas)', co2: '~0.28-0.35 t CO2/t' },
  { value: 'aerobic_composting', label: 'Aerobic Composting', co2: '~0.15-0.22 t CO2/t' },
  { value: 'vermicomposting', label: 'Vermicomposting', co2: '~0.12-0.18 t CO2/t' },
];

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
            i < step ? 'bg-forest-800 text-white' :
            i === step ? 'bg-forest-100 text-forest-800 ring-2 ring-forest-800' :
            'bg-charcoal-100 text-charcoal-400'
          }`}>
            {i < step ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 transition-all ${i < step ? 'bg-forest-800' : 'bg-charcoal-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const isGenerator = user?.role === 'generator';
  const isFacility = user?.role === 'facility_operator';
  const steps = isGenerator ? 3 : isFacility ? 3 : 2;

  // Generator fields
  const [generatorForm, setGeneratorForm] = useState({
    site_name: '',
    lat: 12.9716,
    lng: 77.5946,
    waste_types: [] as string[],
    avg_volume_t_month: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
  });

  // Facility fields
  const [facilityForm, setFacilityForm] = useState({
    name: '',
    lat: 12.9716,
    lng: 77.5946,
    conversion_type: 'biochar_pyrolysis',
    capacity_t_month: '',
    remaining_capacity_t: '',
    accepted_waste_types: [] as string[],
    efficiency_pct: '80',
    service_radius_km: '100',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
  });

  const toggleWasteType = (type: string, isGenerator: boolean) => {
    if (isGenerator) {
      setGeneratorForm((prev) => ({
        ...prev,
        waste_types: prev.waste_types.includes(type)
          ? prev.waste_types.filter((t) => t !== type)
          : [...prev.waste_types, type],
      }));
    } else {
      setFacilityForm((prev) => ({
        ...prev,
        accepted_waste_types: prev.accepted_waste_types.includes(type)
          ? prev.accepted_waste_types.filter((t) => t !== type)
          : [...prev.accepted_waste_types, type],
      }));
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      if (isGenerator) {
        await apiClient.post('/api/generators', {
          ...generatorForm,
          avg_volume_t_month: parseFloat(generatorForm.avg_volume_t_month),
        });
      } else if (isFacility) {
        await apiClient.post('/api/facilities', {
          ...facilityForm,
          capacity_t_month: parseFloat(facilityForm.capacity_t_month),
          remaining_capacity_t: parseFloat(facilityForm.remaining_capacity_t || facilityForm.capacity_t_month),
          efficiency_pct: parseFloat(facilityForm.efficiency_pct),
          service_radius_km: parseFloat(facilityForm.service_radius_km),
        });
      }
      toast.success('Profile set up successfully.');
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs text-charcoal-500">Welcome to CarbonLoop</p>
            <p className="text-sm font-bold text-charcoal-900">Set up your profile</p>
          </div>
        </div>

        <div className="card">
          <StepIndicator step={step} total={steps} />

          {/* Generator steps */}
          {isGenerator && step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Site details</h3>
              <p className="text-sm text-charcoal-500 mb-5">Tell us about your waste generation site.</p>
              <div>
                <label className="label">Site name</label>
                <input className="input" placeholder="Green Valley Farm, Anekal" value={generatorForm.site_name}
                  onChange={(e) => setGeneratorForm((p) => ({ ...p, site_name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input className="input" placeholder="Bengaluru" value={generatorForm.city}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, city: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" placeholder="Karnataka" value={generatorForm.state}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, state: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">PIN code</label>
                  <input className="input" placeholder="560001" maxLength={6} value={generatorForm.pincode}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, pincode: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Avg. volume (t/month)</label>
                  <input className="input" type="number" min="0.1" placeholder="50" value={generatorForm.avg_volume_t_month}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, avg_volume_t_month: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">Full address</label>
                <input className="input" placeholder="Survey No. 12, Anekal Taluk" value={generatorForm.address}
                  onChange={(e) => setGeneratorForm((p) => ({ ...p, address: e.target.value }))} required />
              </div>
            </div>
          )}

          {isGenerator && step === 1 && (
            <div className="animate-fade-in">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Waste types</h3>
              <p className="text-sm text-charcoal-500 mb-5">Select all waste types your site generates.</p>
              <div className="grid grid-cols-2 gap-2">
                {WASTE_TYPES.map((wt) => {
                  const selected = generatorForm.waste_types.includes(wt.value);
                  return (
                    <button key={wt.value} type="button" onClick={() => toggleWasteType(wt.value, true)}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                        selected ? 'border-forest-600 bg-forest-50 text-forest-800' : 'border-charcoal-200 hover:border-charcoal-300 text-charcoal-700'
                      }`}>
                      {selected && <Check className="inline w-3.5 h-3.5 mr-1 text-forest-700" />}
                      {wt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isGenerator && step === 2 && (
            <div className="animate-fade-in space-y-4">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Map location</h3>
              <p className="text-sm text-charcoal-500 mb-4">Set your site's coordinates (latitude, longitude). Use Google Maps to find them if needed.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Latitude</label>
                  <input className="input" type="number" step="0.0001" value={generatorForm.lat}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, lat: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input className="input" type="number" step="0.0001" value={generatorForm.lng}
                    onChange={(e) => setGeneratorForm((p) => ({ ...p, lng: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea className="input min-h-[80px] resize-none" placeholder="Brief description of your site and waste output..."
                  value={generatorForm.description}
                  onChange={(e) => setGeneratorForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Facility steps */}
          {isFacility && step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Facility details</h3>
              <div>
                <label className="label">Facility name</label>
                <input className="input" placeholder="Karnataka Biochar Plant, Tumkur" value={facilityForm.name}
                  onChange={(e) => setFacilityForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Conversion method</label>
                <select className="select" value={facilityForm.conversion_type}
                  onChange={(e) => setFacilityForm((p) => ({ ...p, conversion_type: e.target.value }))}>
                  {CONVERSION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label} ({ct.co2})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Total capacity (t/month)</label>
                  <input className="input" type="number" min="1" placeholder="500" value={facilityForm.capacity_t_month}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, capacity_t_month: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Service radius (km)</label>
                  <input className="input" type="number" min="10" placeholder="150" value={facilityForm.service_radius_km}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, service_radius_km: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input className="input" value={facilityForm.city}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, city: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">PIN code</label>
                  <input className="input" maxLength={6} value={facilityForm.pincode}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, pincode: e.target.value }))} required />
                </div>
              </div>
            </div>
          )}

          {isFacility && step === 1 && (
            <div className="animate-fade-in">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Accepted waste types</h3>
              <p className="text-sm text-charcoal-500 mb-5">Select all waste types your facility can process.</p>
              <div className="grid grid-cols-2 gap-2">
                {WASTE_TYPES.map((wt) => {
                  const selected = facilityForm.accepted_waste_types.includes(wt.value);
                  return (
                    <button key={wt.value} type="button" onClick={() => toggleWasteType(wt.value, false)}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                        selected ? 'border-forest-600 bg-forest-50 text-forest-800' : 'border-charcoal-200 hover:border-charcoal-300 text-charcoal-700'
                      }`}>
                      {selected && <Check className="inline w-3.5 h-3.5 mr-1 text-forest-700" />}
                      {wt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isFacility && step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-charcoal-900 mb-1">Location and efficiency</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Latitude</label>
                  <input className="input" type="number" step="0.0001" value={facilityForm.lat}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, lat: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input className="input" type="number" step="0.0001" value={facilityForm.lng}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, lng: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Conversion efficiency (%)</label>
                  <input className="input" type="number" min="0" max="100" value={facilityForm.efficiency_pct}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, efficiency_pct: e.target.value }))} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={facilityForm.state}
                    onChange={(e) => setFacilityForm((p) => ({ ...p, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Full address</label>
                <input className="input" value={facilityForm.address}
                  onChange={(e) => setFacilityForm((p) => ({ ...p, address: e.target.value }))} required />
              </div>
            </div>
          )}

          {/* Non-generator, non-facility: go straight to dashboard */}
          {!isGenerator && !isFacility && step === 0 && (
            <div className="animate-fade-in text-center py-8">
              <Leaf className="w-12 h-12 text-forest-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-charcoal-900 mb-2">Profile setup</h3>
              <p className="text-sm text-charcoal-500 mb-6">Your role as {user?.role?.replace('_', ' ')} does not require additional location setup. Click Finish to go to your dashboard.</p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/dashboard')}
              className="btn-secondary"
            >
              {step === 0 ? 'Skip for now' : 'Back'}
            </button>
            {step < steps - 1 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} className="btn-primary">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleFinish} disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : 'Finish setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
