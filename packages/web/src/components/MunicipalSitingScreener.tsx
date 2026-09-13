import { useState } from 'react';

export function MunicipalSitingScreener() {
  const [corridor, setCorridor] = useState<'ahmedabad_kheda' | 'punjab_malwa' | 'surat_ulb'>('ahmedabad_kheda');
  const [activeLayer, setActiveLayer] = useState<'all' | 'density' | 'catchment' | 'biochemical' | 'offtake'>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<'sanand_gidc' | 'bavla_agro' | 'jamalpur_node'>('sanand_gidc');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // Interactive R_max Logistics Formula State
  const [gateFee, setGateFee] = useState(1600);
  const [preCost, setPreCost] = useState(420);
  const [fuelCostPerTkm, setFuelCostPerTkm] = useState(14);
  const laborWearCost = 3.5;

  const computedRmax = Math.max(10, Math.round((gateFee - preCost) / (2 * (fuelCostPerTkm + laborWearCost))));

  const candidates = {
    sanand_gidc: {
      name: 'Sanand GIDC Agro-Industrial Buffer',
      type: 'Slow Pyrolysis Retort (550°C Rotary Kiln)',
      targetCap: '30 t/day',
      score: 0.91,
      densityScore: 0.95,
      radiusScore: 0.88,
      offtakeScore: 0.90,
      zoningScore: 0.92,
      overlapIndex: 0.08,
      deadheadingSaved: '34.8 km',
      co2Sequestration: '+1.84 tCO₂e/t biochar',
      paybackYears: '3.2 years',
      recommendation: 'HIGHLY RECOMMENDED — Deploy 30t/d Pyrolysis Retort to capture 42t/d stubble & eliminate open burning.',
    },
    bavla_agro: {
      name: 'Bavla Rice Mill Cluster',
      type: 'Co-Digestion CSTR + Pelletiser',
      targetCap: '25 t/day',
      score: 0.74,
      densityScore: 0.82,
      radiusScore: 0.65,
      offtakeScore: 0.78,
      zoningScore: 0.70,
      overlapIndex: 0.32,
      deadheadingSaved: '18.2 km',
      co2Sequestration: '+1.22 tCO₂e/t biochar',
      paybackYears: '4.5 years',
      recommendation: 'MODERATE RISK — 32% overlap with GreenGas CBG. High risk of feedstock bidding war.',
    },
    jamalpur_node: {
      name: 'Jamalpur Urban Market Buffer',
      type: 'Wet Anaerobic Digestion (CBG)',
      targetCap: '50 t/day',
      score: 0.58,
      densityScore: 0.90,
      radiusScore: 0.28,
      offtakeScore: 0.85,
      zoningScore: 0.35,
      overlapIndex: 0.54,
      deadheadingSaved: '8.5 km',
      co2Sequestration: '+0.88 tCO₂e/t CBG',
      paybackYears: '6.1 years',
      recommendation: 'CANNIBALIZATION ALERT — 54% overlap with Sabarmati CSTR (>40% threshold). Severe feedstock starvation risk.',
    },
  };

  const currentCand = candidates[selectedCandidate];

  // Helper for score bars
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'var(--green-500)';
    if (score >= 0.5) return 'var(--warn)';
    return 'var(--neg)';
  };

  // SVG Gauge Math for Omega (Overlap Index)
  const gaugeRadius = 40;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeDashoffset = gaugeCircumference - (currentCand.overlapIndex * gaugeCircumference);
  
  // R_max ruler logic
  const maxRulerValue = 70;
  const wetVal = computedRmax;
  const looseVal = Math.round(computedRmax * 0.6);
  const pelletVal = Math.round(computedRmax * 1.6);

  return (
    <div className="siting-screener-container" style={{ background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--rule)', padding: '0 0 20px 0', overflow: 'hidden' }}>
      
      {/* ── Mode Toggle Header ── */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: '0 16px', alignItems: 'flex-end', gap: 20, marginBottom: 20 }}>
        <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--green-100)', color: 'var(--green-700)', fontWeight: 700, fontSize: 14 }}>
            🧭
          </span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Municipal Siting Screener
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Spatial Decision-Support System</div>
          </div>
        </div>

        {/* Tab Strip */}
        <div style={{ display: 'flex', gap: 24, fontSize: 13, fontWeight: 600 }}>
          <div style={{ padding: '16px 4px', color: 'var(--ink-4)', borderBottom: '2px solid transparent', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ opacity: 0.5 }}>🏭</span> Operations Mode
          </div>
          <div style={{ padding: '16px 4px', color: 'var(--green-900)', borderBottom: '2px solid var(--green-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📍</span> Site Planning (Active)
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* ── Control Bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginRight: 6 }}>SPATIAL LAYERS:</span>
            {[
              { id: 'all', label: 'All Layers' },
              { id: 'density', label: 'Biomass KDE' },
              { id: 'catchment', label: 'Catchment Isochrones' },
              { id: 'biochemical', label: 'Moisture Phase' },
              { id: 'offtake', label: 'Offtake Sinks' },
            ].map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id as any)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: activeLayer === layer.id ? '1px solid var(--green-700)' : '1px solid var(--rule-2)',
                  background: activeLayer === layer.id ? 'var(--green-700)' : 'var(--surface)',
                  color: activeLayer === layer.id ? '#ffffff' : 'var(--ink-2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {layer.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value as any)}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4, border: '1px solid var(--rule-2)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer' }}
            >
              <option value="ahmedabad_kheda">Corridor: Ahmedabad–Kheda (Gujarat)</option>
              <option value="punjab_malwa">Corridor: Malwa Stubble (Punjab)</option>
              <option value="surat_ulb">Corridor: Surat ULB Municipal</option>
            </select>
          </div>
        </div>

        {/* ── Interactive SVG Canvas ── */}
        <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rule-2)', background: '#f8faf7', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)' }}>
          
          {/* Top Floating Legend */}
          <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 10, display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.08)', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4F835B' }} /> Wet
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#C58A42' }} /> Dry
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '2px solid #2563eb' }} /> Facility
            </span>
          </div>

          <svg viewBox="0 0 1000 580" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <pattern id="sitingGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" opacity="0.7" />
              </pattern>
              
              {/* Subtle Topo Rings */}
              <pattern id="topoRings" width="200" height="200" patternUnits="userSpaceOnUse">
                <circle cx="100" cy="100" r="40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.4" />
                <circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3" />
                <circle cx="100" cy="100" r="120" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.2" />
              </pattern>

              <radialGradient id="wetGlowSabarmati" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4F835B" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#4F835B" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#4F835B" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="wetGlowAnand" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4F835B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#4F835B" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="dryGlowSanand" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#C58A42" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#C58A42" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#C58A42" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="dryGlowKheda" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#C58A42" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#C58A42" stopOpacity="0" />
              </radialGradient>

              {/* Gradient River */}
              <linearGradient id="riverGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.7" />
              </linearGradient>

              {/* Drop Shadow for hover */}
              <filter id="hoverShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Background */}
            <rect width="1000" height="580" fill="url(#sitingGrid)" />
            <rect width="1000" height="580" fill="url(#topoRings)" />

            {/* River */}
            <path
              d="M 580 0 Q 560 140 520 260 T 480 420 T 440 580"
              fill="none"
              stroke="url(#riverGrad)"
              strokeWidth="18"
              strokeLinecap="round"
            />


            {/* Heatmap Glows */}
            {(activeLayer === 'all' || activeLayer === 'density') && (
              <g style={{ transition: 'opacity 0.3s' }}>
                <circle cx="330" cy="240" r="140" fill="url(#dryGlowSanand)" />
                <circle cx="530" cy="220" r="130" fill="url(#wetGlowSabarmati)" />
                <circle cx="710" cy="390" r="120" fill="url(#dryGlowKheda)" />
                <circle cx="820" cy="460" r="110" fill="url(#wetGlowAnand)" />
              </g>
            )}



            {/* Haul Routes */}
            <g stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6">
              <line x1="600" y1="130" x2="530" y2="220" />
              <line x1="530" y1="220" x2="510" y2="260" />
              <line x1="510" y1="260" x2="470" y2="330" />
              <line x1="710" y1="390" x2="730" y2="360" />
              <line x1="820" y1="460" x2="800" y2="480" />
              <line x1="330" y1="240" x2="710" y2="390" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" opacity="0.8" />
            </g>

            <g transform="translate(520, 315)">
              <rect x="-38" y="-12" width="76" height="24" rx="12" fill="#fef2f2" stroke="#f87171" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#dc2626" fontSize="10" fontWeight="700">RISK</text>
            </g>

            {/* ── GENERATORS ── */}
            {/* Sanand Gap */}
            <g 
              transform="translate(330, 240)" 
              style={{ cursor: 'pointer' }} 
              onClick={() => setSelectedCandidate('sanand_gidc')}
              onMouseEnter={() => setHoveredNode('sanand')}
              onMouseLeave={() => setHoveredNode(null)}
              filter={hoveredNode === 'sanand' ? 'url(#hoverShadow)' : ''}
            >
              {/* Pulsing ring */}
              <circle r="18" fill="none" stroke="#d97706" strokeWidth="2" opacity="0.6">
                <animate attributeName="r" values="18;28;18" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle r="18" fill="#d97706" stroke="#ffffff" strokeWidth="3" />
              <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="800">9.4t</text>
              <text x="0" y="34" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="700">Sanand GIDC</text>
            </g>

            {/* Gandhinagar */}
            <g transform="translate(600, 130)">
              <circle r="16" fill="#166534" stroke="#ffffff" strokeWidth="2" />
              <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="10" fontWeight="700">7.6t</text>
              <text x="0" y="28" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="600">Gandhinagar</text>
            </g>

            {/* Ahmedabad Market */}
            <g transform="translate(510, 260)">
              <circle r="18" fill="#166534" stroke="#ffffff" strokeWidth="2" />
              <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="10.5" fontWeight="800">12.8t</text>
              <text x="0" y="30" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="700">Ahmedabad Market</text>
            </g>

            {/* Kheda Fiber Hub */}
            <g transform="translate(730, 360)">
              <circle r="18" fill="#b45309" stroke="#ffffff" strokeWidth="2" />
              <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="10.5" fontWeight="800">18.5t</text>
              <text x="0" y="30" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="700">Kheda Fiber Hub</text>
            </g>

            {/* Anand APMC */}
            <g transform="translate(800, 480)">
              <circle r="17" fill="#166534" stroke="#ffffff" strokeWidth="2" />
              <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="10" fontWeight="700">14.2t</text>
              <text x="0" y="28" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="600">Anand APMC</text>
            </g>

            {/* Sabarmati CSTR (92%) */}
            <g transform="translate(530, 220)">
              <circle r="20" fill="#ffffff" stroke="#dc2626" strokeWidth="2" />
              <circle r="5" fill="#dc2626" cx="0" cy="0" />
              <text x="10" y="4" fill="#dc2626" fontSize="10" fontWeight="800">92%</text>
              <text x="0" y="36" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="700">Sabarmati CSTR</text>
            </g>

            {/* GreenGas CBG (73%) */}
            <g transform="translate(470, 330)">
              <circle r="18" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
              <circle r="5" fill="#2563eb" cx="0" cy="0" />
              <text x="9" y="4" fill="#2563eb" fontSize="9" fontWeight="800">73%</text>
              <text x="0" y="34" textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="600">GreenGas CBG</text>
            </g>

            {/* Kheda Biochar (70%) */}
            <g transform="translate(710, 390)">
              <circle r="18" fill="#ffffff" stroke="#475569" strokeWidth="2" />
              <circle r="5" fill="#475569" cx="0" cy="0" />
              <text x="9" y="4" fill="#475569" fontSize="9" fontWeight="800">70%</text>
              <text x="0" y="34" textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="600">Kheda Retort</text>
            </g>

            {/* Anand Co-Digestion (86%) */}
            <g transform="translate(820, 460)">
              <circle r="18" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2" />
              <circle r="5" fill="#1d4ed8" cx="0" cy="0" />
              <text x="9" y="4" fill="#1d4ed8" fontSize="9" fontWeight="800">86%</text>
              <text x="0" y="34" textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="600">Anand Co-Digestion</text>
            </g>
          </svg>
        </div>

        {/* ── ANALYSIS 3-COLUMN LAYOUT ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16, marginTop: 20, alignItems: 'stretch' }}>
          
          {/* PANEL 1: Candidate Evaluator (Primary) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>1. Candidate Site Evaluator</h3>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: currentCand.overlapIndex > 0.4 ? 'var(--neg-bg)' : currentCand.overlapIndex <= 0.15 ? 'var(--green-100)' : 'var(--warn-bg)', color: currentCand.overlapIndex > 0.4 ? 'var(--neg)' : currentCand.overlapIndex <= 0.15 ? 'var(--green-700)' : 'var(--warn)' }}>
                Overall: {(currentCand.score * 100).toFixed(0)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'sanand_gidc', label: 'Sanand GIDC' },
                { id: 'bavla_agro', label: 'Bavla Mills' },
                { id: 'jamalpur_node', label: 'Jamalpur Node' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCandidate(c.id as any)}
                  style={{
                    flex: 1, padding: '8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: selectedCandidate === c.id ? '1px solid var(--green-700)' : '1px solid var(--rule-2)',
                    background: selectedCandidate === c.id ? 'var(--green-100)' : 'transparent',
                    color: selectedCandidate === c.id ? 'var(--green-900)' : 'var(--ink-2)',
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Density (Φ)', val: currentCand.densityScore },
                { label: 'Catchment (Λ)', val: currentCand.radiusScore },
                { label: 'Offtake (Ξ)', val: currentCand.offtakeScore },
                { label: 'Zoning (Ψ)', val: currentCand.zoningScore }
              ].map(crit => (
                <div key={crit.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{crit.label}</span>
                    <strong style={{ color: 'var(--ink)' }}>{(crit.val * 100).toFixed(0)}%</strong>
                  </div>
                  {/* Score Bar */}
                  <div style={{ width: '100%', height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${crit.val * 100}%`, height: '100%', background: getScoreColor(crit.val), transition: 'width 0.3s ease, background 0.3s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 12, borderRadius: 6, background: currentCand.overlapIndex > 0.4 ? 'var(--neg-bg)' : currentCand.overlapIndex <= 0.15 ? 'var(--green-100)' : 'var(--warn-bg)', border: currentCand.overlapIndex > 0.4 ? '1px solid #fca5a5' : currentCand.overlapIndex <= 0.15 ? '1px solid var(--green-300)' : '1px solid #fde047', fontSize: 11, lineHeight: 1.5, marginTop: 'auto' }}>
              <strong>Decision:</strong> {currentCand.recommendation}
            </div>
          </div>

          {/* PANEL 2: R_max Logistics */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>2. Break-Even Radius (R_max)</h3>
            
            <div style={{ display: 'grid', gap: 12, fontSize: 11, color: 'var(--ink-2)', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Gate Tipping (V_gate)</span>
                  <strong className="num">₹{gateFee}/t</strong>
                </div>
                <input type="range" min="1000" max="3000" step="50" value={gateFee} onChange={(e) => setGateFee(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green-700)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Pre-treatment (C_pre)</span>
                  <strong className="num">₹{preCost}/t</strong>
                </div>
                <input type="range" min="100" max="800" step="20" value={preCost} onChange={(e) => setPreCost(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green-700)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Diesel Cost (C_fuel)</span>
                  <strong className="num">₹{fuelCostPerTkm}/km</strong>
                </div>
                <input type="range" min="8" max="25" step="1" value={fuelCostPerTkm} onChange={(e) => setFuelCostPerTkm(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green-700)' }} />
              </div>
            </div>

            {/* Live Radius Ruler SVG */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 600 }}>MAX HAUL RADII (KM):</div>
              <svg width="100%" height="40" style={{ overflow: 'visible' }}>
                <rect x="0" y="10" width="100%" height="4" fill="var(--surface-sunken)" rx="2" />
                <line x1="0" y1="12" x2="100%" y2="12" stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 2" />
                
                {/* Scale markers */}
                <text x="0%" y="30" fontSize="9" fill="var(--ink-4)" textAnchor="start">0</text>
                <text x="50%" y="30" fontSize="9" fill="var(--ink-4)" textAnchor="middle">35</text>
                <text x="100%" y="30" fontSize="9" fill="var(--ink-4)" textAnchor="end">70</text>
                
                {/* Markers */}
                <g style={{ transition: 'transform 0.3s ease' }} transform={`translate(${(looseVal / maxRulerValue) * 100}%, 0)`}>
                  <rect x="-1" y="2" width="2" height="20" fill="var(--warn)" />
                  <text x="0" y="-2" fontSize="9" fill="var(--warn)" textAnchor="middle" fontWeight="700">{looseVal}</text>
                </g>
                <g style={{ transition: 'transform 0.3s ease' }} transform={`translate(${(wetVal / maxRulerValue) * 100}%, 0)`}>
                  <rect x="-1" y="2" width="2" height="20" fill="var(--info)" />
                  <text x="0" y="-2" fontSize="9" fill="var(--info)" textAnchor="middle" fontWeight="700">{wetVal}</text>
                </g>
                <g style={{ transition: 'transform 0.3s ease' }} transform={`translate(${Math.min(100, (pelletVal / maxRulerValue) * 100)}%, 0)`}>
                  <rect x="-1" y="2" width="2" height="20" fill="var(--green-700)" />
                  <text x="0" y="-2" fontSize="9" fill="var(--green-700)" textAnchor="middle" fontWeight="700">{pelletVal}</text>
                </g>
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 4, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--warn)' }}>Loose Stalks</span>
                <span style={{ color: 'var(--info)' }}>Wet Organics</span>
                <span style={{ color: 'var(--green-700)' }}>Pellets/Bales</span>
              </div>
            </div>
          </div>

          {/* PANEL 3: Overlap Ω Gauge */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', width: '100%', marginBottom: 20 }}>3. Cannibalization (Ω)</h3>
            
            {/* SVG Semicircular Gauge */}
            <div style={{ position: 'relative', width: 120, height: 60, marginBottom: 16 }}>
              <svg width="120" height="60" viewBox="0 0 100 50">
                {/* Background track (Semicircle) */}
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--surface-sunken)" strokeWidth="12" strokeLinecap="round" />
                
                {/* Zone Markers (Optional subtle marks) */}
                <path d="M 10 50 A 40 40 0 0 1 20 20" fill="none" stroke="var(--green-300)" strokeWidth="12" opacity="0.3" />
                <path d="M 20 20 A 40 40 0 0 1 70 15" fill="none" stroke="#fde047" strokeWidth="12" opacity="0.3" />
                <path d="M 70 15 A 40 40 0 0 1 90 50" fill="none" stroke="#fca5a5" strokeWidth="12" opacity="0.3" />

                {/* Active Value Track */}
                <path 
                  d="M 10 50 A 40 40 0 0 1 90 50" 
                  fill="none" 
                  stroke={currentCand.overlapIndex > 0.4 ? 'var(--neg)' : currentCand.overlapIndex <= 0.15 ? 'var(--green-500)' : 'var(--warn)'} 
                  strokeWidth="12" 
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference / 2}
                  strokeDashoffset={(gaugeCircumference / 2) * (1 - currentCand.overlapIndex)}
                  style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
                />
              </svg>
              
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', textAlign: 'center', transform: 'translateY(40%)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: currentCand.overlapIndex > 0.4 ? 'var(--neg)' : currentCand.overlapIndex <= 0.15 ? 'var(--green-700)' : 'var(--warn)', lineHeight: 1 }}>
                  {(currentCand.overlapIndex * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.05em' }}>OVERLAP</div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 'auto', background: 'var(--surface-sunken)', padding: 12, borderRadius: 6, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--neg)' }} />
                <span><strong>Ω &gt; 40%:</strong> Starvation Risk</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-500)' }} />
                <span><strong>Ω ≤ 15%:</strong> Greenfield Safe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
