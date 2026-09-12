/**
 * Handcrafted SVG halftone/screen-printed style icons & visual flourishes for TerraFlux
 * matching the 3 reference images:
 * - Image 1: Linen paper ground (#EDE7DC)
 * - Image 2: Forest green gingham pattern (#3D6B4E)
 * - Image 3: Ripped paper corners, bold forest green type, gold accent sparks (#F2B84C)
 */

export function GoldSpark({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={`gold-spark ${className}`} style={{ width: 44, height: 44, ...style }}>
      <g fill="#F2B84C">
        <rect x="44" y="5" width="12" height="90" rx="3" transform="rotate(0 50 50)" />
        <rect x="44" y="5" width="12" height="90" rx="3" transform="rotate(45 50 50)" />
        <rect x="44" y="5" width="12" height="90" rx="3" transform="rotate(90 50 50)" />
        <rect x="44" y="5" width="12" height="90" rx="3" transform="rotate(135 50 50)" />
      </g>
    </svg>
  );
}

export function TornGinghamCorner({ position = 'top-right' }: { position?: 'top-right' | 'bottom-left' }) {
  const isTopRight = position === 'top-right';
  return (
    <div
      className={`torn-corner ${position}`}
      style={{
        position: 'absolute',
        top: isTopRight ? 0 : 'auto',
        bottom: isTopRight ? 'auto' : 0,
        right: isTopRight ? 0 : 'auto',
        left: isTopRight ? 'auto' : 0,
        width: 140,
        height: 140,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}
    >
      <svg viewBox="0 0 140 140" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id="ginghamPattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#FFFFFF" />
            <rect width="10" height="10" fill="#3D6B4E" fillOpacity="0.85" />
            <rect x="10" y="10" width="10" height="10" fill="#3D6B4E" fillOpacity="0.85" />
            <rect x="10" y="0" width="10" height="10" fill="#2E523B" fillOpacity="0.95" />
            <rect x="0" y="10" width="10" height="10" fill="#2E523B" fillOpacity="0.95" />
          </pattern>
          <filter id="paperShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#2A2A22" floodOpacity="0.2" />
          </filter>
        </defs>
        {isTopRight ? (
          <path
            d="M 20 0 Q 35 15 50 5 Q 65 25 80 10 Q 95 30 110 15 Q 125 35 140 20 L 140 140 L 0 140 Z"
            fill="url(#ginghamPattern)"
            transform="rotate(90 70 70)"
            filter="url(#paperShadow)"
          />
        ) : (
          <path
            d="M 0 120 Q 15 105 30 115 Q 45 95 60 110 Q 75 90 90 105 Q 105 85 120 100 L 0 0 Z"
            fill="url(#ginghamPattern)"
            filter="url(#paperShadow)"
          />
        )}
      </svg>
    </div>
  );
}

export function ScallopedGinghamCorner({ position = 'top-left' }: { position?: 'top-left' | 'bottom-right' }) {
  const isTopLeft = position === 'top-left';
  return (
    <div
      className={`scalloped-corner ${position}`}
      style={{
        position: 'absolute',
        top: isTopLeft ? 0 : 'auto',
        bottom: isTopLeft ? 'auto' : 0,
        left: isTopLeft ? 0 : 'auto',
        right: isTopLeft ? 'auto' : 0,
        width: 'clamp(140px, 20vw, 240px)',
        height: 'clamp(140px, 20vw, 240px)',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      <svg viewBox="0 0 240 240" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id={`ginghamPatternScallop_${position}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#FFFFFF" />
            <rect width="10" height="10" fill="#3D6B4E" fillOpacity="0.85" />
            <rect x="10" y="10" width="10" height="10" fill="#3D6B4E" fillOpacity="0.85" />
            <rect x="10" y="0" width="10" height="10" fill="#2E523B" fillOpacity="0.95" />
            <rect x="0" y="10" width="10" height="10" fill="#2E523B" fillOpacity="0.95" />
          </pattern>
          <filter id={`paperShadowScallop_${position}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#2A2A22" floodOpacity="0.2" />
          </filter>
        </defs>
        {isTopLeft ? (
          <path
            d="M 0 0 L 0 220 A 32 32 0 0 1 44 176 A 32 32 0 0 1 88 132 A 32 32 0 0 1 132 88 A 32 32 0 0 1 176 44 A 32 32 0 0 1 220 0 L 0 0 Z"
            fill={`url(#ginghamPatternScallop_${position})`}
            filter={`url(#paperShadowScallop_${position})`}
          />
        ) : (
          <path
            d="M 240 240 L 240 20 A 32 32 0 0 1 196 64 A 32 32 0 0 1 152 108 A 32 32 0 0 1 108 152 A 32 32 0 0 1 64 196 A 32 32 0 0 1 20 240 L 240 240 Z"
            fill={`url(#ginghamPatternScallop_${position})`}
            filter={`url(#paperShadowScallop_${position})`}
          />
        )}
      </svg>
    </div>
  );
}

export function WelcomeBackgroundLandscape() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 220,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Far background soft hills */}
        <path
          d="M 0 160 Q 360 110 720 150 Q 1080 190 1440 130 L 1440 220 L 0 220 Z"
          fill="#E5ECE6"
          fillOpacity="0.75"
        />
        <path
          d="M 0 180 Q 400 140 800 170 Q 1200 150 1440 170 L 1440 220 L 0 220 Z"
          fill="#D8E4DA"
          fillOpacity="0.85"
        />

        {/* Left Side: Sprouting Plant / Leaves Illustration */}
        <g stroke="#3D6B4E" strokeWidth="2.5" fill="#3D6B4E" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
          <path d="M 120 185 C 80 150, 40 160, 45 200 C 75 205, 100 195, 120 185 Z" fill="#7B9C85" fillOpacity="0.4" />
          <path d="M 120 185 C 150 145, 190 155, 185 195 C 160 205, 135 195, 120 185 Z" fill="#7B9C85" fillOpacity="0.4" />
          <path d="M 120 220 Q 120 195 120 180" stroke="#3D6B4E" strokeWidth="3" fill="none" />
        </g>
        <g stroke="#3D6B4E" strokeWidth="2" fill="#3D6B4E" opacity="0.25">
          <path d="M 50 190 C 25 170, 0 175, 5 210 C 25 210, 40 200, 50 190 Z" fill="#98B4A1" />
        </g>

        {/* Right Side: Processing Facility / Factory Silhouette */}
        <g fill="#7B9C85" opacity="0.35">
          <path d="M 1120 200 L 1120 150 L 1170 150 L 1170 165 L 1220 165 L 1220 135 L 1280 135 L 1280 200 Z" />
          <rect x="1290" y="115" width="14" height="85" rx="1" fill="#3D6B4E" opacity="0.4" />
          <rect x="1310" y="125" width="10" height="75" rx="1" fill="#3D6B4E" opacity="0.3" />
          <circle cx="1297" cy="100" r="10" fill="#FFFFFF" opacity="0.7" />
          <circle cx="1302" cy="85" r="7" fill="#FFFFFF" opacity="0.6" />
          <circle cx="1315" cy="112" r="7" fill="#FFFFFF" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}


export function HalftoneDotPattern({ id = 'halftoneDots' }: { id?: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.5" fill="#3D6B4E" fillOpacity="0.25" />
    </pattern>
  );
}

export function HalftoneGeneratorIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotGen" />
      </defs>
      {/* Gold Highlight Burst */}
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      {/* Halftone BG circle */}
      <circle cx="50" cy="50" r="38" fill="url(#hDotGen)" />
      {/* Hand & Sprouting Plant */}
      <path
        d="M20 65 C30 55, 45 65, 60 60 C70 56, 80 62, 85 68 L80 80 L20 80 Z"
        fill="#3D6B4E"
      />
      <path
        d="M50 60 L50 30 M50 40 C40 32, 32 35, 30 45 C40 45, 48 42, 50 40 Z M50 35 C60 27, 68 30, 70 40 C60 40, 52 37, 50 35 Z"
        fill="#3D6B4E"
        stroke="#3D6B4E"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="22" r="5" fill="#F2B84C" />
    </svg>
  );
}

export function HalftoneFacilityIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotFac" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotFac)" />
      {/* Plant Silhouettes */}
      <path
        d="M22 78 L22 45 L38 45 L38 55 L54 55 L54 35 L70 35 L70 78 Z"
        fill="#3D6B4E"
      />
      {/* Chimneys */}
      <rect x="74" y="28" width="8" height="50" fill="#3D6B4E" />
      {/* Clean Vapour Puff */}
      <circle cx="78" cy="20" r="6" fill="#EDE7DC" stroke="#3D6B4E" strokeWidth="2" />
      <circle cx="84" cy="14" r="4" fill="#EDE7DC" stroke="#3D6B4E" strokeWidth="2" />
    </svg>
  );
}

export function HalftoneCarbonIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotCarb" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotCarb)" />
      {/* Carbon Leaf Shield */}
      <path
        d="M50 18 C30 18, 20 40, 20 62 C35 75, 65 75, 80 62 C80 40, 70 18, 50 18 Z"
        fill="#3D6B4E"
      />
      {/* Lock / 100yr Permanence Symbol */}
      <rect x="40" y="44" width="20" height="18" rx="3" fill="#EDE7DC" />
      <path d="M44 44 V38 C44 33, 56 33, 56 38 V44" fill="none" stroke="#EDE7DC" strokeWidth="3" />
    </svg>
  );
}

export function HalftoneEconomyIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotEcon" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotEcon)" />
      {/* Stacked Rupee Coins */}
      <circle cx="42" cy="62" r="18" fill="#3D6B4E" />
      <circle cx="58" cy="46" r="18" fill="#2E523B" stroke="#EDE7DC" strokeWidth="2" />
      <text x="58" y="52" textAnchor="middle" fill="#F2B84C" fontSize="18" fontWeight="bold" fontFamily="serif">₹</text>
    </svg>
  );
}

export function HalftoneBiocharIcon({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
      <circle cx="40" cy="40" r="34" fill="#F2B84C" fillOpacity="0.3" />
      {/* Charcoal Briquette */}
      <path d="M22 30 L40 18 L58 30 L58 52 L40 64 L22 52 Z" fill="#3D6B4E" />
      <path d="M40 18 L40 64 M22 30 L58 32 M22 52 L58 50" stroke="#EDE7DC" strokeWidth="2" />
    </svg>
  );
}

export function HalftoneBiogasIcon({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
      <circle cx="40" cy="40" r="34" fill="#F2B84C" fillOpacity="0.3" />
      {/* Tank & Flame */}
      <rect x="25" y="32" width="30" height="32" rx="6" fill="#3D6B4E" />
      <path d="M40 15 C34 25, 46 27, 40 35 C48 30, 44 20, 40 15 Z" fill="#F2B84C" />
    </svg>
  );
}

export function HalftoneCompostIcon({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
      <circle cx="40" cy="40" r="34" fill="#F2B84C" fillOpacity="0.3" />
      {/* Soil Mound & Sprout */}
      <path d="M15 58 C25 44, 55 44, 65 58 Z" fill="#3D6B4E" />
      <path d="M40 46 V30 M40 36 C34 30, 30 32, 28 38 C34 38, 38 36, 40 36 Z" fill="#3D6B4E" stroke="#3D6B4E" strokeWidth="2" />
    </svg>
  );
}

export function HalftoneAgriWasteIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotAgri" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotAgri)" />
      {/* Wheat Stalk / Crop */}
      <path d="M50 78 V24 M50 35 C42 28, 34 32, 32 40 C42 40, 48 37, 50 35 Z M50 35 C58 28, 66 32, 68 40 C58 40, 52 37, 50 35 Z M50 50 C40 43, 32 47, 30 55 C40 55, 48 52, 50 50 Z M50 50 C60 43, 68 47, 70 55 C60 55, 52 52, 50 50 Z M50 65 C42 58, 34 62, 32 70 C42 70, 48 67, 50 65 Z M50 65 C58 58, 66 62, 68 70 C58 70, 52 67, 50 65 Z" fill="#3D6B4E" stroke="#3D6B4E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HalftoneMunicipalWasteIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotMuni" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotMuni)" />
      {/* Cityscape Buildings & Bin */}
      <path d="M20 78 V45 H35 V78 M35 78 V32 H55 V78 M55 78 V50 H70 V78 M70 78 V40 H82 V78 Z" fill="#3D6B4E" />
      <rect x="25" y="52" width="5" height="7" fill="#EDE7DC" />
      <rect x="40" y="40" width="6" height="8" fill="#EDE7DC" />
      <rect x="40" y="54" width="6" height="8" fill="#EDE7DC" />
      <rect x="60" y="58" width="5" height="7" fill="#EDE7DC" />
      <circle cx="75" cy="65" r="12" fill="#F2B84C" stroke="#3D6B4E" strokeWidth="2" />
      <path d="M71 61 L79 61 L75 69 Z" fill="#3D6B4E" />
    </svg>
  );
}

export function HalftoneLivestockWasteIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotLive" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotLive)" />
      {/* Cattle / Cow Silhouette */}
      <path d="M22 68 V76 H28 V64 H44 V76 H50 V60 H66 C72 60, 76 56, 76 50 V42 L72 38 H64 V30 L54 36 H38 C30 36, 24 44, 22 52 Z" fill="#3D6B4E" />
      <path d="M72 38 L80 32 M76 36 L82 40" stroke="#3D6B4E" strokeWidth="3" strokeLinecap="round" />
      <circle cx="68" cy="42" r="2.5" fill="#EDE7DC" />
    </svg>
  );
}

export function HalftoneIndustrialWasteIcon({ size = 54 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <defs>
        <HalftoneDotPattern id="hDotInd" />
      </defs>
      <circle cx="50" cy="50" r="42" fill="#F2B84C" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="38" fill="url(#hDotInd)" />
      {/* Factory & Smokestack */}
      <path d="M20 78 V52 L36 62 V52 L52 62 V42 H72 V78 Z" fill="#3D6B4E" />
      <rect x="74" y="30" width="10" height="48" fill="#3D6B4E" />
      <circle cx="79" cy="22" r="6" fill="#EDE7DC" stroke="#3D6B4E" strokeWidth="2" />
      <circle cx="85" cy="16" r="4" fill="#EDE7DC" stroke="#3D6B4E" strokeWidth="2" />
    </svg>
  );
}
