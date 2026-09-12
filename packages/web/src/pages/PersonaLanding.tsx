/**
 * Section 1: App Entry — 4-Persona Landing Page (/entry)
 *
 * Prominently presents four large persona choices:
 *   1. WASTE GENERATOR (Farmer / Producer)
 *   2. FACILITY (Processing Plant)
 *   3. CARBON (Ledger & Permanence)
 *   4. ECONOMY (Markets & Unit Economics)
 *
 * CHANGE 9 & 10 POLISH:
 * - Real recycled-paper texture background (#EDE7DC ground)
 * - Smooth scalloped corner accents top-left and bottom-right (matching /welcome exactly)
 * - Top-right compact language dropdown control (🌐 EN ▾)
 */

import { useState } from 'react';
import { useRouter } from '../router.tsx';
import { LANGUAGES, getSavedLanguage, saveLanguage, t, type LanguageCode } from '../i18n.ts';
import {
  HalftoneGeneratorIcon,
  HalftoneFacilityIcon,
  HalftoneCarbonIcon,
  HalftoneEconomyIcon,
  ScallopedGinghamCorner,
  GoldSpark,
} from '../components/FarmerIcons.tsx';

export default function PersonaLanding() {
  const { navigate } = useRouter();
  const [lang, setLang] = useState<LanguageCode>(getSavedLanguage);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const handleSelectLanguage = (code: LanguageCode) => {
    saveLanguage(code);
    setLang(code);
    setLangDropdownOpen(false);
  };

  const personas = [
    {
      id: 'generator',
      title: t(lang, 'role_generator'),
      sub: t(lang, 'role_generator_sub'),
      icon: <HalftoneGeneratorIcon size={64} />,
      route: '/generator',
      active: true,
    },
    {
      id: 'facility',
      title: t(lang, 'role_facility'),
      sub: t(lang, 'role_facility_sub'),
      icon: <HalftoneFacilityIcon size={64} />,
      route: '/facilities',
      active: false,
    },
    {
      id: 'carbon',
      title: t(lang, 'role_carbon'),
      sub: t(lang, 'role_carbon_sub'),
      icon: <HalftoneCarbonIcon size={64} />,
      route: '/carbon',
      active: false,
    },
    {
      id: 'economy',
      title: t(lang, 'role_economy'),
      sub: t(lang, 'role_economy_sub'),
      icon: <HalftoneEconomyIcon size={64} />,
      route: '/economics',
      active: false,
    },
  ];

  return (
    <div className="generator-app" style={{ minHeight: '100vh', paddingBottom: 60, position: 'relative', overflow: 'hidden' }}>
      {/* CHANGE 9: Smooth Scalloped Corner Accents Top-Left and Bottom-Right (Matching /welcome) */}
      <ScallopedGinghamCorner position="top-left" />
      <ScallopedGinghamCorner position="bottom-right" />

      {/* CHANGE 10: Top-Right Compact Language Selector Dropdown (🌐 EN ▾) */}
      <div style={{ position: 'absolute', top: 24, right: 28, zIndex: 30 }}>
        <button
          onClick={() => setLangDropdownOpen(!langDropdownOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--g-white)',
            border: '1.5px solid var(--g-border)',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--g-ink)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 140ms ease',
          }}
          aria-label="Select Language"
        >
          <span style={{ fontSize: 14 }}>🌐</span>
          <span>{lang.toUpperCase()}</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
        </button>

        {langDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              background: 'var(--g-white)',
              border: '1.5px solid var(--g-border)',
              borderRadius: 12,
              padding: '6px 0',
              boxShadow: '0 8px 24px rgba(42, 42, 34, 0.14)',
              minWidth: 160,
              zIndex: 40,
              textAlign: 'left',
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
                  padding: '8px 16px',
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

      <header className="gen-header" style={{ position: 'relative', zIndex: 10 }}>
        <div className="gen-brand">
          <h1>TERRAFLUX</h1>
          <span className="gen-brand-sub">Circular Network</span>
        </div>
        <button
          className="btn-farmer secondary"
          style={{ minHeight: 36, padding: '2px 10px', fontSize: 12, width: 'auto', margin: 0 }}
          onClick={() => navigate('/')}
        >
          {t(lang, 'nav_back_terminal')}
        </button>
      </header>

      <div className="persona-landing" style={{ position: 'relative', zIndex: 10 }}>
        <div className="persona-head">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <GoldSpark style={{ width: 32, height: 32 }} />
            <h2>{t(lang, 'select_role')}</h2>
            <GoldSpark style={{ width: 32, height: 32 }} />
          </div>
          <p>{t(lang, 'role_subtitle')}</p>
        </div>

        <div className="persona-grid">
          {personas.map((p) => (
            <div
              key={p.id}
              className={`persona-tile ${p.active ? 'active-module' : ''}`}
              onClick={() => navigate(p.route)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(p.route);
              }}
            >
              <div style={{ marginBottom: 4 }}>{p.icon}</div>
              <div className="tile-title">{p.title}</div>
              <div className="tile-sub">{p.sub}</div>
              {p.active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'var(--g-forest)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    textTransform: 'uppercase',
                  }}
                >
                  Featured
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
