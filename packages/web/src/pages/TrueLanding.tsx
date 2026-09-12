/**
 * CHANGE 7 — TRUE LANDING PAGE (/welcome) — DESKTOP POLISH PATCH
 *
 * Implements desktop polish fixes per target reference mock (Image 3):
 * 1. Desktop Alignment & Corner Accents: Centered vertical stack with balanced
 *    side margins; smooth scalloped edge checkered accents in top-left and bottom-right.
 * 2. Language Selector: Top-right compact dropdown control (🌐 EN ▾) with 4 languages.
 * 3. Primary Button: Simplified label "Select Role →" routing to Persona Landing (/entry).
 */

import { useState } from 'react';
import { useRouter } from '../router.tsx';
import { LANGUAGES, getSavedLanguage, saveLanguage, t, type LanguageCode } from '../i18n.ts';
import {
  HalftoneGeneratorIcon,
  ScallopedGinghamCorner,
  WelcomeBackgroundLandscape,
  GoldSpark,
} from '../components/FarmerIcons.tsx';

export default function TrueLanding() {
  const { navigate } = useRouter();
  const [lang, setLang] = useState<LanguageCode>(getSavedLanguage());
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const handleSelectLanguage = (code: LanguageCode) => {
    saveLanguage(code);
    setLang(code);
    setLangDropdownOpen(false);
  };

  return (
    <div
      className="generator-app"
      style={{
        minHeight: '100vh',
        width: '100%',
        padding: '50px 24px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Soft Landscape Vector Art */}
      <WelcomeBackgroundLandscape />

      {/* FIX 1: Smooth Scalloped Edge Corner Accents in Top-Left and Bottom-Right */}
      <ScallopedGinghamCorner position="top-left" />
      <ScallopedGinghamCorner position="bottom-right" />

      {/* FIX 2: Top-Right Language Selector Dropdown Control (🌐 EN ▾) */}
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

      {/* FIX 1: Centered Desktop Hero Stack */}
      <div
        style={{
          maxWidth: 680,
          width: '100%',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Top Centered Logo Lockup with Gold Spark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
          <GoldSpark style={{ width: 44, height: 44 }} />
          <HalftoneGeneratorIcon size={64} />
        </div>

        {/* Top-Center Eyebrow Text */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--g-forest)',
            marginBottom: 10,
          }}
        >
          {t(lang, 'welcome_eyebrow')}
        </div>

        {/* Main Heading */}
        <h1
          style={{
            fontSize: 'clamp(44px, 7vw, 76px)',
            fontWeight: 900,
            color: 'var(--g-forest)',
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            lineHeight: 1.0,
          }}
        >
          TERRAFLUX
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(18px, 2.5vw, 23px)',
            fontWeight: 800,
            color: 'var(--g-ink)',
            maxWidth: '44ch',
            margin: '0 auto 8px',
            lineHeight: 1.35,
          }}
        >
          {t(lang, 'welcome_subtitle')}
        </p>

        {/* Tagline (Matching Image 3) */}
        <p
          style={{
            fontSize: 'clamp(13px, 1.8vw, 15px)',
            fontWeight: 500,
            color: 'var(--g-ink-muted)',
            maxWidth: '50ch',
            margin: '0 auto 26px',
            lineHeight: 1.4,
          }}
        >
          {t(lang, 'welcome_tagline')}
        </p>

        {/* FIX 3: Primary CTA Button "Select Role" */}
        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto 20px' }}>
          <button
            className="btn-farmer"
            style={{ fontSize: 18, minHeight: 56, borderRadius: 14, margin: 0, width: '100%' }}
            onClick={() => navigate('/entry')}
          >
            {t(lang, 'select_role_btn')} →
          </button>
        </div>

        {/* Secondary Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          <button
            className="btn-farmer secondary"
            style={{ width: 'auto', minHeight: 44, padding: '8px 20px', fontSize: 14, margin: 0 }}
            onClick={() => navigate('/generator')}
          >
            🌾 {t(lang, 'farmer_app_btn')}
          </button>
          <button
            className="btn-farmer secondary"
            style={{ width: 'auto', minHeight: 44, padding: '8px 20px', fontSize: 14, margin: 0 }}
            onClick={() => navigate('/')}
          >
            🏭 {t(lang, 'control_tower_btn')}
          </button>
        </div>

        {/* Separator & Footer Copy */}
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            borderTop: '1px solid rgba(61, 107, 78, 0.25)',
            paddingTop: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--g-ink-muted)',
            }}
          >
            @TERRAFLUX.NETWORK  |  HACKOUT&apos;26 PS11
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--g-forest)',
            }}
          >
            <span>🍃 {t(lang, 'welcome_footer_left')}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>♻ {t(lang, 'welcome_footer_mid')}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>🌐 {t(lang, 'welcome_footer_right')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
