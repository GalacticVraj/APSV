import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Mail, Lock, Building2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';

const ROLES = [
  { value: 'generator', label: 'Waste Generator', desc: 'Farm, restaurant, market, or processor with organic waste to divert' },
  { value: 'facility_operator', label: 'Facility Operator', desc: 'Biochar, biogas, or composting facility accepting biomass waste' },
  { value: 'logistics_partner', label: 'Logistics Partner', desc: 'Collection and transportation service for waste pickups' },
  { value: 'municipal_admin', label: 'Municipal Admin', desc: 'Municipal authority managing generators and public waste flows' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({
    email: '',
    password: '',
    org_name: '',
    role: (searchParams.get('role') || 'generator') as UserRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/auth/register', form);
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success('Account created. Complete your profile to get started.');
      navigate('/onboarding');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold text-charcoal-900">CarbonLoop</span>
          </div>
          <h2 className="text-2xl font-bold text-charcoal-900 mb-1">Create your account</h2>
          <p className="text-sm text-charcoal-500">Join the circular carbon ecosystem</p>
        </div>

        <div className="card">
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selection */}
            <div>
              <label className="label">I am joining as a</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update('role', r.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      form.role === r.value
                        ? 'border-forest-600 bg-forest-50'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <p className={`text-xs font-bold mb-0.5 ${form.role === r.value ? 'text-forest-800' : 'text-charcoal-800'}`}>
                      {r.label}
                    </p>
                    <p className="text-[11px] text-charcoal-500 leading-snug">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="reg-org" className="label">Organization name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  id="reg-org"
                  type="text"
                  required
                  minLength={2}
                  value={form.org_name}
                  onChange={(e) => update('org_name', e.target.value)}
                  className="input pl-10"
                  placeholder="Your farm, facility, or company name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="input pl-10"
                  placeholder="contact@yourorg.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pw" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  id="reg-pw"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="input pl-10"
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-charcoal-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-forest-700 font-semibold hover:text-forest-900">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
