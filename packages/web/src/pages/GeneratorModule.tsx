/**
 * TERRAFLUX WASTE GENERATOR MODULE (FARMER-FIRST PREMIUM UX)
 *
 * CHANGE 15 — WASTE INTAKE FORM: LOCK TO EXACT REFERENCE LAYOUT
 * - Left sidebar navigation (Home / Map / Routes / Waste / Facilities / Analytics / Settings)
 * - Top header row: TERRAFLUX logo + tagline, Language dropdown (🌐 EN ▾), Profile icon
 * - Form header: "← Back" top-left, "Why we ask ⓘ" top-right
 * - Page title: "Agricultural Waste · Waste Intake Form" (NOTICEABLY LARGER font size exception)
 * - One unified white panel containing two-column layout separated by thin vertical divider
 * - Numbered questions ("1.", "2." bold prefix)
 * - Pill-button answer options (solid forest green when selected, white/outlined when unselected)
 * - Q2 Quantity: numeric input + unit toggle pills beside it
 * - Q3 Location: text input + full-width "📍 Use map location" button
 * - Panel Footer: thin divider + right-aligned "Complete & View Recommendation →" button
 * - Page Footer: "@TERRAFLUX.NETWORK | HACKOUT'26 PS11" + taglines
 * - Background & Corner Accents: linen texture ground + torn checkered corners
 */

import { useState } from 'react';
import { useRouter } from '../router.tsx';
import { useTwin } from '../store.tsx';
import {
  LANGUAGES,
  getSavedLanguage,
  saveLanguage,
  t,
  type LanguageCode,
} from '../i18n.ts';
import { CountUp } from '../components/Primitives.tsx';
import {
  HalftoneBiocharIcon,
  HalftoneBiogasIcon,
  HalftoneCompostIcon,
  HalftoneGeneratorIcon,
  HalftoneFacilityIcon,
  HalftoneCarbonIcon,
  HalftoneEconomyIcon,
  HalftoneAgriWasteIcon,
  HalftoneMunicipalWasteIcon,
  HalftoneLivestockWasteIcon,
  HalftoneIndustrialWasteIcon,
  TornGinghamCorner,
  TornFabricSideStrip,
  SidebarLeafIllustration,
  GoldSpark,
} from '../components/FarmerIcons.tsx';

type TabView = 'lang' | 'intake_cat' | 'intake_wizard' | 'home' | 'pathways' | 'journey';
type CategoryKey = 'agri' | 'muni' | 'live' | 'ind';

interface IntakeSummary {
  category: CategoryKey;
  materialType: string;
  quantity: number;
  unit: string;
  location: string;
  moisture: string;
  disposition?: string;
}

export default function GeneratorModule() {
  const { optimization } = useTwin();
  const { navigate } = useRouter();
  const [lang, setLang] = useState<LanguageCode>(getSavedLanguage);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Default tab flow: if lang saved -> category intake, else lang selection
  const [tab, setTab] = useState<TabView>(() => {
    return localStorage.getItem('terraflux_generator_lang') ? 'intake_cat' : 'lang';
  });

  // Intake Questionnaire State & Mandatory Field Validation
  const [activeCat, setActiveCat] = useState<CategoryKey>('agri');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [quantityVal, setQuantityVal] = useState<number>(8.4);
  const [unitVal, setUnitVal] = useState<string>('tonnes');
  const [locationVal, setLocationVal] = useState<string>('Batala, Gurdaspur');
  const [mapCaptured, setMapCaptured] = useState<boolean>(false);
  const [whyAskOpen, setWhyAskOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  // Completed Intake Summary
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary>({
    category: 'agri',
    materialType: 'Paddy straw',
    quantity: 8.4,
    unit: 'tonnes',
    location: 'Batala, Gurdaspur',
    moisture: 'Dry',
  });

  const [selectedPathway, setSelectedPathway] = useState<'biochar' | 'biogas' | 'compost'>('biochar');

  const onSelectLanguage = (code: LanguageCode) => {
    setLang(code);
    saveLanguage(code);
    setLangDropdownOpen(false);
    setTab('intake_cat');
  };

  const handleSelectCategory = (cat: CategoryKey) => {
    setActiveCat(cat);
    setAnswers({});
    setOtherText({});
    setValidationErrors(new Set());
    setWhyAskOpen(false);
    if (cat === 'agri') setUnitVal('tonnes');
    else if (cat === 'muni') setUnitVal('tonnes/day');
    else if (cat === 'live') setUnitVal('per day');
    else if (cat === 'ind') setUnitVal('tonnes/day');
    setTab('intake_wizard');
  };

  // Derive dynamic values
  const availableT = intakeSummary.quantity;
  const totals = optimization?.result.totals;
  const netCarbon = totals?.netCarbonT ?? 4.8;
  const estMargin = totals?.marginInr ?? 12400;

  // Pathway comparison metrics
  const pathwayData = {
    biochar: {
      id: 'biochar',
      name: 'BIOCHAR',
      facility: 'Facility 02 (Batala)',
      valPerTonne: Math.round(estMargin / Math.max(1, availableT)),
      totalVal: estMargin,
      netCarbon: +netCarbon.toFixed(1),
      distanceKm: 18.4,
      processTime: '24 Hours',
      icon: <HalftoneBiocharIcon size={44} />,
      recommended: true,
      reason: t(lang, 'rec_reason_biochar'),
    },
    biogas: {
      id: 'biogas',
      name: 'BIOGAS (CBG)',
      facility: 'Facility 05 (Ludhiana)',
      valPerTonne: Math.round((estMargin * 0.88) / Math.max(1, availableT)),
      totalVal: Math.round(estMargin * 0.88),
      netCarbon: +(netCarbon * 0.65).toFixed(1),
      distanceKm: 12.2,
      processTime: '48 Hours',
      icon: <HalftoneBiogasIcon size={44} />,
      recommended: false,
      reason: t(lang, 'rec_reason_biogas'),
    },
    compost: {
      id: 'compost',
      name: 'ORGANIC COMPOST',
      facility: 'Facility 01 (Amritsar)',
      valPerTonne: Math.round((estMargin * 0.72) / Math.max(1, availableT)),
      totalVal: Math.round(estMargin * 0.72),
      netCarbon: +(netCarbon * 0.4).toFixed(1),
      distanceKm: 8.5,
      processTime: '14 Days',
      icon: <HalftoneCompostIcon size={44} />,
      recommended: false,
      reason: t(lang, 'rec_reason_compost'),
    },
  };

  const activeP = pathwayData[selectedPathway];

  // Material Journey Connected Timeline Nodes
  const journeyNodes = [
    {
      id: 'waste',
      stepNum: 1,
      title: t(lang, 'step_waste'),
      desc: `${intakeSummary.quantity} ${intakeSummary.unit} of ${intakeSummary.materialType} collected at ${intakeSummary.location}.`,
      icon: <HalftoneGeneratorIcon size={32} />,
      facts: [`${intakeSummary.quantity} ${intakeSummary.unit} Available`, `Moisture: ${intakeSummary.moisture}`, 'Gate Price: ₹1,200/t'],
      active: false,
    },
    {
      id: 'collection',
      stepNum: 2,
      title: t(lang, 'step_collection'),
      desc: t(lang, 'step_collection_desc'),
      icon: <HalftoneGeneratorIcon size={32} />,
      facts: ['16t Baled Truck Dispatched', 'Haul Radius: 18.4 km', 'ETA Pickup: Today 2:00 PM'],
      active: false,
    },
    {
      id: 'facility',
      stepNum: 3,
      title: t(lang, 'step_facility'),
      desc: t(lang, 'step_facility_desc'),
      icon: <HalftoneFacilityIcon size={32} />,
      facts: ['Batala Pyrolysis Unit', 'Nameplate: 150 t/day', 'Utilisation: 92%'],
      active: false,
    },
    {
      id: 'processing',
      stepNum: 4,
      title: t(lang, 'step_processing'),
      desc: t(lang, 'step_processing_desc'),
      icon: <HalftoneFacilityIcon size={32} />,
      facts: ['Slow Pyrolysis @ 550°C', 'Char Yield: 34%', 'Fixed Carbon: 62%'],
      active: true,
    },
    {
      id: 'carbon',
      stepNum: 5,
      title: t(lang, 'step_carbon'),
      desc: t(lang, 'step_carbon_desc'),
      icon: <HalftoneCarbonIcon size={32} />,
      facts: ['+4.8 tCO₂e Removal', 'Permanence: 100 Years', 'Q10 Soil Harmonised'],
      active: false,
    },
    {
      id: 'value',
      stepNum: 6,
      title: t(lang, 'step_value'),
      desc: t(lang, 'step_value_desc'),
      icon: <HalftoneEconomyIcon size={32} />,
      facts: ['₹12,400 Net Credit', 'Direct Farmer Payout', 'Carbon Credit Verified'],
      active: false,
    },
  ];

  // Mandatory Field Validation
  const validateCurrentCategory = (): boolean => {
    const errors = new Set<string>();
    let requiredKeys: string[] = [];

    if (activeCat === 'agri') {
      requiredKeys = ['q1', 'quantity', 'location', 'availability', 'moisture', 'disposition'];
    } else if (activeCat === 'muni') {
      requiredKeys = ['q1', 'muni_source', 'quantity', 'location', 'muni_segregation', 'moisture', 'muni_contamination', 'disposition'];
    } else if (activeCat === 'live') {
      requiredKeys = ['q1', 'quantity', 'location', 'live_facility', 'live_bedding', 'moisture', 'disposition'];
    } else if (activeCat === 'ind') {
      requiredKeys = ['q1', 'ind_organic', 'quantity', 'location', 'moisture', 'ind_hazard', 'availability', 'disposition'];
    }

    for (const key of requiredKeys) {
      if (key === 'quantity') {
        if (!quantityVal || quantityVal <= 0) errors.add('quantity');
      } else if (key === 'location') {
        if (!locationVal || locationVal.trim() === '') errors.add('location');
      } else {
        const ans = answers[key];
        if (!ans || ans.trim() === '') {
          errors.add(key);
        } else if (ans === 'opt_other') {
          const ot = otherText[key];
          if (!ot || ot.trim() === '') {
            errors.add(`${key}_other`);
          }
        }
      }
    }

    setValidationErrors(errors);
    return errors.size === 0;
  };

  const handleFormSubmit = () => {
    const isValid = validateCurrentCategory();
    if (!isValid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const selectedType = answers['q1'] === 'opt_other'
      ? (otherText['q1'] || 'Other Waste')
      : (t(lang, answers['q1']) || 'Residue');

    setIntakeSummary({
      category: activeCat,
      materialType: selectedType,
      quantity: quantityVal,
      unit: unitVal,
      location: locationVal,
      moisture: answers['moisture'] ? t(lang, answers['moisture']) : 'Dry',
      disposition: answers['disposition'] ? t(lang, answers['disposition']) : undefined,
    });

    setTab('home');
  };

  const setAnswerKey = (stepKey: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [stepKey]: val }));
    if (validationErrors.has(stepKey) || validationErrors.has(`${stepKey}_other`)) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete(stepKey);
        next.delete(`${stepKey}_other`);
        return next;
      });
    }
  };

  const updateOtherText = (stepKey: string, text: string) => {
    setOtherText((prev) => ({ ...prev, [stepKey]: text }));
    if (text.trim() !== '' && validationErrors.has(`${stepKey}_other`)) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete(`${stepKey}_other`);
        return next;
      });
    }
  };

  const updateQuantityVal = (v: number) => {
    setQuantityVal(v);
    if (v > 0 && validationErrors.has('quantity')) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete('quantity');
        return next;
      });
    }
  };

  const updateLocationVal = (loc: string) => {
    setLocationVal(loc);
    if (loc.trim() !== '' && validationErrors.has('location')) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete('location');
        return next;
      });
    }
  };

  return (
    <div className="generator-app" style={{ minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      {/* HEADER ROW: TerraFlux Logo + Tagline (Left), Language Dropdown + User Avatar (Right) */}
      <header
        style={{
          height: 64,
          background: 'rgba(237, 231, 220, 0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1.5px solid var(--g-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Brand Top Left */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => navigate('/welcome')}
        >
          <GoldSpark style={{ width: 30, height: 30 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--g-forest)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
              TERRAFLUX
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--g-ink-muted)', letterSpacing: '0.02em' }}>
              Waste to Carbon Value Chain
            </span>
          </div>
        </div>

        {/* Top Right: Language Dropdown + User Avatar Silhouette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Language Selector Dropdown */}
          <div style={{ position: 'relative' }}>
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
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
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
                  zIndex: 50,
                  textAlign: 'left',
                }}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => onSelectLanguage(l.code)}
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

          {/* Profile Avatar Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#DCE7DF',
              border: '1.5px solid #B8D4C1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--g-forest)',
              cursor: 'pointer',
            }}
            title="User Profile"
          >
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--g-forest)' }}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      <div className="intake-layout-container">
        {/* FIXED LEFT SIDEBAR NAVIGATION */}
        <aside className="intake-sidebar">
          {/* Sidebar Nav Items */}
          <nav className="intake-sidebar-nav">
            {[
              { key: 'home', label: 'Home', icon: '🏠', route: '/welcome' },
              { key: 'map', label: 'Map', icon: '🗺️', route: '/map' },
              { key: 'routes', label: 'Routes', icon: '🚛', route: '/logistics' },
              { key: 'waste', label: 'Waste', icon: '🍃', active: true, route: '/generator' },
              { key: 'facilities', label: 'Facilities', icon: '🏭', route: '/facilities' },
              { key: 'analytics', label: 'Analytics', icon: '📊', route: '/optimization' },
              { key: 'settings', label: 'Settings', icon: '⚙️', route: '/system' },
            ].map((item) => (
              <button
                key={item.key}
                className={`intake-sidebar-item ${item.active ? 'active' : ''}`}
                onClick={() => {
                  if (item.key === 'waste') setTab('intake_cat');
                  else navigate(item.route);
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Bottom Area: Leaf Art + Tags */}
          <div className="intake-sidebar-footer">
            <SidebarLeafIllustration style={{ marginBottom: 10, opacity: 0.65 }} />
            <div className="intake-sidebar-tags">
              Less Waste<br />
              More Value<br />
              Greener Tomorrow
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="intake-main-area">
          {/* Side Accent Strip on Main Ground (Fix 4) */}
          <TornFabricSideStrip />

          {/* DEDICATED LANGUAGE SELECTION SCREEN */}
          {tab === 'lang' && (
            <div className="lang-select-container" style={{ position: 'relative', zIndex: 10 }}>
              <div className="persona-head">
                <GoldSpark style={{ width: 36, height: 36, margin: '0 auto 8px' }} />
                <h2>{t(lang, 'select_language')}</h2>
                <p>{t(lang, 'select_language_sub')}</p>
              </div>

              <div className="lang-grid">
                {LANGUAGES.map((l) => (
                  <div
                    key={l.code}
                    className={`lang-card ${lang === l.code ? 'selected' : ''}`}
                    onClick={() => onSelectLanguage(l.code)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectLanguage(l.code);
                    }}
                  >
                    <div className="native-script">{l.nativeName}</div>
                    <div className="lang-english">{l.name} ({l.region})</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <button className="btn-farmer" onClick={() => setTab('intake_cat')}>
                  {t(lang, 'continue_btn')}
                </button>
              </div>
            </div>
          )}

          {/* CATEGORY SELECTION SCREEN (4-GRID) */}
          {tab === 'intake_cat' && (
            <div className="lang-select-container" style={{ maxWidth: 740, position: 'relative', zIndex: 10 }}>
              <div className="persona-head">
                <GoldSpark style={{ width: 36, height: 36, margin: '0 auto 8px' }} />
                <h2>{t(lang, 'intake_cat_heading')}</h2>
              </div>

              <div className="persona-grid" style={{ gap: 16 }}>
                <div
                  className="persona-tile"
                  style={{ minHeight: 160, padding: 20 }}
                  onClick={() => handleSelectCategory('agri')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCategory('agri'); }}
                >
                  <HalftoneAgriWasteIcon size={56} />
                  <div className="tile-title">{t(lang, 'cat_agri_title')}</div>
                  <div className="tile-sub">{t(lang, 'cat_agri_sub')}</div>
                </div>

                <div
                  className="persona-tile"
                  style={{ minHeight: 160, padding: 20 }}
                  onClick={() => handleSelectCategory('muni')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCategory('muni'); }}
                >
                  <HalftoneMunicipalWasteIcon size={56} />
                  <div className="tile-title">{t(lang, 'cat_muni_title')}</div>
                  <div className="tile-sub">{t(lang, 'cat_muni_sub')}</div>
                </div>

                <div
                  className="persona-tile"
                  style={{ minHeight: 160, padding: 20 }}
                  onClick={() => handleSelectCategory('live')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCategory('live'); }}
                >
                  <HalftoneLivestockWasteIcon size={56} />
                  <div className="tile-title">{t(lang, 'cat_live_title')}</div>
                  <div className="tile-sub">{t(lang, 'cat_live_sub')}</div>
                </div>

                <div
                  className="persona-tile"
                  style={{ minHeight: 160, padding: 20 }}
                  onClick={() => handleSelectCategory('ind')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCategory('ind'); }}
                >
                  <HalftoneIndustrialWasteIcon size={56} />
                  <div className="tile-title">{t(lang, 'cat_ind_title')}</div>
                  <div className="tile-sub">{t(lang, 'cat_ind_sub')}</div>
                </div>
              </div>
            </div>
          )}

          {/* CHANGE 15: WASTE INTAKE FORM (LOCK TO EXACT REFERENCE LAYOUT) */}
          {tab === 'intake_wizard' && (
            <div style={{ position: 'relative', zIndex: 10 }}>
              {/* FORM HEADER: Back button top-left, Why We Ask top-right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--g-ink-muted)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 0,
                  }}
                  onClick={() => setTab('intake_cat')}
                >
                  ← Back
                </button>

                <button
                  onClick={() => setWhyAskOpen(!whyAskOpen)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--g-ink-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Why we ask ⓘ
                </button>
              </div>

              {/* PAGE TITLE & SUBHEADING */}
              <div style={{ marginBottom: 20 }}>
                {/* PAGE TITLE: Noticeably larger than reference image exception */}
                <h1 className="intake-page-title">
                  {activeCat === 'agri' && 'Agricultural Waste'}
                  {activeCat === 'muni' && 'Municipal Waste'}
                  {activeCat === 'live' && 'Livestock Waste'}
                  {activeCat === 'ind' && 'Industrial Waste'} · Waste Intake Form
                </h1>

                {/* SUBHEADING: Same normal size as reference image */}
                <p className="intake-page-subheading">
                  {activeCat === 'agri' && 'Help us understand the available agricultural waste in your area.'}
                  {activeCat === 'muni' && 'Help us understand the available municipal organic waste in your area.'}
                  {activeCat === 'live' && 'Help us understand the available livestock waste in your area.'}
                  {activeCat === 'ind' && 'Help us understand the available industrial byproduct waste in your area.'}
                </p>
              </div>

              {/* Collapsed "Why We Ask" Helper Box */}
              {whyAskOpen && (
                <div style={{
                  background: '#FFF9E8',
                  borderLeft: '4px solid var(--g-gold)',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 13,
                  color: 'var(--g-ink)',
                  lineHeight: 1.5,
                }}>
                  {activeCat === 'agri' && t(lang, 'why_ask_agri')}
                  {activeCat === 'muni' && t(lang, 'why_ask_muni')}
                  {activeCat === 'live' && t(lang, 'why_ask_live')}
                  {activeCat === 'ind' && t(lang, 'why_ask_ind')}
                </div>
              )}

              {/* Top Validation Error Banner */}
              {validationErrors.size > 0 && (
                <div
                  style={{
                    background: '#FDF2F0',
                    border: '2px solid #a3412b',
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 20,
                    color: '#a3412b',
                    fontWeight: 800,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20 }}>⚠</span>
                  <span>{t(lang, 'validation_summary_error')}</span>
                </div>
              )}

              {/* ONE UNIFIED WHITE PANEL CONTAINING TWO-COLUMN LAYOUT */}
              <SinglePageFormContent
                lang={lang}
                cat={activeCat}
                answers={answers}
                setAnswerKey={setAnswerKey}
                otherText={otherText}
                updateOtherText={updateOtherText}
                quantityVal={quantityVal}
                updateQuantityVal={updateQuantityVal}
                unitVal={unitVal}
                setUnitVal={setUnitVal}
                locationVal={locationVal}
                updateLocationVal={updateLocationVal}
                mapCaptured={mapCaptured}
                setMapCaptured={setMapCaptured}
                validationErrors={validationErrors}
                handleFormSubmit={handleFormSubmit}
              />

              {/* PAGE FOOTER (OUTSIDE PANEL) */}
              <div className="intake-page-footer">
                <div className="intake-footer-line-row">
                  <div className="intake-footer-rule" />
                  <span className="intake-footer-brand">@TERRAFLUX.NETWORK | HACKOUT'26 PS11</span>
                  <div className="intake-footer-rule" />
                </div>
                <div className="intake-footer-tags-row">
                  <span>🍃 Less Waste</span>
                  <span>|</span>
                  <span>♻️ More Value</span>
                  <span>|</span>
                  <span>🌐 Greener Tomorrow</span>
                </div>
              </div>
            </div>
          )}

          {/* HOME — "MY MATERIAL" */}
          {tab === 'home' && (
            <div className="gen-container" style={{ position: 'relative', zIndex: 10 }}>
              <div className="hero-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="hero-k">{t(lang, 'hero_available_label')}</div>
                  <button
                    className="btn-farmer secondary"
                    style={{ minHeight: 32, padding: '2px 10px', fontSize: 11, width: 'auto', margin: 0 }}
                    onClick={() => setTab('intake_cat')}
                  >
                    ✏ Edit Intake Answers
                  </button>
                </div>

                <div className="hero-v">{intakeSummary.quantity} {intakeSummary.unit} Available</div>
                <div className="hero-type">{intakeSummary.materialType} ({intakeSummary.category.toUpperCase()})</div>
                <div style={{ fontSize: 13, color: 'var(--g-forest)', fontWeight: 700, marginTop: 4 }}>
                  ✓ Location: {intakeSummary.location} · Moisture: {intakeSummary.moisture}
                </div>

                <div className="rec-box">
                  <span className="rec-badge-tag">★ {t(lang, 'rec_badge')} (sample estimate)</span>
                  <div className="rec-title">{pathwayData.biochar.name} → {pathwayData.biochar.facility}</div>
                  <div className="rec-meta">
                    {pathwayData.biochar.distanceKm} km haul · +{pathwayData.biochar.netCarbon} tCO₂e carbon saved · ₹{pathwayData.biochar.totalVal.toLocaleString()} estimated value
                  </div>

                  <button className="btn-farmer" onClick={() => setTab('pathways')}>
                    {t(lang, 'view_best_pathway_btn')}
                  </button>
                </div>
              </div>

              <div className="hero-card" style={{ background: '#FAF8F3', borderColor: 'var(--g-border)' }}>
                <div className="hero-k">{t(lang, 'quick_facts')}</div>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14, fontWeight: 600, color: 'var(--g-ink)', lineHeight: 1.6 }}>
                  <li>Material: {intakeSummary.materialType}</li>
                  <li>Moisture Level: {intakeSummary.moisture}</li>
                  <li>Intake Location: {intakeSummary.location}</li>
                </ul>
              </div>
            </div>
          )}

          {/* "BEST PATHWAY" */}
          {tab === 'pathways' && (
            <div className="gen-container" style={{ position: 'relative', zIndex: 10 }}>
              <div className="persona-head" style={{ textAlign: 'left', marginBottom: 16 }}>
                <h2>{t(lang, 'pathways_title')}</h2>
                <p>{t(lang, 'pathways_sub')}</p>
              </div>

              <div className="pathway-cards-grid">
                {(['biochar', 'biogas', 'compost'] as const).map((key) => {
                  const p = pathwayData[key];
                  const isSel = selectedPathway === key;
                  return (
                    <div
                      key={p.id}
                      className={`pathway-card ${p.recommended ? 'recommended' : ''}`}
                      onClick={() => setSelectedPathway(key)}
                      style={isSel ? { borderColor: 'var(--g-forest)', borderWidth: 3 } : undefined}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedPathway(key);
                      }}
                    >
                      <div className="pathway-head">
                        <div className="pathway-title">
                          {p.icon}
                          <div>
                            {p.name}
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g-ink-muted)' }}>
                              {p.facility}
                            </div>
                          </div>
                        </div>
                        {p.recommended && (
                          <span className="rec-badge-tag" style={{ margin: 0 }}>
                            ★ {t(lang, 'recommended_badge')}
                          </span>
                        )}
                      </div>

                      <div className="pathway-metrics">
                        <div className="pm-item">
                          <div className="pm-label">{t(lang, 'val_per_tonne')}</div>
                          <div className="pm-value">
                            ₹<CountUp value={p.valPerTonne} format={(v) => Math.round(v).toLocaleString()} />
                          </div>
                        </div>
                        <div className="pm-item">
                          <div className="pm-label">{t(lang, 'net_carbon')}</div>
                          <div className="pm-value" style={{ color: 'var(--g-forest)' }}>
                            +<CountUp value={p.netCarbon} dp={1} /> tCO₂e
                          </div>
                        </div>
                        <div className="pm-item">
                          <div className="pm-label">{t(lang, 'haul_distance')}</div>
                          <div className="pm-value">
                            <CountUp value={p.distanceKm} dp={1} /> km
                          </div>
                        </div>
                        <div className="pm-item">
                          <div className="pm-label">{t(lang, 'process_time')}</div>
                          <div className="pm-value" style={{ fontSize: 14 }}>
                            {p.processTime}
                          </div>
                        </div>
                      </div>

                      {p.reason && <div className="pathway-reason">{p.reason}</div>}
                    </div>
                  );
                })}
              </div>

              <div className="what-changed-box">
                <GoldSpark style={{ width: 32, height: 32, flex: 'none' }} />
                <div>
                  <div className="wc-title">{t(lang, 'what_changed_title')}</div>
                  <div className="wc-desc">
                    {selectedPathway === 'biochar' && 'Selected Biochar — Highest total value (₹12,400) and durable carbon (+4.8 tCO₂e).'}
                    {selectedPathway === 'biogas' && t(lang, 'delta_biochar_to_biogas')}
                    {selectedPathway === 'compost' && t(lang, 'delta_biochar_to_compost')}
                  </div>
                </div>
              </div>

              <button
                className="btn-farmer"
                style={{ marginTop: 20 }}
                onClick={() => setTab('journey')}
              >
                {t(lang, 'select_this_pathway')} ({activeP.name}) →
              </button>
            </div>
          )}

          {/* "FOLLOW MY TONNE" (MATERIAL JOURNEY) */}
          {tab === 'journey' && (
            <div className="gen-container" style={{ maxWidth: 720, position: 'relative', zIndex: 10 }}>
              <div className="persona-head" style={{ textAlign: 'left', marginBottom: 24 }}>
                <h2>{t(lang, 'journey_title')}</h2>
                <p>{t(lang, 'journey_sub')}</p>
              </div>

              <div style={{ position: 'relative', paddingLeft: 44, paddingBottom: 10 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 19,
                    top: 24,
                    bottom: 60,
                    width: 3,
                    background: 'var(--g-forest)',
                    opacity: 0.35,
                    borderRadius: 2,
                  }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {journeyNodes.map((node) => (
                    <div key={node.id} style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -44,
                          top: 18,
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: node.active ? 'var(--g-forest)' : '#EDE7DC',
                          border: `3px solid ${node.active ? 'var(--g-gold)' : 'var(--g-forest)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 800,
                          color: node.active ? '#FFFFFF' : 'var(--g-forest)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                          zIndex: 2,
                        }}
                      >
                        {node.stepNum}
                      </div>

                      <div
                        style={{
                          background: 'var(--g-white)',
                          border: `2px solid ${node.active ? 'var(--g-forest)' : 'var(--g-border)'}`,
                          borderRadius: 14,
                          padding: 20,
                          boxShadow: node.active ? '0 6px 18px rgba(61,107,78,0.14)' : 'var(--g-shadow)',
                          transition: 'all 160ms ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div className="node-icon-wrap" style={{ width: 44, height: 44, borderRadius: 10, background: '#F0F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            {node.icon}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <h4 style={{ fontSize: 17, fontWeight: 800, color: 'var(--g-forest)', margin: 0 }}>
                                Step {node.stepNum}: {node.title}
                              </h4>
                              {node.active && (
                                <span
                                  style={{
                                    background: 'var(--g-forest)',
                                    color: '#FFFFFF',
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: 12,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                  }}
                                >
                                  ● Active Processing Stage
                                </span>
                              )}
                            </div>

                            <p style={{ fontSize: 14, color: 'var(--g-ink)', margin: '0 0 12px', lineHeight: 1.45 }}>
                              {node.desc}
                            </p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid var(--g-border)' }}>
                              {node.facts.map((fact, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    background: '#F0F6F2',
                                    border: '1px solid #C4DCCE',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--g-forest-dark)',
                                  }}
                                >
                                  ✓ {fact}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn-farmer"
                style={{ marginTop: 24 }}
                onClick={() => setTab('home')}
              >
                {t(lang, 'nav_home')} →
              </button>
            </div>
          )}
        </main>
      </div>

      {/* PERSISTENT BOTTOM NAV BAR FOR MOBILE */}
      <nav className="gen-bottom-nav">
        <button
          className={`gen-nav-item ${tab === 'home' ? 'active' : ''}`}
          onClick={() => setTab('home')}
        >
          <HalftoneGeneratorIcon size={26} />
          <span>{t(lang, 'nav_home')}</span>
        </button>

        <button
          className={`gen-nav-item ${tab === 'pathways' ? 'active' : ''}`}
          onClick={() => setTab('pathways')}
        >
          <HalftoneBiocharIcon size={26} />
          <span>{t(lang, 'nav_pathway')}</span>
        </button>

        <button
          className={`gen-nav-item ${tab === 'journey' ? 'active' : ''}`}
          onClick={() => setTab('journey')}
        >
          <HalftoneFacilityIcon size={26} />
          <span>{t(lang, 'nav_journey')}</span>
        </button>
      </nav>
    </div>
  );
}

// ── SINGLE-PAGE QUESTIONNAIRE FORM COMPONENT ─────────────────────────────
interface SinglePageFormProps {
  lang: LanguageCode;
  cat: CategoryKey;
  answers: Record<string, string>;
  setAnswerKey: (k: string, v: string) => void;
  otherText: Record<string, string>;
  updateOtherText: (k: string, v: string) => void;
  quantityVal: number;
  updateQuantityVal: (v: number) => void;
  unitVal: string;
  setUnitVal: (v: string) => void;
  locationVal: string;
  updateLocationVal: (v: string) => void;
  mapCaptured: boolean;
  setMapCaptured: (v: boolean) => void;
  validationErrors: Set<string>;
  handleFormSubmit: () => void;
}

function SinglePageFormContent({
  lang,
  cat,
  answers,
  setAnswerKey,
  otherText,
  updateOtherText,
  quantityVal,
  updateQuantityVal,
  unitVal,
  setUnitVal,
  locationVal,
  updateLocationVal,
  mapCaptured,
  setMapCaptured,
  validationErrors,
  handleFormSubmit,
}: SinglePageFormProps) {
  const renderQuestion = (
    qKey: string,
    numStr: string,
    titleText: string,
    helperText: string | undefined,
    children: React.ReactNode
  ) => {
    const hasError = validationErrors.has(qKey) || validationErrors.has(`${qKey}_other`);
    return (
      <div
        key={qKey}
        className="intake-question-block"
        style={{
          padding: hasError ? '12px 14px' : 0,
          borderRadius: hasError ? 12 : 0,
          background: hasError ? '#FFF5F3' : 'transparent',
          border: hasError ? '2px solid #a3412b' : 'none',
          transition: 'all 160ms ease',
        }}
      >
        <h3 className="intake-question-title" style={{ color: hasError ? '#a3412b' : 'var(--g-ink)' }}>
          <span style={{ fontWeight: 800 }}>{numStr}</span> {titleText}
        </h3>
        {helperText && (
          <p className="intake-question-helper">
            {helperText}
          </p>
        )}
        {children}
        {hasError && (
          <div style={{ marginTop: 8, color: '#a3412b', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠</span>
            <span>
              {validationErrors.has(`${qKey}_other`)
                ? t(lang, 'field_required_other')
                : t(lang, 'field_required')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderPillOptions = (
    stepKey: string,
    options: { key: string; labelKey: string }[]
  ) => {
    const sel = answers[stepKey];
    return (
      <div className="intake-pill-row">
        {options.map((opt) => {
          const isSelected = sel === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              className={`intake-pill-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => setAnswerKey(stepKey, opt.key)}
            >
              <span>{t(lang, opt.labelKey)}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderOtherInput = (stepKey: string) => {
    if (answers[stepKey] !== 'opt_other') return null;
    const hasError = validationErrors.has(`${stepKey}_other`);
    return (
      <div style={{ marginTop: 10 }}>
        <input
          type="text"
          placeholder={t(lang, 'other_placeholder')}
          value={otherText[stepKey] || ''}
          onChange={(e) => updateOtherText(stepKey, e.target.value)}
          className="intake-input-text"
          style={{
            borderColor: hasError ? '#a3412b' : 'var(--g-border)',
            background: hasError ? '#FFF5F3' : '#FFFFFF',
          }}
        />
      </div>
    );
  };

  const renderQuantityField = (stepKey: string, numStr: string, titleKey: string, unitOptions: string[]) => {
    const hasError = validationErrors.has('quantity');
    return renderQuestion(
      stepKey,
      numStr,
      t(lang, titleKey),
      undefined,
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <input
          type="number"
          value={quantityVal || ''}
          onChange={(e) => updateQuantityVal(parseFloat(e.target.value) || 0)}
          style={{
            width: 140,
            padding: '10px 14px',
            fontSize: 18,
            fontWeight: 800,
            border: `2px solid ${hasError ? '#a3412b' : 'var(--g-border)'}`,
            borderRadius: 10,
            color: 'var(--g-forest)',
            boxSizing: 'border-box',
            background: hasError ? '#FFF5F3' : '#FFFFFF',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {unitOptions.map((u) => (
            <button
              key={u}
              type="button"
              className={`intake-pill-btn ${unitVal === u ? 'selected' : ''}`}
              onClick={() => setUnitVal(u)}
            >
              {t(lang, u)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLocationField = (stepKey: string, numStr: string, titleKey: string, sublabelKey: string) => {
    const hasError = validationErrors.has('location');
    return renderQuestion(
      stepKey,
      numStr,
      t(lang, titleKey),
      undefined,
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--g-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
          {t(lang, sublabelKey)}
        </label>
        <input
          type="text"
          value={locationVal}
          onChange={(e) => updateLocationVal(e.target.value)}
          placeholder={t(lang, 'location_district_placeholder')}
          className="intake-input-text"
          style={{
            borderColor: hasError ? '#a3412b' : 'var(--g-border)',
            background: hasError ? '#FFF5F3' : '#FFFFFF',
            marginBottom: 10,
          }}
        />
        <button
          type="button"
          className="intake-pill-btn"
          style={{ width: '100%', justifyContent: 'center', background: '#FFFFFF' }}
          onClick={() => setMapCaptured(!mapCaptured)}
        >
          {mapCaptured ? t(lang, 'map_location_captured') : t(lang, 'use_map_location')}
        </button>
      </div>
    );
  };

  // Determine left and right columns per category
  let leftColumnJSX: React.ReactNode = null;
  let rightColumnJSX: React.ReactNode = null;

  if (cat === 'agri') {
    leftColumnJSX = (
      <>
        {renderQuestion(
          'q1',
          '1.',
          t(lang, 'agri_q1_title'),
          `Examples: ${t(lang, 'agri_q1_helper')}`,
          <>
            {renderPillOptions('q1', [
              { key: 'opt_paddy_straw', labelKey: 'opt_paddy_straw' },
              { key: 'opt_wheat_straw', labelKey: 'opt_wheat_straw' },
              { key: 'opt_corn_stalks', labelKey: 'opt_corn_stalks' },
              { key: 'opt_husk', labelKey: 'opt_husk' },
              { key: 'opt_sugarcane_residue', labelKey: 'opt_sugarcane_residue' },
              { key: 'opt_pruning_waste', labelKey: 'opt_pruning_waste' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('q1')}
          </>
        )}

        {renderQuantityField('quantity', '2.', 'agri_q2_title', ['unit_tonnes', 'unit_kg'])}

        {renderLocationField('location', '3.', 'agri_q3_title', 'location_district_label')}
      </>
    );

    rightColumnJSX = (
      <>
        {renderQuestion(
          'availability',
          '4.',
          t(lang, 'agri_q4_title'),
          undefined,
          renderPillOptions('availability', [
            { key: 'opt_one_time', labelKey: 'opt_one_time' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_monthly', labelKey: 'opt_monthly' },
            { key: 'opt_year_round', labelKey: 'opt_year_round' },
          ])
        )}

        {renderQuestion(
          'moisture',
          '5.',
          t(lang, 'agri_q5_title'),
          undefined,
          renderPillOptions('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_moderately_wet', labelKey: 'opt_moderately_wet' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'disposition',
          '6.',
          t(lang, 'agri_q6_title'),
          undefined,
          <>
            {renderPillOptions('disposition', [
              { key: 'opt_burned', labelKey: 'opt_burned' },
              { key: 'opt_dumped', labelKey: 'opt_dumped' },
              { key: 'opt_stored', labelKey: 'opt_stored' },
              { key: 'opt_composting', labelKey: 'opt_composting' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('disposition')}
          </>
        )}
      </>
    );
  } else if (cat === 'muni') {
    leftColumnJSX = (
      <>
        {renderQuestion(
          'q1',
          '1.',
          t(lang, 'muni_q1_title'),
          `Examples: ${t(lang, 'muni_q1_helper')}`,
          <>
            {renderPillOptions('q1', [
              { key: 'opt_food_waste', labelKey: 'opt_food_waste' },
              { key: 'opt_market_waste', labelKey: 'opt_market_waste' },
              { key: 'opt_garden_waste', labelKey: 'opt_garden_waste' },
              { key: 'opt_mixed_organic', labelKey: 'opt_mixed_organic' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('q1')}
          </>
        )}

        {renderQuestion(
          'muni_source',
          '2.',
          t(lang, 'muni_q7_title'),
          undefined,
          renderPillOptions('muni_source', [
            { key: 'opt_residential', labelKey: 'opt_residential' },
            { key: 'opt_market', labelKey: 'opt_market' },
            { key: 'opt_public_facility', labelKey: 'opt_public_facility' },
            { key: 'opt_multiple_locations', labelKey: 'opt_multiple_locations' },
          ])
        )}

        {renderQuantityField('quantity', '3.', 'muni_q3_title', ['unit_tonnes_day', 'unit_tonnes_week', 'unit_tonnes_month'])}

        {renderLocationField('location', '4.', 'muni_q2_title', 'location_district_label')}
      </>
    );

    rightColumnJSX = (
      <>
        {renderQuestion(
          'muni_segregation',
          '5.',
          t(lang, 'muni_q4_title'),
          undefined,
          renderPillOptions('muni_segregation', [
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'opt_partially', labelKey: 'opt_partially' },
            { key: 'opt_no', labelKey: 'opt_no' },
          ])
        )}

        {renderQuestion(
          'moisture',
          '6.',
          t(lang, 'muni_q5_title'),
          undefined,
          renderPillOptions('moisture', [
            { key: 'opt_low', labelKey: 'opt_low' },
            { key: 'opt_medium', labelKey: 'opt_medium' },
            { key: 'opt_high', labelKey: 'opt_high' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'muni_contamination',
          '7.',
          t(lang, 'muni_q6_title'),
          undefined,
          renderPillOptions('muni_contamination', [
            { key: 'opt_very_little', labelKey: 'opt_very_little' },
            { key: 'opt_some_contaminants', labelKey: 'opt_some_contaminants' },
            { key: 'opt_high_contamination', labelKey: 'opt_high_contamination' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'disposition',
          '8.',
          t(lang, 'muni_q8_title'),
          undefined,
          <>
            {renderPillOptions('disposition', [
              { key: 'opt_daily', labelKey: 'opt_daily' },
              { key: 'opt_weekly', labelKey: 'opt_weekly' },
              { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('disposition')}
          </>
        )}
      </>
    );
  } else if (cat === 'live') {
    leftColumnJSX = (
      <>
        {renderQuestion(
          'q1',
          '1.',
          t(lang, 'live_q1_title'),
          `Examples: ${t(lang, 'live_q1_helper')}`,
          <>
            {renderPillOptions('q1', [
              { key: 'opt_cattle_dung', labelKey: 'opt_cattle_dung' },
              { key: 'opt_poultry_manure', labelKey: 'opt_poultry_manure' },
              { key: 'opt_dairy_waste', labelKey: 'opt_dairy_waste' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('q1')}
          </>
        )}

        {renderQuantityField('quantity', '2.', 'live_q2_title', ['unit_per_day', 'unit_per_month'])}

        {renderLocationField('location', '3.', 'location_district_label', 'location_district_label')}

        {renderQuestion(
          'live_facility',
          '4.',
          t(lang, 'live_q3_title'),
          undefined,
          <>
            {renderPillOptions('live_facility', [
              { key: 'opt_facility_farm', labelKey: 'opt_facility_farm' },
              { key: 'opt_facility_dairy', labelKey: 'opt_facility_dairy' },
              { key: 'opt_facility_poultry', labelKey: 'opt_facility_poultry' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('live_facility')}
          </>
        )}
      </>
    );

    rightColumnJSX = (
      <>
        {renderQuestion(
          'live_bedding',
          '5.',
          t(lang, 'live_q4_title'),
          undefined,
          <>
            {renderPillOptions('live_bedding', [
              { key: 'opt_no', labelKey: 'opt_no' },
              { key: 'opt_crop_residue', labelKey: 'opt_crop_residue' },
              { key: 'opt_food_waste', labelKey: 'opt_food_waste' },
              { key: 'opt_water_slurry', labelKey: 'opt_water_slurry' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('live_bedding')}
          </>
        )}

        {renderQuestion(
          'moisture',
          '6.',
          t(lang, 'live_q5_title'),
          undefined,
          renderPillOptions('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_semi_wet', labelKey: 'opt_semi_wet' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'disposition',
          '7.',
          t(lang, 'live_q7_title'),
          undefined,
          renderPillOptions('disposition', [
            { key: 'opt_composting', labelKey: 'opt_composting' },
            { key: 'opt_biogas_plant', labelKey: 'opt_biogas_plant' },
            { key: 'opt_agri_use', labelKey: 'opt_agri_use' },
            { key: 'opt_dumped', labelKey: 'opt_dumped' },
            { key: 'opt_no_current_use', labelKey: 'opt_no_current_use' },
          ])
        )}
      </>
    );
  } else if (cat === 'ind') {
    leftColumnJSX = (
      <>
        {renderQuestion(
          'q1',
          '1.',
          t(lang, 'ind_q1_title'),
          `Examples: ${t(lang, 'ind_q1_helper')}`,
          <>
            {renderPillOptions('q1', [
              { key: 'opt_press_mud', labelKey: 'opt_press_mud' },
              { key: 'opt_bagasse', labelKey: 'opt_bagasse' },
              { key: 'opt_food_processing', labelKey: 'opt_food_processing' },
              { key: 'opt_wood_biomass', labelKey: 'opt_wood_biomass' },
              { key: 'opt_organic_industrial', labelKey: 'opt_organic_industrial' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('q1')}
          </>
        )}

        {renderQuestion(
          'ind_organic',
          '2.',
          t(lang, 'ind_q5_title'),
          undefined,
          renderPillOptions('ind_organic', [
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'opt_partially', labelKey: 'opt_partially' },
            { key: 'opt_no', labelKey: 'opt_no' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuantityField('quantity', '3.', 'ind_q2_title', ['unit_tonnes_day', 'unit_tonnes_month'])}

        {renderLocationField('location', '4.', 'ind_q3_title', 'location_district_label')}
      </>
    );

    rightColumnJSX = (
      <>
        {renderQuestion(
          'moisture',
          '5.',
          t(lang, 'ind_q4_title'),
          undefined,
          renderPillOptions('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_medium', labelKey: 'opt_medium' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'ind_hazard',
          '6.',
          t(lang, 'ind_q6_title'),
          undefined,
          renderPillOptions('ind_hazard', [
            { key: 'opt_no', labelKey: 'opt_no' },
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])
        )}

        {renderQuestion(
          'availability',
          '7.',
          t(lang, 'ind_q7_title'),
          undefined,
          renderPillOptions('availability', [
            { key: 'opt_daily', labelKey: 'opt_daily' },
            { key: 'opt_weekly', labelKey: 'opt_weekly' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_one_time', labelKey: 'opt_one_time' },
          ])
        )}

        {renderQuestion(
          'disposition',
          '8.',
          t(lang, 'ind_q8_title'),
          undefined,
          <>
            {renderPillOptions('disposition', [
              { key: 'opt_sold', labelKey: 'opt_sold' },
              { key: 'opt_reused', labelKey: 'opt_reused' },
              { key: 'opt_dumped', labelKey: 'opt_dumped' },
              { key: 'opt_burned', labelKey: 'opt_burned' },
              { key: 'opt_composting', labelKey: 'opt_composting' },
              { key: 'opt_other', labelKey: 'opt_other' },
            ])}
            {renderOtherInput('disposition')}
          </>
        )}
      </>
    );
  }

  return (
    <div className="intake-unified-panel">
      <div className="intake-two-column-grid">
        {/* LEFT COLUMN */}
        <div>
          {leftColumnJSX}
        </div>

        {/* THIN VERTICAL DIVIDER LINE */}
        <div className="intake-column-divider" />

        {/* RIGHT COLUMN */}
        <div>
          {rightColumnJSX}

          {/* PANEL FOOTER: Thin divider line & Right-aligned submit button */}
          <div className="intake-panel-footer">
            <button
              type="button"
              className="intake-submit-btn"
              onClick={handleFormSubmit}
            >
              <span>Complete &amp; View Recommendation</span>
              <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
