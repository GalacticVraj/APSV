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

export interface GinghamCornerProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  style?: React.CSSProperties;
}

export function TornGinghamCorner({ position = 'top-left', className = '', style = {} }: GinghamCornerProps) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  return (
    <div
      className={`torn-corner ${position} ${className}`}
      style={{
        position: 'absolute',
        top: isTop ? 0 : 'auto',
        bottom: isTop ? 'auto' : 0,
        left: isLeft ? 0 : 'auto',
        right: isLeft ? 'auto' : 0,
        width: 'clamp(220px, 26vw, 360px)',
        height: 'clamp(220px, 26vw, 360px)',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          {/* Photorealistic Gingham Fabric Check Pattern with Visible Weave */}
          <pattern id={`ginghamFabricPattern_${position}`} width="60" height="60" patternUnits="userSpaceOnUse">
            <image href="/gingham-fabric.jpg" width="60" height="60" preserveAspectRatio="xMidYMid slice" />
          </pattern>

          {/* Realistic Torn Paper Layer Drop Shadow */}
          <filter id={`tornPaperShadow_${position}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#14181A" floodOpacity="0.28" />
          </filter>
        </defs>

        {position === 'top-left' && (
          <path
            d="M 0 0 L 0 295 L 14 286 L 22 292 L 36 274 L 48 280 L 64 256 L 76 262 L 94 238 L 108 244 L 126 218 L 142 224 L 160 196 L 176 202 L 195 174 L 210 180 L 228 152 L 244 158 L 262 130 L 276 136 L 292 108 L 304 114 L 316 0 Z"
            fill={`url(#ginghamFabricPattern_${position})`}
            filter={`url(#tornPaperShadow_${position})`}
          />
        )}
        {position === 'bottom-right' && (
          <path
            d="M 320 320 L 320 25 L 306 34 L 298 28 L 284 46 L 272 40 L 256 64 L 244 58 L 226 82 L 212 76 L 194 102 L 178 96 L 160 124 L 144 118 L 125 146 L 110 140 L 92 168 L 76 162 L 58 190 L 44 184 L 28 212 L 16 206 L 0 320 Z"
            fill={`url(#ginghamFabricPattern_${position})`}
            filter={`url(#tornPaperShadow_${position})`}
          />
        )}
        {position === 'top-right' && (
          <path
            d="M 320 0 L 320 295 L 306 286 L 298 292 L 284 274 L 272 280 L 256 256 L 244 262 L 226 238 L 212 244 L 194 218 L 178 224 L 160 196 L 144 202 L 125 174 L 110 180 L 92 152 L 76 158 L 58 130 L 44 136 L 28 108 L 16 114 L 0 0 Z"
            fill={`url(#ginghamFabricPattern_${position})`}
            filter={`url(#tornPaperShadow_${position})`}
          />
        )}
        {position === 'bottom-left' && (
          <path
            d="M 0 320 L 0 25 L 14 34 L 22 28 L 36 46 L 48 40 L 64 64 L 76 58 L 94 82 L 108 76 L 126 102 L 142 96 L 160 124 L 176 118 L 195 146 L 210 140 L 228 168 L 244 162 L 262 190 L 276 184 L 292 212 L 304 206 L 320 320 Z"
            fill={`url(#ginghamFabricPattern_${position})`}
            filter={`url(#tornPaperShadow_${position})`}
          />
        )}
      </svg>
    </div>
  );
}

// Re-export ScallopedGinghamCorner pointing to TornGinghamCorner (supersedes smooth scallops sitewide per Change 12)
export const ScallopedGinghamCorner = TornGinghamCorner;

export function SidebarLeafIllustration({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 120" style={{ width: 64, height: 76, display: 'block', ...style }}>
      <g stroke="#3D6B4E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
        <path d="M 20 110 C 25 80, 45 50, 75 20" />
        <path d="M 32 90 C 15 85, 10 70, 22 65 C 32 75, 30 85, 32 90 Z" fill="#7B9C85" fillOpacity="0.4" />
        <path d="M 45 72 C 60 65, 65 50, 52 48 C 43 58, 44 68, 45 72 Z" fill="#7B9C85" fillOpacity="0.4" />
        <path d="M 58 52 C 40 45, 38 30, 48 26 C 58 35, 57 45, 58 52 Z" fill="#7B9C85" fillOpacity="0.4" />
        <path d="M 68 35 C 80 25, 82 10, 70 12 C 62 20, 64 30, 68 35 Z" fill="#7B9C85" fillOpacity="0.4" />
      </g>
    </svg>
  );
}

/* CHANGE 16: NEW SIDE STRIP ACCENTS & REGIONAL CHOROPLETH MAP */
export function GinghamSideStrip({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 'clamp(32px, 3.5vw, 48px)',
        zIndex: 15,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg viewBox="0 0 48 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id="ginghamSidePattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#EBF2EE" />
            <rect width="20" height="20" fill="#3D6B4E" fillOpacity="0.75" />
            <rect x="20" y="20" width="20" height="20" fill="#3D6B4E" fillOpacity="0.75" />
            <rect x="20" y="0" width="20" height="20" fill="#75A083" fillOpacity="0.45" />
            <rect x="0" y="20" width="20" height="20" fill="#75A083" fillOpacity="0.45" />
          </pattern>
          <filter id="sideStripShadow" x="-20%" y="-10%" width="150%" height="120%">
            <feDropShadow dx="3" dy="0" stdDeviation="3" floodColor="#1A2A20" floodOpacity="0.18" />
          </filter>
        </defs>
        <path
          d="M 0 0 L 38 0 L 36 80 L 42 160 L 37 240 L 41 320 L 36 400 L 40 480 L 35 560 L 41 640 L 37 720 L 42 800 L 36 880 L 40 960 L 38 1000 L 0 1000 Z"
          fill="url(#ginghamSidePattern)"
          filter="url(#sideStripShadow)"
        />
      </svg>
    </div>
  );
}

export function TornFabricSideStrip({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 'clamp(32px, 3.5vw, 48px)',
        zIndex: 15,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg viewBox="0 0 48 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="fabricSideGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CDC6B8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#BDB5A5" stopOpacity="0.85" />
          </linearGradient>
          <filter id="rightSideShadow" x="-40%" y="-10%" width="150%" height="120%">
            <feDropShadow dx="-3" dy="0" stdDeviation="3" floodColor="#1A2A20" floodOpacity="0.18" />
          </filter>
        </defs>
        <path
          d="M 48 0 L 10 0 L 14 80 L 8 160 L 13 240 L 7 320 L 12 400 L 8 480 L 14 560 L 7 640 L 12 720 L 7 800 L 13 880 L 8 960 L 10 1000 L 48 1000 Z"
          fill="url(#fabricSideGrad)"
          filter="url(#rightSideShadow)"
        />
      </svg>
    </div>
  );
}

export function ContourLinesBg({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 380,
        height: 320,
        pointerEvents: 'none',
        zIndex: 2,
        opacity: 0.5,
        ...style,
      }}
    >
      <svg viewBox="0 0 380 320" style={{ width: '100%', height: '100%', display: 'block' }}>
        <g fill="none" stroke="#3D6B4E" strokeWidth="1.2" strokeOpacity="0.22">
          <path d="M 120 0 C 180 40, 240 70, 380 90" />
          <path d="M 80 0 C 150 50, 220 90, 380 120" />
          <path d="M 40 0 C 130 65, 200 115, 380 150" />
          <path d="M 0 0 C 100 80, 180 140, 380 180" />
          <path d="M 0 40 C 90 110, 170 170, 380 210" />
          <path d="M 0 90 C 80 150, 160 210, 380 240" />
          <path d="M 0 150 C 70 200, 150 250, 380 275" />
        </g>
      </svg>
    </div>
  );
}

export function RegionalChoroplethMap({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 780, margin: '0 auto', ...style }}>
      <svg viewBox="0 0 800 380" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#2A3A2E" floodOpacity="0.12" />
          </filter>
          <linearGradient id="mapGrad1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A2BEAA" />
            <stop offset="100%" stopColor="#8EAFA0" />
          </linearGradient>
          <linearGradient id="mapGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B4CBB9" />
            <stop offset="100%" stopColor="#9BB8A4" />
          </linearGradient>
        </defs>

        <g filter="url(#mapShadow)" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round">
          {/* District Polygons - Punjab North (Gurdaspur, Amritsar, Hoshiarpur) */}
          <path d="M 280 80 L 330 40 L 390 55 L 420 95 L 370 120 L 310 110 Z" fill="url(#mapGrad1)" />
          <path d="M 220 110 L 280 80 L 310 110 L 290 160 L 230 150 Z" fill="url(#mapGrad2)" />
          <path d="M 310 110 L 370 120 L 410 165 L 360 185 L 310 160 Z" fill="url(#mapGrad1)" />
          
          {/* Punjab Central (Ludhiana, Jalandhar, Firozpur, Kapurthala) */}
          <path d="M 370 120 L 420 95 L 480 115 L 460 170 L 410 165 Z" fill="url(#mapGrad2)" />
          <path d="M 290 160 L 360 185 L 340 240 L 270 220 L 250 180 Z" fill="url(#mapGrad1)" />
          <path d="M 360 185 L 440 170 L 450 230 L 390 250 L 340 240 Z" fill="url(#mapGrad2)" />
          
          {/* Punjab South & Chandigarh Hub (Patiala, Sangrur, Bathinda, Mohali, Chandigarh) */}
          <path d="M 440 170 L 510 160 L 540 210 L 480 235 L 450 230 Z" fill="url(#mapGrad1)" />
          <path d="M 480 115 L 560 110 L 580 165 L 510 160 Z" fill="url(#mapGrad2)" />
          <path d="M 390 250 L 450 230 L 480 235 L 460 300 L 380 290 Z" fill="url(#mapGrad1)" />

          {/* Haryana North & Central (Ambala, Yamunanagar, Kurukshetra, Karnal, Panipat) */}
          <path d="M 540 210 L 620 190 L 650 245 L 570 260 L 480 235 Z" fill="url(#mapGrad2)" />
          <path d="M 560 110 L 640 120 L 680 175 L 620 190 L 580 165 Z" fill="url(#mapGrad1)" />
          <path d="M 570 260 L 650 245 L 670 310 L 590 320 Z" fill="url(#mapGrad2)" />
          
          {/* Haryana West & South (Hisar, Sirsa, Rohtak, Jind, Sonipat) */}
          <path d="M 340 240 L 390 250 L 380 290 L 310 290 Z" fill="url(#mapGrad2)" />
          <path d="M 460 300 L 570 260 L 590 320 L 500 340 Z" fill="url(#mapGrad1)" />
          <path d="M 380 290 L 460 300 L 500 340 L 420 350 Z" fill="url(#mapGrad2)" />
        </g>

        {/* Network Nodes / Active Location Indicators */}
        <circle cx="345" cy="85" r="7" fill="#3D6B4E" fillOpacity="0.3" className="map-pulse-halo" />
        <circle cx="345" cy="85" r="3.5" fill="#3D6B4E" />
        <circle cx="345" cy="85" r="1.5" fill="#F2B84C" />

        <circle cx="265" cy="125" r="6" fill="#3D6B4E" fillOpacity="0.3" className="map-pulse-halo" />
        <circle cx="265" cy="125" r="3" fill="#3D6B4E" />

        <circle cx="405" cy="205" r="7" fill="#3D6B4E" fillOpacity="0.3" className="map-pulse-halo" />
        <circle cx="405" cy="205" r="3.5" fill="#3D6B4E" />
        <circle cx="405" cy="205" r="1.5" fill="#F2B84C" />

        <circle cx="530" cy="175" r="8" fill="#3D6B4E" fillOpacity="0.3" className="map-pulse-halo" />
        <circle cx="530" cy="175" r="4" fill="#3D6B4E" />
        <circle cx="530" cy="175" r="1.5" fill="#F2B84C" />

        <circle cx="610" cy="230" r="6" fill="#3D6B4E" fillOpacity="0.3" className="map-pulse-halo" />
        <circle cx="610" cy="230" r="3" fill="#3D6B4E" />

        {/* Small floating node labels */}
        <text x="345" y="72" textAnchor="middle" fill="#2E523B" fontSize="10" fontWeight="700">Batala</text>
        <text x="405" y="222" textAnchor="middle" fill="#2E523B" fontSize="10" fontWeight="700">Ludhiana</text>
        <text x="530" y="162" textAnchor="middle" fill="#2E523B" fontSize="10" fontWeight="700">Chandigarh</text>
      </svg>
    </div>
  );
}

export function TexturedHeadline({ text = 'TERRAFLUX' }: { text?: string }) {
  return (
    <div className="textured-headline-container">
      <svg viewBox="0 0 1000 160" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxWidth: 940, height: 'auto', display: 'block', margin: '0 auto' }}>
        <defs>
          <pattern id="headlineFabricTexture" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill="#3D6B4E" />
            <circle cx="20" cy="20" r="1.5" fill="#2E523B" />
            <circle cx="60" cy="40" r="1.5" fill="#254330" />
            <circle cx="90" cy="80" r="1.5" fill="#2E523B" />
            <line x1="0" y1="0" x2="120" y2="120" stroke="#31573F" strokeWidth="0.8" opacity="0.4" />
            <line x1="120" y1="0" x2="0" y2="120" stroke="#31573F" strokeWidth="0.8" opacity="0.4" />
          </pattern>
        </defs>
        <text
          x="500"
          y="122"
          textAnchor="middle"
          fill="url(#headlineFabricTexture)"
          fontSize="118"
          fontWeight="normal"
          fontFamily="'PineForest', 'Inter', system-ui, -apple-system, sans-serif"
          letterSpacing="0.05em"
        >
          {text}
        </text>
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
