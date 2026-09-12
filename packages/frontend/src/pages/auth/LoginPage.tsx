import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/auth/login', { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.org_name || data.user.email}`);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string, role: string) => {
    setEmail(email);
    setPassword('Demo@1234');
    toast(`Demo credentials filled for ${role}`, { icon: 'ℹ️' });
  };

  return (
    <div className="min-h-screen bg-charcoal-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-forest-950 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-white">CarbonLoop</span>
        </div>
        <div>
          <blockquote className="text-xl font-medium text-forest-200 leading-relaxed mb-6">
            "Every tonne of organic waste diverted from landfill can sequester between 0.15 and 1.0 tonnes of CO2 equivalent, depending on the conversion pathway."
          </blockquote>
          <p className="text-sm text-forest-500">Based on EPA WARM v15 and IPCC AR6 WG3 methodology</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-forest-500 uppercase tracking-wider mb-3">Demo accounts (password: Demo@1234)</p>
          {[
            { email: 'green.farms@example.in', label: 'Generator', role: 'generator' },
            { email: 'biochar.karnataka@example.in', label: 'Facility', role: 'facility_operator' },
            { email: 'logistics@greenmove.in', label: 'Logistics', role: 'logistics_partner' },
            { email: 'admin@carbonloop.in', label: 'Admin', role: 'platform_admin' },
          ].map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => fillDemo(d.email, d.label)}
              className="w-full text-left px-4 py-2.5 rounded-lg bg-forest-900/50 border border-forest-800 text-xs text-forest-300 hover:border-forest-600 hover:text-white transition-colors"
            >
              <span className="font-semibold text-forest-400">{d.label}: </span>{d.email}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-forest-800 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-charcoal-900">CarbonLoop</span>
          </div>

          <h2 className="text-2xl font-bold text-charcoal-900 mb-1">Welcome back</h2>
          <p className="text-sm text-charcoal-500 mb-8">Sign in to your CarbonLoop account</p>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@organization.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-charcoal-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-charcoal-50 px-3 text-charcoal-400">or</span>
              </div>
            </div>

            <button
              type="button"
              disabled
              title="Google OAuth requires a configured GCP project. Add your client ID to .env to enable."
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-charcoal-300 bg-white text-charcoal-400 text-sm font-medium cursor-not-allowed opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google (requires GCP setup)
            </button>
          </form>

          <p className="text-center text-sm text-charcoal-500 mt-6">
            New to CarbonLoop?{' '}
            <Link to="/register" className="text-forest-700 font-semibold hover:text-forest-900">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
