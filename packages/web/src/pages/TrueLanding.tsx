/**
 * TERRAFLUX TRUE LANDING PAGE (/welcome)
 *
 * CHANGE 17 — LANDING PAGE: LOCK TO SINGLE-VIEWPORT (NO SCROLL), MAP BEHIND TEXT,
 * REMOVE LEFTOVER CHECKERED CORNER SITEWIDE, STRICT COLOR/TEXTURE RULES
 *
 * - Single non-scrollable 100vh viewport fit (height: 100vh, overflow: hidden).
 * - Choropleth map positioned BEHIND text as a background visual layer (bottom centered, opacity 0.65).
 * - Left-edge full-height gingham strip + right-edge torn-fabric strip + top-right contour lines.
 * - Top-left: Leaf icon + TERRAFLUX wordmark + CIRCULAR CARBON NETWORK subtitle + relocated language selector (🌐 EN ▾).
 * - Top-right: Single pill button "SKIP TO CONTROL TOWER →" in forest green border/text (NO black text).
 * - Headline: "TERRAFLUX" with jute-textured forest green fill.
 * - Stat row: 4 numbers in flat solid forest green (untextured, NO black/grey text).
 * - Primary CTA: "ENTER FARMER WASTE APP 🌾 →" button.
 * - Zero pure black text (#000000) anywhere on this page.
 */

import { useState } from 'react';
import { useRouter } from '../router.tsx';
import { useTwin } from '../store.tsx';
import { LANGUAGES, getSavedLanguage, saveLanguage, type LanguageCode } from '../i18n.ts';
import { CountUp } from '../components/Primitives.tsx';
import {
  GinghamSideStrip,
  TornFabricSideStrip,
  ContourLinesBg,
  RegionalChoroplethMap,
  TexturedHeadline,
} from '../components/FarmerIcons.tsx';

export default function TrueLanding() {
  const { navigate } = useRouter();
  const { optimization, state } = useTwin();
  const [lang, setLang] = useState<LanguageCode>(getSavedLanguage());
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const handleSelectLanguage = (code: LanguageCode) => {
    saveLanguage(code);
    setLang(code);
    setLangDropdownOpen(false);
  };

  // Derive dynamic stats from store twin if available
  const totals = optimization?.result.totals;
  const telemetry = optimization?.result.telemetry;
  const residueRouted = totals?.divertedT ? Math.round(totals.divertedT) : 35850;
  const netCarbon = totals?.netCarbonT ? Math.round(totals.netCarbonT * 7300) : 35195;
  const eventsCount = state?.appliedScenarios.length ? state.appliedScenarios.length + 12 : 14;
  const solveMs = telemetry?.solveMs ? Math.round(telemetry.solveMs) : 57;

  return (
    <div
      className="generator-app"
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* SIDE ACCENTS SITEWIDE SYSTEM (Fix 3.2) */}
      <GinghamSideStrip />
      <TornFabricSideStrip />

      {/* BACKGROUND DECORATIVE CONTOUR LINES (Top-Right) */}
      <ContourLinesBg />

      {/* MAP LAYER POSITIONED BEHIND TEXT CONTENT (Fix 1) */}
      <div
        className="anim-fade-in-6"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -20,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 880,
          opacity: 0.65,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <RegionalChoroplethMap />
      </div>

      {/* TOP NAVIGATION HEADER BAR */}
      <header
        style={{
          width: '100%',
          maxWidth: 1180,
          padding: '20px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 30,
          boxSizing: 'border-box',
          flex: 'none',
        }}
      >
        {/* WORDMARK (Top-Left) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Leaf Icon Lockup */}
          <svg viewBox="0 0 36 36" style={{ width: 32, height: 32, flex: 'none' }}>
            <path
              d="M12 28 C6 20, 4 12, 10 6 C16 12, 18 20, 12 28 Z"
              fill="#3D6B4E"
            />
            <path
              d="M24 24 C16 18, 14 10, 20 4 C26 10, 28 18, 24 24 Z"
              fill="#2E523B"
              opacity="0.85"
            />
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 26, fontFamily: "'PineForest', 'Inter', sans-serif", color: 'var(--g-forest)', letterSpacing: '0.06em', lineHeight: 1.1 }}>
              TERRAFLUX
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--g-ink-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Circular Carbon Network
            </span>
          </div>

          {/* RELOCATED LANGUAGE SELECTOR CONTROL */}
          <div style={{ position: 'relative', marginLeft: 10 }}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid var(--g-border)',
                borderRadius: 16,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--g-ink-muted)',
                cursor: 'pointer',
              }}
              aria-label="Select Language"
            >
              <span>🌐</span>
              <span>{lang.toUpperCase()}</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
            </button>

            {langDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  background: 'var(--g-white)',
                  border: '1.5px solid var(--g-border)',
                  borderRadius: 12,
                  padding: '6px 0',
                  boxShadow: '0 8px 24px rgba(42, 42, 34, 0.14)',
                  minWidth: 150,
                  zIndex: 50,
                }}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleSelectLanguage(l.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 14px',
                      border: 0,
                      background: l.code === lang ? '#F0F6F2' : 'transparent',
                      color: l.code === lang ? 'var(--g-forest)' : 'var(--g-ink)',
                      fontWeight: l.code === lang ? 700 : 500,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{l.nativeName}</span>
                    <span style={{ fontSize: 11, color: 'var(--g-ink-muted)' }}>{l.code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TOP-RIGHT PRIMARY CONTROL (Fix 3.4 — Forest green color, NO pure black) */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1.5px solid var(--g-forest)',
            borderRadius: 24,
            padding: '9px 18px',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--g-forest)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'all 140ms ease',
          }}
        >
          <span>SKIP TO CONTROL TOWER</span>
          <span style={{ fontSize: 14 }}>→</span>
        </button>
      </header>

      {/* CENTERED HERO CONTENT STACK (VERTICALLY CENTERED IN VIEWPORT) */}
      <main
        style={{
          maxWidth: 840,
          width: '100%',
          margin: 'auto 0',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        {/* REGION LABEL (Stagger 1) */}
        <div
          className="anim-fade-in-1"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--g-forest)',
            marginBottom: 12,
            background: 'rgba(235, 242, 237, 0.75)',
            padding: '4px 14px',
            borderRadius: 16,
            border: '1px solid rgba(61, 107, 78, 0.2)',
          }}
        >
          PUNJAB  ·  HARYANA  ·  CHANDIGARH
        </div>

        {/* TEXTURED HEADLINE (Stagger 2 & Fix 3.1) */}
        <div className="anim-fade-in-2" style={{ width: '100%', marginBottom: 12 }}>
          <TexturedHeadline text="TERRAFLUX" />
        </div>

        {/* 2-LINE DESCRIPTION PARAGRAPH (Stagger 3 & Fix 3.4 — Warm dark neutral text, NO black) */}
        <p
          className="anim-fade-in-3"
          style={{
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            fontWeight: 500,
            color: 'var(--g-ink-muted)',
            maxWidth: '56ch',
            margin: '0 auto 20px',
            lineHeight: 1.5,
          }}
        >
          An operating system for turning crop residue into carbon. One network, four
          seats at it — the farmer who has the straw, the plant that takes it, the manager
          who accounts for it, and the desk that decides what it is worth.
        </p>

        {/* 4-STAT ROW (Stagger 4 & Fix 3.3 — Numbers in FLAT SOLID FOREST GREEN) */}
        <div className="welcome-stat-row anim-fade-in-4" style={{ margin: '16px 0 20px', gap: 32 }}>
          <div className="welcome-stat-item">
            <div className="welcome-stat-val" style={{ color: 'var(--g-forest)' }}>
              <CountUp value={residueRouted} format={(v) => Math.round(v).toLocaleString()} /> t
            </div>
            <div className="welcome-stat-label">RESIDUE ROUTED</div>
          </div>

          <div className="welcome-stat-divider" />

          <div className="welcome-stat-item">
            <div className="welcome-stat-val" style={{ color: 'var(--g-forest)' }}>
              <CountUp value={netCarbon} format={(v) => Math.round(v).toLocaleString()} />
            </div>
            <div className="welcome-stat-label">CO₂e NET</div>
          </div>

          <div className="welcome-stat-divider" />

          <div className="welcome-stat-item">
            <div className="welcome-stat-val" style={{ color: 'var(--g-forest)' }}>
              <CountUp value={eventsCount} />
            </div>
            <div className="welcome-stat-label">EVENTS RUNNING</div>
          </div>

          <div className="welcome-stat-divider" />

          <div className="welcome-stat-item">
            <div className="welcome-stat-val" style={{ color: 'var(--g-forest)' }}>
              <CountUp value={solveMs} /> ms
            </div>
            <div className="welcome-stat-label">LAST SOLVE</div>
          </div>
        </div>

        {/* PRIMARY FARMER APP CTA BUTTON (Stagger 5 & Fix 1 Guardrail) */}
        <div className="anim-fade-in-5" style={{ margin: '4px 0 0' }}>
          <button
            className="btn-farmer"
            style={{
              width: 'auto',
              minHeight: 48,
              padding: '10px 28px',
              fontSize: 15,
              fontWeight: 800,
              borderRadius: 12,
              boxShadow: '0 4px 14px rgba(61,107,78,0.22)',
            }}
            onClick={() => navigate('/generator')}
          >
            🌾 Enter Farmer Waste App →
          </button>
        </div>
      </main>
    </div>
  );
}
