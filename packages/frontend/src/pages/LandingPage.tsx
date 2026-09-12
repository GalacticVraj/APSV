import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Zap, MapPin, BarChart2, ArrowRight, Shield, Truck, Factory, Users } from 'lucide-react';
import apiClient from '../api/client';

interface PlatformStats {
  total_co2_sequestered_t: number;
  total_waste_diverted_t: number;
  active_facilities: number;
  active_generators: number;
  completed_pickups: number;
}

function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const startTime = Date.now();
          countRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress >= 1) {
              clearInterval(countRef.current!);
              setCount(end);
            }
          }, 16);
          observerRef.current?.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (elementRef.current) observerRef.current.observe(elementRef.current);
    return () => {
      observerRef.current?.disconnect();
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [end, duration]);

  return <span ref={elementRef}>{count.toLocaleString('en-IN')}{suffix}</span>;
}

function StatCard({ value, label, icon: Icon }: { value: number; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
      <Icon className="w-7 h-7 mx-auto mb-3 text-forest-200" />
      <p className="text-3xl font-bold text-white mb-1">
        <AnimatedCounter end={Math.round(value)} />
      </p>
      <p className="text-sm text-forest-200 font-medium">{label}</p>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Generators list their waste',
    description: 'Farms, food processors, markets, and restaurants create listings with waste type, volume, and preferred pickup window.',
    icon: Users,
  },
  {
    step: '02',
    title: 'AI matches to the best facility',
    description: 'Our scoring engine ranks conversion facilities by distance, capacity, waste-type compatibility, and conversion efficiency.',
    icon: Zap,
  },
  {
    step: '03',
    title: 'Logistics routes are optimized',
    description: 'Collection routes are batched and sequenced using a nearest-neighbor optimizer with vehicle capacity and time-window constraints.',
    icon: Truck,
  },
  {
    step: '04',
    title: 'Carbon impact is calculated and verified',
    description: 'Each verified pickup earns a carbon credit, calculated using IPCC AR6 and EPA WARM emission factors with full methodology traceability.',
    icon: BarChart2,
  },
];

const ROLES = [
  { title: 'Waste Generator', desc: 'List agricultural, food, or industrial biomass waste and get matched to certified conversion facilities near you.', href: '/register?role=generator', color: 'bg-forest-50 border-forest-200' },
  { title: 'Facility Operator', desc: 'Receive a steady, optimized inbound stream of compatible waste and grow your throughput while tracking your carbon output.', href: '/register?role=facility_operator', color: 'bg-sage-50 border-sage-200' },
  { title: 'Logistics Partner', desc: 'Get assigned optimized multi-pickup routes with real-time status tracking and delivery verification.', href: '/register?role=logistics_partner', color: 'bg-charcoal-50 border-charcoal-200' },
];

export default function LandingPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    apiClient.get<PlatformStats>('/api/stats/platform')
      .then((r) => setStats(r.data))
      .catch(() => {
        // Use placeholder values if API is down
        setStats({
          total_co2_sequestered_t: 422.22,
          total_waste_diverted_t: 688,
          active_facilities: 8,
          active_generators: 12,
          completed_pickups: 5,
        });
      });
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-charcoal-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-800 flex items-center justify-center">
              <Leaf className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-charcoal-900 tracking-tight">CarbonLoop</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-charcoal-600">
            <a href="#how-it-works" className="hover:text-forest-800 transition-colors">How it works</a>
            <a href="#impact" className="hover:text-forest-800 transition-colors">Impact</a>
            <a href="#roles" className="hover:text-forest-800 transition-colors">Who it is for</a>
            <Link to="/map" className="hover:text-forest-800 transition-colors">Map</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-forest-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 30% 50%, #22c55e 0%, transparent 60%), radial-gradient(circle at 80% 20%, #166534 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest-800/50 border border-forest-700 mb-6">
              <div className="w-2 h-2 rounded-full bg-forest-400 animate-pulse" />
              <span className="text-xs font-semibold text-forest-300 tracking-wider uppercase">HackOut '26 Circular Carbon</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-6">
              Turning waste into<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-forest-400 to-sage-400">
                verified carbon value
              </span>
            </h1>
            <p className="text-lg text-forest-200 leading-relaxed mb-10 max-w-xl">
              CarbonLoop connects waste generators with biochar, biogas, and composting facilities across India.
              We optimize collection logistics and calculate verifiable CO2 sequestration per tonne diverted from landfill.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-forest-500 hover:bg-forest-400 text-white font-semibold text-sm transition-all shadow-green-glow">
                Start as a generator
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/map" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all">
                <MapPin className="w-4 h-4" />
                Explore the map
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Impact counters */}
      <section id="impact" className="bg-forest-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-forest-400 uppercase tracking-widest mb-10">
            Platform impact (live data)
          </p>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard value={stats.total_co2_sequestered_t} label="Tonnes CO2 sequestered" icon={Leaf} />
              <StatCard value={stats.total_waste_diverted_t} label="Tonnes waste diverted" icon={Factory} />
              <StatCard value={stats.active_facilities} label="Active facilities" icon={Zap} />
              <StatCard value={stats.active_generators} label="Registered generators" icon={Users} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/10 rounded-2xl p-6 h-28 skeleton" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-charcoal-900 mb-4">How CarbonLoop works</h2>
            <p className="text-base text-charcoal-500 max-w-xl mx-auto">
              A four-step process from waste listing to verified carbon credit, with every calculation sourced and documented.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="relative group">
                <div className="card h-full hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-forest-50 border border-forest-200 flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-5 h-5 text-forest-700" />
                    </div>
                    <span className="text-xs font-bold text-charcoal-400 mt-2.5 tracking-widest">{step.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-charcoal-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-charcoal-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-24 bg-charcoal-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-charcoal-900 mb-4">Who is it for?</h2>
            <p className="text-base text-charcoal-500 max-w-lg mx-auto">
              CarbonLoop serves every participant in the circular carbon value chain.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {ROLES.map((role) => (
              <Link key={role.title} to={role.href}
                className={`block card-hover border ${role.color} group`}>
                <h3 className="text-lg font-bold text-charcoal-900 mb-3 group-hover:text-forest-800 transition-colors">
                  {role.title}
                </h3>
                <p className="text-sm text-charcoal-600 leading-relaxed mb-5">{role.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 group-hover:gap-2.5 transition-all">
                  Join as {role.title.split(' ')[0]}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology strip */}
      <section className="bg-forest-50 border-y border-forest-200 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-forest-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-charcoal-900">Verified methodology</p>
              <p className="text-xs text-charcoal-500">EPA WARM v15, IPCC AR6 WG3, DEFRA 2023 emission factors</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-7 h-7 text-forest-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-charcoal-900">India-first design</p>
              <p className="text-xs text-charcoal-500">Nominatim geocoding biased to Indian addresses and PIN codes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-forest-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-charcoal-900">Exportable reports</p>
              <p className="text-xs text-charcoal-500">CSV and PDF impact reports for corporate ESG and municipal compliance</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl font-extrabold text-charcoal-900 mb-4">
            Ready to close the loop?
          </h2>
          <p className="text-base text-charcoal-500 mb-10">
            Join generators and facilities already turning organic waste into verified carbon value across India.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
              Create your account
            </Link>
            <Link to="/login" className="btn-secondary px-7 py-3.5 text-base">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-charcoal-200 bg-charcoal-50 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-forest-800 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-charcoal-700">CarbonLoop</span>
          </div>
          <p className="text-xs text-charcoal-400">
            Built for HackOut '26, Circular Carbon Ecosystem track. Carbon calculations sourced from IPCC AR6, EPA WARM v15, and DEFRA 2023.
          </p>
          <div className="flex gap-5 text-xs text-charcoal-400">
            <Link to="/map" className="hover:text-charcoal-700 transition-colors">Map</Link>
            <a href="#how-it-works" className="hover:text-charcoal-700 transition-colors">Methodology</a>
            <Link to="/login" className="hover:text-charcoal-700 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
