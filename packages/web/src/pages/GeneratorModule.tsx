/**
 * TERRAFLUX WASTE GENERATOR MODULE (FARMER-FIRST PREMIUM UX)
 *
 * Answers the single fundamental farmer question:
 *   "I have waste. What is the best thing I can do with it?"
 *
 * Implements:
 * - CHANGE 9: Visual Theme Consistency
 *     - Real paper texture ground across all screens
 *     - Smooth scalloped corner accents top-left and bottom-right (matching /welcome exactly)
 * - CHANGE 10: Persistent Top-Right Language Control
 *     - Compact "🌐 EN ▾" dropdown control on top-right of every screen
 *     - Removed "Language" item from bottom nav bar (now 3 clean items)
 * - CHANGE 8: Waste Intake Questionnaire v2 (4-category 2x2 grid, dynamic 1-step-at-a-time wizard)
 * - CHANGE 11: "Follow My Tonne" Material Journey Redesign
 *     - Single-page vertical connected timeline (dot markers + continuous connecting line)
 *     - All 6 steps visible at once (MY WASTE → COLLECTION → FACILITY → PROCESSING → CARBON → VALUE)
 *     - Always-visible inline detail chips (no "Tap for Facts" click required)
 *     - Step 4 active view highlight
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
  ScallopedGinghamCorner,
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
  const { state, optimization } = useTwin();
  const { navigate } = useRouter();
  const [lang, setLang] = useState<LanguageCode>(getSavedLanguage);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Default tab flow: if lang saved -> category intake, else lang selection
  const [tab, setTab] = useState<TabView>(() => {
    return localStorage.getItem('terraflux_generator_lang') ? 'intake_cat' : 'lang';
  });

  // Intake Questionnaire v2 Wizard State
  const [activeCat, setActiveCat] = useState<CategoryKey>('agri');
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [quantityVal, setQuantityVal] = useState<number>(8.4);
  const [unitVal, setUnitVal] = useState<string>('tonnes');
  const [locationVal, setLocationVal] = useState<string>('Batala, Gurdaspur');
  const [mapCaptured, setMapCaptured] = useState<boolean>(false);
  const [whyAskOpen, setWhyAskOpen] = useState<boolean>(false);

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
    setWizardStep(1);
    setAnswers({});
    setOtherText({});
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

  // CHANGE 11: All 6 Material Journey Connected Timeline Nodes (Inline Detail, No Tap Needed)
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
      active: true, // Visual emphasis highlight as active processing stage
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

  // Total steps definition for each category
  const totalStepsMap: Record<CategoryKey, number> = {
    agri: 6,
    muni: 8,
    live: 7,
    ind: 8,
  };

  const totalSteps = totalStepsMap[activeCat];

  const handleNextStep = () => {
    if (wizardStep < totalSteps) {
      setWizardStep(wizardStep + 1);
      setWhyAskOpen(false);
    } else {
      const selectedType = answers['q1'] === 'opt_other' ? (otherText['q1'] || 'Other Waste') : (t(lang, answers['q1']) || 'Residue');
      setIntakeSummary({
        category: activeCat,
        materialType: selectedType,
        quantity: quantityVal,
        unit: unitVal,
        location: locationVal,
        moisture: t(lang, answers['moisture'] || 'opt_dry'),
        disposition: answers['disposition'] ? t(lang, answers['disposition']) : undefined,
      });
      setTab('home');
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
      setWhyAskOpen(false);
    } else {
      setTab('intake_cat');
    }
  };

  const setAnswerKey = (stepKey: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [stepKey]: val }));
  };

  return (
    <div className="generator-app" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* CHANGE 9: Smooth Scalloped Corner Accents Top-Left and Bottom-Right (Matching /welcome) */}
      <ScallopedGinghamCorner position="top-left" />
      <ScallopedGinghamCorner position="bottom-right" />

      {/* CHANGE 10: Persistent Top-Right Language Selector Dropdown (🌐 EN ▾) */}
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

      {/* Persistent Farmer Header */}
      <header className="gen-header" style={{ position: 'relative', zIndex: 10 }}>
        <div className="gen-brand">
          <h1>TERRAFLUX</h1>
          <span className="gen-brand-sub">{t(lang, 'farmer_module_title')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sync-badge">
            <span className="dot" />
            <span>{t(lang, 'synced_status')}</span>
          </div>
          <button
            className="btn-farmer secondary"
            style={{ minHeight: 36, padding: '2px 10px', fontSize: 12, width: 'auto', margin: 0 }}
            onClick={() => navigate('/entry')}
          >
            {t(lang, 'back_to_entry')}
          </button>
        </div>
      </header>

      {/* ── SECTION 2: DEDICATED LANGUAGE SELECTION ────────────────────────── */}
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

      {/* ── CHANGE 8: STEP 0 — CATEGORY SELECTION SCREEN ────────────────────── */}
      {tab === 'intake_cat' && (
        <div className="lang-select-container" style={{ maxWidth: 740, position: 'relative', zIndex: 10 }}>
          <div className="persona-head">
            <GoldSpark style={{ width: 36, height: 36, margin: '0 auto 8px' }} />
            <h2>{t(lang, 'intake_cat_heading')}</h2>
          </div>

          <div className="persona-grid" style={{ gap: 16 }}>
            {/* 1. Agricultural Waste */}
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

            {/* 2. Municipal Waste */}
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

            {/* 3. Livestock Waste */}
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

            {/* 4. Industrial Waste */}
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

      {/* ── CHANGE 8: DYNAMIC QUESTION WIZARD (ONE STEP AT A TIME) ─────────── */}
      {tab === 'intake_wizard' && (
        <div className="gen-container" style={{ maxWidth: 680, position: 'relative', zIndex: 10 }}>
          {/* Top Wizard Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button
              className="btn-farmer secondary"
              style={{ minHeight: 38, padding: '4px 14px', fontSize: 13, width: 'auto', margin: 0 }}
              onClick={handlePrevStep}
            >
              {t(lang, 'btn_back_step')}
            </button>

            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--g-forest)', letterSpacing: '0.06em' }}>
              Step {wizardStep} of {totalSteps}
            </span>

            {/* Why we ask collapsed affordance */}
            <button
              onClick={() => setWhyAskOpen(!whyAskOpen)}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--g-ink-muted)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {t(lang, 'why_we_ask')}
            </button>
          </div>

          {/* Collapsed "Why We Ask" Helper Box */}
          {whyAskOpen && (
            <div style={{ background: '#FFF9E8', borderLeft: '4px solid var(--g-gold)', padding: '10px 14px', borderRadius: 6, marginBottom: 18, fontSize: 13, color: 'var(--g-ink)' }}>
              {activeCat === 'agri' && t(lang, 'why_ask_agri')}
              {activeCat === 'muni' && t(lang, 'why_ask_muni')}
              {activeCat === 'live' && t(lang, 'why_ask_live')}
              {activeCat === 'ind' && t(lang, 'why_ask_ind')}
            </div>
          )}

          {/* Render Active Category Step Content */}
          <WizardStepContent
            lang={lang}
            cat={activeCat}
            step={wizardStep}
            answers={answers}
            setAnswerKey={setAnswerKey}
            otherText={otherText}
            setOtherText={setOtherText}
            quantityVal={quantityVal}
            setQuantityVal={setQuantityVal}
            unitVal={unitVal}
            setUnitVal={setUnitVal}
            locationVal={locationVal}
            setLocationVal={setLocationVal}
            mapCaptured={mapCaptured}
            setMapCaptured={setMapCaptured}
          />

          {/* Bottom Primary Wizard Action */}
          <div style={{ marginTop: 28 }}>
            <button className="btn-farmer" onClick={handleNextStep}>
              {wizardStep < totalSteps ? t(lang, 'btn_next_step') : t(lang, 'btn_complete_intake')}
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 3: HOME — "MY MATERIAL" ───────────────────────────────── */}
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

      {/* ── SECTION 4 & 8: "BEST PATHWAY" ─────────────────────────────────── */}
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

          {/* Section 8: Micro-interaction Delta Callout */}
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

      {/* ── CHANGE 11: "FOLLOW MY TONNE" (MATERIAL JOURNEY CONNECTED TIMELINE) ─ */}
      {tab === 'journey' && (
        <div className="gen-container" style={{ maxWidth: 720, position: 'relative', zIndex: 10 }}>
          <div className="persona-head" style={{ textAlign: 'left', marginBottom: 24 }}>
            <h2>{t(lang, 'journey_title')}</h2>
            <p>{t(lang, 'journey_sub')}</p>
          </div>

          {/* Single-Page Connected Vertical Timeline Container */}
          <div style={{ position: 'relative', paddingLeft: 44, paddingBottom: 10 }}>
            {/* Continuous Vertical Guide Line linking all 6 step markers */}
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

            {/* Render all 6 steps visible at once */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {journeyNodes.map((node) => (
                <div key={node.id} style={{ position: 'relative' }}>
                  {/* Step Dot Marker on Vertical Line */}
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

                  {/* Step Card with Always-Visible Inline Facts */}
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

                        {/* Always-Visible Inline Stat Chips (No Tap Needed) */}
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

      {/* ── CHANGE 10: FARMER PERSISTENT BOTTOM NAV BAR (3 CLEAN ITEMS) ─────── */}
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

// ── WIZARD STEP CONTENT COMPONENT ──────────────────────────────────────────
interface WizardStepProps {
  lang: LanguageCode;
  cat: CategoryKey;
  step: number;
  answers: Record<string, string>;
  setAnswerKey: (k: string, v: string) => void;
  otherText: Record<string, string>;
  setOtherText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quantityVal: number;
  setQuantityVal: (v: number) => void;
  unitVal: string;
  setUnitVal: (v: string) => void;
  locationVal: string;
  setLocationVal: (v: string) => void;
  mapCaptured: boolean;
  setMapCaptured: (v: boolean) => void;
}

function WizardStepContent({
  lang,
  cat,
  step,
  answers,
  setAnswerKey,
  otherText,
  setOtherText,
  quantityVal,
  setQuantityVal,
  unitVal,
  setUnitVal,
  locationVal,
  setLocationVal,
  mapCaptured,
  setMapCaptured,
}: WizardStepProps) {
  const renderOptionCards = (
    stepKey: string,
    options: { key: string; labelKey: string }[]
  ) => {
    const sel = answers[stepKey];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
        {options.map((opt) => {
          const isSelected = sel === opt.key;
          return (
            <div
              key={opt.key}
              onClick={() => setAnswerKey(stepKey, opt.key)}
              style={{
                background: isSelected ? '#F0F6F2' : 'var(--g-white)',
                border: `2px solid ${isSelected ? 'var(--g-forest)' : 'var(--g-border)'}`,
                borderRadius: 12,
                padding: '16px 14px',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: isSelected ? 800 : 600,
                color: isSelected ? 'var(--g-forest)' : 'var(--g-ink)',
                fontSize: 14,
                boxShadow: isSelected ? '0 4px 12px rgba(61,107,78,0.12)' : 'none',
                transition: 'all 120ms ease',
              }}
            >
              <span>{t(lang, opt.labelKey)}</span>
              {isSelected && <span style={{ fontSize: 16, color: 'var(--g-forest)' }}>✓</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderOtherText = (stepKey: string) => {
    if (answers[stepKey] !== 'opt_other') return null;
    return (
      <div style={{ marginTop: 14 }}>
        <input
          type="text"
          placeholder={t(lang, 'other_placeholder')}
          value={otherText[stepKey] || ''}
          onChange={(e) => setOtherText((prev) => ({ ...prev, [stepKey]: e.target.value }))}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 15,
            border: '2px solid var(--g-forest)',
            borderRadius: 10,
            background: '#FFFFFF',
            color: 'var(--g-ink)',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  };

  const renderLocationStep = (titleKey: string) => {
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
          {t(lang, titleKey)}
        </h2>
        <div style={{ background: 'var(--g-white)', border: '2px solid var(--g-border)', borderRadius: 14, padding: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--g-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
            {t(lang, 'location_district_label')}
          </label>
          <input
            type="text"
            value={locationVal}
            onChange={(e) => setLocationVal(e.target.value)}
            placeholder={t(lang, 'location_district_placeholder')}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 16,
              fontWeight: 700,
              border: '2px solid var(--g-border)',
              borderRadius: 10,
              boxSizing: 'border-box',
              marginBottom: 16,
            }}
          />

          <button
            className="btn-farmer secondary"
            style={{ width: '100%', minHeight: 46, fontSize: 14, margin: 0 }}
            onClick={() => setMapCaptured(!mapCaptured)}
          >
            {mapCaptured ? t(lang, 'map_location_captured') : t(lang, 'use_map_location')}
          </button>
        </div>
      </div>
    );
  };

  const renderQuantityStep = (
    titleKey: string,
    unitOptions: string[]
  ) => {
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
          {t(lang, titleKey)}
        </h2>
        <div style={{ background: 'var(--g-white)', border: '2px solid var(--g-border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="number"
              value={quantityVal}
              onChange={(e) => setQuantityVal(parseFloat(e.target.value) || 0)}
              style={{
                flex: 1,
                padding: '14px 18px',
                fontSize: 24,
                fontWeight: 800,
                border: '2px solid var(--g-forest)',
                borderRadius: 12,
                color: 'var(--g-forest)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {unitOptions.map((u) => (
                <button
                  key={u}
                  className={`btn-farmer ${unitVal === u ? '' : 'secondary'}`}
                  style={{ minHeight: 48, padding: '8px 16px', fontSize: 14, width: 'auto', margin: 0 }}
                  onClick={() => setUnitVal(u)}
                >
                  {t(lang, u)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (cat === 'agri') {
    if (step === 1) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 6px' }}>
            {t(lang, 'agri_q1_title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--g-ink-muted)', margin: '0 0 16px' }}>
            Examples: {t(lang, 'agri_q1_helper')}
          </p>
          {renderOptionCards('q1', [
            { key: 'opt_paddy_straw', labelKey: 'opt_paddy_straw' },
            { key: 'opt_wheat_straw', labelKey: 'opt_wheat_straw' },
            { key: 'opt_corn_stalks', labelKey: 'opt_corn_stalks' },
            { key: 'opt_husk', labelKey: 'opt_husk' },
            { key: 'opt_sugarcane_residue', labelKey: 'opt_sugarcane_residue' },
            { key: 'opt_pruning_waste', labelKey: 'opt_pruning_waste' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('q1')}
        </div>
      );
    }
    if (step === 2) return renderQuantityStep('agri_q2_title', ['unit_tonnes', 'unit_kg']);
    if (step === 3) return renderLocationStep('agri_q3_title');
    if (step === 4) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'agri_q4_title')}
          </h2>
          {renderOptionCards('availability', [
            { key: 'opt_one_time', labelKey: 'opt_one_time' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_monthly', labelKey: 'opt_monthly' },
            { key: 'opt_year_round', labelKey: 'opt_year_round' },
          ])}
        </div>
      );
    }
    if (step === 5) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'agri_q5_title')}
          </h2>
          {renderOptionCards('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_moderately_wet', labelKey: 'opt_moderately_wet' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 6) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'agri_q6_title')}
          </h2>
          {renderOptionCards('disposition', [
            { key: 'opt_burned', labelKey: 'opt_burned' },
            { key: 'opt_dumped', labelKey: 'opt_dumped' },
            { key: 'opt_stored', labelKey: 'opt_stored' },
            { key: 'opt_composting', labelKey: 'opt_composting' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('disposition')}
        </div>
      );
    }
  }

  if (cat === 'muni') {
    if (step === 1) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 6px' }}>
            {t(lang, 'muni_q1_title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--g-ink-muted)', margin: '0 0 16px' }}>
            Examples: {t(lang, 'muni_q1_helper')}
          </p>
          {renderOptionCards('q1', [
            { key: 'opt_food_waste', labelKey: 'opt_food_waste' },
            { key: 'opt_market_waste', labelKey: 'opt_market_waste' },
            { key: 'opt_garden_waste', labelKey: 'opt_garden_waste' },
            { key: 'opt_mixed_organic', labelKey: 'opt_mixed_organic' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('q1')}
        </div>
      );
    }
    if (step === 2) return renderLocationStep('muni_q2_title');
    if (step === 3) return renderQuantityStep('muni_q3_title', ['unit_tonnes_day', 'unit_tonnes_week', 'unit_tonnes_month']);
    if (step === 4) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'muni_q4_title')}
          </h2>
          {renderOptionCards('segregated', [
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'opt_partially', labelKey: 'opt_partially' },
            { key: 'opt_no', labelKey: 'opt_no' },
          ])}
        </div>
      );
    }
    if (step === 5) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'muni_q5_title')}
          </h2>
          {renderOptionCards('moisture', [
            { key: 'opt_low', labelKey: 'opt_low' },
            { key: 'opt_medium', labelKey: 'opt_medium' },
            { key: 'opt_high', labelKey: 'opt_high' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 6) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'muni_q6_title')}
          </h2>
          {renderOptionCards('contaminants', [
            { key: 'opt_very_little', labelKey: 'opt_very_little' },
            { key: 'opt_some_contaminants', labelKey: 'opt_some_contaminants' },
            { key: 'opt_high_contamination', labelKey: 'opt_high_contamination' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 7) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'muni_q7_title')}
          </h2>
          {renderOptionCards('source_type', [
            { key: 'opt_residential', labelKey: 'opt_residential' },
            { key: 'opt_market', labelKey: 'opt_market' },
            { key: 'opt_public_facility', labelKey: 'opt_public_facility' },
            { key: 'opt_multiple_locations', labelKey: 'opt_multiple_locations' },
          ])}
        </div>
      );
    }
    if (step === 8) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'muni_q8_title')}
          </h2>
          {renderOptionCards('frequency', [
            { key: 'opt_daily', labelKey: 'opt_daily' },
            { key: 'opt_weekly', labelKey: 'opt_weekly' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('frequency')}
        </div>
      );
    }
  }

  if (cat === 'live') {
    if (step === 1) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 6px' }}>
            {t(lang, 'live_q1_title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--g-ink-muted)', margin: '0 0 16px' }}>
            Examples: {t(lang, 'live_q1_helper')}
          </p>
          {renderOptionCards('q1', [
            { key: 'opt_cattle_dung', labelKey: 'opt_cattle_dung' },
            { key: 'opt_poultry_manure', labelKey: 'opt_poultry_manure' },
            { key: 'opt_dairy_waste', labelKey: 'opt_dairy_waste' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('q1')}
        </div>
      );
    }
    if (step === 2) return renderQuantityStep('live_q2_title', ['unit_per_day', 'unit_per_month']);
    if (step === 3) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'live_q3_title')}
          </h2>
          {renderOptionCards('facility_type', [
            { key: 'opt_facility_farm', labelKey: 'opt_facility_farm' },
            { key: 'opt_facility_dairy', labelKey: 'opt_facility_dairy' },
            { key: 'opt_facility_poultry', labelKey: 'opt_facility_poultry' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('facility_type')}
          <div style={{ marginTop: 20 }}>
            {renderLocationStep('location_district_label')}
          </div>
        </div>
      );
    }
    if (step === 4) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'live_q4_title')}
          </h2>
          {renderOptionCards('mixed', [
            { key: 'opt_no', labelKey: 'opt_no' },
            { key: 'opt_crop_residue', labelKey: 'opt_crop_residue' },
            { key: 'opt_food_waste', labelKey: 'opt_food_waste' },
            { key: 'opt_water_slurry', labelKey: 'opt_water_slurry' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('mixed')}
        </div>
      );
    }
    if (step === 5) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'live_q5_title')}
          </h2>
          {renderOptionCards('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_semi_wet', labelKey: 'opt_semi_wet' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 6) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'live_q6_title')}
          </h2>
          {renderOptionCards('continuous', [
            { key: 'opt_daily', labelKey: 'opt_daily' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_irregular', labelKey: 'opt_irregular' },
          ])}
        </div>
      );
    }
    if (step === 7) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'live_q7_title')}
          </h2>
          {renderOptionCards('disposition', [
            { key: 'opt_composting', labelKey: 'opt_composting' },
            { key: 'opt_biogas_plant', labelKey: 'opt_biogas_plant' },
            { key: 'opt_agri_use', labelKey: 'opt_agri_use' },
            { key: 'opt_dumped', labelKey: 'opt_dumped' },
            { key: 'opt_no_current_use', labelKey: 'opt_no_current_use' },
          ])}
        </div>
      );
    }
  }

  if (cat === 'ind') {
    if (step === 1) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 6px' }}>
            {t(lang, 'ind_q1_title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--g-ink-muted)', margin: '0 0 16px' }}>
            Examples: {t(lang, 'ind_q1_helper')}
          </p>
          {renderOptionCards('q1', [
            { key: 'opt_press_mud', labelKey: 'opt_press_mud' },
            { key: 'opt_bagasse', labelKey: 'opt_bagasse' },
            { key: 'opt_food_processing', labelKey: 'opt_food_processing' },
            { key: 'opt_wood_biomass', labelKey: 'opt_wood_biomass' },
            { key: 'opt_organic_industrial', labelKey: 'opt_organic_industrial' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('q1')}
        </div>
      );
    }
    if (step === 2) return renderQuantityStep('ind_q2_title', ['unit_tonnes_day', 'unit_tonnes_month']);
    if (step === 3) return renderLocationStep('ind_q3_title');
    if (step === 4) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'ind_q4_title')}
          </h2>
          {renderOptionCards('moisture', [
            { key: 'opt_dry', labelKey: 'opt_dry' },
            { key: 'opt_medium', labelKey: 'opt_medium' },
            { key: 'opt_very_wet', labelKey: 'opt_very_wet' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 5) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'ind_q5_title')}
          </h2>
          {renderOptionCards('biodegradable', [
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'opt_partially', labelKey: 'opt_partially' },
            { key: 'opt_no', labelKey: 'opt_no' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 6) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'ind_q6_title')}
          </h2>
          {renderOptionCards('hazardous', [
            { key: 'opt_no', labelKey: 'opt_no' },
            { key: 'opt_yes', labelKey: 'opt_yes' },
            { key: 'dont_know', labelKey: 'dont_know' },
          ])}
        </div>
      );
    }
    if (step === 7) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'ind_q7_title')}
          </h2>
          {renderOptionCards('frequency', [
            { key: 'opt_daily', labelKey: 'opt_daily' },
            { key: 'opt_weekly', labelKey: 'opt_weekly' },
            { key: 'opt_seasonal', labelKey: 'opt_seasonal' },
            { key: 'opt_one_time', labelKey: 'opt_one_time' },
          ])}
        </div>
      );
    }
    if (step === 8) {
      return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--g-forest)', margin: '0 0 16px' }}>
            {t(lang, 'ind_q8_title')}
          </h2>
          {renderOptionCards('disposition', [
            { key: 'opt_sold', labelKey: 'opt_sold' },
            { key: 'opt_reused', labelKey: 'opt_reused' },
            { key: 'opt_dumped', labelKey: 'opt_dumped' },
            { key: 'opt_burned', labelKey: 'opt_burned' },
            { key: 'opt_composting', labelKey: 'opt_composting' },
            { key: 'opt_other', labelKey: 'opt_other' },
          ])}
          {renderOtherText('disposition')}
        </div>
      );
    }
  }

  return null;
}
