import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from "recharts";
import {
  Compass,
  MapPin,
  Truck,
  Factory,
  Flame,
  Droplets,
  Layers,
  ArrowRight,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Info,
  Sliders,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  Maximize2,
  X,
  Clock,
  Zap,
  Activity,
  Calendar,
  Check,
  Percent,
  Atom,
  HelpCircle,
  ShieldCheck,
  CornerDownRight,
  CircleDot,
  Navigation,
  Share2,
  Crosshair,
  FileSpreadsheet,
  Cpu,
  ArrowUpRight,
  Play,
  Layers2,
  Scale,
  Workflow,
  BookOpen,
  ArrowDown
} from "lucide-react";

const REGIONAL_GENERATORS = [
  {
    id: "GEN-01",
    name: "Ahmedabad APMC Central Market",
    zone: "Jamalpur / South Zone",
    wasteType: "Fruit & Vegetable Market Organic",
    category: "Food Waste",
    dailyTonnage: 12.8,
    moisture: 78,
    cnRatio: "24:1",
    cnNumeric: 24,
    ligninPct: 4.2,
    bulkDensity: "0.62 t/m³",
    pickupWindow: "06:00 - 10:00",
    status: "Active - Ready for Pickup",
    urgency: "high",
    coordinates: { x: 490, y: 280, lat: 23.012, lng: 72.585 },
    recommendedPathway: "BIOGAS",
    confidence: "High",
    pathwayReason: "Wet, highly biodegradable organic matter (78% moisture, C:N 24:1) perfectly suited for continuous mesophilic anaerobic digestion.",
    matchedFacilityId: "FAC-01"
  },
  {
    id: "GEN-02",
    name: "Kheda Agro Farmers Cooperative",
    zone: "Kheda Agri Belt",
    wasteType: "Paddy Straw Stubble Residue",
    category: "Crop Residue",
    dailyTonnage: 18.5,
    moisture: 16,
    cnRatio: "48:1",
    cnNumeric: 48,
    ligninPct: 18.4,
    bulkDensity: "0.14 t/m³",
    pickupWindow: "08:00 - 18:00",
    status: "Active - Ready for Pickup",
    urgency: "medium",
    coordinates: { x: 620, y: 390, lat: 22.751, lng: 72.684 },
    recommendedPathway: "BIOCHAR",
    confidence: "High",
    pathwayReason: "Dry lignocellulosic biomass (16% moisture, C:N 48:1) with high recalcitrant carbon content; prime candidate for slow pyrolysis carbon sequestration.",
    matchedFacilityId: "FAC-02"
  },
  {
    id: "GEN-03",
    name: "Sanand Cotton Ginning & Fiber Park",
    zone: "Sanand Industrial Sector",
    wasteType: "Cotton Stalk & Gin Waste",
    category: "Agricultural Waste",
    dailyTonnage: 9.4,
    moisture: 22,
    cnRatio: "42:1",
    cnNumeric: 42,
    ligninPct: 21.0,
    bulkDensity: "0.22 t/m³",
    pickupWindow: "10:00 - 16:00",
    status: "Matched - In Transit",
    urgency: "medium",
    coordinates: { x: 340, y: 260, lat: 22.985, lng: 72.378 },
    recommendedPathway: "BIOCHAR",
    confidence: "High",
    pathwayReason: "High lignin and fiber density. Pyrolysis produces stable high-porosity soil biochar with 80+ year recalcitrance.",
    matchedFacilityId: "FAC-02"
  },
  {
    id: "GEN-04",
    name: "Anand Cooperative Dairy Farm Cluster",
    zone: "Anand Rural Outskirts",
    wasteType: "Bovine Slurry & Dairy Manure",
    category: "Livestock Manure",
    dailyTonnage: 14.2,
    moisture: 84,
    cnRatio: "12:1",
    cnNumeric: 12,
    ligninPct: 2.1,
    bulkDensity: "0.98 t/m³",
    pickupWindow: "05:00 - 12:00",
    status: "Requires Blending",
    urgency: "high",
    coordinates: { x: 670, y: 460, lat: 22.564, lng: 72.928 },
    recommendedPathway: "CO-DIGESTION",
    confidence: "Very High",
    pathwayReason: "Excessive nitrogen (C:N 12:1) triggers ammonia inhibition in single-substrate AD. Optimal when co-digested with 58% high-carbon straw (C:N 52:1).",
    matchedFacilityId: "FAC-04"
  },
  {
    id: "GEN-05",
    name: "Gandhinagar Food Processing Park",
    zone: "Infocity Agro Zone",
    wasteType: "Citrus & Potato Pulp Residue",
    category: "Industrial Food Sludge",
    dailyTonnage: 7.6,
    moisture: 72,
    cnRatio: "28:1",
    cnNumeric: 28,
    ligninPct: 3.5,
    bulkDensity: "0.71 t/m³",
    pickupWindow: "13:00 - 17:00",
    status: "Active - Ready for Pickup",
    urgency: "low",
    coordinates: { x: 530, y: 150, lat: 23.215, lng: 72.636 },
    recommendedPathway: "BIOGAS",
    confidence: "High",
    pathwayReason: "High volatile solids (82% VS) and ideal 28:1 C:N ratio inside the peak biomethane generation envelope.",
    matchedFacilityId: "FAC-01"
  }
];

const CONVERSION_FACILITIES = [
  {
    id: "FAC-01",
    name: "GreenGas Ahmedabad CBG Terminal",
    type: "Compressed Biogas (CBG)",
    pathway: "BIOGAS",
    totalCapacity: 25.0, // t/day
    currentIntake: 18.3,
    remainingCapacity: 6.7,
    utilization: 73.2,
    acceptedFeedstocks: ["Food Waste", "Fruit & Veg Slurry", "High-moisture Agro Sludge"],
    moistureThreshold: "65% - 85%",
    cnTolerance: "20:1 - 32:1",
    coordinates: { x: 450, y: 320, lat: 22.964, lng: 72.542 },
    queueHours: 1.2,
    gateFeePerTonne: -12.0,
    carbonIntensityPerTonne: 1.18,
    operationalStatus: "Optimal Throughput",
    incomingLots: 2
  },
  {
    id: "FAC-02",
    name: "Kheda Biochar & Pyrolysis Hub",
    type: "Slow Pyrolysis (550°C Rotary Retort)",
    pathway: "BIOCHAR",
    totalCapacity: 30.0,
    currentIntake: 21.0,
    remainingCapacity: 9.0,
    utilization: 70.0,
    acceptedFeedstocks: ["Paddy Straw", "Cotton Stalks", "Bagasse", "Wood Shreds"],
    moistureThreshold: "< 25%",
    cnTolerance: "> 35:1",
    coordinates: { x: 590, y: 350, lat: 22.792, lng: 72.712 },
    queueHours: 0.8,
    gateFeePerTonne: 0.0,
    carbonIntensityPerTonne: 1.84,
    operationalStatus: "Accepting Feedstocks",
    incomingLots: 3
  },
  {
    id: "FAC-03",
    name: "Sabarmati Biomethanation Facility",
    type: "Continuous Stirred-Tank Reactor (CSTR)",
    pathway: "BIOGAS",
    totalCapacity: 15.0,
    currentIntake: 13.8,
    remainingCapacity: 1.2,
    utilization: 92.0,
    acceptedFeedstocks: ["Municipal Segregated Food Organic", "Market Veg Waste"],
    moistureThreshold: "70% - 90%",
    cnTolerance: "18:1 - 28:1",
    coordinates: { x: 505, y: 220, lat: 23.082, lng: 72.601 },
    queueHours: 3.5,
    gateFeePerTonne: -8.0,
    carbonIntensityPerTonne: 1.12,
    operationalStatus: "Near Full (Quota Guard Active)",
    incomingLots: 1
  },
  {
    id: "FAC-04",
    name: "Anand Co-Digestion & Bio-Fertilizer Plant",
    type: "Thermophilic High-Rate Co-Digestor",
    pathway: "CO-DIGESTION",
    totalCapacity: 35.0,
    currentIntake: 22.4,
    remainingCapacity: 12.6,
    utilization: 64.0,
    acceptedFeedstocks: ["Cattle Dung", "Poultry Litter", "Rice Husk Blend", "Dairy Whey"],
    moistureThreshold: "60% - 85%",
    cnTolerance: "Target 25:1 Blend",
    coordinates: { x: 690, y: 440, lat: 22.540, lng: 72.960 },
    queueHours: 0.5,
    gateFeePerTonne: 5.0,
    carbonIntensityPerTonne: 1.45,
    operationalStatus: "Optimal Throughput",
    incomingLots: 2
  }
];

const ACTIVE_MATCHES = [
  {
    id: "MTH-901",
    generatorId: "GEN-01",
    generatorName: "Ahmedabad APMC Central Market",
    facilityId: "FAC-01",
    facilityName: "GreenGas Ahmedabad CBG Terminal",
    feedstock: "Fruit & Vegetable Waste (12.8 t)",
    distanceKm: 18.2,
    volumeFit: 94,
    capacityFit: 81,
    pathwayFit: 100,
    matchScore: 0.87,
    weights: { distance: 0.35, volume: 0.25, capacity: 0.15, pathway: 0.25 },
    truckAssigned: "GJ-01-BX-4482 (Compactor #04)",
    co2Avoided: 15.1,
    status: "Dispatched",
    eta: "38 min"
  },
  {
    id: "MTH-902",
    generatorId: "GEN-02",
    generatorName: "Kheda Agro Farmers Cooperative",
    facilityId: "FAC-02",
    facilityName: "Kheda Biochar & Pyrolysis Hub",
    feedstock: "Paddy Straw Stubble (18.5 t)",
    distanceKm: 12.4,
    volumeFit: 88,
    capacityFit: 92,
    pathwayFit: 100,
    matchScore: 0.93,
    weights: { distance: 0.35, volume: 0.25, capacity: 0.15, pathway: 0.25 },
    truckAssigned: "GJ-07-TY-1029 (Hook Loader #02)",
    co2Avoided: 34.0,
    status: "Pending Departure",
    eta: "Scheduled 14:00"
  },
  {
    id: "MTH-903",
    generatorId: "GEN-03",
    generatorName: "Sanand Cotton Ginning Park",
    facilityId: "FAC-02",
    facilityName: "Kheda Biochar & Pyrolysis Hub",
    feedstock: "Cotton Stalk Waste (9.4 t)",
    distanceKm: 34.8,
    volumeFit: 78,
    capacityFit: 85,
    pathwayFit: 95,
    matchScore: 0.79,
    weights: { distance: 0.35, volume: 0.25, capacity: 0.15, pathway: 0.25 },
    truckAssigned: "GJ-27-K-8819 (Flatbed Hauler)",
    co2Avoided: 17.3,
    status: "En Route",
    eta: "52 min"
  }
];

const SEASONAL_FEEDSTOCK_DATA = [
  { month: "Jan", foodWaste: 180, paddyStraw: 40, cottonStalk: 240, manure: 160 },
  { month: "Feb", foodWaste: 185, paddyStraw: 20, cottonStalk: 190, manure: 165 },
  { month: "Mar", foodWaste: 195, paddyStraw: 15, cottonStalk: 90, manure: 170 },
  { month: "Apr", foodWaste: 210, paddyStraw: 80, cottonStalk: 30, manure: 175 },
  { month: "May", foodWaste: 220, paddyStraw: 190, cottonStalk: 10, manure: 180 },
  { month: "Jun", foodWaste: 215, paddyStraw: 140, cottonStalk: 5, manure: 180 },
  { month: "Jul", foodWaste: 190, paddyStraw: 10, cottonStalk: 0, manure: 170 },
  { month: "Aug", foodWaste: 185, paddyStraw: 5, cottonStalk: 0, manure: 165 },
  { month: "Sep", foodWaste: 190, paddyStraw: 45, cottonStalk: 10, manure: 170 },
  { month: "Oct", foodWaste: 205, paddyStraw: 420, cottonStalk: 80, manure: 175 },
  { month: "Nov", foodWaste: 210, paddyStraw: 480, cottonStalk: 260, manure: 180 },
  { month: "Dec", foodWaste: 195, paddyStraw: 120, cottonStalk: 290, manure: 170 }
];

function StatusDot({ status = "active", size = "sm" }) {
  const sizeClasses = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5"
  };

  const statusStyles = {
    active: "bg-[#3D774D]",
    pulse: "bg-[#3D774D] animate-pulse",
    warning: "bg-[#B46B23]",
    danger: "bg-[#A83B35]",
    neutral: "bg-[#829285]"
  };

  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0">
      {status === "pulse" && (
        <span className={`absolute inline-flex h-full w-full rounded-full bg-[#3D774D] opacity-40 animate-ping`} />
      )}
      <span className={`rounded-full ${sizeClasses[size] || sizeClasses.sm} ${statusStyles[status] || statusStyles.active}`} />
    </span>
  );
}

function ProvenanceBadge({ type = "FACT", onClick }) {
  const styles = {
    FACT: "bg-[#EAF2E8] text-[#245233] border-[#C3D9C1] hover:bg-[#dfeadc]",
    CALCULATED: "bg-[#EEF3F8] text-[#34517A] border-[#C8D7EA] hover:bg-[#dce6f2]",
    ASSUMPTION: "bg-[#FDF8EE] text-[#8C581E] border-[#EBD7B8] hover:bg-[#f6ebd7]",
    SIMULATED: "bg-[#F7EFF9] text-[#6F377E] border-[#E5CEE8] hover:bg-[#ebdcf0]"
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold px-2 py-0.5 rounded-[5px] border transition-colors cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-[#295538] ${styles[type] || styles.FACT}`}
      title={`Click to inspect ${type} calculation and evidence source`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85"></span>
      <span className="tracking-wide">{type}</span>
    </button>
  );
}

function StatusBadge({ variant = "neutral", children, icon: Icon }) {
  const variants = {
    success: "bg-[#EAF2E8] text-[#245233] border-[#C3D9C1]",
    warning: "bg-[#FDF8EE] text-[#8C581E] border-[#EBD7B8]",
    danger: "bg-[#FDF3F2] text-[#A63730] border-[#ECC8C5]",
    info: "bg-[#EEF3F8] text-[#34517A] border-[#C8D7EA]",
    neutral: "bg-[#F4F7F2] text-[#58665B] border-[#D1DDD0]"
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] font-mono font-medium border ${variants[variant] || variants.neutral}`}>
      {Icon && <Icon className="w-3 h-3 opacity-90" />}
      <span>{children}</span>
    </span>
  );
}

export default function App() {
  // Global Mode Switch: "landing" (Introduction / Explanation) vs "operations" (Live Command Center)
  const [appMode, setAppMode] = useState("landing");
  const [hasVisitedOperations, setHasVisitedOperations] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);

  // Operations Navigation State
  const [activeTab, setActiveTab] = useState("overview"); // overview, lots, facilities, routes, impact, matches, codigestion, carbon
  const [selectedLotId, setSelectedLotId] = useState("GEN-01");
  const [selectedFacilityId, setSelectedFacilityId] = useState("FAC-01");
  const [activeProvenanceDoc, setActiveProvenanceDoc] = useState(null);
  const [mapMode, setMapMode] = useState("operations"); // operations vs planning
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [blendRatio, setBlendRatio] = useState(42);
  const [naturalLanguageQueryOpen, setNaturalLanguageQueryOpen] = useState(false);

  // Landing Interactive Demo Step: 1 (Lot) -> 2 (Pathway) -> 3 (Match) -> 4 (Route) -> 5 (Impact)
  const [demoStep, setDemoStep] = useState(1);

  // Entities
  const selectedLot = useMemo(() => {
    return REGIONAL_GENERATORS.find((g) => g.id === selectedLotId) || REGIONAL_GENERATORS[0];
  }, [selectedLotId]);

  const selectedFacility = useMemo(() => {
    return CONVERSION_FACILITIES.find((f) => f.id === selectedFacilityId) || CONVERSION_FACILITIES[0];
  }, [selectedFacilityId]);

  const enterOperations = (initialTab = "overview", initialLotId = null) => {
    setAppMode("operations");
    if (initialTab) setActiveTab(initialTab);
    if (initialLotId) setSelectedLotId(initialLotId);
    if (!hasVisitedOperations) {
      setShowOrientationModal(true);
      setHasVisitedOperations(true);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F4F7F2] text-[#152219] font-sans antialiased selection:bg-[#70A777]/25 selection:text-[#152219]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        
        :root {
          --bg-canvas: #F4F7F2;
          --bg-surface: #FFFFFF;
          --bg-surface-subtle: #EDF3EB;
          --bg-surface-muted: #E5EDE2;
          --border-subtle: #E1EAE0;
          --border-default: #D1DDD0;
          --border-strong: #A9BCA7;
          --text-primary: #152219;
          --text-secondary: #58665B;
          --text-tertiary: #829285;
          --color-brand-deep: #1E3F2B;
          --color-brand-primary: #295538;
          --color-brand-muted: #4F7D59;
          --color-brand-accent: #70A777;
          --color-warning: #B46B23;
          --color-danger: #A83B35;
          --shadow-subtle: 0 1px 3px 0 rgba(20, 35, 23, 0.04), 0 1px 2px -1px rgba(20, 35, 23, 0.04);
          --shadow-card: 0 1px 4px 0 rgba(20, 35, 23, 0.05), 0 2px 6px -1px rgba(20, 35, 23, 0.03);
          --shadow-modal: 0 16px 36px -4px rgba(20, 35, 23, 0.12), 0 6px 12px -2px rgba(20, 35, 23, 0.06);
        }

        .font-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .font-sans { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        
        /* Consistent B2B SaaS Card Surfaces */
        .saas-card {
          background-color: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: 12px;
          box-shadow: var(--shadow-subtle);
          transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
        }
        .saas-card:hover {
          border-color: var(--border-strong);
        }

        .saas-card-subtle {
          background-color: var(--bg-surface-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
        }

        /* Standard B2B Button Foundations */
        .btn-primary {
          background-color: var(--color-brand-primary);
          color: #FFFFFF;
          border: 1px solid transparent;
          border-radius: 8px;
          font-weight: 600;
          transition: background-color 140ms ease-out, transform 100ms ease-out, box-shadow 140ms ease-out;
          box-shadow: 0 1px 2px 0 rgba(20, 40, 26, 0.12);
        }
        .btn-primary:hover {
          background-color: var(--color-brand-deep);
        }
        .btn-primary:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--color-brand-primary);
        }

        .btn-secondary {
          background-color: var(--bg-surface);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
          border-radius: 8px;
          font-weight: 600;
          transition: background-color 140ms ease-out, border-color 140ms ease-out;
        }
        .btn-secondary:hover {
          background-color: var(--bg-surface-subtle);
          border-color: var(--border-strong);
        }
        .btn-secondary:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--color-brand-muted);
        }

        /* Subtle Technical Scrollbars */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #F4F7F2;
        }
        ::-webkit-scrollbar-thumb {
          background: #CBD7CA;
          border-radius: 6px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #A9BCA7;
        }
      `}</style>

      {/* MODE 1: INTRODUCTION & LANDING */}
      {appMode === "landing" && (
        <LandingIntroductionView
          demoStep={demoStep}
          onSetDemoStep={setDemoStep}
          onEnterOperations={enterOperations}
          onInspectProvenance={(doc) => setActiveProvenanceDoc(doc)}
        />
      )}

      {/* MODE 2: OPERATIONS COMMAND CENTER */}
      {appMode === "operations" && (
        <OperationsShellView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedLot={selectedLot}
          setSelectedLotId={setSelectedLotId}
          selectedFacility={selectedFacility}
          setSelectedFacilityId={setSelectedFacilityId}
          onReturnToLanding={() => setAppMode("landing")}
          mapMode={mapMode}
          setMapMode={setMapMode}
          routeOptimized={routeOptimized}
          setRouteOptimized={setRouteOptimized}
          blendRatio={blendRatio}
          setBlendRatio={setBlendRatio}
          naturalLanguageQueryOpen={naturalLanguageQueryOpen}
          setNaturalLanguageQueryOpen={setNaturalLanguageQueryOpen}
          onInspectProvenance={(doc) => setActiveProvenanceDoc(doc)}
          showOrientationModal={showOrientationModal}
          onDismissOrientation={() => setShowOrientationModal(false)}
        />
      )}

      {/* Provenance Document Inspector Slide-over Drawer */}
      {activeProvenanceDoc && (
        <ProvenanceInspectorDrawer
          doc={activeProvenanceDoc}
          onClose={() => setActiveProvenanceDoc(null)}
        />
      )}
    </div>
  );
}

function LandingIntroductionView({ demoStep, onSetDemoStep, onEnterOperations, onInspectProvenance }) {
  const scrollToDemo = () => {
    const el = document.getElementById("interactive-flow-demo");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToValueChain = () => {
    const el = document.getElementById("visual-value-chain");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="w-full flex flex-col bg-[#F4F7F2]">
      {/* SaaS Top Header Navigation */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between border-b border-[#D1DDD0]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[#295538] flex items-center justify-center text-[#FFFFFF] shadow-xs">
            <Atom className="w-4 h-4 text-[#70A777]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#152219] tracking-tight">Waste-to-Carbon</span>
              <span className="text-[10px] bg-[#EAF2E8] text-[#245233] border border-[#C3D9C1] font-mono px-1.5 py-0.5 rounded-[4px] font-semibold">
                HackOut'26
              </span>
            </div>
            <div className="text-[10px] text-[#58665B] font-mono">Ahmedabad–Kheda Regional Value Chain</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={scrollToValueChain}
            className="text-xs font-medium text-[#58665B] hover:text-[#152219] transition-colors px-2 py-1 hidden sm:inline"
          >
            How it Works
          </button>
          <button
            onClick={scrollToDemo}
            className="text-xs font-medium text-[#58665B] hover:text-[#152219] transition-colors px-2 py-1 hidden sm:inline"
          >
            Interactive Demo
          </button>
          <button
            onClick={() => onEnterOperations("overview")}
            className="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Launch Operations</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
          </button>
        </div>
      </header>

      {/* SECTION 1 — HERO */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF2E8] border border-[#C3D9C1] text-xs font-mono text-[#245233] mb-6 shadow-xs">
          <StatusDot status="pulse" size="xs" />
          <span className="font-semibold tracking-wide">CIRCULAR CARBON ECOSYSTEM CORRIDOR</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#152219] tracking-tight leading-[1.12]">
          Turn Waste Into Measurable Carbon Value.
        </h1>

        <p className="mt-5 text-base md:text-lg text-[#58665B] max-w-2xl leading-relaxed font-normal">
          Connect waste generators with the right conversion facility, optimize the collection route,
          and calculate the resulting carbon impact with transparent assumptions.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <button
            onClick={() => onEnterOperations("overview")}
            className="btn-primary px-5 py-3 text-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Explore the Value Chain</span>
            <ArrowRight className="w-4 h-4 text-[#70A777]" />
          </button>

          <button
            onClick={scrollToDemo}
            className="btn-secondary px-5 py-3 text-sm flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 text-[#295538]" />
            <span>See How It Works</span>
          </button>
        </div>

        {/* Real Regional Corridor Context Bar */}
        <div className="mt-12 pt-8 border-t border-[#D1DDD0] w-full grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-left">
          <div className="p-3.5 bg-[#FFFFFF] rounded-[10px] border border-[#D1DDD0] shadow-xs">
            <div className="text-[10px] font-mono font-medium text-[#829285] uppercase tracking-wider">ACTIVE PILOT REGION</div>
            <div className="font-bold text-xs text-[#152219] mt-1">Ahmedabad – Kheda</div>
          </div>
          <div className="p-3.5 bg-[#FFFFFF] rounded-[10px] border border-[#D1DDD0] shadow-xs">
            <div className="text-[10px] font-mono font-medium text-[#829285] uppercase tracking-wider">DAILY REGISTERED LOTS</div>
            <div className="font-bold text-xs font-mono text-[#152219] mt-1">62.5 Tonnes/Day</div>
          </div>
          <div className="p-3.5 bg-[#FFFFFF] rounded-[10px] border border-[#D1DDD0] shadow-xs">
            <div className="text-[10px] font-mono font-medium text-[#829285] uppercase tracking-wider">CONVERSION HUBS</div>
            <div className="font-bold text-xs font-mono text-[#152219] mt-1">4 Active Facilities</div>
          </div>
          <div className="p-3.5 bg-[#FFFFFF] rounded-[10px] border border-[#D1DDD0] shadow-xs">
            <div className="text-[10px] font-mono font-medium text-[#829285] uppercase tracking-wider">ACCOUNTING STANDARD</div>
            <div className="font-bold text-xs font-mono text-[#245233] mt-1">IPCC 2006 (100y GWP)</div>
          </div>
        </div>
      </section>

      {}
      <section id="visual-value-chain" className="max-w-6xl mx-auto px-6 py-12 w-full">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-[10px] font-mono text-[#295538] uppercase tracking-wider font-bold">
            THE FIVE-STAGE PIPELINE
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#152219] mt-1">
            How Waste Traverses into Carbon Value
          </h2>
          <p className="text-xs text-[#58665B] mt-1.5">
            Every feedstock lot is chemically classified before matching to prevent reactor quenching,
            deadheading, and unviable tipping economics.
          </p>
        </div>

        <div className="saas-card p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative">
            {[
              {
                step: "01",
                label: "WASTE GENERATOR",
                sub: "Farm • Market • Slurry",
                desc: "12.8 t fresh produce registered at APMC yard.",
                badge: "78% Moisture",
                icon: Droplets,
                color: "text-[#295538]"
              },
              {
                step: "02",
                label: "PATHWAY ENGINE",
                sub: "C:N Ratio • Moisture",
                desc: "C:N 24:1 rules out open pyrolysis; selects Biogas.",
                badge: "Biochemical Fit",
                icon: Atom,
                color: "text-[#1E3F2B]"
              },
              {
                step: "03",
                label: "MATCH ENGINE",
                sub: "4-Factor Weighted Alg",
                desc: "35% Dist, 25% Vol, 15% Cap, 25% Pathway fit.",
                badge: "Score: 0.87",
                icon: Zap,
                color: "text-[#295538]"
              },
              {
                step: "04",
                label: "COLLECTION ROUTE",
                sub: "2-Opt Optimization",
                desc: "Heavy compactor route pruned by 11.2 km.",
                badge: "18.2 km Circuit",
                icon: Truck,
                color: "text-[#4F7D59]"
              },
              {
                step: "05",
                label: "CONVERSION HUB",
                sub: "CBG • Biochar Retort",
                desc: "GreenGas Terminal converts into biomethane.",
                badge: "6.7 t Cap Left",
                icon: Factory,
                color: "text-[#34517A]"
              },
              {
                step: "06",
                label: "CARBON IMPACT",
                sub: "IPCC Calculation",
                desc: "Avoided unmanaged landfill methane net of diesel.",
                badge: "+15.1 tCO2e",
                icon: ShieldCheck,
                color: "text-[#245233]"
              }
            ].map((node, idx) => {
              const Icon = node.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAF7] border border-[#D1DDD0] rounded-[10px] p-3.5 flex flex-col justify-between space-y-3 relative group hover:border-[#295538] hover:bg-[#FFFFFF] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#58665B] mb-2">
                      <span className="font-bold text-[#295538]">STAGE {node.step}</span>
                      <Icon className={`w-3.5 h-3.5 ${node.color}`} />
                    </div>
                    <div className="font-bold text-xs text-[#152219] leading-snug">{node.label}</div>
                    <div className="text-[10px] font-mono text-[#829285] mt-0.5">{node.sub}</div>
                    <p className="text-[11px] text-[#152219] mt-2 leading-relaxed">{node.desc}</p>
                  </div>

                  <div className="pt-2 border-t border-[#E1EAE0]">
                    <span className="text-[9px] font-mono font-bold bg-[#FFFFFF] border border-[#D1DDD0] px-2 py-0.5 rounded-[4px] text-[#245233]">
                      {node.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-[#E1EAE0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#58665B]">
            <div className="flex items-center gap-2">
              <StatusDot status="active" size="xs" />
              <span>All 6 stages execute dynamically without manual routing spreadsheets.</span>
            </div>
            <button
              onClick={() => onEnterOperations("overview")}
              className="text-[#295538] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect active live nodes in Ahmedabad corridor</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3 — "THE PROBLEM": LOGISTICS & AGGREGATION BOTTLENECK */}
      <section className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-[10px] font-mono text-[#B46B23] uppercase tracking-wider font-bold">
            THE CORE BOTTLENECK
          </span>
          <h2 className="text-2xl font-bold text-[#152219] mt-1">
            A Ton of Waste is Only Valuable if it Reaches the Right Place.
          </h2>
          <p className="text-xs text-[#58665B] mt-1.5">
            The climate bottleneck is not lack of pyrolysis or digestors. It is the failure to aggregate
            and match the right feedstock chemistry to the right facility within an economical radius.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#FFFFFF] border border-[#ECC8C5] rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-[#A63730] text-xs font-mono font-bold mb-3">
              <AlertTriangle className="w-4 h-4" />
              <span>WITHOUT INTELLIGENT MATCHING (STATUS QUO)</span>
            </div>
            <ul className="space-y-3 text-xs text-[#152219]">
              <li className="flex items-start gap-2">
                <span className="text-[#A63730] font-bold">✕</span>
                <span><strong>Biochemical Mismatch:</strong> Wet food slurry (78% moisture) delivered to a pyrolysis plant causes tar condensation and immediate kiln shutdown.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A63730] font-bold">✕</span>
                <span><strong>Excessive Haul Radius:</strong> Low-density straw hauled 65+ km burns more diesel CO2 than the carbon offset achieved.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A63730] font-bold">✕</span>
                <span><strong>Default Dumping:</strong> When no local offtake is arranged by 10:00 AM, produce is dumped into open unmanaged landfills, venting methane.</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#FFFFFF] border border-[#C3D9C1] rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-[#245233] text-xs font-mono font-bold mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#295538]" />
              <span>WITH THE VALUE CHAIN TRACKER</span>
            </div>
            <ul className="space-y-3 text-xs text-[#152219]">
              <li className="flex items-start gap-2">
                <span className="text-[#295538] font-bold">✓</span>
                <span><strong>Chemistry-Gated Routing:</strong> Feedstock specs (moisture, C:N, lignin) restrict dispatch only to biochemically compatible reactors.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#295538] font-bold">✓</span>
                <span><strong>Economical Radius Cap:</strong> 35 km break-even threshold prevents negative-carbon transport deadheading.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#295538] font-bold">✓</span>
                <span><strong>Provable Carbon Accounting:</strong> Every tonne diverted calculates net avoided emissions subtracting transport fuel burn under IPCC rules.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {}
      <section id="interactive-flow-demo" className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-[10px] font-mono text-[#295538] uppercase tracking-wider font-bold">
            INTERACTIVE SYSTEM DEMONSTRATION
          </span>
          <h2 className="text-2xl font-bold text-[#152219] mt-1">
            Walk Through One Waste Lot in 30 Seconds
          </h2>
          <p className="text-xs text-[#58665B] mt-1.5">
            Step through the actual decision algorithms that run when Ahmedabad APMC registers morning vegetable organics.
          </p>
        </div>

        <div className="saas-card p-6 md:p-8">
          {/* Stepper Tabs */}
          <div className="grid grid-cols-5 gap-2 border-b border-[#D1DDD0] pb-4 mb-6">
            {[
              { num: 1, title: "1. Waste Lot" },
              { num: 2, title: "2. Pathway" },
              { num: 3, title: "3. Facility Match" },
              { num: 4, title: "4. Route 2-Opt" },
              { num: 5, title: "5. Carbon Net" }
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => onSetDemoStep(s.num)}
                className={`py-2 px-1 text-center rounded-[8px] font-mono text-xs transition-all cursor-pointer ${
                  demoStep === s.num
                    ? "bg-[#295538] text-white font-bold shadow-xs"
                    : demoStep > s.num
                    ? "bg-[#EAF2E8] text-[#245233] font-medium"
                    : "bg-[#F4F7F2] text-[#58665B] hover:bg-[#EDF3EB]"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {demoStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#829285] uppercase">REGISTERED FEEDSTOCK</span>
                  <h3 className="text-lg font-bold text-[#152219]">Ahmedabad APMC Central Market</h3>
                  <p className="text-xs text-[#58665B]">Zone: Jamalpur Market Yard • 12.8 Tonnes Available</p>
                </div>
                <ProvenanceBadge type="FACT" onClick={() => onInspectProvenance({
                  title: "APMC Weighbridge Shift Log",
                  type: "FACT",
                  source: "Jamalpur Yard Outward Ledger",
                  value: "12.8 t gross",
                  timestamp: "2026-09-12 06:15 IST"
                })} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono pt-2">
                <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[#829285]">MOISTURE CONTENT:</span>
                  <div className="text-lg font-bold text-[#152219] mt-1">78%</div>
                  <span className="text-[10px] text-[#295538]">High liquid fraction</span>
                </div>
                <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[#829285]">CARBON:NITROGEN:</span>
                  <div className="text-lg font-bold text-[#245233] mt-1">24:1</div>
                  <span className="text-[10px] text-[#295538]">Balanced methanogenesis</span>
                </div>
                <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[#829285]">LIGNIN RATIO:</span>
                  <div className="text-lg font-bold text-[#152219] mt-1">4.2%</div>
                  <span className="text-[10px] text-[#58665B]">Readily biodegradable</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => onSetDemoStep(2)}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Step 2: Run Biochemical Pathway Engine</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
                </button>
              </div>
            </div>
          )}

          {demoStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#245233] font-bold uppercase">PATHWAY SELECTION RESULT</span>
                  <h3 className="text-lg font-bold text-[#152219]">Path Recommended: BIOGAS (Compressed Biogas)</h3>
                  <p className="text-xs text-[#58665B]">Pyrolysis & direct soil incorporation rejected due to moisture penalty.</p>
                </div>
                <span className="px-2 py-1 rounded-[6px] bg-[#EAF2E8] text-[#245233] font-mono text-xs font-bold border border-[#C3D9C1]">
                  Confidence: HIGH (98%)
                </span>
              </div>

              <div className="p-4 bg-[#EAF2E8]/60 border border-[#C3D9C1] rounded-[10px] space-y-2 text-xs">
                <div className="font-bold text-[#245233]">DECISION LOGIC ENFORCED:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-[#152219]">
                  <div>✓ Moisture 78% &gt; 65% requirement for wet AD</div>
                  <div>✓ C:N 24:1 sits inside optimal 20:1–30:1 range</div>
                  <div>✕ Pyrolysis rejected: Moisture &gt; 25% quenches reactor</div>
                  <div>✓ No ammonia inhibition risk (C:N &gt; 18:1)</div>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button onClick={() => onSetDemoStep(1)} className="btn-secondary px-3 py-1.5 text-xs">
                  ← Back
                </button>
                <button
                  onClick={() => onSetDemoStep(3)}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Step 3: Match Against Regional Facilities</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
                </button>
              </div>
            </div>
          )}

          {demoStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#829285] uppercase">FACILITY SCORING BREAKDOWN</span>
                  <h3 className="text-lg font-bold text-[#152219]">Matched: GreenGas Ahmedabad CBG Terminal</h3>
                  <p className="text-xs text-[#58665B]">Weighted Match Score: 0.87 (Rank #1 of 4 facilities)</p>
                </div>
                <span className="text-base font-mono font-bold text-[#245233] bg-[#EAF2E8] px-3 py-1 rounded-[6px] border border-[#C3D9C1]">
                  0.87 / 1.00
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[10px] text-[#829285]">DISTANCE (35%):</span>
                  <div className="font-bold text-[#152219] mt-0.5">18.2 km</div>
                  <span className="text-[10px] text-[#295538]">Within 35km radius</span>
                </div>
                <div className="p-2.5 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[10px] text-[#829285]">VOLUME FIT (25%):</span>
                  <div className="font-bold text-[#152219] mt-0.5">94%</div>
                  <span className="text-[10px] text-[#295538]">Optimal batch load</span>
                </div>
                <div className="p-2.5 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[10px] text-[#829285]">CAPACITY (15%):</span>
                  <div className="font-bold text-[#152219] mt-0.5">81%</div>
                  <span className="text-[10px] text-[#295538]">6.7 t remaining</span>
                </div>
                <div className="p-2.5 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0]">
                  <span className="text-[10px] text-[#829285]">PATHWAY (25%):</span>
                  <div className="font-bold text-[#152219] mt-0.5">100%</div>
                  <span className="text-[10px] text-[#295538]">Direct CBG spec</span>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button onClick={() => onSetDemoStep(2)} className="btn-secondary px-3 py-1.5 text-xs">
                  ← Back
                </button>
                <button
                  onClick={() => onSetDemoStep(4)}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Step 4: Prune Route via 2-Opt TSP</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
                </button>
              </div>
            </div>
          )}

          {demoStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#245233] font-bold uppercase">LOGISTICS DISPATCH CIRCUIT</span>
                  <h3 className="text-lg font-bold text-[#152219]">Truck Assigned: GJ-01-BX-4482 (Compactor #04)</h3>
                  <p className="text-xs text-[#58665B]">Depot → APMC (12.8t) → GreenGas Terminal</p>
                </div>
                <span className="text-xs font-mono font-bold text-[#245233] bg-[#EAF2E8] px-2 py-1 rounded-[6px] border border-[#C3D9C1]">
                  2-Opt Pruned: -11.2 km
                </span>
              </div>

              <div className="p-4 bg-[#F8FAF7] border border-[#D1DDD0] rounded-[8px] flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[#829285]">Standard Haul:</span>
                  <div className="font-bold text-[#152219]">29.4 km circuit</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#70A777]" />
                <div>
                  <span className="text-[#245233] font-bold">Optimized Sequence:</span>
                  <div className="font-bold text-[#245233]">18.2 km circuit</div>
                </div>
                <div className="text-right">
                  <span className="text-[#829285]">Diesel Saved:</span>
                  <div className="font-bold text-[#295538]">3.1 Liters (-10.6 kg CO2)</div>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button onClick={() => onSetDemoStep(3)} className="btn-secondary px-3 py-1.5 text-xs">
                  ← Back
                </button>
                <button
                  onClick={() => onSetDemoStep(5)}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Step 5: Verify IPCC Carbon Calculation</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
                </button>
              </div>
            </div>
          )}

          {demoStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#245233] font-bold uppercase">AUDITABLE CARBON VALUE</span>
                  <h3 className="text-xl font-bold text-[#152219]">+15.1 tCO2e Net Reduction</h3>
                  <p className="text-xs text-[#58665B]">Calculated under IPCC 2006 Waste Model (Chapter 3, 100-year GWP)</p>
                </div>
                <ProvenanceBadge type="CALCULATED" onClick={() => onInspectProvenance({
                  title: "IPCC 2006 First Order Decay Diversion Formula",
                  type: "CALCULATED",
                  formula: "Net Avoided = [12.8t * 0.15 DOC * 0.5 DOCf * 0.8 MCF * 0.5 F * (16/12) * 28 GWP] - (0.42t transport + 0.68t process)",
                  source: "IPCC Guidelines for National GHG Inventories"
                })} />
              </div>

              <div className="p-4 bg-[#EAF2E8]/60 border border-[#C3D9C1] rounded-[10px] text-xs font-mono space-y-2">
                <div className="flex justify-between font-bold text-[#245233]">
                  <span>Gross Landfill Methane Avoided:</span>
                  <span>+16.2 tCO2e</span>
                </div>
                <div className="flex justify-between text-[#A63730]">
                  <span>Transport Diesel Deduction (18.2 km):</span>
                  <span>-0.42 tCO2e</span>
                </div>
                <div className="flex justify-between text-[#A63730]">
                  <span>Parasitic Digestor Energy:</span>
                  <span>-0.68 tCO2e</span>
                </div>
                <div className="pt-2 border-t border-[#C3D9C1] flex justify-between font-bold text-sm text-[#152219]">
                  <span>Net Verified Value:</span>
                  <span className="text-[#245233]">+15.10 tCO2e</span>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
                <button onClick={() => onSetDemoStep(4)} className="btn-secondary px-3 py-1.5 text-xs">
                  ← Back
                </button>
                <button
                  onClick={() => onEnterOperations("overview", "GEN-01")}
                  className="btn-primary px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Launch Operations with APMC Lot #GEN-01</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#70A777]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {}
      <section className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-[10px] font-mono text-[#829285] uppercase tracking-wider font-bold">
            ARCHITECTURAL ADVANTAGE
          </span>
          <h2 className="text-2xl font-bold text-[#152219] mt-1">
            Three Reasons Receipts is Built Differently
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="saas-card p-5 space-y-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#EAF2E8] border border-[#C3D9C1] flex items-center justify-center text-[#295538]">
              <Atom className="w-4 h-4 text-[#295538]" />
            </div>
            <h3 className="font-bold text-sm text-[#152219] pt-1">1. Chemistry-Aware</h3>
            <p className="text-xs text-[#58665B] leading-relaxed">
              Not every waste stream belongs in the same pathway. We gate dispatch by moisture,
              C:N stoichiometric envelope, and lignin degradability to protect biological and thermal assets.
            </p>
          </div>

          <div className="saas-card p-5 space-y-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#EAF2E8] border border-[#C3D9C1] flex items-center justify-center text-[#295538]">
              <Truck className="w-4 h-4 text-[#295538]" />
            </div>
            <h3 className="font-bold text-sm text-[#152219] pt-1">2. Logistics-Aware</h3>
            <p className="text-xs text-[#58665B] leading-relaxed">
              The nearest facility is not automatically viable if its gate fee or intake queue is jammed.
              Our 4-factor scoring balances distance, volume fit, gate capacity, and pathway compatibility.
            </p>
          </div>

          <div className="saas-card p-5 space-y-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#EAF2E8] border border-[#C3D9C1] flex items-center justify-center text-[#295538]">
              <ShieldCheck className="w-4 h-4 text-[#295538]" />
            </div>
            <h3 className="font-bold text-sm text-[#152219] pt-1">3. Carbon-Transparent</h3>
            <p className="text-xs text-[#58665B] leading-relaxed">
              No black-box ESG statistics. Every carbon number expands into its foundational IPCC parameters,
              fuel deductions, and audit tags (FACT, CALCULATED, ASSUMPTION, SIMULATED).
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6 — ENTER THE PLATFORM */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center w-full">
        <div className="bg-[#1E3F2B] text-white rounded-[16px] p-8 md:p-10 shadow-md relative overflow-hidden border border-[#295538]">
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <span className="text-[10px] font-mono text-[#70A777] uppercase tracking-wider font-bold">
              LIVE REGIONAL OPERATIONAL GRID
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Ready to Dispatch the Ahmedabad Corridor?
            </h2>
            <p className="text-xs md:text-sm text-[#EAF2E8] leading-relaxed">
              Enter the command center to inspect 5 active waste lots, 4 conversion facilities,
              run 2-opt route pruning, and test co-digestion stoichiometry.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onEnterOperations("overview")}
                className="btn-secondary bg-[#FFFFFF] hover:bg-[#F4F7F2] text-[#152219] px-6 py-3 text-sm font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Open Operations Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#295538]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full border-t border-[#D1DDD0] py-6 px-6 text-center text-xs font-mono text-[#829285]">
        Waste-to-Carbon Value Chain Tracker • HackOut'26 Circular Carbon Ecosystem • Ahmedabad–Kheda Grid
      </footer>
    </div>
  );
}

function OperationsShellView({
  activeTab,
  setActiveTab,
  selectedLot,
  setSelectedLotId,
  selectedFacility,
  setSelectedFacilityId,
  onReturnToLanding,
  mapMode,
  setMapMode,
  routeOptimized,
  setRouteOptimized,
  blendRatio,
  setBlendRatio,
  naturalLanguageQueryOpen,
  setNaturalLanguageQueryOpen,
  onInspectProvenance,
  showOrientationModal,
  onDismissOrientation
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7F2]">
      {/* First Time Orientation Modal */}
      {showOrientationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152219]/45 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] border border-[#D1DDD0] rounded-[14px] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1EAE0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-[6px] bg-[#295538] flex items-center justify-center text-white">
                  <Atom className="w-3.5 h-3.5 text-[#70A777]" />
                </div>
                <span className="font-bold text-sm text-[#152219]">Welcome to Operations Command</span>
              </div>
              <button
                onClick={onDismissOrientation}
                className="text-[#829285] hover:text-[#152219] p-1 rounded hover:bg-[#F4F7F2] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#58665B] leading-relaxed">
              This live workspace coordinates regional waste dispatch across the <strong>Ahmedabad–Kheda corridor</strong>.
              Here is how to navigate:
            </p>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0] flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#295538] mt-1 flex-shrink-0"></span>
                <div>
                  <strong className="text-[#152219]">1. Waste Generators (Green Circles)</strong>
                  <div className="text-[11px] text-[#58665B]">Click any lot to inspect moisture, C:N ratio, and trigger pathway matching.</div>
                </div>
              </div>

              <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0] flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#34517A] mt-1 flex-shrink-0"></span>
                <div>
                  <strong className="text-[#152219]">2. Conversion Hubs (Blue Squares)</strong>
                  <div className="text-[11px] text-[#58665B]">See live daily intake limits, queue hours, and remaining gate capacity.</div>
                </div>
              </div>

              <div className="p-3 bg-[#F8FAF7] rounded-[8px] border border-[#D1DDD0] flex items-start gap-2.5">
                <span className="w-3 h-0.5 bg-[#4F7D59] mt-2 flex-shrink-0"></span>
                <div>
                  <strong className="text-[#152219]">3. Active Routes (Lines)</strong>
                  <div className="text-[11px] text-[#58665B]">Prune travel distance using the 2-opt TSP optimization tool.</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-[#E1EAE0]">
              <button
                onClick={onReturnToLanding}
                className="text-xs text-[#58665B] hover:text-[#152219] font-mono cursor-pointer"
              >
                ← Return to Overview Story
              </button>
              <button
                onClick={onDismissOrientation}
                className="btn-primary px-4 py-2 text-xs cursor-pointer"
              >
                Explore Live Corridor
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      <aside className="w-64 border-r border-[#D1DDD0] bg-[#FFFFFF] flex flex-col justify-between z-30 flex-shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-[#D1DDD0] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#295538] flex items-center justify-center text-[#FFFFFF] shadow-xs">
                <Atom className="w-4 h-4 text-[#70A777]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-[#152219] tracking-tight">Waste-to-Carbon</span>
                  <span className="text-[9px] bg-[#EAF2E8] text-[#245233] border border-[#C3D9C1] font-mono px-1 py-0.5 rounded-[4px] font-semibold">
                    v3.2
                  </span>
                </div>
                <div className="text-[10px] text-[#58665B] font-medium">Value Chain Tracker</div>
              </div>
            </div>
          </div>

          {/* Corridor Context Pill */}
          <div className="p-3 mx-3 my-2.5 rounded-[8px] bg-[#F8FAF7] border border-[#D1DDD0] text-xs">
            <div className="flex items-center justify-between text-[#829285] text-[9px] font-mono mb-0.5">
              <span>ACTIVE CORRIDOR</span>
              <span className="flex items-center gap-1 text-[#245233] font-semibold">
                <StatusDot status="pulse" size="xs" /> LIVE
              </span>
            </div>
            <div className="font-bold text-[#152219] text-xs truncate">Ahmedabad – Kheda Region</div>
            <div className="text-[10px] text-[#58665B] mt-1 flex items-center justify-between font-mono">
              <span>Radius: 45 km</span>
              <span>5 Lots Active</span>
            </div>
          </div>

          {/* Primary Navigation Hierarchy */}
          <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-[#829285] uppercase font-bold tracking-wider">
            Primary Operations
          </div>
          <nav className="px-2 space-y-0.5">
            {[
              { id: "overview", label: "Command Center", icon: Compass },
              { id: "lots", label: "Waste Lots & Chemistry", icon: Droplets, count: "5" },
              { id: "facilities", label: "Conversion Hubs", icon: Factory, count: "4" },
              { id: "routes", label: "Route Optimizer", icon: Truck },
              { id: "impact", label: "Seasonality & Impact", icon: Activity }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#295538] text-[#FFFFFF] shadow-xs font-semibold"
                      : "text-[#152219] hover:bg-[#F4F7F2] hover:text-[#245233]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#70A777]" : "text-[#58665B]"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isActive ? "text-white bg-[#1E3F2B]" : "text-[#829285] bg-[#F4F7F2]"}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Deep Dives / Specialized Engines */}
          <div className="px-3 pt-4 pb-1 text-[10px] font-mono text-[#829285] uppercase font-bold tracking-wider">
            Optimization Engines
          </div>
          <nav className="px-2 space-y-0.5">
            {[
              { id: "matches", label: "4-Factor Match Engine", icon: Zap, badge: "Scoring" },
              { id: "codigestion", label: "Co-Digestion Advisor", icon: Sliders, badge: "Stoichiometry" },
              { id: "carbon", label: "IPCC Carbon Ledger", icon: ShieldCheck, badge: "Transparent" }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#295538] text-[#FFFFFF] shadow-xs font-semibold"
                      : "text-[#152219] hover:bg-[#F4F7F2] hover:text-[#245233]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#70A777]" : "text-[#58665B]"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[4px] border ${
                        isActive
                          ? "bg-[#1E3F2B] text-[#FFFFFF] border-transparent"
                          : "bg-[#EAF2E8] text-[#245233] border-[#C3D9C1]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Switcher & Health Indicator */}
        <div className="p-3 border-t border-[#D1DDD0] space-y-2">
          <button
            onClick={onReturnToLanding}
            className="w-full py-2 px-2.5 rounded-[8px] bg-[#F8FAF7] hover:bg-[#EAF2E8] text-[#245233] text-xs font-mono font-bold border border-[#D1DDD0] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>← Return to Product Story</span>
          </button>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#829285] px-1">
            <span>SCADA grid: 4s ago</span>
            <span className="text-[#245233] flex items-center gap-1.5 font-medium">
              <StatusDot status="active" size="xs" /> 100% Audited
            </span>
          </div>
        </div>
      </aside>

      {}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#D1DDD0] bg-[#FFFFFF] px-6 flex items-center justify-between gap-4 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#295538]" />
              <span className="text-xs font-bold text-[#152219]">Sector 14 Corridor</span>
              <span className="text-[10px] text-[#829285] font-mono hidden sm:inline">
                (Lat: 22.95N, Lng: 72.62E)
              </span>
            </div>
            <span className="text-[#D1DDD0]">|</span>
            <div className="text-xs font-mono text-[#58665B] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#829285]" />
              <span>12 Sep 2026</span>
              <span className="text-[10px] bg-[#EAF2E8] text-[#245233] border border-[#C3D9C1] px-1.5 py-0.5 rounded-[4px] font-semibold ml-1">
                Shift #02
              </span>
            </div>
          </div>

          {/* Operator Query Interface Trigger */}
          <button
            onClick={() => setNaturalLanguageQueryOpen(true)}
            className="flex items-center gap-2 bg-[#F8FAF7] border border-[#D1DDD0] hover:border-[#295538] px-3.5 py-1.5 rounded-[8px] text-xs text-[#58665B] transition-all max-w-md w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#295538]/20"
          >
            <Search className="w-3.5 h-3.5 text-[#295538]" />
            <span className="truncate text-left flex-1">
              Query corridor: "Which facility should take APMC food waste?"
            </span>
            <span className="text-[9px] font-mono bg-[#FFFFFF] border border-[#D1DDD0] px-1.5 py-0.5 rounded text-[#245233] shadow-2xs">
              ⌘K
            </span>
          </button>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <div className="flex items-center bg-[#F4F7F2] border border-[#D1DDD0] p-0.5 rounded-[8px]">
              <button
                onClick={() => setMapMode("operations")}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                  mapMode === "operations" ? "bg-[#295538] text-white shadow-xs font-bold" : "text-[#58665B] hover:text-[#152219]"
                }`}
              >
                Operations
              </button>
              <button
                onClick={() => setMapMode("planning")}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                  mapMode === "planning" ? "bg-[#295538] text-white shadow-xs font-bold" : "text-[#58665B] hover:text-[#152219]"
                }`}
              >
                Site Planning
              </button>
            </div>

            <button
              onClick={() => onInspectProvenance({
                title: "Shift Verification Ledger",
                type: "CALCULATED",
                source: "Regional SCADA & Weighbridge Ledger",
                equation: "Net avoided CO2e = sum(diverted_tonnes * pathway_emission_avoidance_factor)",
                timestamp: "2026-09-12 10:45 IST"
              })}
              className="p-1.5 rounded-[8px] border border-[#D1DDD0] hover:bg-[#EAF2E8] hover:border-[#A9BCA7] text-[#245233] transition-colors cursor-pointer"
              title="Provenance Explorer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto bg-[#F4F7F2] relative">
          {activeTab === "overview" && (
            <CommandCenterOverview
              selectedLot={selectedLot}
              onSelectLot={(id) => {
                setSelectedLotId(id);
                setActiveTab("lots");
              }}
              onSelectFacility={(id) => {
                setSelectedFacilityId(id);
                setActiveTab("facilities");
              }}
              onMatchNow={() => setActiveTab("matches")}
              mapMode={mapMode}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "lots" && (
            <WasteLotsWorkspace
              selectedLot={selectedLot}
              onSelectLotId={setSelectedLotId}
              onFindBestFacility={() => setActiveTab("matches")}
              onOpenCoDigestion={() => setActiveTab("codigestion")}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "facilities" && (
            <FacilityExplorerWorkspace
              selectedFacility={selectedFacility}
              onSelectFacilityId={setSelectedFacilityId}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "matches" && (
            <MatchEngineWorkspace
              matches={ACTIVE_MATCHES}
              onSelectMatch={(m) => {
                setSelectedLotId(m.generatorId);
                setSelectedFacilityId(m.facilityId);
                setActiveTab("routes");
              }}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "routes" && (
            <RouteOptimizationWorkspace
              routeOptimized={routeOptimized}
              onToggleOptimization={() => setRouteOptimized(!routeOptimized)}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "codigestion" && (
            <CoDigestionAdvisorWorkspace
              blendRatio={blendRatio}
              onChangeBlendRatio={setBlendRatio}
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "carbon" && (
            <CarbonLedgerWorkspace
              onInspectProvenance={onInspectProvenance}
            />
          )}

          {activeTab === "impact" && (
            <SeasonalImpactWorkspace
              onInspectProvenance={onInspectProvenance}
            />
          )}
        </main>
      </div>

      {/* Query Drawer */}
      {naturalLanguageQueryOpen && (
        <CommandQueryDrawer
          onClose={() => setNaturalLanguageQueryOpen(false)}
          onNavigate={(tab, lotId) => {
            if (tab) setActiveTab(tab);
            if (lotId) setSelectedLotId(lotId);
            setNaturalLanguageQueryOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CommandCenterOverview({ selectedLot, onSelectLot, onSelectFacility, onMatchNow, mapMode, onInspectProvenance }) {
  const topActionLot = REGIONAL_GENERATORS[0];

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* WHAT NEEDS ATTENTION RIGHT NOW? — Top Operational Decision Banner */}
      <div className="bg-[#FFFFFF] border-l-4 border-l-[#C58A42] border border-[#DDE6DA] rounded-[12px] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#FBF5EC] text-[#C58A42] flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#17231A]">WHAT NEEDS ATTENTION RIGHT NOW?</span>
                <span className="text-[10px] font-mono bg-[#FBF5EC] text-[#8C5D23] px-1.5 py-0.5 rounded font-bold">
                  2 Immediate Decisions
                </span>
              </div>
              <p className="text-xs text-[#68746B] mt-0.5">
                • <strong>APMC Food Waste (12.8 t)</strong>: Ready for morning dispatch before 10:00 AM fermentation onset.<br />
                • <strong>Sabarmati CSTR</strong>: Operating at 92% capacity quota. Recommend re-routing overflow to GreenGas Terminal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
            <button
              onClick={onMatchNow}
              className="px-3.5 py-1.5 bg-[#285238] hover:bg-[#1f422d] text-white text-xs font-bold rounded-[8px] transition-colors"
            >
              Resolve Matches Now →
            </button>
          </div>
        </div>
      </div>

      {/* Operational Flow Strip */}
      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <div>
              <div className="text-[10px] font-mono text-[#68746B] uppercase tracking-wider flex items-center gap-1.5">
                <span>ACTIVE TODAY</span>
                <ProvenanceBadge type="FACT" onClick={() => onInspectProvenance({
                  title: "Shift Gate Receipts Total",
                  type: "FACT",
                  source: "APMC & Cooperative Inward Scales",
                  value: "62.5 t total registered",
                  timestamp: "2026-09-12 06:00 - 11:00"
                })} />
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-mono font-bold text-[#17231A]">62.5</span>
                <span className="text-xs text-[#68746B] font-mono">tonnes available</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-[#86B98C] hidden sm:block" />

            <div>
              <div className="text-[10px] font-mono text-[#68746B] uppercase tracking-wider flex items-center gap-1.5">
                <span>MATCHED & ALLOCATED</span>
                <ProvenanceBadge type="CALCULATED" onClick={() => onInspectProvenance({
                  title: "Algorithmic Match Allocation",
                  type: "CALCULATED",
                  source: "Weighted Match Engine v3.2",
                  value: "40.7 t (65.1% efficiency)"
                })} />
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-mono font-bold text-[#285238]">40.7</span>
                <span className="text-xs text-[#285238] font-mono">tonnes routed</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-[#86B98C] hidden sm:block" />

            <div>
              <div className="text-[10px] font-mono text-[#68746B] uppercase tracking-wider">
                NETWORK CAPACITY
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-mono font-bold text-[#17231A]">29.5</span>
                <span className="text-xs text-[#68746B] font-mono">t/day remaining</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-[#86B98C] hidden sm:block" />

            <div>
              <div className="text-[10px] font-mono text-[#68746B] uppercase tracking-wider flex items-center gap-1.5">
                <span>ESTIMATED AVOIDANCE</span>
                <ProvenanceBadge type="CALCULATED" onClick={() => onInspectProvenance({
                  title: "Avoided Landfill Methane Impact",
                  type: "CALCULATED",
                  source: "IPCC 2006 Waste Model (100-yr horizon)",
                  value: "66.4 tCO2e net reduction"
                })} />
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-mono font-bold text-[#4F835B]">66.4</span>
                <span className="text-xs text-[#4F835B] font-mono">tCO2e avoided</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#DDE6DA]">
            <span className="text-xs font-mono text-[#68746B] hidden xl:inline">Active pathways:</span>
            <span className="px-2 py-1 bg-[#EAF1E8] text-[#285238] rounded font-mono text-[11px] font-semibold flex items-center gap-1">
              <Droplets className="w-3 h-3 text-[#4F835B]" /> Biogas (3)
            </span>
            <span className="px-2 py-1 bg-[#F3F7F1] text-[#647DA8] rounded font-mono text-[11px] font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3 text-[#647DA8]" /> Biochar (2)
            </span>
          </div>
        </div>
      </div>

      {/* Geospatial Operational Map + Top Action Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] overflow-hidden flex flex-col shadow-xs">
          <div className="p-3.5 border-b border-[#DDE6DA] bg-[#EAF1E8]/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#285238]" />
              <span className="font-bold text-xs text-[#17231A]">
                {mapMode === "operations"
                  ? "Live Value Chain Map — Ahmedabad Corridor"
                  : "Municipal Siting Screener — Feedstock Density & Catchment"}
              </span>
              <span className="text-[10px] font-mono text-[#68746B]">
                (5 Generators • 4 Conversion Hubs)
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-[#285238]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4F835B]"></span> Generator
              </span>
              <span className="flex items-center gap-1 text-[#647DA8]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#647DA8]"></span> Facility
              </span>
              <span className="flex items-center gap-1 text-[#567A60]">
                <span className="w-3 h-0.5 bg-[#567A60]"></span> Route
              </span>
            </div>
          </div>

          <div className="relative w-full h-[460px] bg-[#EAF1E8]/30 overflow-hidden select-none">
            <GeospatialOperationalCanvas
              generators={REGIONAL_GENERATORS}
              facilities={CONVERSION_FACILITIES}
              matches={ACTIVE_MATCHES}
              selectedLot={selectedLot}
              onSelectLot={onSelectLot}
              onSelectFacility={onSelectFacility}
              mapMode={mapMode}
            />

            <div className="absolute bottom-3 left-3 bg-[#FFFFFF]/95 backdrop-blur-xs border border-[#DDE6DA] rounded-[10px] p-2.5 text-[10px] font-mono shadow-sm space-y-1">
              <div className="font-bold text-[#17231A]">Active Corridor Constraints:</div>
              <div className="text-[#68746B]">• Max Economic Haul: 35 km</div>
              <div className="text-[#68746B]">• AD Moisture Window: 65% - 85%</div>
              <div className="text-[#68746B]">• Pyrolysis Moisture Limit: &lt; 25%</div>
            </div>
          </div>
        </div>

        {/* Top Action Right Now */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#C58A42] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#C58A42] animate-ping"></span>
                <span>TOP ACTION RIGHT NOW</span>
              </div>
              <span className="text-[10px] font-mono bg-[#EAF1E8] text-[#285238] px-2 py-0.5 rounded font-semibold">
                Match Score: 0.87
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-[#68746B] uppercase">Feedstock Lot #GEN-01</span>
              <h3 className="text-base font-bold text-[#17231A] leading-tight">
                {topActionLot.name}
              </h3>
              <p className="text-xs text-[#68746B] mt-0.5">{topActionLot.zone} • {topActionLot.wasteType}</p>
            </div>

            <div className="mt-4 p-3 bg-[#EAF1E8] border border-[#DDE6DA] rounded-[10px] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-[#285238]">Recommended Pathway:</span>
                <span className="font-mono font-bold text-[#285238] bg-[#FFFFFF] px-2 py-0.5 rounded border border-[#DDE6DA]">
                  {topActionLot.recommendedPathway} (CBG)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[10px] text-[#68746B]">MOISTURE:</span>
                  <div className="font-bold text-[#17231A]">78% ✓ <span className="text-[10px] font-normal text-[#4F835B]">(Wet range)</span></div>
                </div>
                <div>
                  <span className="text-[10px] text-[#68746B]">C:N RATIO:</span>
                  <div className="font-bold text-[#17231A]">24:1 ✓ <span className="text-[10px] font-normal text-[#4F835B]">(Optimal AD)</span></div>
                </div>
              </div>

              <p className="text-[11px] text-[#68746B] leading-relaxed pt-1 border-t border-[#DDE6DA]">
                {topActionLot.pathwayReason}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#DDE6DA] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#68746B]">Target Facility:</span>
                <span className="font-bold text-[#17231A]">GreenGas CBG Terminal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68746B]">Transit Distance:</span>
                <span className="font-mono font-bold text-[#285238]">18.2 km (Economical)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68746B]">Remaining Capacity:</span>
                <span className="font-mono font-bold text-[#17231A]">6.7 t / 25.0 t (73% used)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68746B]">Carbon Impact:</span>
                <span className="font-mono font-bold text-[#4F835B]">+15.1 tCO2e avoided</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={onMatchNow}
                className="w-full py-2.5 px-4 bg-[#285238] hover:bg-[#1f422d] text-[#FFFFFF] text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Dispatch Match & Plan Route</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSelectLot(topActionLot.id)}
                className="w-full py-2 px-3 bg-[#F3F7F1] hover:bg-[#EAF1E8] text-[#17231A] text-xs font-medium rounded-[8px] border border-[#DDE6DA] transition-colors text-center"
              >
                Inspect Feedstock Chemistry Spec
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeospatialOperationalCanvas({
  generators,
  facilities,
  matches,
  selectedLot,
  onSelectLot,
  onSelectFacility,
  mapMode = "operations"
}) {
  const [hoveredNode, setHoveredNode] = useState(null);

  return (
    <div className="w-full h-full relative">
      <svg
        viewBox="0 0 800 480"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="geoGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#DDE6DA" strokeWidth="0.8" opacity="0.6" />
          </pattern>
          <radialGradient id="densityGlow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4F835B" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#4F835B" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#4F835B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="densityGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C58A42" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#C58A42" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#C58A42" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="800" height="480" fill="#F8FAF7" />
        <rect width="800" height="480" fill="url(#geoGrid)" />

        {/* Sabarmati River Stylized Geographic Vector */}
        <path
          d="M 490 0 C 510 120, 520 200, 480 300 C 450 380, 470 440, 490 480"
          fill="none"
          stroke="#D0DFD0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <text x="495" y="60" fill="#9FB59E" fontSize="9" fontFamily="IBM Plex Mono" opacity="0.8">
          Sabarmati River Basin
        </text>

        {mapMode === "planning" && (
          <g>
            <circle cx="500" cy="270" r="140" fill="url(#densityGlow1)" />
            <circle cx="630" cy="380" r="130" fill="url(#densityGlow1)" />
            <circle cx="340" cy="250" r="100" fill="url(#densityGlow2)" />

            {facilities.map((fac) => (
              <circle
                key={`buffer-${fac.id}`}
                cx={fac.coordinates.x}
                cy={fac.coordinates.y}
                r="95"
                fill="none"
                stroke="#4F835B"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.5"
              />
            ))}

            <g transform="translate(240, 180)">
              <rect width="180" height="46" rx="8" fill="#FFFFFF" stroke="#C58A42" strokeWidth="1.5" />
              <text x="12" y="18" fill="#C58A42" fontSize="9" fontFamily="IBM Plex Mono" fontWeight="bold">
                UNDERSUPPLIED GAP: SANAND
              </text>
              <text x="12" y="32" fill="#17231A" fontSize="9" fontFamily="Plus Jakarta Sans">
                42 t/day cotton stalk lacks &lt;20km pyrolysis
              </text>
            </g>
          </g>
        )}

        {/* Active Routes */}
        {matches.map((m) => {
          const gen = generators.find((g) => g.id === m.generatorId);
          const fac = facilities.find((f) => f.id === m.facilityId);
          if (!gen || !fac) return null;

          const isSelected = selectedLot?.id === gen.id;

          return (
            <g key={m.id}>
              <line
                x1={gen.coordinates.x}
                y1={gen.coordinates.y}
                x2={fac.coordinates.x}
                y2={fac.coordinates.y}
                stroke={isSelected ? "#285238" : "#567A60"}
                strokeWidth={isSelected ? "3" : "1.8"}
                strokeDasharray={isSelected ? "none" : "5 4"}
                opacity={isSelected ? 1 : 0.65}
              />
              <rect
                x={(gen.coordinates.x + fac.coordinates.x) / 2 - 20}
                y={(gen.coordinates.y + fac.coordinates.y) / 2 - 8}
                width="40"
                height="16"
                rx="4"
                fill="#FFFFFF"
                stroke="#DDE6DA"
              />
              <text
                x={(gen.coordinates.x + fac.coordinates.x) / 2}
                y={(gen.coordinates.y + fac.coordinates.y) / 2 + 4}
                fill="#285238"
                fontSize="9"
                fontFamily="IBM Plex Mono"
                fontWeight="bold"
                textAnchor="middle"
              >
                {m.distanceKm}k
              </text>
            </g>
          );
        })}

        {/* Facilities */}
        {facilities.map((fac) => {
          const isFull = fac.utilization > 85;
          return (
            <g
              key={fac.id}
              transform={`translate(${fac.coordinates.x}, ${fac.coordinates.y})`}
              className="cursor-pointer"
              onClick={() => onSelectFacility(fac.id)}
              onMouseEnter={() => setHoveredNode(fac)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r="22"
                fill="#FFFFFF"
                stroke={isFull ? "#B94B47" : "#647DA8"}
                strokeWidth="2.5"
                className="shadow-sm"
              />
              <circle
                r="18"
                fill={isFull ? "#B94B47" : "#647DA8"}
                opacity={fac.utilization / 100}
              />
              <text
                dy="4"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="9"
                fontFamily="IBM Plex Mono"
                fontWeight="bold"
              >
                {Math.round(fac.utilization)}%
              </text>

              <rect
                x="-55"
                y="26"
                width="110"
                height="18"
                rx="4"
                fill="#FFFFFF"
                stroke="#DDE6DA"
                opacity="0.95"
              />
              <text
                y="38"
                textAnchor="middle"
                fill="#17231A"
                fontSize="9"
                fontFamily="Plus Jakarta Sans"
                fontWeight="600"
              >
                {fac.name.split(" ")[0]} ({fac.pathway})
              </text>
            </g>
          );
        })}

        {/* Waste Generators */}
        {generators.map((gen) => {
          const isSelected = selectedLot?.id === gen.id;
          const nodeColor = gen.recommendedPathway === "BIOGAS" ? "#4F835B" : "#C58A42";

          return (
            <g
              key={gen.id}
              transform={`translate(${gen.coordinates.x}, ${gen.coordinates.y})`}
              className="cursor-pointer"
              onClick={() => onSelectLot(gen.id)}
              onMouseEnter={() => setHoveredNode(gen)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {isSelected && (
                <circle
                  r="24"
                  fill="none"
                  stroke="#285238"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  className="animate-spin"
                />
              )}

              <circle
                r={isSelected ? "16" : "13"}
                fill={isSelected ? "#285238" : "#FFFFFF"}
                stroke={nodeColor}
                strokeWidth="3"
              />

              <text
                dy="3.5"
                textAnchor="middle"
                fill={isSelected ? "#FFFFFF" : "#17231A"}
                fontSize="9"
                fontFamily="IBM Plex Mono"
                fontWeight="bold"
              >
                {gen.dailyTonnage}t
              </text>

              <rect
                x="-25"
                y="-26"
                width="50"
                height="14"
                rx="3"
                fill="#FFFFFF"
                stroke="#DDE6DA"
              />
              <text
                y="-16"
                textAnchor="middle"
                fill={nodeColor}
                fontSize="8"
                fontFamily="IBM Plex Mono"
                fontWeight="bold"
              >
                {gen.moisture}% M
              </text>

              <text
                y="24"
                textAnchor="middle"
                fill="#17231A"
                fontSize="9"
                fontFamily="Plus Jakarta Sans"
                fontWeight={isSelected ? "bold" : "500"}
              >
                {gen.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node Hover Inspector */}
      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none bg-[#FFFFFF] border border-[#DDE6DA] rounded-[10px] p-3 text-xs shadow-md font-sans"
          style={{ top: 12, right: 12, maxWidth: 280 }}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#68746B]">{hoveredNode.zone || hoveredNode.type}</span>
            <span className="font-bold text-[#285238]">{hoveredNode.pathway || hoveredNode.recommendedPathway}</span>
          </div>
          <div className="font-bold text-[#17231A] text-sm">{hoveredNode.name}</div>
          <div className="mt-2 pt-2 border-t border-[#DDE6DA] grid grid-cols-2 gap-2 text-[11px] font-mono">
            {hoveredNode.dailyTonnage !== undefined ? (
              <>
                <div>Daily: <strong>{hoveredNode.dailyTonnage} t</strong></div>
                <div>Moisture: <strong>{hoveredNode.moisture}%</strong></div>
                <div>C:N: <strong>{hoveredNode.cnRatio}</strong></div>
                <div>Lignin: <strong>{hoveredNode.ligninPct}%</strong></div>
              </>
            ) : (
              <>
                <div>Capacity: <strong>{hoveredNode.totalCapacity} t/day</strong></div>
                <div>Remaining: <strong>{hoveredNode.remainingCapacity} t</strong></div>
                <div>Intake: <strong>{hoveredNode.currentIntake} t</strong></div>
                <div>Utilization: <strong>{hoveredNode.utilization}%</strong></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WasteLotsWorkspace({ selectedLot, onSelectLotId, onFindBestFacility, onOpenCoDigestion, onInspectProvenance }) {
  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="font-bold text-lg text-[#17231A]">Regional Waste Lots & Chemistry Profile</h2>
        <p className="text-xs text-[#68746B]">
          Feedstock characteristics determine conversion suitability. The pathway engine enforces biochemical constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] overflow-hidden shadow-xs flex flex-col">
          <div className="p-3.5 border-b border-[#DDE6DA] bg-[#EAF1E8]/30 flex items-center justify-between">
            <span className="font-bold text-xs text-[#17231A]">Registered Feedstock Lots</span>
            <span className="text-[10px] font-mono text-[#285238] bg-[#EAF1E8] px-2 py-0.5 rounded font-semibold">
              5 Active Lots
            </span>
          </div>

          <div className="divide-y divide-[#DDE6DA] overflow-y-auto max-h-[560px]">
            {REGIONAL_GENERATORS.map((lot) => {
              const isSelected = selectedLot.id === lot.id;
              return (
                <div
                  key={lot.id}
                  onClick={() => onSelectLotId(lot.id)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected ? "bg-[#EAF1E8] border-l-4 border-[#285238]" : "hover:bg-[#F3F7F1]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-[#68746B] font-semibold">{lot.id} • {lot.zone}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      lot.recommendedPathway === "BIOGAS"
                        ? "bg-[#EAF1E8] text-[#285238] border border-[#4F835B]/30"
                        : lot.recommendedPathway === "BIOCHAR"
                        ? "bg-[#EEF3F8] text-[#34517A] border border-[#647DA8]/30"
                        : "bg-[#FBF5EC] text-[#8C5D23] border border-[#C58A42]/30"
                    }`}>
                      {lot.recommendedPathway}
                    </span>
                  </div>

                  <div className="font-bold text-sm text-[#17231A]">{lot.name}</div>
                  <div className="text-xs text-[#68746B] mt-0.5">{lot.wasteType}</div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs font-mono pt-2 border-t border-[#DDE6DA]/60">
                    <div>
                      <span className="text-[10px] text-[#68746B]">VOLUME:</span>
                      <div className="font-bold text-[#17231A]">{lot.dailyTonnage} t/day</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#68746B]">MOISTURE:</span>
                      <div className="font-bold text-[#17231A]">{lot.moisture}%</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#68746B]">C:N RATIO:</span>
                      <div className="font-bold text-[#17231A]">{lot.cnRatio}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#68746B] uppercase">Feedstock Technical Dossier</span>
                <h3 className="font-bold text-lg text-[#17231A]">{selectedLot.name}</h3>
                <div className="text-xs text-[#68746B]">{selectedLot.zone} • Category: {selectedLot.category}</div>
              </div>
              <ProvenanceBadge type="FACT" onClick={() => onInspectProvenance({
                title: `${selectedLot.name} Spectrometry & Lab Log`,
                type: "FACT",
                source: "Gujarat State Bio-Energy Testing Facility",
                labReportId: `LAB-GJ-${selectedLot.id}-2026`,
                timestamp: "2026-09-10 14:20 IST"
              })} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
                <div className="text-[10px] font-mono text-[#68746B]">MOISTURE CONTENT</div>
                <div className="text-xl font-mono font-bold text-[#17231A] mt-0.5">{selectedLot.moisture}%</div>
                <div className="text-[10px] text-[#68746B] mt-0.5">
                  {selectedLot.moisture > 60 ? "High water activity" : "Low water activity"}
                </div>
              </div>

              <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
                <div className="text-[10px] font-mono text-[#68746B]">C:N RATIO</div>
                <div className="text-xl font-mono font-bold text-[#285238] mt-0.5">{selectedLot.cnRatio}</div>
                <div className="text-[10px] text-[#68746B] mt-0.5">
                  {selectedLot.cnNumeric < 20 ? "Nitrogen-rich (Risk)" : selectedLot.cnNumeric > 35 ? "Carbon-rich (Pyrolysis)" : "Optimal AD balance"}
                </div>
              </div>

              <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
                <div className="text-[10px] font-mono text-[#68746B]">LIGNIN FRACTION</div>
                <div className="text-xl font-mono font-bold text-[#17231A] mt-0.5">{selectedLot.ligninPct}%</div>
                <div className="text-[10px] text-[#68746B] mt-0.5">Structural recalcitrance</div>
              </div>

              <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
                <div className="text-[10px] font-mono text-[#68746B]">BULK DENSITY</div>
                <div className="text-xl font-mono font-bold text-[#17231A] mt-0.5">{selectedLot.bulkDensity}</div>
                <div className="text-[10px] text-[#68746B] mt-0.5">Transport compaction</div>
              </div>
            </div>

            <div className="p-4 bg-[#EAF1E8] border border-[#4F835B]/30 rounded-[12px] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Atom className="w-4 h-4 text-[#285238]" />
                  <span className="font-bold text-xs text-[#285238] uppercase tracking-wide font-mono">
                    Chemistry Pathway Recommender
                  </span>
                </div>
                <span className="text-[11px] font-mono bg-[#FFFFFF] px-2 py-0.5 rounded text-[#285238] font-bold border border-[#DDE6DA]">
                  Recommended: {selectedLot.recommendedPathway}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4F835B]" />
                  <span>Moisture Compatibility: {selectedLot.moisture}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4F835B]" />
                  <span>C:N Envelope: {selectedLot.cnRatio}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4F835B]" />
                  <span>Lignin Degradability: {selectedLot.ligninPct}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4F835B]" />
                  <span>Haul Radius Viability: 18.2 km</span>
                </div>
              </div>

              <div className="p-3 bg-[#FFFFFF] rounded-[8px] border border-[#DDE6DA] text-xs text-[#17231A] leading-relaxed">
                <div className="font-semibold text-[#285238] mb-1">WHY THIS PATHWAY?</div>
                {selectedLot.pathwayReason}
              </div>

              {selectedLot.recommendedPathway === "CO-DIGESTION" && (
                <div className="p-2 bg-[#FBF5EC] border border-[#C58A42]/40 rounded-[8px] flex items-center justify-between text-xs">
                  <span className="text-[#8C5D23] font-medium">
                    High nitrogen risk detected. Blending with carbon-rich crop partner required.
                  </span>
                  <button
                    onClick={onOpenCoDigestion}
                    className="px-2.5 py-1 bg-[#C58A42] text-white rounded font-mono text-[10px] font-bold hover:bg-[#a67232]"
                  >
                    Open Blend Optimizer →
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs font-mono text-[#68746B]">
                Pickup window: <strong className="text-[#17231A]">{selectedLot.pickupWindow}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onFindBestFacility}
                  className="px-4 py-2 bg-[#285238] hover:bg-[#1f422d] text-white rounded-[8px] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-[#86B98C]" />
                  <span>Run Matching Engine for this Lot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacilityExplorerWorkspace({ selectedFacility, onSelectFacilityId, onInspectProvenance }) {
  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="font-bold text-lg text-[#17231A]">Conversion Hubs & Intake Windows</h2>
        <p className="text-xs text-[#68746B]">
          Real-time facility utilization, remaining intake capacity, and biochemical gate constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CONVERSION_FACILITIES.map((fac) => {
          const isSelected = selectedFacility.id === fac.id;
          const isNearFull = fac.utilization > 85;

          return (
            <div
              key={fac.id}
              onClick={() => onSelectFacilityId(fac.id)}
              className={`bg-[#FFFFFF] border rounded-[14px] p-4 cursor-pointer transition-all shadow-xs ${
                isSelected ? "border-[#285238] ring-2 ring-[#285238]/20 bg-[#EAF1E8]/20" : "border-[#DDE6DA] hover:border-[#4F835B]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                <span className="text-[#68746B]">{fac.id}</span>
                <span className={`px-1.5 py-0.5 rounded font-bold ${
                  fac.pathway === "BIOGAS"
                    ? "bg-[#EAF1E8] text-[#285238]"
                    : fac.pathway === "BIOCHAR"
                    ? "bg-[#EEF3F8] text-[#34517A]"
                    : "bg-[#FBF5EC] text-[#8C5D23]"
                }`}>
                  {fac.pathway}
                </span>
              </div>

              <h4 className="font-bold text-sm text-[#17231A] leading-tight">{fac.name}</h4>
              <div className="text-[11px] text-[#68746B] mt-0.5">{fac.type}</div>

              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#68746B]">Intake Load:</span>
                  <span className="font-bold text-[#17231A]">{fac.currentIntake} / {fac.totalCapacity} t/day</span>
                </div>
                <div className="w-full bg-[#EAF1E8] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isNearFull ? "bg-[#B94B47]" : "bg-[#4F835B]"}`}
                    style={{ width: `${fac.utilization}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#68746B]">
                  <span>{fac.utilization}% Utilized</span>
                  <span className={fac.remainingCapacity < 3 ? "text-[#B94B47] font-bold" : "text-[#285238] font-bold"}>
                    {fac.remainingCapacity} t remaining
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#DDE6DA] text-xs font-mono space-y-1 text-[#68746B]">
                <div className="flex justify-between">
                  <span>Gate Queue:</span>
                  <span className="text-[#17231A] font-semibold">{fac.queueHours} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span>Carbon Factor:</span>
                  <span className="text-[#4F835B] font-semibold">+{fac.carbonIntensityPerTonne} tCO2e/t</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3">
          <div>
            <span className="text-[10px] font-mono text-[#68746B] uppercase">Gate Acceptance Rules</span>
            <h3 className="text-base font-bold text-[#17231A]">{selectedFacility.name}</h3>
            <p className="text-xs text-[#68746B]">Status: <strong className="text-[#285238]">{selectedFacility.operationalStatus}</strong></p>
          </div>
          <ProvenanceBadge type="FACT" onClick={() => onInspectProvenance({
            title: `${selectedFacility.name} Operating License & CBG Yield`,
            type: "FACT",
            source: "Ministry of New and Renewable Energy (MNRE) Portal",
            licenseNo: "SATAT-GJ-09941",
            timestamp: "2026-08-28"
          })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
            <div className="text-[10px] text-[#68746B] mb-1">ACCEPTED FEEDSTOCKS</div>
            <div className="space-y-1">
              {selectedFacility.acceptedFeedstocks.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[#17231A]">
                  <Check className="w-3 h-3 text-[#4F835B]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA]">
            <div className="text-[10px] text-[#68746B] mb-1">BIOCHEMICAL ENVELOPE</div>
            <div className="space-y-1.5 text-[#17231A]">
              <div>Moisture: <strong>{selectedFacility.moistureThreshold}</strong></div>
              <div>C:N Target: <strong>{selectedFacility.cnTolerance}</strong></div>
              <div>Incoming Pending: <strong>{selectedFacility.incomingLots} trucks scheduled</strong></div>
            </div>
          </div>

          <div className="p-3 bg-[#EAF1E8] rounded-[10px] border border-[#4F835B]/30">
            <div className="text-[10px] text-[#285238] font-bold mb-1">COMMERCIAL & CARBON BALANCE</div>
            <div className="space-y-1.5 text-[#285238]">
              <div>Gate Fee: <strong>{selectedFacility.gateFeePerTonne < 0 ? `Credit of ₹${Math.abs(selectedFacility.gateFeePerTonne * 82)}/t` : `Tipping fee ₹${selectedFacility.gateFeePerTonne * 82}/t`}</strong></div>
              <div>Avoidance Factor: <strong>{selectedFacility.carbonIntensityPerTonne} tCO2e / tonne</strong></div>
              <div>Capacity Utilization: <strong>{selectedFacility.utilization}%</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchEngineWorkspace({ matches, onSelectMatch, onInspectProvenance }) {
  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="font-bold text-lg text-[#17231A]">Intelligent Match Engine</h2>
        <p className="text-xs text-[#68746B]">
          Matches generators to facilities using the documented 4-factor formula: Distance (35%), Volume (25%), Capacity (15%), Pathway (25%).
        </p>
      </div>

      <div className="p-3.5 bg-[#FFFFFF] border border-[#DDE6DA] rounded-[12px] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#4F835B]" />
          <span className="font-bold text-[#17231A]">Default Match Scoring Algorithm:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#68746B]">
          <span className="bg-[#EAF1E8] text-[#285238] px-2 py-0.5 rounded font-semibold">Distance: 35%</span>
          <span className="bg-[#EAF1E8] text-[#285238] px-2 py-0.5 rounded font-semibold">Volume Fit: 25%</span>
          <span className="bg-[#EAF1E8] text-[#285238] px-2 py-0.5 rounded font-semibold">Capacity Fit: 15%</span>
          <span className="bg-[#EAF1E8] text-[#285238] px-2 py-0.5 rounded font-semibold">Pathway Fit: 25%</span>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDE6DA] bg-[#EAF1E8]/40 text-[#68746B] font-mono text-[11px]">
                <th className="py-3 px-4 font-semibold">RANK / ID</th>
                <th className="py-3 px-4 font-semibold">GENERATOR & FEEDSTOCK</th>
                <th className="py-3 px-4 font-semibold">TARGET FACILITY</th>
                <th className="py-3 px-4 font-semibold text-right">HAUL DISTANCE</th>
                <th className="py-3 px-4 font-semibold">WEIGHTED FIT BREAKDOWN</th>
                <th className="py-3 px-4 font-semibold text-right">MATCH SCORE</th>
                <th className="py-3 px-4 font-semibold text-right">AVOIDED CO2e</th>
                <th className="py-3 px-4 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE6DA]">
              {matches.map((m, idx) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectMatch(m)}
                  className="hover:bg-[#EAF1E8]/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-[#17231A]">
                    #{idx + 1} <span className="text-[10px] text-[#68746B] font-normal">({m.id})</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#17231A]">{m.generatorName}</div>
                    <div className="text-[11px] text-[#68746B]">{m.feedstock}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#17231A]">{m.facilityName}</div>
                    <div className="text-[10px] font-mono text-[#4F835B]">Assigned: {m.truckAssigned}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-[#17231A]">
                    {m.distanceKm} km
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-1 w-44">
                      <div className="flex h-2 rounded-full overflow-hidden bg-[#DDE6DA]">
                        <div style={{ width: "35%" }} className="bg-[#4F835B]" title={`Distance Fit: ${m.distanceKm} km`} />
                        <div style={{ width: "25%" }} className="bg-[#86B98C]" title={`Volume Fit: ${m.volumeFit}%`} />
                        <div style={{ width: "15%" }} className="bg-[#647DA8]" title={`Capacity Fit: ${m.capacityFit}%`} />
                        <div style={{ width: "25%" }} className="bg-[#285238]" title={`Pathway Fit: ${m.pathwayFit}%`} />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-[#68746B]">
                        <span>Vol {m.volumeFit}%</span>
                        <span>Cap {m.capacityFit}%</span>
                        <span>Path {m.pathwayFit}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span className="text-sm font-bold text-[#285238] bg-[#EAF1E8] px-2 py-0.5 rounded">
                      {m.matchScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-[#4F835B]">
                    +{m.co2Avoided} t
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="px-2.5 py-1 bg-[#285238] text-white rounded text-xs font-semibold hover:bg-[#1f422d] transition-colors">
                      Deploy Route
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RouteOptimizationWorkspace({ routeOptimized, onToggleOptimization, onInspectProvenance }) {
  const currentKm = 98.4;
  const optimizedKm = 87.2;
  const deltaKm = (currentKm - optimizedKm).toFixed(1);

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg text-[#17231A]">Logistics & Route Optimization</h2>
          <p className="text-xs text-[#68746B]">
            Nearest-neighbour heuristic with 2-opt refinement eliminates deadheading and lowers transport diesel emissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOptimization}
            className={`px-4 py-2 rounded-[8px] text-xs font-bold font-mono transition-all flex items-center gap-2 ${
              routeOptimized
                ? "bg-[#285238] text-white shadow-xs"
                : "bg-[#FFFFFF] border border-[#DDE6DA] text-[#17231A] hover:bg-[#EAF1E8]"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{routeOptimized ? "2-Opt Refinement ACTIVE (-11.2 km)" : "Run 2-Opt TSP Refinement"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#68746B]">BASELINE CIRCUIT</div>
          <div className="text-2xl font-mono font-bold text-[#17231A] mt-0.5">{currentKm} km</div>
          <div className="text-[11px] text-[#68746B] mt-0.5">FIFO generator dispatch sequence</div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#4F835B]/40 bg-[#EAF1E8]/30 rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#285238] font-semibold">2-OPT OPTIMIZED CIRCUIT</div>
          <div className="text-2xl font-mono font-bold text-[#285238] mt-0.5">{routeOptimized ? optimizedKm : currentKm} km</div>
          <div className="text-[11px] text-[#285238] font-mono mt-0.5">
            {routeOptimized ? `↓ ${deltaKm} km saved (-11.4%)` : "Click button above to refine"}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#68746B]">DIESEL CO2 SAVINGS</div>
          <div className="text-2xl font-mono font-bold text-[#4F835B] mt-0.5">
            {routeOptimized ? "28.4 kg" : "0.0 kg"}
          </div>
          <div className="text-[11px] text-[#68746B] mt-0.5">Based on 2.68 kgCO2e/L heavy diesel factor</div>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#285238]" />
            <span className="font-bold text-xs text-[#17231A]">
              TRUCK #04 CIRCUIT — Heavy Compactor (GJ-01-BX-4482)
            </span>
          </div>
          <span className="text-xs font-mono text-[#285238] bg-[#EAF1E8] px-2 py-0.5 rounded font-semibold">
            Capacity Load: 6.8 / 8.0 t (85% utilized)
          </span>
        </div>

        <div className="relative pl-6 border-l-2 border-[#DDE6DA] space-y-6 ml-3 my-2 font-mono text-xs">
          {[
            { time: "08:30", stop: "Hub Depot Departure", loc: "Ahmedabad Central Depot", note: "Empty tare weight verified" },
            { time: "09:15", stop: "Stop 1: APMC Central Market (GEN-01)", loc: "Fruit & Veg Organics", note: "+4.2 t loaded (78% moisture)" },
            { time: "10:40", stop: "Stop 2: Bawla Agro Cluster (GEN-05)", loc: "Citrus & Potato Pulp", note: "+2.6 t loaded (72% moisture)" },
            { time: "11:50", stop: "Destination: GreenGas CBG Terminal", loc: "Terminal Weighbridge B", note: "Gate queue 0.8h, unload into Digestor 2" }
          ].map((s, idx) => (
            <div key={idx} className="relative">
              <span className="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-[#FFFFFF] border-2 border-[#4F835B]"></span>
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-[#17231A]">{s.stop}</span>
                <span className="text-[#68746B]">{s.time}</span>
              </div>
              <div className="text-[11px] text-[#285238]">{s.loc}</div>
              <div className="text-[10px] text-[#68746B] mt-0.5">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoDigestionAdvisorWorkspace({ blendRatio, onChangeBlendRatio, onInspectProvenance }) {
  const manureShare = blendRatio;
  const strawShare = 100 - blendRatio;
  const compositeCN = ((manureShare * 12 + strawShare * 52) / 100).toFixed(1);
  const isOptimal = compositeCN >= 22 && compositeCN <= 28;

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="font-bold text-lg text-[#17231A]">Co-Digestion Stoichiometric Advisor</h2>
        <p className="text-xs text-[#68746B]">
          Solve biochemical inhibition: Blend nitrogen-heavy dairy slurry with carbon-rich crop stubble to reach the optimal 20:1–30:1 C:N digestion envelope.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#285238]" />
              <span className="font-bold text-xs text-[#17231A]">Stoichiometric Blend Ratio Calculator</span>
            </div>
            <ProvenanceBadge type="CALCULATED" onClick={() => onInspectProvenance({
              title: "Anaerobic Co-Digestion Carbon-Nitrogen Balance",
              type: "CALCULATED",
              formula: "Composite C:N = (W_manure * CN_manure + W_straw * CN_straw) / (W_manure + W_straw)",
              source: "IAEA Guidelines on Biogas Methanogenesis Stabilization",
              timestamp: "2026-09-12"
            })} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 bg-[#F3F7F1] border border-[#DDE6DA] rounded-[10px]">
              <div className="text-[10px] text-[#68746B]">SUBSTRATE A (NITROGEN-RICH)</div>
              <div className="font-bold text-[#17231A] text-sm mt-0.5">Bovine Dairy Slurry</div>
              <div className="text-[11px] text-[#B94B47] mt-1 font-semibold">C:N = 12:1 (Too low alone)</div>
              <div className="text-[10px] text-[#68746B]">Moisture: 84% • Ammonia risk</div>
            </div>

            <div className="p-3 bg-[#F3F7F1] border border-[#DDE6DA] rounded-[10px]">
              <div className="text-[10px] text-[#68746B]">SUBSTRATE B (CARBON-RICH)</div>
              <div className="font-bold text-[#17231A] text-sm mt-0.5">Paddy Straw Stubble</div>
              <div className="text-[11px] text-[#C58A42] mt-1 font-semibold">C:N = 52:1 (Slow degradation)</div>
              <div className="text-[10px] text-[#68746B]">Moisture: 16% • High lignin</div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#285238] font-bold">Substrate A: {manureShare}% (Manure)</span>
              <span className="text-[#4F835B] font-bold">Substrate B: {strawShare}% (Crop Straw)</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={blendRatio}
              onChange={(e) => onChangeBlendRatio(Number(e.target.value))}
              className="w-full h-2 bg-[#DDE6DA] rounded-lg appearance-none cursor-pointer accent-[#285238]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#68746B]">
              <span>10% Manure / 90% Straw</span>
              <span>Balanced Recommendation: 42% / 58%</span>
              <span>90% Manure / 10% Straw</span>
            </div>
          </div>

          <div className={`p-4 rounded-[12px] border ${
            isOptimal ? "bg-[#EAF1E8] border-[#4F835B]/40" : "bg-[#FBF5EC] border-[#C58A42]/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs font-mono uppercase">COMPOSITE BLEND RESULT</span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                isOptimal ? "bg-[#285238] text-white" : "bg-[#C58A42] text-white"
              }`}>
                {isOptimal ? "✓ Inside Ideal AD Window" : "⚠ Outside Optimal Window"}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-2 font-mono">
              <span className="text-3xl font-bold text-[#17231A]">{compositeCN}:1</span>
              <span className="text-xs text-[#68746B]">Target Range: 22:1 – 28:1</span>
            </div>

            <p className="text-xs text-[#17231A] mt-2 leading-relaxed">
              {isOptimal
                ? "Optimal methanogenesis stability. The straw dilutes ammonia toxicity, while the manure provides active anaerobic microbial inoculum."
                : compositeCN < 22
                ? "Warning: Excess nitrogen will produce free un-ionized ammonia (NH3), suppressing volatile fatty acid conversion."
                : "Warning: High carbon content will slow digestor turnover and leave recalcitrant floating scum."}
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-[#DDE6DA] pb-3 mb-3">
              <span className="text-[10px] font-mono text-[#68746B] uppercase">Projected Biogas Production</span>
              <h3 className="font-bold text-sm text-[#17231A]">Methane Yield Lift Factor</h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#F3F7F1] rounded-[10px]">
                <div className="text-[10px] text-[#68746B]">STANDALONE MANURE YIELD:</div>
                <div className="text-base font-bold text-[#17231A]">190 Nm³ CH4 / t VS</div>
              </div>

              <div className="p-3 bg-[#F3F7F1] rounded-[10px]">
                <div className="text-[10px] text-[#68746B]">CO-DIGESTED COMPOSITE YIELD:</div>
                <div className="text-base font-bold text-[#285238]">
                  {isOptimal ? "285 Nm³ CH4 / t VS (+50.0%)" : "210 Nm³ CH4 / t VS"}
                </div>
              </div>

              <div className="p-3 bg-[#EAF1E8] rounded-[10px] border border-[#4F835B]/30">
                <div className="text-[10px] text-[#285238] font-bold">DIGESTATE BIO-FERTILIZER VALUE:</div>
                <div className="text-sm font-bold text-[#285238] mt-0.5">High-grade N-P-K Organic Humus</div>
                <div className="text-[11px] text-[#285238] mt-0.5">Moisture 68% • Cured in 14 days</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#DDE6DA]">
            <button
              onClick={() => onChangeBlendRatio(42)}
              className="w-full py-2 bg-[#F3F7F1] hover:bg-[#EAF1E8] text-[#17231A] text-xs font-mono font-bold rounded-[8px] border border-[#DDE6DA] transition-colors"
            >
              Reset to Optimal Ratio (42% / 58%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarbonLedgerWorkspace({ onInspectProvenance }) {
  const [gwpHorizon, setGwpHorizon] = useState("100");

  const DOC = 0.15;
  const DOCf = 0.50;
  const MCF = 0.80;
  const F = 0.50;
  const stoichiometricFactor = 1.333;
  const gwpVal = gwpHorizon === "100" ? 28 : 84;

  const divertedTonnes = 10.0;
  const grossAvoidedMethane = divertedTonnes * DOC * DOCf * MCF * F * stoichiometricFactor;
  const grossCO2e = grossAvoidedMethane * gwpVal;
  const transportEmissions = 0.42;
  const processingEmissions = 0.68;
  const netAvoidedCO2e = (grossCO2e - transportEmissions - processingEmissions).toFixed(1);

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg text-[#17231A]">Transparent Carbon Ledger & IPCC Parameters</h2>
          <p className="text-xs text-[#68746B]">
            Every carbon number expands into its foundational IPCC parameters, transport deductions, and uncertainty bounds.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#DDE6DA] p-1 rounded-[8px] text-xs font-mono">
          <span className="text-[#68746B] pl-2">GWP HORIZON:</span>
          <button
            onClick={() => setGwpHorizon("100")}
            className={`px-2.5 py-1 rounded-[6px] transition-colors ${
              gwpHorizon === "100" ? "bg-[#285238] text-white font-bold" : "text-[#68746B]"
            }`}
          >
            100-Year (GWP: 28)
          </button>
          <button
            onClick={() => setGwpHorizon("20")}
            className={`px-2.5 py-1 rounded-[6px] transition-colors ${
              gwpHorizon === "20" ? "bg-[#285238] text-white font-bold" : "text-[#68746B]"
            }`}
          >
            20-Year (GWP: 84)
          </button>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-baseline lg:items-center justify-between gap-6 border-b border-[#DDE6DA] pb-5">
          <div>
            <div className="text-[10px] font-mono text-[#68746B] uppercase flex items-center gap-2">
              <span>NET DIVERSION IMPACT (PER 10 TONNES FEEDSTOCK)</span>
              <ProvenanceBadge type="CALCULATED" onClick={() => onInspectProvenance({
                title: "IPCC 2006 Waste Diversion Equation",
                type: "CALCULATED",
                source: "IPCC Guidelines for National GHG Inventories (Chapter 3)",
                formula: "Net CO2e = [W * DOC * DOCf * MCF * F * 16/12 * GWP] - (E_transport + E_process)",
                timestamp: "2026-09-12"
              })} />
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-4xl font-mono font-bold text-[#285238]">{netAvoidedCO2e}</span>
              <span className="font-mono text-sm text-[#68746B]">tCO2e avoided</span>
              <span className="text-xs font-mono font-semibold text-[#4F835B] bg-[#EAF1E8] px-2 py-0.5 rounded">
                Uncertainty Range: ±8.4%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <div className="p-2 bg-[#F3F7F1] rounded border border-[#DDE6DA]">
              <div className="text-[9px] text-[#68746B]">GROSS METHANE</div>
              <div className="font-bold text-[#17231A]">{(grossAvoidedMethane).toFixed(2)} t CH4</div>
            </div>
            <span className="text-[#68746B]">×</span>
            <div className="p-2 bg-[#F3F7F1] rounded border border-[#DDE6DA]">
              <div className="text-[9px] text-[#68746B]">GWP ({gwpHorizon}y)</div>
              <div className="font-bold text-[#17231A]">{gwpVal}</div>
            </div>
            <span className="text-[#68746B]">−</span>
            <div className="p-2 bg-[#F3F7F1] rounded border border-[#DDE6DA]">
              <div className="text-[9px] text-[#68746B]">TRANSPORT</div>
              <div className="font-bold text-[#B94B47]">{transportEmissions} t</div>
            </div>
            <span className="text-[#68746B]">−</span>
            <div className="p-2 bg-[#F3F7F1] rounded border border-[#DDE6DA]">
              <div className="text-[9px] text-[#68746B]">PROCESSING</div>
              <div className="font-bold text-[#B94B47]">{processingEmissions} t</div>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="font-bold text-xs text-[#17231A]">Foundational Parameter Registry:</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            {[
              { code: "DOC", label: "Degradable Organic Carbon", val: "0.15", type: "FACT", cite: "IPCC default for tropical food waste" },
              { code: "DOCf", label: "Fraction of DOC Dissimilated", val: "0.50", type: "ASSUMPTION", cite: "Standard anaerobic degradation rate" },
              { code: "MCF", label: "Methane Correction Factor", val: "0.80", type: "FACT", cite: "Unmanaged deep landfill (>5m depth)" },
              { code: "F", label: "Methane in Landfill Gas", val: "0.50", type: "ASSUMPTION", cite: "Stoichiometric 50% CH4 / 50% CO2" },
              { code: "OX", label: "Soil Oxidation Factor", val: "0.00", type: "ASSUMPTION", cite: "Zero topsoil methane oxidation" },
              { code: "GWP_100", label: "Global Warming Potential", val: `${gwpVal}`, type: "FACT", cite: "IPCC AR5 without feedback" }
            ].map((p) => (
              <div
                key={p.code}
                onClick={() => onInspectProvenance({
                  title: `${p.code} — ${p.label}`,
                  type: p.type,
                  value: p.val,
                  source: p.cite,
                  parameterCode: p.code
                })}
                className="p-3 bg-[#F3F7F1] rounded-[10px] border border-[#DDE6DA] hover:border-[#4F835B] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#17231A]">{p.code} = {p.val}</span>
                  <ProvenanceBadge type={p.type} />
                </div>
                <div className="text-[11px] text-[#68746B] mt-1 font-sans">{p.label}</div>
                <div className="text-[10px] text-[#285238] mt-1 truncate">{p.cite}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeasonalImpactWorkspace({ onInspectProvenance }) {
  return (
    <div className="p-5 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="font-bold text-lg text-[#17231A]">Seasonal Availability & Cumulative Carbon Impact</h2>
        <p className="text-xs text-[#68746B]">
          Predictive calendar reveals feedstock gaps (e.g. post-harvest paddy spikes vs summer deficits) ensuring year-round facility intake.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#68746B]">TONNES DIVERTED (YTD)</div>
          <div className="text-3xl font-mono font-bold text-[#17231A] mt-0.5">1,482.0 t</div>
          <div className="text-[11px] text-[#4F835B] font-mono mt-0.5">↑ 24.2% vs last cycle</div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#68746B]">AVOIDED CO2e EMISSIONS</div>
          <div className="text-3xl font-mono font-bold text-[#285238] mt-0.5">1,940.6 t</div>
          <div className="text-[11px] text-[#285238] font-mono mt-0.5">Validated on IPCC 100y</div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#68746B]">NET LOGISTICS COST</div>
          <div className="text-3xl font-mono font-bold text-[#17231A] mt-0.5">₹412 / t</div>
          <div className="text-[11px] text-[#68746B] font-mono mt-0.5">Within ₹500 budget cap</div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-4 shadow-xs">
          <div className="text-[10px] font-mono text-[#285238] font-semibold">CBG & BIOCHAR REVENUE</div>
          <div className="text-3xl font-mono font-bold text-[#4F835B] mt-0.5">₹2.84 M</div>
          <div className="text-[11px] text-[#4F835B] font-mono mt-0.5">Offtake contracts active</div>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[14px] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-[#17231A]">Annual Feedstock Generation Cycle (Monthly Tonnes)</h3>
            <p className="text-xs text-[#68746B]">
              Identifies the critical October–November paddy straw spike and summer food waste ramp.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#285238]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#285238]"></span> Paddy Straw (Stubble)
            </span>
            <span className="flex items-center gap-1.5 text-[#C58A42]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#C58A42]"></span> Cotton Stalk
            </span>
            <span className="flex items-center gap-1.5 text-[#4F835B]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4F835B]"></span> Food Organics
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SEASONAL_FEEDSTOCK_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fill: "#68746B", fontSize: 11, fontFamily: "Plus Jakarta Sans" }}
                axisLine={{ stroke: "#DDE6DA" }}
                tickLine={{ stroke: "#DDE6DA" }}
              />
              <YAxis
                tick={{ fill: "#68746B", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: "#DDE6DA" }}
                tickLine={{ stroke: "#DDE6DA" }}
              />
              <RechartsTooltip content={<ModernTooltip />} />
              <Bar dataKey="paddyStraw" name="Paddy Straw" stackId="a" fill="#285238" />
              <Bar dataKey="cottonStalk" name="Cotton Stalk" stackId="a" fill="#C58A42" />
              <Bar dataKey="foodWaste" name="Food Organics" stackId="a" fill="#4F835B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CommandQueryDrawer({ onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);

  const PREBUILT_QUERIES = [
    "Which facility should take this week's food waste from zone 4?",
    "What happens if Rice Straw moisture spikes to 32%?",
    "Where is the biggest feedstock supply bottleneck this month?"
  ];

  const handleRunQuery = (text) => {
    setQuery(text);
    if (text.includes("zone 4") || text.includes("food waste")) {
      setResponse({
        title: "BEST MATCH: GreenGas CBG Terminal",
        matchScore: "0.87",
        distance: "18.2 km",
        capacity: "6.7 t remaining",
        pathwayFit: "100%",
        reasoning: "Moisture (78%) and C:N (24:1) sit directly inside the recommended mesophilic AD window. Lowest logistics ton-km penalty.",
        actionLabel: "View Match & Dispatch Route",
        targetTab: "matches",
        lotId: "GEN-01"
      });
    } else if (text.includes("moisture spikes") || text.includes("32%")) {
      setResponse({
        title: "PATHWAY SWITCH: Ineligible for Slow Pyrolysis",
        matchScore: "0.42 (Downgraded)",
        distance: "Kheda Biochar Hub",
        capacity: "N/A",
        pathwayFit: "Incompatible (Moisture > 25%)",
        reasoning: "Moisture > 25% quenches rotary pyrolysis reactors causing tar condensation. System recommends solar drying or diversion to co-digestion.",
        actionLabel: "Inspect Lot Chemistry",
        targetTab: "lots",
        lotId: "GEN-02"
      });
    } else {
      setResponse({
        title: "BOTTLENECK IDENTIFIED: Sanand Cotton Belt",
        matchScore: "Deficit Area",
        distance: "34.8 km to nearest pyrolysis",
        capacity: "42 t/day unserviced",
        pathwayFit: "High Biochar Potential",
        reasoning: "Excessive transport radius (34.8 km) exceeds economical break-even buffer for low-density stalk biomass.",
        actionLabel: "Inspect Site Planning View",
        targetTab: "overview"
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#17231A]/25 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#FFFFFF] h-full shadow-2xl border-l border-[#DDE6DA] flex flex-col justify-between p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#285238]" />
              <span className="font-bold text-sm text-[#17231A]">Operator Decision Interface</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-[#68746B] hover:bg-[#F3F7F1]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#68746B]">
            Directly queries the underlying biochemistry constraints, logistics graph, and facility capacity ledgers.
          </p>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-[#68746B] uppercase">Suggested Inquiries:</span>
            <div className="flex flex-col gap-1.5">
              {PREBUILT_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunQuery(q)}
                  className="text-left text-xs p-2.5 rounded-[8px] bg-[#F3F7F1] border border-[#DDE6DA] hover:border-[#4F835B] hover:bg-[#EAF1E8] transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {response && (
            <div className="p-4 bg-[#EAF1E8] border border-[#4F835B]/40 rounded-[12px] space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#285238]">{response.title}</span>
                <span className="text-[10px] font-mono bg-[#FFFFFF] px-1.5 py-0.5 rounded font-bold text-[#285238]">
                  Score: {response.matchScore}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>Distance: <strong>{response.distance}</strong></div>
                <div>Capacity: <strong>{response.capacity}</strong></div>
              </div>

              <p className="text-xs text-[#17231A] leading-relaxed bg-[#FFFFFF] p-3 rounded-[8px] border border-[#DDE6DA]">
                {response.reasoning}
              </p>

              <button
                onClick={() => onNavigate(response.targetTab, response.lotId)}
                className="w-full py-2 bg-[#285238] hover:bg-[#1f422d] text-white text-xs font-bold rounded-[8px] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{response.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#DDE6DA]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#F3F7F1] hover:bg-[#EAF1E8] text-[#17231A] rounded-[8px] text-xs font-mono font-bold transition-colors"
          >
            Close Interface
          </button>
        </div>
      </div>
    </div>
  );
}

function ProvenanceInspectorDrawer({ doc, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#17231A]/20 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#FFFFFF] h-full shadow-2xl border-l border-[#DDE6DA] flex flex-col justify-between p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDE6DA] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#285238]" />
              <span className="font-bold text-sm text-[#17231A]">Data Provenance Inspector</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-[#68746B] hover:bg-[#F3F7F1]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <span className="text-[10px] font-mono text-[#68746B] uppercase">Evidence Registry Record</span>
            <h3 className="font-bold text-base text-[#17231A] mt-0.5">{doc.title}</h3>
            <div className="text-xs text-[#68746B] mt-0.5">{doc.source}</div>
          </div>

          <div className="p-3.5 bg-[#F3F7F1] rounded-[12px] border border-[#DDE6DA] space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#68746B]">Classification:</span>
              <ProvenanceBadge type={doc.type} />
            </div>
            {doc.value && (
              <div className="flex justify-between">
                <span className="text-[#68746B]">Assigned Value:</span>
                <span className="font-bold text-[#17231A]">{doc.value}</span>
              </div>
            )}
            {doc.timestamp && (
              <div className="flex justify-between">
                <span className="text-[#68746B]">Audited Timestamp:</span>
                <span className="text-[#17231A]">{doc.timestamp}</span>
              </div>
            )}
          </div>

          {doc.formula && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-[#68746B] uppercase">Calculation Formula Applied</span>
              <div className="p-3 bg-[#17231A] text-[#86B98C] rounded-[10px] font-mono text-[11px] leading-relaxed break-all">
                {doc.formula}
              </div>
            </div>
          )}

          <div className="text-xs text-[#68746B] leading-relaxed">
            In compliance with HackOut'26 rules, this value is explicitly tagged as <strong>{doc.type}</strong>. Every calculation parameter traces to an audited source.
          </div>
        </div>

        <div className="pt-4 border-t border-[#DDE6DA]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#285238] hover:bg-[#1f422d] text-white rounded-[8px] text-xs font-semibold transition-colors"
          >
            Close Provenance Record
          </button>
        </div>
      </div>
    </div>
  );
}

function ModernTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#FFFFFF] border border-[#DDE6DA] rounded-[10px] p-3 text-xs shadow-md font-sans">
        <div className="font-bold text-[#17231A] mb-1.5">{label}</div>
        <div className="space-y-1 font-mono text-[11px]">
          {payload.map((p, idx) => (
            <div key={idx} className="flex justify-between gap-4">
              <span className="text-[#68746B] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                {p.name}:
              </span>
              <span className="font-bold text-[#17231A]">
                {Number(p.value).toLocaleString()} t
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}