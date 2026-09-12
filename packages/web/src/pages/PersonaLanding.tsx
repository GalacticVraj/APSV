/**
 * Section 1: App Entry — 4-Persona Landing Page
 *
 * Prominently presents four large persona choices:
 *   1. WASTE GENERATOR (Farmer / Producer)
 *   2. FACILITY (Processing Plant)
 *   3. CARBON (Ledger & Permanence)
 *   4. ECONOMY (Markets & Unit Economics)
 *
 * Uses Section 0 visual design matching attached reference images:
 * - Cream paper ground (#EDE7DC)
 * - Forest green typography (#3D6B4E)
 * - Torn paper edge with green gingham pattern corner
 * - Large 64dp+ tap targets for accessibility
 */

import { useRouter } from '../router.tsx';
import { getSavedLanguage, t } from '../i18n.ts';
import {
  HalftoneGeneratorIcon,
  HalftoneFacilityIcon,
  HalftoneCarbonIcon,
  HalftoneEconomyIcon,
  TornGinghamCorner,
  GoldSpark,
} from '../components/FarmerIcons.tsx';

export default function PersonaLanding() {
  const { navigate } = useRouter();
  const lang = getSavedLanguage();

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
    <div className="generator-app" style={{ minHeight: '100vh', paddingBottom: 40 }}>
      <TornGinghamCorner position="top-right" />
      <TornGinghamCorner position="bottom-left" />

      <header className="gen-header">
        <div className="gen-brand">
          <h1>TERRAFLUX</h1>
          <span className="gen-brand-sub">Circular Network</span>
        </div>
        <button
          className="btn-farmer secondary"
          style={{ minHeight: 40, padding: '4px 12px', fontSize: 13, width: 'auto' }}
          onClick={() => navigate('/')}
        >
          {t(lang, 'nav_back_terminal')}
        </button>
      </header>

      <div className="persona-landing">
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
