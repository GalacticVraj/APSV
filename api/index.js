var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/api/src/ai-insights/templates.ts
var PLATFORM_REFERENCE_CONSTANTS, OUTPUT_SCHEMA, INSIGHT_TEMPLATES, INSIGHT_SYSTEM_PREAMBLE;
var init_templates = __esm({
  "packages/api/src/ai-insights/templates.ts"() {
    "use strict";
    PLATFORM_REFERENCE_CONSTANTS = `
Platform reference constants (use these; do not invent others):
- Biochar Pyrolysis LCOP: \u20B93,200/tonne; CO2 sequestration: ~0.8\u20131.0 tCO2e/tonne
- Anaerobic Digestion LCOP: \u20B92,800/tonne; CO2 avoided: ~0.3\u20130.5 tCO2e/tonne
- Aerobic Composting LCOP: \u20B91,200/tonne; CO2 avoided: ~0.15\u20130.22 tCO2e/tonne
- Vermicomposting LCOP: \u20B9900/tonne; CO2 avoided: ~0.10\u20130.18 tCO2e/tonne
- Shadow price (durable removal / biochar): \u20B910,800/tCO2e
- Shadow price (avoided emissions / other pathways): \u20B9520/tCO2e
- Transport cost base rate: \u20B912/tonne-km (DEFRA 2023 HGV factors)
- DCF factor: 5-year NPV at 10% nominal discount rate = 3.791
- Carbon accounting: EPA WARM v15; biogenic CO2 excluded per IPCC AR6 WG3
- Capacity utilization warning threshold: >80% = approaching constraint; >90% = overcommitted
- Match score thresholds: >=75 = strong match; 50\u201374 = acceptable; <50 = weak match
`.trim();
    OUTPUT_SCHEMA = `
You MUST return ONLY a valid JSON object with exactly these four string fields. No markdown fences, no prose.
{
  "finding": "One sharp sentence stating the single most important thing about this data right now.",
  "carbonEconomicFraming": "One line connecting the finding to real CO2 and economic impact using actual numbers from the data.",
  "action": "One specific, concrete action the user could take. If no action is warranted, write: No action required.",
  "supportingDetail": "One or two data points that justify the finding above, so the user can verify it is grounded in real numbers."
}
`.trim();
    INSIGHT_TEMPLATES = {
      waste_listing: `
You are analyzing a single waste listing on the CarbonLoop platform.

Your task is to assess PATHWAY GATE COMPATIBILITY for this specific listing.

Focus on:
1. Which conversion pathways (biochar pyrolysis, anaerobic digestion, aerobic composting, vermicomposting)
   are compatible or incompatible with this waste type and volume.
2. Whether the listing is heading toward a suboptimal match \u2014 for example, high-moisture agricultural
   biomass that would underperform in pyrolysis but excel in anaerobic digestion.
3. The listing's current status and what it implies for routing urgency.

If the data does not include physical composition parameters (moisture, C:N ratio, ash), acknowledge that
and base your finding on waste type compatibility alone.

Do not comment on the platform as a whole. Focus only on this listing.
`.trim(),
      facility_card: `
You are analyzing a single processing facility on the CarbonLoop network.

Your task is to assess CAPACITY UTILIZATION TREND and ECONOMIC/CARBON PERFORMANCE.

Focus on:
1. Current capacity utilization percentage and whether it signals stranded capacity (underutilized)
   or overcommitment risk (approaching or exceeding the 80\u201390% warning thresholds).
2. How this facility's carbon output per tonne and economic performance compares to the reference
   constants for its conversion type. Is it above or below expected efficiency?
3. If match history data is present, whether the facility is accepting a good mix of waste types
   or concentrating risk in a single stream.

Do not generalize to the whole network. Focus only on this facility's numbers.
`.trim(),
      kpi_card: `
You are analyzing a single KPI metric on the CarbonLoop platform.

Your task is to identify what CHANGED and whether it CROSSES A MEANINGFUL THRESHOLD.

Focus on:
1. The absolute value of the metric and what it means in context \u2014 not just repeating the number.
2. Whether this value is above, below, or at a meaningful threshold: break-even lines, capacity
   ceilings, cost-leak thresholds, or shadow price parity.
3. Whether the trend is accelerating, stable, or decelerating based on any period or comparison
   data present.

If no comparison data is present, state the threshold context (where does this value sit relative
to what the platform aims for) rather than inventing a trend.
`.trim(),
      trade_ledger_row: `
You are analyzing a single verified trade transaction in the CarbonLoop trade ledger.

Your task is to assess MATCH QUALITY for this specific transaction.

Focus on:
1. Whether the transport distance was efficient relative to the break-even distance for this
   conversion type (use \u20B912/tonne-km transport cost and the pathway's LCOP from platform constants).
2. Whether the CO2 sequestered per tonne is consistent with expected rates for this waste type
   and conversion pathway, or whether it deviates significantly.
3. The implied net economic value (estimated_value_inr) relative to what is expected given the
   volume and conversion type.

Do not comment on other transactions. Focus only on the specific row data given.
`.trim(),
      pathway_economics: `
You are analyzing the full pathway economics comparison across all active conversion pathways.

Your task is to identify the DOMINANT MARGIN ADVANTAGE and its implications.

Focus on:
1. Which single pathway has the highest net margin per tonne, and by how much it leads the next best.
2. Whether the margin advantage is driven by LCOP efficiency, shadow price, or volume \u2014 identify
   which factor dominates based on the actual numbers.
3. Whether any pathway is generating a negative net margin, and what threshold it would need to
   cross to become viable (volume, price, or distance change).

Use actual numbers from the data. Do not offer generic pathway advice.
`.trim(),
      break_even: `
You are analyzing a break-even scenario projection from the CarbonLoop What-If simulator.

Your task is to identify SENSITIVITY \u2014 which parameter most changes the break-even outcome.

Focus on:
1. The projected break-even volume compared to current actual waste diverted \u2014 how far from
   break-even is the system right now?
2. Which of the three levers (shadow price multiplier, transport cost multiplier, capacity
   utilization target) has the largest effect on the break-even volume in this specific run.
3. Whether the break-even point is achievable with plausible operational changes, or whether
   it requires a step-change in one parameter.

Base all numbers strictly on the data package provided. Do not estimate numbers not given.
`.trim(),
      what_if_result: `
You are analyzing the results of a What-If scenario simulation on the CarbonLoop platform.

Your task is to identify the SINGLE LARGEST LEVER and the plausible NEXT ACTION.

Focus on:
1. Which of the three parameters (shadow price multiplier, transport cost multiplier, capacity
   utilization target) had the largest absolute impact on projected net value compared to baseline.
2. Whether the projected outcome is materially better or worse than baseline, and by how much.
3. One specific, realistic action the user could take in response to this simulation result.
   This could be renegotiating transport contracts, targeting specific high-value waste streams,
   or adjusting facility intake mix.

Be concrete. Do not offer generic simulation advice.
`.trim(),
      investment_opportunity: `
You are analyzing a single facility investment opportunity ranked by 5-year DCF on CarbonLoop.

Your task is to assess PAYBACK TIMEFRAME and MATERIALIZATION RISK.

Focus on:
1. The implied payback timeframe from the annual_net_value_inr and dcf_5y_inr figures \u2014 how
   many years does the 5Y DCF imply, and is that consistent with the stated 10% discount rate?
2. The single biggest risk to this opportunity materializing: is it headroom that is too small
   to sustain the projected throughput, a break-even distance that is too short to attract
   sufficient generators, or a shadow price that depends on a specific policy remaining in effect?
3. Whether the facility's current historical_pickups suggests the volume projections are realistic.

Do not compare to other facilities in the list. Analyze only this one facility.
`.trim(),
      value_flow: `
You are analyzing the monthly carbon value flow trend for the CarbonLoop platform.

Your task is to identify TREND DIRECTION, ACCELERATION, and any notable PATTERN.

Focus on:
1. Whether the monthly CO2 sequestration trend is growing, flat, or declining \u2014 and whether the
   rate of change is accelerating or decelerating over the visible period.
2. Whether there are any notable peaks, troughs, or seasonal patterns visible in the data, and
   what they might indicate about waste supply seasonality or facility intake patterns.
3. Whether the current trajectory is consistent with reaching a meaningful milestone (e.g. a
   round-number CO2 target or a threshold implied by the period's KPI totals).

Use only the monthly_trend data and kpis totals provided. Do not extrapolate beyond what the
data supports.
`.trim()
    };
    INSIGHT_SYSTEM_PREAMBLE = `
You are the CarbonLoop AI Insights engine. CarbonLoop connects waste generators with carbon-conversion
facilities (biochar plants, biogas digesters, composting facilities) in India, optimizing collection
logistics and calculating verified CO2 sequestration.

HARD RULES \u2014 violating any of these constitutes a failed response:
1. Return ONLY the JSON object specified. No markdown, no prose, no code fences.
2. Never introduce a number that is not present in the given data package or the platform reference
   constants provided. If a number is needed but not available, say "data not available" in the
   relevant field rather than estimating.
3. Never produce generic sustainability advice not tied to the specific data on screen.
4. If the data is insufficient to support a meaningful finding, the "finding" field must say so
   plainly. Do not invent an observation to fill the field.
5. Do not use em dashes. Use commas, periods, or parentheses instead.
6. Keep every field to 1-2 sentences maximum. The insight must be scannable, not a report.

${PLATFORM_REFERENCE_CONSTANTS}

${OUTPUT_SCHEMA}
`.trim();
  }
});

// packages/api/src/ai-insights/ai.ts
var ai_exports = {};
__export(ai_exports, {
  InsightParseError: () => InsightParseError,
  generateStructuredInsight: () => generateStructuredInsight,
  getAIResponse: () => getAIResponse
});
async function callGemini(messages, context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const systemInstruction = context._systemOverride ? context._systemOverride : `${SYSTEM_PROMPT}

User context:
${JSON.stringify(context, null, 2)}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        }))
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no content.");
  return text;
}
async function callGroq(messages, context) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  const baseURL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  const systemContent = context._systemOverride ? context._systemOverride : `${SYSTEM_PROMPT}

User context:
${JSON.stringify(context, null, 2)}`;
  const openAIMessages = [
    { role: "system", content: systemContent },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  ];
  const res = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: openAIMessages
    })
  });
  if (!res.ok) throw new Error(`Groq responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return body.choices?.[0]?.message?.content || "No response generated.";
}
function rulesBasedResponse(userMessage, context) {
  const lower = userMessage.toLowerCase();
  if (lower.includes("match") || lower.includes("facilit")) {
    const matchCount = context.matches?.length ?? 0;
    if (matchCount === 0) {
      return "I do not have any active matches in your current context. Try creating a new waste listing and the matching engine will compute scored facility recommendations for you.";
    }
    return `You have ${matchCount} match(es) in your current context. The matching engine scores facilities using a weighted formula: distance (30%), waste-type compatibility (30%), remaining capacity (25%), and facility efficiency (15%). Review your matches in the Matches section for detailed breakdowns.`;
  }
  if (lower.includes("carbon") || lower.includes("co2") || lower.includes("sequestrat")) {
    const stats = context.stats;
    if (stats) {
      return `Your platform data shows ${stats.total_co2_sequestered_t ?? 0} tonnes of CO2 sequestered so far, from ${stats.total_waste_diverted_t ?? 0} tonnes of waste diverted. Carbon calculations follow EPA WARM v15 and IPCC AR6 WG3 methodology.`;
    }
    return "Carbon sequestration is calculated per pickup based on waste type, conversion method, and collection distance. Biochar pyrolysis sequesters approximately 0.8 to 1.0 tonnes of CO2 per tonne of organic waste. Composting avoids 0.15 to 0.22 tonnes CO2 per tonne.";
  }
  if (lower.includes("pickup") || lower.includes("status") || lower.includes("transit")) {
    const pickupCount = context.pickups?.length ?? 0;
    return `You have ${pickupCount} pickup(s) in your context. Check the Pickups section for status updates. Pickups progress through: Requested, Scheduled, In Transit, Delivered, Verified.`;
  }
  return "I can help with questions about your waste listings, facility matches, pickup status, and carbon impact. Please ask a specific question and I will do my best to help using your platform data. (AI provider not configured. Add your GEMINI_API_KEY or GROQ_API_KEY in .env to enable full AI responses.)";
}
async function getAIResponse(messages, context) {
  const primary = process.env.AI_PROVIDER || "groq";
  const secondary = primary === "gemini" ? "groq" : "gemini";
  try {
    let response;
    if (primary === "gemini") {
      response = await Promise.race([
        callGemini(messages, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15e3))
      ]);
    } else {
      response = await Promise.race([
        callGroq(messages, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15e3))
      ]);
    }
    return { response, provider: primary };
  } catch (err) {
    console.warn(`Primary AI provider (${primary}) failed`, { error: err.message });
  }
  try {
    let response;
    if (secondary === "gemini") {
      response = await Promise.race([
        callGemini(messages, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15e3))
      ]);
    } else {
      response = await Promise.race([
        callGroq(messages, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15e3))
      ]);
    }
    return { response, provider: secondary };
  } catch (err) {
    console.warn(`Secondary AI provider (${secondary}) failed`, { error: err.message });
  }
  console.info("Using rule-based AI fallback");
  return {
    response: rulesBasedResponse(messages[messages.length - 1]?.content || "", context),
    provider: "rules-based"
  };
}
function validateInsightShape(obj) {
  if (!obj || typeof obj !== "object") throw new InsightParseError("Response is not an object");
  const o = obj;
  const required = ["finding", "carbonEconomicFraming", "action", "supportingDetail"];
  for (const field of required) {
    if (typeof o[field] !== "string" || !o[field].trim()) {
      throw new InsightParseError(`Missing or empty field: ${field}`);
    }
  }
  return {
    finding: o.finding.trim(),
    carbonEconomicFraming: o.carbonEconomicFraming.trim(),
    action: o.action.trim(),
    supportingDetail: o.supportingDetail.trim()
  };
}
function extractJSON(text) {
  const stripped = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new InsightParseError("No JSON object found in response");
  return JSON.parse(stripped.slice(start, end + 1));
}
async function generateStructuredInsight(templateKey, dataPackage) {
  const componentTemplate = INSIGHT_TEMPLATES[templateKey];
  const dataJson = JSON.stringify(dataPackage, null, 2);
  const systemPrompt = INSIGHT_SYSTEM_PREAMBLE;
  const userMessage = `${componentTemplate}

--- DATA PACKAGE ---
${dataJson}`;
  const messages = [{ role: "user", content: userMessage }];
  const insightContext = { role: "insight", _systemOverride: systemPrompt };
  const { response, provider } = await getAIResponse(messages, insightContext);
  try {
    const parsed = extractJSON(response);
    const insight = validateInsightShape(parsed);
    return { insight, provider };
  } catch (err) {
    console.warn("Insight parse failed", { templateKey, error: err.message, raw: response.slice(0, 200) });
    throw new InsightParseError(`Failed to parse structured insight: ${err.message}`);
  }
}
var SYSTEM_PROMPT, InsightParseError;
var init_ai = __esm({
  "packages/api/src/ai-insights/ai.ts"() {
    "use strict";
    init_templates();
    SYSTEM_PROMPT = `You are the CarbonLoop AI assistant. CarbonLoop is a platform that connects 
waste generators with carbon-conversion facilities (biochar plants, biogas digesters, composting facilities) 
in India, optimizing collection logistics and calculating verified CO2 sequestration.

You help users understand their waste listings, match scores, carbon impact, and platform data.

Rules:
1. Only discuss data provided to you in the context. Do not invent numbers or claim data you were not given.
2. When you do not have enough data to answer, say so clearly.
3. Be concise, specific, and actionable. Avoid generic AI-sounding filler.
4. Carbon sequestration figures follow EPA WARM v15 and IPCC AR6 WG3 methodology.
5. Do not use em dashes. Use commas, periods, or parentheses instead.`;
    InsightParseError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "InsightParseError";
      }
    };
  }
});

// packages/api/src/index.ts
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// packages/engine/src/constants.ts
var f = (key, label, value, unit, uncertaintyPct, source, note) => ({ key, label, value, unit, uncertaintyPct, source, note });
var EF = {
  dieselCombustion: f(
    "dieselCombustion",
    "Diesel combustion",
    2.68,
    "kgCO\u2082e/litre",
    5,
    "DEFRA GHG Conversion Factors 2023 \u2014 diesel, 100% mineral, tank-to-wheel"
  ),
  dieselUpstream: f(
    "dieselUpstream",
    "Diesel well-to-tank",
    0.61,
    "kgCO\u2082e/litre",
    18,
    "DEFRA GHG Conversion Factors 2023 \u2014 WTT diesel",
    "Included so transport emissions are well-to-wheel, not tailpipe-only."
  ),
  gridElectricity: f(
    "gridElectricity",
    "Indian grid electricity",
    0.716,
    "tCO\u2082e/MWh",
    8,
    "CEA CO\u2082 Baseline Database for the Indian Power Sector, weighted average operating margin"
  ),
  coal: f(
    "coal",
    "Indian thermal coal",
    96.1,
    "tCO\u2082/TJ",
    7,
    "IPCC 2006 GL Vol.2 Table 1.4 \u2014 sub-bituminous default"
  ),
  cngDisplaced: f(
    "cngDisplaced",
    "Fossil CNG displaced by bio-CNG",
    2.75,
    "kgCO\u2082e/kg CNG",
    9,
    "IPCC 2006 GL Vol.2 natural gas EF plus Indian upstream/compression"
  ),
  syntheticFertiliserN: f(
    "syntheticFertiliserN",
    "Synthetic nitrogen fertiliser displaced",
    5.6,
    "kgCO\u2082e/kg N",
    30,
    "IPCC 2006 GL Vol.4 Ch.11 direct/indirect N\u2082O plus urea manufacturing"
  ),
  ch4Gwp: f(
    "ch4Gwp",
    "CH\u2084 global warming potential (non-fossil, 100 yr)",
    27.2,
    "kgCO\u2082e/kg",
    0,
    "IPCC AR6 WG1 Ch.7 Table 7.15"
  ),
  n2oGwp: f(
    "n2oGwp",
    "N\u2082O global warming potential (100 yr)",
    273,
    "kgCO\u2082e/kg",
    0,
    "IPCC AR6 WG1 Ch.7 Table 7.15"
  ),
  baling: f(
    "baling",
    "Field aggregation (rake, bale, load)",
    3.9,
    "kgCO\u2082e/tonne",
    25,
    "Tractor diesel burn of ~1.45 L/t for straw baling at DEFRA diesel EF"
  )
};
var EF_LIST = Object.values(EF);
var DIESEL_WTW_KG_PER_L = EF.dieselCombustion.value + EF.dieselUpstream.value;
var PRICES = {
  biochar: {
    product: "biochar",
    label: "Agricultural-grade biochar",
    price: 16e3,
    unit: "\u20B9/tonne",
    perTonneBasis: "tonne of biochar",
    uncertaintyPct: 25,
    source: "Indian agri-input biochar offtake range \u20B914,000\u201325,000/t; conservative end used"
  },
  bio_cng: {
    product: "bio_cng",
    label: "Compressed bio-gas",
    price: 54,
    unit: "\u20B9/kg",
    perTonneBasis: "kg of CBG",
    uncertaintyPct: 8,
    source: "MoPNG SATAT programme assured ex-plant price, \u20B954/kg"
  },
  pellets: {
    product: "pellets",
    label: "Biomass pellets",
    price: 7e3,
    unit: "\u20B9/tonne",
    perTonneBasis: "tonne of pellets",
    uncertaintyPct: 15,
    source: "Thermal-plant biomass co-firing tender range \u20B96,500\u20138,500/t"
  },
  compost: {
    product: "compost",
    label: "City compost / FOM",
    price: 4e3,
    unit: "\u20B9/tonne",
    perTonneBasis: "tonne of compost",
    uncertaintyPct: 20,
    source: "City-compost MRP net of market development assistance"
  },
  electricity: {
    product: "electricity",
    label: "Biomass power",
    price: 5.5,
    unit: "\u20B9/kWh",
    perTonneBasis: "kWh exported",
    uncertaintyPct: 12,
    source: "CERC biomass generic tariff band"
  },
  digestate: {
    product: "digestate",
    label: "Fermented organic manure",
    price: 2500,
    unit: "\u20B9/tonne",
    perTonneBasis: "tonne of digestate",
    uncertaintyPct: 30,
    source: "FOM realisation under the SATAT/GOBARdhan framework"
  }
};
var PRICE_LIST = Object.values(PRICES);
var CARBON_MARKETS = {
  durableCdr: {
    key: "durableCdr",
    label: "Durable CO\u2082 removal (biochar CORC)",
    price: 10800,
    unit: "\u20B9/tCO\u2082e",
    uncertaintyPct: 22,
    source: "Puro.earth biochar CORC clearing range, ~USD 130/t at \u20B983/USD"
  },
  avoidedEmission: {
    key: "avoidedEmission",
    label: "Avoided emissions (voluntary market)",
    price: 520,
    unit: "\u20B9/tCO\u2082e",
    uncertaintyPct: 45,
    source: "Voluntary carbon market waste-sector avoidance credits, ~USD 6/t"
  }
};
var VEHICLES = [
  {
    id: "tractor_trolley",
    label: "Tractor + trolley",
    massCapacityT: 6,
    volumeM3: 22,
    dieselLPerKm: 0.19,
    costInrPerKm: 28,
    fixedCostInrPerTrip: 450,
    avgSpeedKmh: 22,
    shiftHours: 9,
    fleetSize: 120,
    allowedRoads: ["rural_road", "state_highway", "national_highway"]
  },
  {
    id: "truck_16t",
    label: "16 t rigid truck",
    massCapacityT: 16,
    volumeM3: 58,
    dieselLPerKm: 0.28,
    costInrPerKm: 46,
    fixedCostInrPerTrip: 1400,
    avgSpeedKmh: 42,
    shiftHours: 11,
    fleetSize: 64,
    allowedRoads: ["state_highway", "national_highway"]
  },
  {
    id: "truck_25t_bulk",
    label: "25 t bulk trailer",
    massCapacityT: 25,
    volumeM3: 92,
    dieselLPerKm: 0.36,
    costInrPerKm: 62,
    fixedCostInrPerTrip: 2200,
    avgSpeedKmh: 46,
    shiftHours: 11,
    fleetSize: 28,
    allowedRoads: ["national_highway"]
  }
];
var VEHICLE_BY_ID = Object.fromEntries(
  VEHICLES.map((v) => [v.id, v])
);
var DEFAULT_ASSUMPTIONS = {
  windowDays: 30,
  circuityFactor: 1.28,
  dieselPriceInrPerL: 92,
  cdrPriceInrPerT: CARBON_MARKETS.durableCdr.price,
  vcmPriceInrPerT: CARBON_MARKETS.avoidedEmission.price,
  gridEfTPerMwh: EF.gridElectricity.value,
  // Mean annual soil temperature for the Indo-Gangetic plain. The Puro/SLU
  // reference dataset is harmonised to 14.9 degC; using that European default here
  // would overstate biochar permanence.
  soilTempC: 26,
  maxHaulKm: 140,
  mcDraws: 2e3,
  seed: 20260912
};
var ASSUMPTION_META = {
  windowDays: {
    label: "Planning window",
    unit: "days",
    min: 7,
    max: 90,
    step: 1,
    note: "Length of the operating period the optimiser allocates over."
  },
  circuityFactor: {
    label: "Road circuity factor",
    unit: "\xD7 crow-fly",
    min: 1,
    max: 1.6,
    step: 0.01,
    note: "Road distance divided by great-circle distance. 1.28 is typical for Indian NH/SH inter-district pairs."
  },
  dieselPriceInrPerL: {
    label: "Diesel price",
    unit: "\u20B9/litre",
    min: 60,
    max: 160,
    step: 1,
    note: "Drives transport cost but not transport emissions."
  },
  cdrPriceInrPerT: {
    label: "Durable CDR price",
    unit: "\u20B9/tCO\u2082e",
    min: 0,
    max: 25e3,
    step: 100,
    note: "Price for permanent removal. Only the pyrolysis and gasification pathways earn it."
  },
  vcmPriceInrPerT: {
    label: "Avoided-emission price",
    unit: "\u20B9/tCO\u2082e",
    min: 0,
    max: 5e3,
    step: 20,
    note: "Voluntary market price for avoidance credits. Roughly twenty times below removal."
  },
  gridEfTPerMwh: {
    label: "Grid emission factor",
    unit: "tCO\u2082e/MWh",
    min: 0.2,
    max: 1.1,
    step: 0.01,
    note: "Applies to parasitic load and to displaced grid power."
  },
  soilTempC: {
    label: "Mean annual soil temperature",
    unit: "\xB0C",
    min: 5,
    max: 35,
    step: 0.5,
    note: "Drives the Q10 correction on biochar decay. Raising it lowers 100-year permanence."
  },
  maxHaulKm: {
    label: "Maximum haul distance",
    unit: "km",
    min: 20,
    max: 400,
    step: 5,
    note: "Hard cut-off beyond which an arc is never generated."
  },
  mcDraws: {
    label: "Monte Carlo draws",
    unit: "samples",
    min: 200,
    max: 2e4,
    step: 100,
    note: "Sample count for the carbon uncertainty band."
  },
  seed: {
    label: "Random seed",
    unit: "",
    min: 1,
    max: 999999999,
    step: 1,
    note: "Every stochastic element derives from this. Same seed, identical results."
  }
};
var OBJECTIVE_META = {
  carbon_first: {
    label: "Carbon First",
    short: "CARBON",
    description: "Maximise net tCO\u2082e. Accepts thin or negative margins where the carbon case is strong."
  },
  profit_first: {
    label: "Profit First",
    short: "PROFIT",
    description: "Maximise operating margin. Drops carbon-positive but loss-making tonnage."
  },
  balanced: {
    label: "Balanced",
    short: "BALANCED",
    description: "Scalarised trade-off between normalised carbon and normalised margin, with a diversion floor."
  },
  logistics_first: {
    label: "Logistics First",
    short: "LOGISTICS",
    description: "Maximise carbon per tonne-kilometre. Favours short, dense, operationally simple hauls."
  }
};

// packages/engine/src/rng.ts
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function normal(rng, mean3 = 0, sd = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean3 + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function lognormalAround(rng, mean3, relSd) {
  if (mean3 === 0) return 0;
  const sign = mean3 < 0 ? -1 : 1;
  const m = Math.abs(mean3);
  const variance = (relSd * m) ** 2;
  const sigma2 = Math.log(1 + variance / (m * m));
  const mu = Math.log(m) - sigma2 / 2;
  return sign * Math.exp(normal(rng, mu, Math.sqrt(sigma2)));
}
function percentileSorted(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function mean(xs) {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

// packages/engine/src/network.ts
var DISTRICTS = [
  { name: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.857 },
  { name: "Sangrur", state: "Punjab", lat: 30.245, lon: 75.842 },
  { name: "Patiala", state: "Punjab", lat: 30.34, lon: 76.386 },
  { name: "Bathinda", state: "Punjab", lat: 30.211, lon: 74.945 },
  { name: "Moga", state: "Punjab", lat: 30.817, lon: 75.171 },
  { name: "Barnala", state: "Punjab", lat: 30.374, lon: 75.546 },
  { name: "Firozpur", state: "Punjab", lat: 30.925, lon: 74.613 },
  { name: "Sri Muktsar Sahib", state: "Punjab", lat: 30.474, lon: 74.516 },
  { name: "Faridkot", state: "Punjab", lat: 30.676, lon: 74.755 },
  { name: "Jalandhar", state: "Punjab", lat: 31.326, lon: 75.576 },
  { name: "Kapurthala", state: "Punjab", lat: 31.38, lon: 75.384 },
  { name: "Amritsar", state: "Punjab", lat: 31.634, lon: 74.872 },
  { name: "Tarn Taran", state: "Punjab", lat: 31.452, lon: 74.927 },
  { name: "Hoshiarpur", state: "Punjab", lat: 31.532, lon: 75.912 },
  { name: "Fatehgarh Sahib", state: "Punjab", lat: 30.644, lon: 76.396 },
  { name: "Mansa", state: "Punjab", lat: 29.988, lon: 75.393 },
  { name: "Rupnagar", state: "Punjab", lat: 30.966, lon: 76.527 },
  { name: "Karnal", state: "Haryana", lat: 29.686, lon: 76.99 },
  { name: "Kaithal", state: "Haryana", lat: 29.801, lon: 76.399 },
  { name: "Kurukshetra", state: "Haryana", lat: 29.97, lon: 76.878 },
  { name: "Ambala", state: "Haryana", lat: 30.378, lon: 76.777 },
  { name: "Yamunanagar", state: "Haryana", lat: 30.129, lon: 77.288 },
  { name: "Hisar", state: "Haryana", lat: 29.153, lon: 75.722 },
  { name: "Sirsa", state: "Haryana", lat: 29.535, lon: 75.028 },
  { name: "Fatehabad", state: "Haryana", lat: 29.512, lon: 75.456 },
  { name: "Jind", state: "Haryana", lat: 29.317, lon: 76.315 },
  { name: "Panipat", state: "Haryana", lat: 29.391, lon: 76.977 },
  { name: "Chandigarh", state: "Chandigarh", lat: 30.741, lon: 76.778 }
];
var DISTRICT_BY_NAME = new Map(DISTRICTS.map((d) => [d.name, d]));
var SOURCE_SEEDS = [
  // ── Paddy straw: the main event, 13 aggregation clusters ──────────────────
  { id: "SRC-PB-01", name: "Dhuri CHC Straw Yard", district: "Sangrur", stream: "paddy_straw", kind: "crop_residue", availableT: 3100, access: "state_highway", clusterCount: 14 },
  { id: "SRC-PB-02", name: "Lehragaga FPO Baling Point", district: "Sangrur", stream: "paddy_straw", kind: "crop_residue", availableT: 2450, access: "rural_road", clusterCount: 11 },
  { id: "SRC-PB-03", name: "Jagraon Grain Belt Cluster", district: "Ludhiana", stream: "paddy_straw", kind: "crop_residue", availableT: 2800, access: "national_highway", clusterCount: 16 },
  { id: "SRC-PB-04", name: "Raikot Custom Hiring Centre", district: "Ludhiana", stream: "paddy_straw", kind: "crop_residue", availableT: 1900, access: "state_highway", clusterCount: 9 },
  { id: "SRC-PB-05", name: "Nabha Co-op Baling Yard", district: "Patiala", stream: "paddy_straw", kind: "crop_residue", availableT: 2050, access: "state_highway", clusterCount: 10 },
  { id: "SRC-PB-06", name: "Rajpura Roadside Aggregation", district: "Patiala", stream: "paddy_straw", kind: "crop_residue", availableT: 1600, access: "national_highway", clusterCount: 7 },
  { id: "SRC-PB-07", name: "Rampura Phul Straw Depot", district: "Bathinda", stream: "paddy_straw", kind: "crop_residue", availableT: 1750, access: "state_highway", clusterCount: 8 },
  { id: "SRC-PB-08", name: "Nihal Singh Wala Cluster", district: "Moga", stream: "paddy_straw", kind: "crop_residue", availableT: 1480, access: "rural_road", clusterCount: 6 },
  { id: "SRC-PB-09", name: "Tapa Mandi Baling Point", district: "Barnala", stream: "paddy_straw", kind: "crop_residue", availableT: 1320, access: "state_highway", clusterCount: 6 },
  { id: "SRC-PB-10", name: "Zira Block Aggregation", district: "Firozpur", stream: "paddy_straw", kind: "crop_residue", availableT: 1250, access: "rural_road", clusterCount: 5 },
  { id: "SRC-HR-01", name: "Nilokheri Straw Collection Yard", district: "Karnal", stream: "paddy_straw", kind: "crop_residue", availableT: 2350, access: "national_highway", clusterCount: 12 },
  { id: "SRC-HR-02", name: "Pehowa FPO Baling Centre", district: "Kurukshetra", stream: "paddy_straw", kind: "crop_residue", availableT: 1880, access: "state_highway", clusterCount: 9 },
  { id: "SRC-HR-03", name: "Guhla Block Straw Cluster", district: "Kaithal", stream: "paddy_straw", kind: "crop_residue", availableT: 1640, access: "rural_road", clusterCount: 7 },
  // ── Wheat straw: expensive because fodder competes ────────────────────────
  { id: "SRC-PB-11", name: "Phillaur Wheat Residue Yard", district: "Jalandhar", stream: "wheat_straw", kind: "crop_residue", availableT: 920, access: "national_highway", clusterCount: 5 },
  { id: "SRC-PB-12", name: "Sultanpur Lodhi Cluster", district: "Kapurthala", stream: "wheat_straw", kind: "crop_residue", availableT: 760, access: "state_highway", clusterCount: 4 },
  { id: "SRC-HR-04", name: "Narwana Wheat Straw Depot", district: "Jind", stream: "wheat_straw", kind: "crop_residue", availableT: 1050, access: "state_highway", clusterCount: 6 },
  { id: "SRC-HR-05", name: "Tohana Residue Aggregation", district: "Fatehabad", stream: "wheat_straw", kind: "crop_residue", availableT: 880, access: "rural_road", clusterCount: 4 },
  { id: "SRC-PB-13", name: "Patti Block Wheat Cluster", district: "Tarn Taran", stream: "wheat_straw", kind: "crop_residue", availableT: 690, access: "rural_road", clusterCount: 4 },
  // ── Cotton stalk: the best biochar and pellet feedstock in the network ────
  { id: "SRC-HR-06", name: "Sirsa Cotton Belt Cluster", district: "Sirsa", stream: "cotton_stalk", kind: "crop_residue", availableT: 1420, access: "state_highway", clusterCount: 8 },
  { id: "SRC-HR-07", name: "Hisar Stalk Shredding Yard", district: "Hisar", stream: "cotton_stalk", kind: "crop_residue", availableT: 1180, access: "national_highway", clusterCount: 6 },
  { id: "SRC-PB-14", name: "Maur Cotton Residue Point", district: "Bathinda", stream: "cotton_stalk", kind: "crop_residue", availableT: 960, access: "state_highway", clusterCount: 5 },
  { id: "SRC-PB-15", name: "Malout Stalk Aggregation", district: "Sri Muktsar Sahib", stream: "cotton_stalk", kind: "crop_residue", availableT: 840, access: "rural_road", clusterCount: 4 },
  // ── Dairy: dense, wet, mass-limited in transport ──────────────────────────
  { id: "SRC-PB-16", name: "Khanna Dairy Cluster", district: "Ludhiana", stream: "cattle_dung", kind: "dairy", availableT: 2100, access: "national_highway", clusterCount: 42 },
  { id: "SRC-PB-17", name: "Samrala Cattle Belt", district: "Ludhiana", stream: "cattle_dung", kind: "dairy", availableT: 1550, access: "state_highway", clusterCount: 31 },
  { id: "SRC-PB-18", name: "Bhogpur Dairy Collective", district: "Jalandhar", stream: "cattle_dung", kind: "dairy", availableT: 1380, access: "state_highway", clusterCount: 26 },
  { id: "SRC-HR-08", name: "Gharaunda Dairy Belt", district: "Karnal", stream: "cattle_dung", kind: "dairy", availableT: 1720, access: "national_highway", clusterCount: 35 },
  { id: "SRC-HR-09", name: "Hansi Cattle Cluster", district: "Hisar", stream: "cattle_dung", kind: "dairy", availableT: 1240, access: "state_highway", clusterCount: 22 },
  { id: "SRC-PB-19", name: "Ajnala Dairy Collective", district: "Amritsar", stream: "cattle_dung", kind: "dairy", availableT: 1010, access: "rural_road", clusterCount: 18 },
  // ── Agro-processing: concentrated at the mill gate ────────────────────────
  { id: "SRC-PB-20", name: "Khanna Rice Mill Belt", district: "Ludhiana", stream: "rice_husk", kind: "agro_processing", availableT: 980, access: "national_highway", clusterCount: 12 },
  { id: "SRC-HR-10", name: "Taraori Rice Mill Cluster", district: "Karnal", stream: "rice_husk", kind: "agro_processing", availableT: 860, access: "national_highway", clusterCount: 10 },
  { id: "SRC-PB-21", name: "Jalalabad Mill Group", district: "Firozpur", stream: "rice_husk", kind: "agro_processing", availableT: 620, access: "state_highway", clusterCount: 7 },
  { id: "SRC-HR-11", name: "Yamunanagar Sugar Mill", district: "Yamunanagar", stream: "press_mud", kind: "agro_processing", availableT: 2150, access: "national_highway", clusterCount: 1 },
  { id: "SRC-PB-22", name: "Bhogpur Co-op Sugar Mill", district: "Jalandhar", stream: "press_mud", kind: "agro_processing", availableT: 1480, access: "state_highway", clusterCount: 1 },
  // ── Municipal organics: negative gate price, landfill counterfactual ──────
  { id: "SRC-PB-23", name: "Ludhiana MC Wet Waste Station", district: "Ludhiana", stream: "msw_organic", kind: "municipal", availableT: 1850, access: "national_highway", clusterCount: 4 },
  { id: "SRC-CH-01", name: "Chandigarh Dadumajra Transfer", district: "Chandigarh", stream: "msw_organic", kind: "municipal", availableT: 1320, access: "national_highway", clusterCount: 3 },
  { id: "SRC-PB-24", name: "Amritsar MC Segregation Yard", district: "Amritsar", stream: "msw_organic", kind: "municipal", availableT: 1100, access: "state_highway", clusterCount: 3 },
  { id: "SRC-HR-12", name: "Panipat MC Wet Waste Point", district: "Panipat", stream: "msw_organic", kind: "municipal", availableT: 640, access: "national_highway", clusterCount: 2 },
  // ── Markets: free feedstock with the best methane potential ───────────────
  { id: "SRC-PB-25", name: "Ludhiana Sabzi Mandi", district: "Ludhiana", stream: "mandi_waste", kind: "market", availableT: 1120, access: "national_highway", clusterCount: 1 },
  { id: "SRC-PB-26", name: "Jalandhar Fruit & Veg Market", district: "Jalandhar", stream: "mandi_waste", kind: "market", availableT: 840, access: "state_highway", clusterCount: 1 },
  { id: "SRC-HR-13", name: "Ambala Cantt Mandi", district: "Ambala", stream: "mandi_waste", kind: "market", availableT: 610, access: "national_highway", clusterCount: 1 },
  // ── Poultry litter: C:N of 9 puts it outside every pathway gate ───────────
  { id: "SRC-HR-14", name: "Barwala Poultry Belt", district: "Hisar", stream: "poultry_litter", kind: "dairy", availableT: 520, access: "state_highway", clusterCount: 19 },
  { id: "SRC-PB-27", name: "Nawanshahr Poultry Cluster", district: "Hoshiarpur", stream: "poultry_litter", kind: "dairy", availableT: 310, access: "rural_road", clusterCount: 11 }
];
var FACILITY_SEEDS = [
  // ── Pyrolysis / biochar — the only durable-removal assets in the network ──
  { id: "FAC-BC-01", name: "Sangrur Biochar Works", operator: "Trisala Carbon", district: "Sangrur", pathway: "pyrolysis_biochar", capacityTpd: 60, minFeedTpd: 22, efficiency: 1.02, opexInrPerT: 1800, capexAmortInrPerT: 1200, commissioned: 2023, powerSource: "captive_biomass" },
  { id: "FAC-BC-02", name: "Bathinda Carbon Unit", operator: "Malwa Biocarbon", district: "Bathinda", pathway: "pyrolysis_biochar", capacityTpd: 45, minFeedTpd: 18, efficiency: 0.95, opexInrPerT: 1950, capexAmortInrPerT: 1320, commissioned: 2024, powerSource: "captive_biomass" },
  { id: "FAC-BC-03", name: "Karnal Pyrolysis Complex", operator: "Indus Char Systems", district: "Karnal", pathway: "pyrolysis_biochar", capacityTpd: 70, minFeedTpd: 26, efficiency: 1.06, opexInrPerT: 1720, capexAmortInrPerT: 1150, commissioned: 2022, powerSource: "captive_biomass" },
  { id: "FAC-BC-04", name: "Sirsa Stalk Carbonisation", operator: "Agni Carbon Rural", district: "Sirsa", pathway: "pyrolysis_biochar", capacityTpd: 30, minFeedTpd: 12, efficiency: 0.92, opexInrPerT: 2100, capexAmortInrPerT: 1400, commissioned: 2025, powerSource: "grid" },
  // ── Compressed bio-gas (SATAT) ────────────────────────────────────────────
  { id: "FAC-CB-01", name: "Yamunanagar CBG Plant", operator: "Saraswati Bioenergy", district: "Yamunanagar", pathway: "anaerobic_digestion_cbg", capacityTpd: 120, minFeedTpd: 55, efficiency: 1.04, opexInrPerT: 1400, capexAmortInrPerT: 1100, commissioned: 2022, powerSource: "grid" },
  { id: "FAC-CB-02", name: "Khanna Bio-CNG Facility", operator: "Doaba Green Fuels", district: "Ludhiana", pathway: "anaerobic_digestion_cbg", capacityTpd: 100, minFeedTpd: 45, efficiency: 1, opexInrPerT: 1450, capexAmortInrPerT: 1150, commissioned: 2023, powerSource: "grid" },
  { id: "FAC-CB-03", name: "Bhogpur CBG Unit", operator: "Doaba Green Fuels", district: "Jalandhar", pathway: "anaerobic_digestion_cbg", capacityTpd: 70, minFeedTpd: 32, efficiency: 0.97, opexInrPerT: 1520, capexAmortInrPerT: 1240, commissioned: 2024, powerSource: "grid" },
  { id: "FAC-CB-04", name: "Gharaunda Biomethane Plant", operator: "Haryana Bioenergy Corp", district: "Karnal", pathway: "anaerobic_digestion_cbg", capacityTpd: 80, minFeedTpd: 36, efficiency: 1.01, opexInrPerT: 1430, capexAmortInrPerT: 1180, commissioned: 2023, powerSource: "grid" },
  { id: "FAC-CB-05", name: "Mohali Urban Digester", operator: "Tricity Organics", district: "Chandigarh", pathway: "anaerobic_digestion_cbg", capacityTpd: 60, minFeedTpd: 28, efficiency: 0.99, opexInrPerT: 1560, capexAmortInrPerT: 1260, commissioned: 2024, powerSource: "grid", acceptedStreams: ["msw_organic", "mandi_waste"] },
  // ── Pellet / densification for thermal co-firing ──────────────────────────
  { id: "FAC-PL-01", name: "Jagraon Pellet Plant", operator: "Satluj Biomass", district: "Ludhiana", pathway: "pellet_cofiring", capacityTpd: 180, minFeedTpd: 70, efficiency: 1, opexInrPerT: 1100, capexAmortInrPerT: 450, commissioned: 2023, powerSource: "grid" },
  { id: "FAC-PL-02", name: "Kaithal Densification Unit", operator: "Haryana Biomass Pellets", district: "Kaithal", pathway: "pellet_cofiring", capacityTpd: 120, minFeedTpd: 50, efficiency: 0.96, opexInrPerT: 1180, capexAmortInrPerT: 500, commissioned: 2024, powerSource: "grid" },
  { id: "FAC-PL-03", name: "Panipat Co-firing Feed Plant", operator: "North Thermal Fuels", district: "Panipat", pathway: "pellet_cofiring", capacityTpd: 200, minFeedTpd: 85, efficiency: 1.03, opexInrPerT: 1050, capexAmortInrPerT: 420, commissioned: 2022, powerSource: "grid" },
  // ── Composting — cheapest, most robust, lowest value ──────────────────────
  { id: "FAC-CP-01", name: "Ludhiana Windrow Site", operator: "Ludhiana Municipal Corp", district: "Ludhiana", pathway: "composting", capacityTpd: 140, minFeedTpd: 30, efficiency: 0.98, opexInrPerT: 550, capexAmortInrPerT: 180, commissioned: 2021, powerSource: "grid" },
  { id: "FAC-CP-02", name: "Patiala Compost Yard", operator: "Patiala Nagar Nigam", district: "Patiala", pathway: "composting", capacityTpd: 90, minFeedTpd: 20, efficiency: 0.94, opexInrPerT: 600, capexAmortInrPerT: 200, commissioned: 2020, powerSource: "grid" },
  { id: "FAC-CP-03", name: "Hisar Organic Compost Unit", operator: "Bharat Agri Organics", district: "Hisar", pathway: "composting", capacityTpd: 110, minFeedTpd: 25, efficiency: 1, opexInrPerT: 570, capexAmortInrPerT: 190, commissioned: 2022, powerSource: "grid" },
  { id: "FAC-CP-04", name: "Ambala Windrow Facility", operator: "Ambala Municipal Council", district: "Ambala", pathway: "composting", capacityTpd: 70, minFeedTpd: 16, efficiency: 0.93, opexInrPerT: 620, capexAmortInrPerT: 210, commissioned: 2021, powerSource: "grid" },
  // ── Gasification to power — ash-sensitive, small ──────────────────────────
  { id: "FAC-GP-01", name: "Barnala Gasifier Station", operator: "Punjab Rural Power", district: "Barnala", pathway: "gasification_power", capacityTpd: 35, minFeedTpd: 15, efficiency: 0.98, opexInrPerT: 1300, capexAmortInrPerT: 900, commissioned: 2023, powerSource: "captive_biomass" },
  { id: "FAC-GP-02", name: "Fatehabad Biomass Power", operator: "Aravalli Renewables", district: "Fatehabad", pathway: "gasification_power", capacityTpd: 25, minFeedTpd: 11, efficiency: 0.9, opexInrPerT: 1420, capexAmortInrPerT: 980, commissioned: 2025, powerSource: "captive_biomass" }
];
function jitter(id, base, spreadDeg) {
  const rng = makeRng(hashString(id));
  const angle = rng() * Math.PI * 2;
  const radius = Math.sqrt(rng()) * spreadDeg;
  return {
    lat: base.lat + Math.sin(angle) * radius,
    lon: base.lon + Math.cos(angle) * radius / Math.cos(base.lat * Math.PI / 180)
  };
}
function buildSources() {
  return SOURCE_SEEDS.map((seed) => {
    const d = DISTRICT_BY_NAME.get(seed.district);
    if (!d) throw new Error(`Unknown district in source seed: ${seed.district}`);
    const pos = jitter(seed.id, d, seed.kind === "crop_residue" ? 0.22 : 0.1);
    const rng = makeRng(hashString(seed.id + ":meta"));
    return {
      id: seed.id,
      name: seed.name,
      district: d.name,
      state: d.state,
      lat: pos.lat,
      lon: pos.lon,
      stream: seed.stream,
      kind: seed.kind,
      availableT: seed.availableT,
      annualT: Math.round(seed.availableT * (seed.kind === "crop_residue" ? 2.4 : 12.2)),
      access: seed.access,
      clusterCount: seed.clusterCount,
      telemetryAgeH: Math.round(rng() * 20) / 2
    };
  });
}
function buildFacilities() {
  return FACILITY_SEEDS.map((seed) => {
    const d = DISTRICT_BY_NAME.get(seed.district);
    if (!d) throw new Error(`Unknown district in facility seed: ${seed.district}`);
    const pos = jitter(seed.id + ":fac", d, 0.08);
    return {
      id: seed.id,
      name: seed.name,
      operator: seed.operator,
      district: d.name,
      state: d.state,
      lat: pos.lat,
      lon: pos.lon,
      pathway: seed.pathway,
      capacityTpd: seed.capacityTpd,
      minFeedTpd: seed.minFeedTpd,
      availability: 1,
      status: "online",
      acceptedStreams: seed.acceptedStreams ?? [],
      efficiency: seed.efficiency,
      opexInrPerT: seed.opexInrPerT,
      capexAmortInrPerT: seed.capexAmortInrPerT,
      commissioned: seed.commissioned,
      powerSource: seed.powerSource
    };
  });
}
function buildNetwork() {
  return {
    sources: buildSources(),
    facilities: buildFacilities(),
    vehicles: VEHICLES.map((v) => ({ ...v })),
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    asOf: "2026-11-08",
    appliedScenarios: [],
    blockedArcs: []
  };
}
function cloneNetwork(n) {
  return {
    sources: n.sources.map((s) => ({ ...s })),
    facilities: n.facilities.map((f3) => ({ ...f3, acceptedStreams: [...f3.acceptedStreams] })),
    vehicles: n.vehicles.map((v) => ({ ...v, allowedRoads: [...v.allowedRoads] })),
    assumptions: { ...n.assumptions },
    asOf: n.asOf,
    appliedScenarios: n.appliedScenarios.map((s) => ({ ...s, params: { ...s.params } })),
    blockedArcs: n.blockedArcs.map((b) => ({ ...b }))
  };
}

// packages/engine/src/geo.ts
var EARTH_RADIUS_KM = 6371.0088;
function toRad(deg) {
  return deg * Math.PI / 180;
}
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
var ROAD_CLASS_CIRCUITY = {
  national_highway: 1,
  state_highway: 1.06,
  rural_road: 1.14
};
function roadDistanceKm(a, b, circuityFactor, access) {
  return haversineKm(a, b) * circuityFactor * ROAD_CLASS_CIRCUITY[access];
}

// packages/engine/src/streams.ts
var STREAMS = {
  paddy_straw: {
    id: "paddy_straw",
    label: "Paddy straw",
    kind: "crop_residue",
    moisturePct: 13,
    ashPct: 18.7,
    // high silica — the reason paddy straw is a poor boiler fuel
    carbonPct: 38.2,
    hydrogenPct: 5.1,
    nitrogenPct: 0.64,
    ligninPct: 12,
    cnRatio: 60,
    lhvMjPerKg: 14.6,
    bulkDensityTPerM3: 0.15,
    // round-baled; loose straw is ~0.04
    vsFraction: 0.81,
    bmpM3PerTVs: 205,
    // silica + lignin suppress digestibility
    counterfactual: "open_field_burning",
    aggregationCostInrPerT: 1100,
    // rake, bale, load — the dominant cost in Punjab
    gatePriceInrPerT: 600,
    notes: "The emblematic Indian residue problem. ~20 Mt/yr in Punjab alone with a ~20-day window between paddy harvest and wheat sowing. High silica makes combustion troublesome but pyrolysis attractive."
  },
  wheat_straw: {
    id: "wheat_straw",
    label: "Wheat straw",
    kind: "crop_residue",
    moisturePct: 10,
    ashPct: 7.4,
    carbonPct: 43.2,
    hydrogenPct: 5.6,
    nitrogenPct: 0.52,
    ligninPct: 17,
    cnRatio: 85,
    lhvMjPerKg: 16.5,
    bulkDensityTPerM3: 0.16,
    vsFraction: 0.9,
    bmpM3PerTVs: 265,
    counterfactual: "open_field_burning",
    aggregationCostInrPerT: 900,
    gatePriceInrPerT: 1400,
    // competes directly with fodder demand — genuinely expensive
    notes: "Competes with the fodder market, so the gate price is high and the network should generally not outbid cattle feed. The optimiser reflects this and usually leaves most wheat straw alone."
  },
  cotton_stalk: {
    id: "cotton_stalk",
    label: "Cotton stalk",
    kind: "crop_residue",
    moisturePct: 12,
    ashPct: 5.1,
    carbonPct: 45,
    hydrogenPct: 5.7,
    nitrogenPct: 0.72,
    ligninPct: 22,
    cnRatio: 63,
    lhvMjPerKg: 17.2,
    bulkDensityTPerM3: 0.12,
    // woody, awkward, needs shredding
    vsFraction: 0.92,
    bmpM3PerTVs: 160,
    counterfactual: "open_field_burning",
    aggregationCostInrPerT: 1300,
    gatePriceInrPerT: 500,
    notes: "High lignin and low ash \u2014 the best biochar feedstock in the network. Low bulk density makes it volume-limited in transport."
  },
  rice_husk: {
    id: "rice_husk",
    label: "Rice husk",
    kind: "agro_processing",
    moisturePct: 9,
    ashPct: 21.5,
    // ~90% amorphous silica
    carbonPct: 38.5,
    hydrogenPct: 5,
    nitrogenPct: 0.48,
    ligninPct: 20,
    cnRatio: 80,
    lhvMjPerKg: 13.9,
    bulkDensityTPerM3: 0.11,
    vsFraction: 0.78,
    bmpM3PerTVs: 110,
    counterfactual: "open_dumping",
    aggregationCostInrPerT: 300,
    // already concentrated at the mill gate
    gatePriceInrPerT: 1800,
    // already a traded boiler fuel — an existing market to beat
    notes: "Already concentrated at rice mills and already traded as boiler fuel, so the network must outbid an existing buyer. Its biochar is silica-rich and lower in carbon."
  },
  press_mud: {
    id: "press_mud",
    label: "Sugar mill press mud",
    kind: "agro_processing",
    moisturePct: 70,
    ashPct: 12,
    carbonPct: 32.5,
    hydrogenPct: 4.5,
    nitrogenPct: 1.8,
    cnRatio: 18,
    ligninPct: 9.5,
    lhvMjPerKg: 12.1,
    bulkDensityTPerM3: 0.62,
    vsFraction: 0.82,
    bmpM3PerTVs: 290,
    counterfactual: "open_dumping",
    aggregationCostInrPerT: 250,
    gatePriceInrPerT: 200,
    notes: "The backbone feedstock of India\u2019s SATAT compressed-biogas programme. Wet, dense, seasonal with the crushing season, and far too wet to pyrolyse."
  },
  cattle_dung: {
    id: "cattle_dung",
    label: "Cattle dung",
    kind: "dairy",
    moisturePct: 80,
    ashPct: 16,
    carbonPct: 37.8,
    hydrogenPct: 5,
    nitrogenPct: 1.5,
    cnRatio: 25,
    ligninPct: 12,
    lhvMjPerKg: 13,
    bulkDensityTPerM3: 0.85,
    vsFraction: 0.8,
    bmpM3PerTVs: 210,
    counterfactual: "open_dung_heap",
    aggregationCostInrPerT: 400,
    gatePriceInrPerT: 300,
    notes: "Dense and wet: mass-limited rather than volume-limited in transport, the opposite of straw. Avoided open-heap methane is modest per tonne but the volumes are very large."
  },
  poultry_litter: {
    id: "poultry_litter",
    label: "Poultry litter",
    kind: "dairy",
    moisturePct: 30,
    ashPct: 20,
    carbonPct: 35,
    hydrogenPct: 4.8,
    nitrogenPct: 4,
    cnRatio: 9,
    // ammonia inhibition risk in mono-digestion
    ligninPct: 11,
    lhvMjPerKg: 12.8,
    bulkDensityTPerM3: 0.55,
    vsFraction: 0.75,
    bmpM3PerTVs: 255,
    counterfactual: "open_dumping",
    aggregationCostInrPerT: 350,
    gatePriceInrPerT: 400,
    notes: "Nitrogen-rich. Its C:N of 9 sits below the stable window for mono-digestion, so the pathway gate in pathways.ts rejects it for AD unless co-digested."
  },
  mandi_waste: {
    id: "mandi_waste",
    label: "Mandi / vegetable market waste",
    kind: "market",
    moisturePct: 82,
    ashPct: 10,
    carbonPct: 42,
    hydrogenPct: 6,
    nitrogenPct: 2.5,
    cnRatio: 17,
    ligninPct: 7,
    lhvMjPerKg: 15,
    bulkDensityTPerM3: 0.55,
    vsFraction: 0.86,
    bmpM3PerTVs: 400,
    // highly digestible
    counterfactual: "unmanaged_landfill",
    aggregationCostInrPerT: 500,
    gatePriceInrPerT: 0,
    // a disposal liability, not a commodity
    notes: "Highest methane potential in the network and effectively free at the gate, because today it is a disposal liability for the market committee."
  },
  msw_organic: {
    id: "msw_organic",
    label: "Segregated municipal organics",
    kind: "municipal",
    moisturePct: 65,
    ashPct: 18,
    carbonPct: 40,
    hydrogenPct: 5.5,
    nitrogenPct: 2.2,
    cnRatio: 20,
    ligninPct: 10,
    lhvMjPerKg: 14.2,
    bulkDensityTPerM3: 0.5,
    vsFraction: 0.78,
    bmpM3PerTVs: 330,
    counterfactual: "unmanaged_landfill",
    aggregationCostInrPerT: 450,
    gatePriceInrPerT: -400,
    // the ULB pays a tipping fee to have it taken away
    notes: "Carries a negative gate price: the urban local body pays a tipping fee. Combined with an unmanaged-landfill counterfactual worth ~1 tCO\u2082e/t, it is the highest-value avoided-emission feedstock in the network."
  }
};
var STREAM_IDS = Object.keys(STREAMS);
var COUNTERFACTUALS = {
  open_field_burning: {
    id: "open_field_burning",
    label: "Open in-field burning",
    // CH4 2.7 g/kg dm and N2O 0.07 g/kg dm at a combustion factor of 0.89,
    // valued at AR6 GWP100 (CH4 non-fossil 27.2, N2O 273).
    tco2ePerTDry: 0.0824,
    uncertaintyPct: 35,
    pm25KgPerTDry: 7.4,
    basis: "CH\u2084 2.7 g/kg DM + N\u2082O 0.07 g/kg DM, combustion factor 0.89, AR6 GWP\u2081\u2080\u2080. Biogenic CO\u2082 excluded.",
    source: "IPCC 2006 GL Vol.4 Ch.2 Tables 2.5/2.6; IPCC AR6 WG1 Ch.7 GWP values"
  },
  open_dung_heap: {
    id: "open_dung_heap",
    label: "Uncovered solid-storage dung heap",
    // VS-based: B0 0.13 m3 CH4/kg VS, MCF 5% (warm climate solid storage),
    // plus direct N2O at EF3 = 0.005 kg N2O-N/kg N.
    tco2ePerTDry: 0.175,
    uncertaintyPct: 45,
    pm25KgPerTDry: 0,
    basis: "B\u2080 0.13 m\xB3 CH\u2084/kg VS \xD7 MCF 5% (warm-climate solid storage) + direct N\u2082O at EF\u2083 0.005 kg N\u2082O-N/kg N.",
    source: "IPCC 2006 GL Vol.4 Ch.10 (Manure Management), 2019 Refinement"
  },
  unmanaged_landfill: {
    id: "unmanaged_landfill",
    label: "Unmanaged deep landfill",
    // First-order decay, integrated: DOC_f 0.5, MCF 0.8, F 0.5, no gas capture,
    // no oxidation layer. Expressed per tonne of dry matter.
    tco2ePerTDry: 3.1,
    uncertaintyPct: 40,
    pm25KgPerTDry: 0,
    basis: "IPCC first-order decay, DOC\u2091 0.5, MCF 0.8 (unmanaged deep), F 0.5, no capture, no oxidation. Emitted over decades; credited at diversion per standard practice.",
    source: "IPCC 2006 GL Vol.5 Ch.3 (Solid Waste Disposal)"
  },
  open_dumping: {
    id: "open_dumping",
    label: "Open dumping / uncontrolled heap",
    tco2ePerTDry: 1.05,
    uncertaintyPct: 50,
    pm25KgPerTDry: 0,
    basis: "IPCC first-order decay with MCF 0.4 for shallow uncontrolled disposal; substantially aerobic, so far below deep landfill.",
    source: "IPCC 2006 GL Vol.5 Ch.3, MCF for uncategorised shallow sites"
  }
};
function dryFraction(s) {
  return 1 - s.moisturePct / 100;
}
function vsPerWetTonne(s) {
  return dryFraction(s) * s.vsFraction;
}
function biocharYieldDry(s) {
  return 0.2 + 55e-4 * s.ligninPct + 45e-4 * s.ashPct;
}
var CARBON_RETENTION_IN_CHAR = 0.5;
function biocharCarbonPct(s) {
  const yieldDry = biocharYieldDry(s);
  if (yieldDry <= 0) return 0;
  return Math.min(92, s.carbonPct * CARBON_RETENTION_IN_CHAR / yieldDry);
}
function biocharHcOrg(s) {
  const feedHc = s.hydrogenPct / 1.008 / (s.carbonPct / 12.011);
  const aromatisation = 0.19 - 22e-4 * s.ligninPct;
  return Math.max(0.18, Math.min(0.68, feedHc * aromatisation));
}

// packages/engine/src/pathways.ts
var PATHWAYS = {
  pyrolysis_biochar: {
    id: "pyrolysis_biochar",
    label: "Slow pyrolysis \u2192 biochar",
    short: "Biochar",
    primaryProduct: "biochar",
    coProducts: ["electricity"],
    maxMoisturePct: 25,
    // drying a 70%-moisture feed costs more energy than the char is worth
    minMoisturePct: 0,
    maxAshPct: 30,
    minCnRatio: 0,
    maxCnRatio: 1e3,
    parasiticKwhPerT: 55,
    processHeatMjPerT: 0,
    // autothermal: syngas combustion supplies process heat
    ch4SlipFraction: 0,
    producesDurableRemoval: true,
    maturity: "Commercial; ~550 \xB0C continuous screw/auger reactors",
    description: "The only pathway in the network that produces durable carbon removal. Feedstock carbon is converted to condensed aromatic carbon that resists microbial decay for centuries. Requires a dry, lignin-rich feed."
  },
  anaerobic_digestion_cbg: {
    id: "anaerobic_digestion_cbg",
    label: "Anaerobic digestion \u2192 compressed bio-gas",
    short: "Bio-CNG",
    primaryProduct: "bio_cng",
    coProducts: ["digestate"],
    maxMoisturePct: 95,
    minMoisturePct: 55,
    // below this the digester needs dilution water it may not have
    maxAshPct: 25,
    minCnRatio: 15,
    // below 15 ammonia inhibition destabilises the digester
    maxCnRatio: 40,
    // above 40 nitrogen-limited, digestion stalls
    parasiticKwhPerT: 38,
    processHeatMjPerT: 210,
    // mesophilic digester heating
    ch4SlipFraction: 0.02,
    // 2% fugitive methane — counted against the pathway, honestly
    producesDurableRemoval: false,
    maturity: "Commercial; SATAT programme, ~\u20B954/kg assured offtake",
    description: "Converts wet, nitrogen-balanced organics to vehicle-grade compressed bio-gas plus a fertiliser-grade digestate. Displaces fossil CNG. Methane slip is counted as an emission rather than ignored."
  },
  pellet_cofiring: {
    id: "pellet_cofiring",
    label: "Densification \u2192 pellet co-firing",
    short: "Pellets",
    primaryProduct: "pellets",
    coProducts: [],
    maxMoisturePct: 18,
    minMoisturePct: 0,
    maxAshPct: 20,
    // high-silica paddy straw slags and fouls boiler tubes
    minCnRatio: 0,
    maxCnRatio: 1e3,
    parasiticKwhPerT: 85,
    // densification is electricity-hungry
    processHeatMjPerT: 120,
    ch4SlipFraction: 0,
    producesDurableRemoval: false,
    maturity: "Commercial; thermal-plant biomass co-firing mandate",
    description: "Densifies dry residue into pellets that displace coal in thermal power stations. High throughput and policy-backed offtake, but the carbon benefit is a one-off fossil displacement, not a removal."
  },
  composting: {
    id: "composting",
    label: "Windrow composting",
    short: "Compost",
    primaryProduct: "compost",
    coProducts: [],
    maxMoisturePct: 90,
    minMoisturePct: 35,
    maxAshPct: 35,
    minCnRatio: 12,
    maxCnRatio: 45,
    parasiticKwhPerT: 12,
    processHeatMjPerT: 0,
    ch4SlipFraction: 0.012,
    // anaerobic pockets in the windrow
    producesDurableRemoval: false,
    maturity: "Mature; lowest capital intensity in the network",
    description: "Cheapest and most robust pathway. Low value per tonne and only a small, low-durability soil carbon effect, but it absorbs feedstock nothing else can take and needs almost no capital."
  },
  gasification_power: {
    id: "gasification_power",
    label: "Gasification \u2192 power",
    short: "Power",
    primaryProduct: "electricity",
    coProducts: ["biochar"],
    maxMoisturePct: 20,
    minMoisturePct: 0,
    maxAshPct: 16,
    minCnRatio: 0,
    maxCnRatio: 1e3,
    parasiticKwhPerT: 95,
    processHeatMjPerT: 0,
    ch4SlipFraction: 0,
    producesDurableRemoval: true,
    // small char fraction, ~5% of feed
    maturity: "Commercial at small scale; sensitive to ash and tar",
    description: "Converts dry residue to producer gas for on-site generation, displacing grid electricity. Yields a small char fraction as a by-product. Ash-sensitive, so high-silica feedstocks are excluded."
  }
};
var PATHWAY_IDS = Object.keys(PATHWAYS);
function suitability(stream, pathway) {
  const gates = [];
  let score = 1;
  let limiting = "none";
  const moistureOk = stream.moisturePct <= pathway.maxMoisturePct && stream.moisturePct >= pathway.minMoisturePct;
  gates.push({
    gate: "Moisture",
    pass: moistureOk,
    detail: `${stream.moisturePct.toFixed(0)}% vs window ${pathway.minMoisturePct}\u2013${pathway.maxMoisturePct}%`
  });
  const ashOk = stream.ashPct <= pathway.maxAshPct;
  gates.push({
    gate: "Ash",
    pass: ashOk,
    detail: `${stream.ashPct.toFixed(1)}% vs max ${pathway.maxAshPct}%`
  });
  const cnOk = stream.cnRatio >= pathway.minCnRatio && stream.cnRatio <= pathway.maxCnRatio;
  gates.push({
    gate: "C:N ratio",
    pass: cnOk,
    detail: `${stream.cnRatio.toFixed(0)}:1 vs window ${pathway.minCnRatio}\u2013${pathway.maxCnRatio}`
  });
  if (!moistureOk) limiting = "moisture";
  else if (!ashOk) limiting = "ash";
  else if (!cnOk) limiting = "C:N ratio";
  const feasible = moistureOk && ashOk && cnOk;
  if (!feasible) return { score: 0, feasible: false, gates, limitingFactor: limiting };
  if (pathway.id === "pyrolysis_biochar") {
    const ligninScore = Math.min(1, stream.ligninPct / 20);
    const ashPenalty = Math.max(0.45, 1 - stream.ashPct / 40);
    score = 0.35 + 0.4 * ligninScore + 0.25 * ashPenalty;
    limiting = stream.ashPct > 15 ? "ash dilution of char carbon" : "lignin content";
  } else if (pathway.id === "anaerobic_digestion_cbg") {
    const cnScore = 1 - Math.min(1, Math.abs(stream.cnRatio - 25) / 25);
    const ligninPenalty = Math.max(0.3, 1 - stream.ligninPct / 25);
    const bmpScore = Math.min(1, stream.bmpM3PerTVs / 400);
    score = 0.2 * cnScore + 0.3 * ligninPenalty + 0.5 * bmpScore;
    limiting = stream.ligninPct > 15 ? "lignin recalcitrance" : "methane potential";
  } else if (pathway.id === "pellet_cofiring") {
    const lhvScore = Math.min(1, stream.lhvMjPerKg / 18);
    const ashPenalty = Math.max(0.3, 1 - stream.ashPct / 14);
    score = 0.55 * lhvScore + 0.45 * ashPenalty;
    limiting = stream.ashPct > 8 ? "boiler slagging risk" : "heating value";
  } else if (pathway.id === "composting") {
    const cnScore = 1 - Math.min(1, Math.abs(stream.cnRatio - 28) / 28);
    score = 0.45 + 0.55 * cnScore;
    limiting = "C:N balance";
  } else if (pathway.id === "gasification_power") {
    const lhvScore = Math.min(1, stream.lhvMjPerKg / 18);
    const ashPenalty = Math.max(0.3, 1 - stream.ashPct / 16);
    score = 0.5 * lhvScore + 0.5 * ashPenalty;
    limiting = "ash and tar loading";
  }
  return { score: Math.max(0, Math.min(1, score)), feasible: true, gates, limitingFactor: limiting };
}
var CH4_DENSITY_KG_PER_M3 = 0.716;
var CBG_UPGRADING_RECOVERY = 0.96;
var GASIFIER_ELECTRICAL_EFFICIENCY = 0.21;
var PELLET_MASS_LOSS = 0.06;
function pathwayYield(stream, pathwayId, efficiency) {
  const p = PATHWAYS[pathwayId];
  const dry = dryFraction(stream);
  const y = {
    biocharT: 0,
    cbgKg: 0,
    ch4M3: 0,
    pelletT: 0,
    compostT: 0,
    digestateT: 0,
    netKwh: 0,
    coalDisplacedMj: 0
  };
  if (pathwayId === "pyrolysis_biochar") {
    y.biocharT = dry * biocharYieldDry(stream) * efficiency;
    const syngasMj = dry * stream.lhvMjPerKg * 1e3 * 0.45;
    const exportKwh = syngasMj * 0.18 / 3.6;
    y.netKwh = exportKwh - p.parasiticKwhPerT;
  } else if (pathwayId === "anaerobic_digestion_cbg") {
    y.ch4M3 = vsPerWetTonne(stream) * stream.bmpM3PerTVs * efficiency;
    const deliveredCh4 = y.ch4M3 * (1 - p.ch4SlipFraction) * CBG_UPGRADING_RECOVERY;
    y.cbgKg = deliveredCh4 * CH4_DENSITY_KG_PER_M3;
    y.digestateT = dry * 0.45 + 0.08;
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === "pellet_cofiring") {
    y.pelletT = dry * (1 - PELLET_MASS_LOSS) * efficiency;
    y.coalDisplacedMj = y.pelletT * 1e3 * stream.lhvMjPerKg;
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === "composting") {
    y.compostT = dry * 0.55 * efficiency + (1 - dry) * 0.1;
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === "gasification_power") {
    const feedMj = dry * stream.lhvMjPerKg * 1e3;
    const grossKwh = feedMj * GASIFIER_ELECTRICAL_EFFICIENCY * efficiency / 3.6;
    y.netKwh = grossKwh - p.parasiticKwhPerT;
    y.biocharT = dry * 0.05 * efficiency;
  }
  return y;
}

// packages/engine/src/carbon.ts
var CO2_PER_C = 44.009 / 12.011;
var REFERENCE_SOIL_TEMP_C = 14.9;
function q10Factor(expTempC, targetTempC) {
  if (Math.abs(expTempC - targetTempC) < 1e-9) return 1.1;
  return 1.1 + 63.1579 * (Math.exp(-0.19 * targetTempC) - Math.exp(-0.19 * expTempC)) / (expTempC - targetTempC);
}
function fT(expTempC, targetTempC) {
  const q10 = q10Factor(expTempC, targetTempC);
  if (q10 <= 0) return 1;
  return Math.exp(Math.log(q10) * ((targetTempC - expTempC) / 10));
}
function twoPoolRemaining(tYears, labileFraction, kLabile, kPersistent) {
  return labileFraction * Math.exp(-kLabile * tYears) + (1 - labileFraction) * Math.exp(-kPersistent * tYears);
}
function decayParamsAtReference(hcOrg) {
  const hc = Math.max(0.1, Math.min(0.9, hcOrg));
  return {
    // More hydrogen means more residual aliphatic carbon, hence a larger fast pool.
    labileFraction: Math.max(0.02, Math.min(0.3, 0.03 + 0.35 * (hc - 0.18))),
    kLabile: 0.55,
    kPersistent: Math.max(4e-4, 9e-4 + 6e-3 * (hc - 0.18))
  };
}
function permanenceFor(streamId, soilTempC) {
  const s = STREAMS[streamId];
  const hc = biocharHcOrg(s);
  const base = decayParamsAtReference(hc);
  const q10 = q10Factor(REFERENCE_SOIL_TEMP_C, soilTempC);
  const ratio = fT(REFERENCE_SOIL_TEMP_C, soilTempC);
  const kLabile = base.kLabile * ratio;
  const kPersistent = base.kPersistent * ratio;
  const bc100 = twoPoolRemaining(100, base.labileFraction, kLabile, kPersistent);
  const curve = [];
  for (const year of [0, 1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200]) {
    curve.push({
      year,
      remaining: twoPoolRemaining(year, base.labileFraction, kLabile, kPersistent)
    });
  }
  return {
    hcOrgRatio: hc,
    soilTempC,
    referenceTempC: REFERENCE_SOIL_TEMP_C,
    q10,
    fT: ratio,
    bc100,
    labileFraction: base.labileFraction,
    labileRatePerYr: kLabile,
    persistentRatePerYr: kPersistent,
    curve,
    method: "Two-pool first-order decay parameterised by char H/C(org), with decay rates Q10-corrected from the harmonised 14.9 \xB0C reference dataset to the local soil temperature. Model form after Azzi et al. (2024); Q10 relation after Woolf et al. (2021)."
  };
}
var EMPTY_RETURN_FUEL_RATIO = 0.78;
var COMPOST_CH4_KG_PER_T_WET = 1.8;
var COMPOST_N2O_KG_PER_T_WET = 0.15;
function physicalPerTonne(streamId, pathwayId, efficiency, distanceKm, payloadT, vehicle) {
  const s = STREAMS[streamId];
  const p = PATHWAYS[pathwayId];
  const y = pathwayYield(s, pathwayId, efficiency);
  const dry = dryFraction(s);
  const charC = biocharCarbonPct(s) / 100 * y.biocharT;
  const dieselPerTrip = vehicle.dieselLPerKm * distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO);
  const transportDieselL = payloadT > 0 ? dieselPerTrip / payloadT : 0;
  const needsAggregation = s.kind === "crop_residue";
  let fertiliserNKg = 0;
  if (y.compostT > 0) fertiliserNKg = y.compostT * 1e3 * 0.012 * 0.35;
  if (y.digestateT > 0) fertiliserNKg += y.digestateT * 1e3 * 0.015 * 0.45;
  return {
    dryT: dry,
    counterfactual: s.counterfactual,
    biocharCarbonT: charC,
    biocharT: y.biocharT,
    cbgKg: y.cbgKg,
    ch4SlipM3: y.ch4M3 * p.ch4SlipFraction,
    coalDisplacedMj: y.coalDisplacedMj,
    netKwh: y.netKwh,
    compostT: y.compostT,
    digestateT: y.digestateT,
    fertiliserNKg,
    transportDieselL,
    aggregationT: needsAggregation ? 1 : 0,
    compostCh4T: pathwayId === "composting" ? COMPOST_CH4_KG_PER_T_WET / 1e3 : 0,
    compostN2oT: pathwayId === "composting" ? COMPOST_N2O_KG_PER_T_WET / 1e3 : 0,
    pm25AvoidedKg: dry * COUNTERFACTUALS[s.counterfactual].pm25KgPerTDry,
    tkm: distanceKm
  };
}
function baseFactors(bc100, assumptions) {
  return {
    bc100,
    counterfactual: {
      open_field_burning: COUNTERFACTUALS.open_field_burning.tco2ePerTDry,
      open_dung_heap: COUNTERFACTUALS.open_dung_heap.tco2ePerTDry,
      unmanaged_landfill: COUNTERFACTUALS.unmanaged_landfill.tco2ePerTDry,
      open_dumping: COUNTERFACTUALS.open_dumping.tco2ePerTDry
    },
    dieselKgPerL: DIESEL_WTW_KG_PER_L,
    gridEfTPerMwh: assumptions.gridEfTPerMwh,
    coalTco2PerMj: EF.coal.value * 1e-6,
    cngKgPerKg: EF.cngDisplaced.value,
    fertNKgPerKg: EF.syntheticFertiliserN.value,
    ch4Gwp: EF.ch4Gwp.value,
    n2oGwp: EF.n2oGwp.value,
    balingKgPerT: EF.baling.value
  };
}
function evaluateCarbon(phys, tonnes, fac) {
  const durable = phys.biocharCarbonT * CO2_PER_C * fac.bc100 * tonnes;
  const avoided = phys.dryT * fac.counterfactual[phys.counterfactual] * tonnes;
  let substitution = 0;
  substitution += phys.cbgKg * fac.cngKgPerKg / 1e3;
  substitution += phys.coalDisplacedMj * fac.coalTco2PerMj;
  if (phys.netKwh > 0) substitution += phys.netKwh / 1e3 * fac.gridEfTPerMwh;
  substitution += phys.fertiliserNKg * fac.fertNKgPerKg / 1e3;
  substitution *= tonnes;
  let emitted = 0;
  emitted += phys.transportDieselL * fac.dieselKgPerL / 1e3;
  emitted += phys.aggregationT * fac.balingKgPerT / 1e3;
  if (phys.netKwh < 0) emitted += -phys.netKwh / 1e3 * fac.gridEfTPerMwh;
  emitted += phys.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp / 1e3;
  emitted += phys.compostCh4T * fac.ch4Gwp;
  emitted += phys.compostN2oT * fac.n2oGwp;
  emitted *= tonnes;
  return {
    durableT: durable,
    avoidedT: avoided,
    substitutionT: substitution,
    emittedT: emitted,
    netT: durable + avoided + substitution - emitted
  };
}
function emptyAggregate() {
  return {
    biocharCarbonT: 0,
    biocharT: 0,
    dryTByCounterfactual: {
      open_field_burning: 0,
      open_dung_heap: 0,
      unmanaged_landfill: 0,
      open_dumping: 0
    },
    cbgKg: 0,
    ch4SlipM3: 0,
    coalDisplacedMj: 0,
    kwhExported: 0,
    kwhImported: 0,
    fertiliserNKg: 0,
    transportDieselL: 0,
    aggregationT: 0,
    compostCh4T: 0,
    compostN2oT: 0,
    pm25AvoidedKg: 0,
    totalTonnes: 0,
    tkm: 0
  };
}
function addToAggregate(agg, phys, tonnes) {
  agg.biocharCarbonT += phys.biocharCarbonT * tonnes;
  agg.biocharT += phys.biocharT * tonnes;
  agg.dryTByCounterfactual[phys.counterfactual] += phys.dryT * tonnes;
  agg.cbgKg += phys.cbgKg * tonnes;
  agg.ch4SlipM3 += phys.ch4SlipM3 * tonnes;
  agg.coalDisplacedMj += phys.coalDisplacedMj * tonnes;
  if (phys.netKwh > 0) agg.kwhExported += phys.netKwh * tonnes;
  else agg.kwhImported += -phys.netKwh * tonnes;
  agg.fertiliserNKg += phys.fertiliserNKg * tonnes;
  agg.transportDieselL += phys.transportDieselL * tonnes;
  agg.aggregationT += phys.aggregationT * tonnes;
  agg.compostCh4T += phys.compostCh4T * tonnes;
  agg.compostN2oT += phys.compostN2oT * tonnes;
  agg.pm25AvoidedKg += phys.pm25AvoidedKg * tonnes;
  agg.totalTonnes += tonnes;
  agg.tkm += phys.tkm * tonnes;
}
function evaluateAggregate(agg, fac) {
  const durable = agg.biocharCarbonT * CO2_PER_C * fac.bc100;
  let avoided = 0;
  for (const key of Object.keys(agg.dryTByCounterfactual)) {
    avoided += agg.dryTByCounterfactual[key] * fac.counterfactual[key];
  }
  let substitution = 0;
  substitution += agg.cbgKg * fac.cngKgPerKg / 1e3;
  substitution += agg.coalDisplacedMj * fac.coalTco2PerMj;
  substitution += agg.kwhExported / 1e3 * fac.gridEfTPerMwh;
  substitution += agg.fertiliserNKg * fac.fertNKgPerKg / 1e3;
  let emitted = 0;
  emitted += agg.transportDieselL * fac.dieselKgPerL / 1e3;
  emitted += agg.aggregationT * fac.balingKgPerT / 1e3;
  emitted += agg.kwhImported / 1e3 * fac.gridEfTPerMwh;
  emitted += agg.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp / 1e3;
  emitted += agg.compostCh4T * fac.ch4Gwp;
  emitted += agg.compostN2oT * fac.n2oGwp;
  return {
    durableT: durable,
    avoidedT: avoided,
    substitutionT: substitution,
    emittedT: emitted,
    netT: durable + avoided + substitution - emitted
  };
}
function buildLedger(agg, assumptions, permanence, withUncertainty) {
  const bc100 = permanence ? permanence.bc100 : 1;
  const fac = baseFactors(bc100, assumptions);
  const lines = [];
  const grossChar = agg.biocharCarbonT * CO2_PER_C;
  if (grossChar > 0) {
    lines.push({
      key: "char_gross",
      label: "Carbon fixed in biochar (gross)",
      valueT: grossChar,
      kind: "removal",
      basis: `${agg.biocharT.toFixed(0)} t biochar \xD7 char carbon content \xD7 44/12`,
      source: "Derived from feedstock ultimate analysis and slow-pyrolysis char yield",
      uncertaintyPct: 18
    });
    if (permanence) {
      const adj = grossChar * (permanence.bc100 - 1);
      lines.push({
        key: "char_permanence",
        label: `Permanence adjustment to 100 years (BC\u2081\u2080\u2080 = ${(permanence.bc100 * 100).toFixed(1)}%)`,
        valueT: adj,
        kind: "adjustment",
        basis: `Two-pool decay at H/C\u2092\u1D63\u1D4D ${permanence.hcOrgRatio.toFixed(2)}, Q10-corrected from ${permanence.referenceTempC} \xB0C to ${permanence.soilTempC} \xB0C (f\u209C = ${permanence.fT.toFixed(3)})`,
        source: "Azzi et al. 2024 Geoderma 441:116761; Woolf et al. 2021 ES&T 55:14795",
        uncertaintyPct: 15
      });
    }
  }
  for (const key of Object.keys(agg.dryTByCounterfactual)) {
    const dryT = agg.dryTByCounterfactual[key];
    if (dryT <= 0.01) continue;
    const cf = COUNTERFACTUALS[key];
    lines.push({
      key: `avoided_${key}`,
      label: `Avoided: ${cf.label.toLowerCase()}`,
      valueT: dryT * cf.tco2ePerTDry,
      kind: "avoided",
      basis: `${dryT.toFixed(0)} t dry matter \xD7 ${cf.tco2ePerTDry} tCO\u2082e/t. ${cf.basis}`,
      source: cf.source,
      uncertaintyPct: cf.uncertaintyPct
    });
  }
  if (agg.cbgKg > 1) {
    lines.push({
      key: "sub_cng",
      label: "Fossil CNG displaced by bio-CNG",
      valueT: agg.cbgKg * fac.cngKgPerKg / 1e3,
      kind: "substitution",
      basis: `${(agg.cbgKg / 1e3).toFixed(1)} t CBG \xD7 ${fac.cngKgPerKg} kgCO\u2082e/kg`,
      source: EF.cngDisplaced.source,
      uncertaintyPct: EF.cngDisplaced.uncertaintyPct
    });
  }
  if (agg.coalDisplacedMj > 1) {
    lines.push({
      key: "sub_coal",
      label: "Thermal coal displaced by pellet co-firing",
      valueT: agg.coalDisplacedMj * fac.coalTco2PerMj,
      kind: "substitution",
      basis: `${(agg.coalDisplacedMj / 1e3).toFixed(0)} GJ \xD7 ${EF.coal.value} tCO\u2082/TJ`,
      source: EF.coal.source,
      uncertaintyPct: EF.coal.uncertaintyPct
    });
  }
  if (agg.kwhExported > 1) {
    lines.push({
      key: "sub_power",
      label: "Grid electricity displaced by exported power",
      valueT: agg.kwhExported / 1e3 * fac.gridEfTPerMwh,
      kind: "substitution",
      basis: `${(agg.kwhExported / 1e3).toFixed(0)} MWh \xD7 ${fac.gridEfTPerMwh} tCO\u2082e/MWh`,
      source: EF.gridElectricity.source,
      uncertaintyPct: EF.gridElectricity.uncertaintyPct
    });
  }
  if (agg.fertiliserNKg > 1) {
    lines.push({
      key: "sub_fert",
      label: "Synthetic nitrogen displaced by compost / digestate",
      valueT: agg.fertiliserNKg * fac.fertNKgPerKg / 1e3,
      kind: "substitution",
      basis: `${(agg.fertiliserNKg / 1e3).toFixed(1)} t plant-available N \xD7 ${fac.fertNKgPerKg} kgCO\u2082e/kg N`,
      source: EF.syntheticFertiliserN.source,
      uncertaintyPct: EF.syntheticFertiliserN.uncertaintyPct
    });
  }
  if (agg.transportDieselL > 1) {
    lines.push({
      key: "em_transport",
      label: "Transport emissions (well-to-wheel, incl. empty return)",
      valueT: -(agg.transportDieselL * fac.dieselKgPerL) / 1e3,
      kind: "emission",
      basis: `${agg.transportDieselL.toFixed(0)} L diesel \xD7 ${fac.dieselKgPerL.toFixed(2)} kgCO\u2082e/L over ${(agg.tkm / 1e3).toFixed(0)}k tonne-km`,
      source: EF.dieselCombustion.source,
      uncertaintyPct: 10
    });
  }
  if (agg.aggregationT > 1) {
    lines.push({
      key: "em_aggregation",
      label: "Field aggregation (raking, baling, loading)",
      valueT: -(agg.aggregationT * fac.balingKgPerT) / 1e3,
      kind: "emission",
      basis: `${agg.aggregationT.toFixed(0)} t \xD7 ${fac.balingKgPerT} kgCO\u2082e/t`,
      source: EF.baling.source,
      uncertaintyPct: EF.baling.uncertaintyPct
    });
  }
  if (agg.kwhImported > 1) {
    lines.push({
      key: "em_parasitic",
      label: "Process electricity drawn from grid",
      valueT: -(agg.kwhImported / 1e3) * fac.gridEfTPerMwh,
      kind: "emission",
      basis: `${(agg.kwhImported / 1e3).toFixed(0)} MWh \xD7 ${fac.gridEfTPerMwh} tCO\u2082e/MWh`,
      source: EF.gridElectricity.source,
      uncertaintyPct: EF.gridElectricity.uncertaintyPct
    });
  }
  if (agg.ch4SlipM3 > 0.1) {
    lines.push({
      key: "em_ch4_slip",
      label: "Digester fugitive methane (2% slip)",
      valueT: -(agg.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp) / 1e3,
      kind: "emission",
      basis: `${agg.ch4SlipM3.toFixed(0)} m\xB3 CH\u2084 \xD7 ${CH4_DENSITY_KG_PER_M3} kg/m\xB3 \xD7 GWP ${fac.ch4Gwp}`,
      source: "Measured fugitive rates at commercial CBG plants; IPCC AR6 GWP",
      uncertaintyPct: 55
    });
  }
  if (agg.compostCh4T > 1e-3) {
    lines.push({
      key: "em_compost",
      label: "Windrow composting CH\u2084 and N\u2082O",
      valueT: -(agg.compostCh4T * fac.ch4Gwp + agg.compostN2oT * fac.n2oGwp),
      kind: "emission",
      basis: `IPCC defaults 4 kg CH\u2084 and 0.3 kg N\u2082O per tonne wet waste composted`,
      source: "IPCC 2006 GL Vol.5 Ch.4 Table 4.1, lower bound of the range for actively turned windrows",
      uncertaintyPct: 40
    });
  }
  const comp = evaluateAggregate(agg, fac);
  lines.push({
    key: "net",
    label: "Net carbon impact",
    valueT: comp.netT,
    kind: "total",
    basis: "Durable removal + avoided emissions + substitution \u2212 emissions",
    source: "This ledger",
    uncertaintyPct: 0
  });
  let uncertainty = null;
  if (withUncertainty && agg.totalTonnes > 0) {
    uncertainty = monteCarlo(agg, assumptions, permanence);
  }
  return {
    lines,
    durableRemovalT: comp.durableT,
    avoidedEmissionsT: comp.avoidedT,
    substitutionT: comp.substitutionT,
    emissionsT: comp.emittedT,
    netT: comp.netT,
    permanence,
    uncertainty
  };
}
function monteCarlo(agg, assumptions, permanence) {
  const draws = Math.max(50, Math.min(5e4, assumptions.mcDraws));
  const rng = makeRng(assumptions.seed ^ 6240801);
  const base = baseFactors(permanence ? permanence.bc100 : 1, assumptions);
  const samples = new Array(draws);
  for (let i = 0; i < draws; i++) {
    const fac = {
      // BC100 is a bounded fraction, so it is perturbed then clipped rather than
      // drawn lognormally.
      bc100: Math.max(
        0.2,
        Math.min(0.99, lognormalAround(rng, base.bc100, 0.15))
      ),
      counterfactual: {
        open_field_burning: lognormalAround(
          rng,
          base.counterfactual.open_field_burning,
          COUNTERFACTUALS.open_field_burning.uncertaintyPct / 100
        ),
        open_dung_heap: lognormalAround(
          rng,
          base.counterfactual.open_dung_heap,
          COUNTERFACTUALS.open_dung_heap.uncertaintyPct / 100
        ),
        unmanaged_landfill: lognormalAround(
          rng,
          base.counterfactual.unmanaged_landfill,
          COUNTERFACTUALS.unmanaged_landfill.uncertaintyPct / 100
        ),
        open_dumping: lognormalAround(
          rng,
          base.counterfactual.open_dumping,
          COUNTERFACTUALS.open_dumping.uncertaintyPct / 100
        )
      },
      dieselKgPerL: lognormalAround(rng, base.dieselKgPerL, 0.1),
      gridEfTPerMwh: lognormalAround(
        rng,
        base.gridEfTPerMwh,
        EF.gridElectricity.uncertaintyPct / 100
      ),
      coalTco2PerMj: lognormalAround(rng, base.coalTco2PerMj, EF.coal.uncertaintyPct / 100),
      cngKgPerKg: lognormalAround(rng, base.cngKgPerKg, EF.cngDisplaced.uncertaintyPct / 100),
      fertNKgPerKg: lognormalAround(
        rng,
        base.fertNKgPerKg,
        EF.syntheticFertiliserN.uncertaintyPct / 100
      ),
      ch4Gwp: base.ch4Gwp,
      n2oGwp: base.n2oGwp,
      balingKgPerT: lognormalAround(rng, base.balingKgPerT, EF.baling.uncertaintyPct / 100)
    };
    samples[i] = evaluateAggregate(agg, fac).netT;
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const binCount = 28;
  const width = (hi - lo) / binCount || 1;
  const counts = new Array(binCount).fill(0);
  for (const v of samples) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - lo) / width)));
    counts[idx]++;
  }
  return {
    draws,
    p5: percentileSorted(sorted, 0.05),
    p50: percentileSorted(sorted, 0.5),
    p95: percentileSorted(sorted, 0.95),
    mean: mean(samples),
    stdev: stdev(samples),
    histogram: counts.map((count, i) => ({ bin: lo + width * (i + 0.5), count }))
  };
}
function aggregateAllocations(allocations, facilities, vehicles, assumptions) {
  const facById = new Map(facilities.map((x) => [x.id, x]));
  const vehById = new Map(vehicles.map((v) => [v.id, v]));
  const agg = emptyAggregate();
  for (const a of allocations) {
    const fac = facById.get(a.facilityId);
    const veh = vehById.get(a.vehicleId);
    if (!fac || !veh) continue;
    const phys = physicalPerTonne(
      a.stream,
      a.pathway,
      fac.efficiency,
      a.distanceKm,
      a.payloadT,
      veh
    );
    addToAggregate(agg, phys, a.tonnes);
  }
  return agg;
}
function networkLedger(allocations, facilities, vehicles, assumptions, basis) {
  const dominant = basis.kind === "inherit" ? basis.stream : dominantBiocharStream(allocations);
  const permanence = dominant ? permanenceFor(dominant, assumptions.soilTempC) : null;
  return buildLedger(
    aggregateAllocations(allocations, facilities, vehicles, assumptions),
    assumptions,
    permanence,
    false
  );
}
function inheritFrom(wholePlan) {
  return { kind: "inherit", stream: dominantBiocharStream(wholePlan) };
}
var OWN_BASIS = { kind: "own" };
function dominantBiocharStream(allocations) {
  const byStream = /* @__PURE__ */ new Map();
  for (const a of allocations) {
    if (!PATHWAYS[a.pathway].producesDurableRemoval) continue;
    byStream.set(a.stream, (byStream.get(a.stream) ?? 0) + a.tonnes);
  }
  let best = null;
  let bestT = 0;
  for (const [s, t] of byStream) {
    if (t > bestT) {
      bestT = t;
      best = s;
    }
  }
  return best;
}

// packages/engine/src/economics.ts
function transportCostPerTonne(distanceKm, payloadT, vehicle, assumptions) {
  if (payloadT <= 0) return Infinity;
  const roundTripKm = distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO);
  const fuelCost = vehicle.dieselLPerKm * roundTripKm * assumptions.dieselPriceInrPerL;
  const runningCost = vehicle.costInrPerKm * roundTripKm * 0.45;
  const tripCost = fuelCost + runningCost + vehicle.fixedCostInrPerTrip;
  return tripCost / payloadT;
}
function economicsPerTonne(streamId, pathwayId, facility, distanceKm, payloadT, vehicle, carbon, assumptions) {
  const s = STREAMS[streamId];
  const y = pathwayYield(s, pathwayId, facility.efficiency);
  const lines = [];
  let productRevenue = 0;
  const addProduct = (key, label, qty, price, unit) => {
    if (qty <= 0) return;
    const v = qty * price;
    productRevenue += v;
    lines.push({
      key,
      label,
      valueInr: v,
      kind: "product_revenue",
      basis: `${qty.toFixed(3)} ${unit} \xD7 \u20B9${price.toLocaleString("en-IN")}`
    });
  };
  addProduct("biochar", "Biochar sales", y.biocharT, PRICES.biochar.price, "t");
  addProduct("cbg", "Compressed bio-gas sales", y.cbgKg, PRICES.bio_cng.price, "kg");
  addProduct("pellets", "Pellet sales", y.pelletT, PRICES.pellets.price, "t");
  addProduct("compost", "Compost sales", y.compostT, PRICES.compost.price, "t");
  addProduct("digestate", "Digestate (FOM) sales", y.digestateT, PRICES.digestate.price, "t");
  if (y.netKwh > 0) {
    addProduct("power", "Power export", y.netKwh, PRICES.electricity.price, "kWh");
  }
  const carbonRevenue = carbon.durableT * assumptions.cdrPriceInrPerT + Math.max(0, carbon.avoidedT + carbon.substitutionT) * assumptions.vcmPriceInrPerT;
  if (carbon.durableT > 0) {
    lines.push({
      key: "cdr",
      label: "Durable removal credits",
      valueInr: carbon.durableT * assumptions.cdrPriceInrPerT,
      kind: "carbon_revenue",
      basis: `${carbon.durableT.toFixed(3)} tCO\u2082e \xD7 \u20B9${assumptions.cdrPriceInrPerT.toLocaleString("en-IN")}`
    });
  }
  const avoidedValue = Math.max(0, carbon.avoidedT + carbon.substitutionT) * assumptions.vcmPriceInrPerT;
  if (avoidedValue > 0) {
    lines.push({
      key: "vcm",
      label: "Avoided-emission credits",
      valueInr: avoidedValue,
      kind: "carbon_revenue",
      basis: `${(carbon.avoidedT + carbon.substitutionT).toFixed(3)} tCO\u2082e \xD7 \u20B9${assumptions.vcmPriceInrPerT.toLocaleString("en-IN")}`
    });
  }
  const feedstockCost = s.gatePriceInrPerT;
  lines.push({
    key: "gate",
    label: feedstockCost >= 0 ? "Feedstock purchase" : "Tipping fee received",
    valueInr: -feedstockCost,
    kind: "feedstock",
    basis: feedstockCost >= 0 ? `\u20B9${feedstockCost}/t paid to the generator` : `\u20B9${-feedstockCost}/t received for accepting the material`
  });
  const aggregationCost = s.aggregationCostInrPerT;
  lines.push({
    key: "aggregation",
    label: "Aggregation and handling",
    valueInr: -aggregationCost,
    kind: "feedstock",
    basis: `\u20B9${aggregationCost}/t \u2014 ${s.kind === "crop_residue" ? "rake, bale, load" : "collection and handling"}`
  });
  const transportCost = transportCostPerTonne(distanceKm, payloadT, vehicle, assumptions);
  lines.push({
    key: "transport",
    label: "Road transport",
    valueInr: -transportCost,
    kind: "logistics",
    basis: `${distanceKm.toFixed(0)} km on a ${vehicle.label} at ${payloadT.toFixed(1)} t payload (round trip)`
  });
  const processingCost = facility.opexInrPerT;
  lines.push({
    key: "opex",
    label: "Processing opex",
    valueInr: -processingCost,
    kind: "processing",
    basis: `\u20B9${processingCost}/t at ${facility.name}`
  });
  const capexCost = facility.capexAmortInrPerT;
  lines.push({
    key: "capex",
    label: "Capital charge (amortised)",
    valueInr: -capexCost,
    kind: "processing",
    basis: `\u20B9${capexCost}/t at nameplate throughput`
  });
  const margin = productRevenue + carbonRevenue - feedstockCost - aggregationCost - transportCost - processingCost - capexCost;
  lines.push({
    key: "margin",
    label: "Operating margin",
    valueInr: margin,
    kind: "total",
    basis: "Revenue less feedstock, logistics and processing"
  });
  return {
    productRevenue,
    carbonRevenue,
    feedstockCost,
    aggregationCost,
    transportCost,
    processingCost,
    capexCost,
    margin,
    lines
  };
}
function emptyEconAggregate() {
  return {
    productRevenueInr: 0,
    carbonRevenueInr: 0,
    feedstockCostInr: 0,
    aggregationCostInr: 0,
    transportCostInr: 0,
    processingCostInr: 0,
    capexCostInr: 0,
    marginInr: 0,
    byPathway: {},
    byFacility: {}
  };
}
function rollupEconomics(allocations) {
  const agg = emptyEconAggregate();
  for (const a of allocations) {
    agg.marginInr += a.marginInr;
    agg.productRevenueInr += a.revenueInr;
    agg.processingCostInr += a.costInr;
    const p = agg.byPathway[a.pathway] ?? { tonnes: 0, revenue: 0, cost: 0, margin: 0 };
    p.tonnes += a.tonnes;
    p.revenue += a.revenueInr;
    p.cost += a.costInr;
    p.margin += a.marginInr;
    agg.byPathway[a.pathway] = p;
    const fkey = a.facilityId;
    const fa = agg.byFacility[fkey] ?? { tonnes: 0, revenue: 0, cost: 0, margin: 0 };
    fa.tonnes += a.tonnes;
    fa.revenue += a.revenueInr;
    fa.cost += a.costInr;
    fa.margin += a.marginInr;
    agg.byFacility[fkey] = fa;
  }
  return agg;
}
var PATHWAY_LABEL = {
  pyrolysis_biochar: PATHWAYS.pyrolysis_biochar.short,
  anaerobic_digestion_cbg: PATHWAYS.anaerobic_digestion_cbg.short,
  pellet_cofiring: PATHWAYS.pellet_cofiring.short,
  composting: PATHWAYS.composting.short,
  gasification_power: PATHWAYS.gasification_power.short
};

// packages/engine/src/mincostflow.ts
var Heap = class {
  keys = [];
  vals = [];
  get size() {
    return this.vals.length;
  }
  push(key, val) {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.vals.length - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(p, i);
      i = p;
    }
  }
  pop() {
    const key = this.keys[0];
    const val = this.vals[0];
    const lastK = this.keys.pop();
    const lastV = this.vals.pop();
    if (this.vals.length > 0) {
      this.keys[0] = lastK;
      this.vals[0] = lastV;
      let i = 0;
      for (; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.vals.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.vals.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(m, i);
        i = m;
      }
    }
    return { key, val };
  }
  swap(a, b) {
    const k = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = k;
    const v = this.vals[a];
    this.vals[a] = this.vals[b];
    this.vals[b] = v;
  }
};
var MinCostFlow = class {
  n;
  graph;
  edges;
  /** Johnson potentials after the final iteration — the LP duals on node balance. */
  potentials;
  iterations;
  constructor(n) {
    this.n = n;
    this.graph = Array.from({ length: n }, () => []);
    this.edges = [];
    this.potentials = new Array(n).fill(0);
    this.iterations = 0;
  }
  /** Adds a directed arc plus its residual twin. Returns the forward edge index. */
  addEdge(from, to, cap, cost) {
    const idx = this.edges.length;
    this.edges.push({ to, cap, cost, flow: 0 });
    this.graph[from].push(idx);
    this.edges.push({ to: from, cap: 0, cost: -cost, flow: 0 });
    this.graph[to].push(idx + 1);
    return idx;
  }
  flowOn(edgeIndex) {
    return this.edges[edgeIndex].flow;
  }
  /** SPFA over the initial (possibly negative-cost) graph to seed the potentials. */
  seedPotentials(s) {
    const INF = Number.POSITIVE_INFINITY;
    const h = new Array(this.n).fill(INF);
    h[s] = 0;
    const inQueue = new Uint8Array(this.n);
    const queue = [s];
    inQueue[s] = 1;
    let head = 0;
    let guard = 0;
    const limit = this.n * this.edges.length + 16;
    while (head < queue.length && guard++ < limit) {
      const u = queue[head++];
      inQueue[u] = 0;
      for (const ei of this.graph[u]) {
        const e = this.edges[ei];
        if (e.cap - e.flow <= 0) continue;
        const nd = h[u] + e.cost;
        if (nd < h[e.to] - 1e-9) {
          h[e.to] = nd;
          if (!inQueue[e.to]) {
            inQueue[e.to] = 1;
            queue.push(e.to);
          }
        }
      }
      if (head > 8192 && head * 2 > queue.length) {
        queue.splice(0, head);
        head = 0;
      }
    }
    for (let i = 0; i < this.n; i++) this.potentials[i] = h[i] === INF ? 0 : h[i];
  }
  /**
   * Runs min-cost max-flow from s to t.
   * Returns the total flow pushed and the total (true, un-reduced) cost.
   */
  run(s, t) {
    this.seedPotentials(s);
    const INF = Number.POSITIVE_INFINITY;
    const dist2 = new Array(this.n).fill(0);
    const prevEdge = new Int32Array(this.n);
    const done = new Uint8Array(this.n);
    const h = this.potentials;
    let totalFlow = 0;
    let totalCost = 0;
    for (; ; ) {
      dist2.fill(INF);
      prevEdge.fill(-1);
      done.fill(0);
      dist2[s] = 0;
      const heap = new Heap();
      heap.push(0, s);
      while (heap.size > 0) {
        const { key, val: u } = heap.pop();
        if (done[u]) continue;
        if (key > dist2[u] + 1e-9) continue;
        done[u] = 1;
        for (const ei of this.graph[u]) {
          const e = this.edges[ei];
          if (e.cap - e.flow <= 0) continue;
          const v = e.to;
          if (done[v]) continue;
          const rc = e.cost + h[u] - h[v];
          const nd = dist2[u] + (rc > 0 ? rc : 0);
          if (nd < dist2[v] - 1e-9) {
            dist2[v] = nd;
            prevEdge[v] = ei;
            heap.push(nd, v);
          }
        }
      }
      this.iterations++;
      if (dist2[t] === INF) break;
      for (let i = 0; i < this.n; i++) {
        if (dist2[i] < INF) h[i] += dist2[i];
      }
      let push = Number.MAX_SAFE_INTEGER;
      for (let v = t; v !== s; ) {
        const ei = prevEdge[v];
        const e = this.edges[ei];
        const residual = e.cap - e.flow;
        if (residual < push) push = residual;
        v = this.edges[ei ^ 1].to;
      }
      if (push <= 0) break;
      for (let v = t; v !== s; ) {
        const ei = prevEdge[v];
        this.edges[ei].flow += push;
        this.edges[ei ^ 1].flow -= push;
        totalCost += push * this.edges[ei].cost;
        v = this.edges[ei ^ 1].to;
      }
      totalFlow += push;
      if (this.iterations > 5e4) break;
    }
    return { flow: totalFlow, cost: totalCost };
  }
};
var FORCE_BONUS = 1e8;
function solveTransport(p) {
  const nS = p.supplies.length;
  const nF = p.capacities.length;
  const S = 0;
  const srcBase = 1;
  const facBase = 1 + nS;
  const T = 1 + nS + nF;
  const mcf = new MinCostFlow(T + 1);
  for (let i = 0; i < nS; i++) {
    const s = Math.max(0, Math.round(p.supplies[i]));
    mcf.addEdge(S, srcBase + i, s, 0);
    mcf.addEdge(srcBase + i, T, s, 0);
  }
  const arcEdgeIndex = [];
  for (let i = 0; i < nS; i++) {
    const row = [];
    for (const a of p.arcs[i]) {
      const cap = Math.min(Math.round(p.supplies[i]), Math.round(p.capacities[a.facility]));
      if (cap <= 0) {
        row.push(-1);
        continue;
      }
      row.push(mcf.addEdge(srcBase + i, facBase + a.facility, cap, -a.value));
    }
    arcEdgeIndex.push(row);
  }
  const forcedEdges = new Array(nF).fill(-1);
  for (let j = 0; j < nF; j++) {
    const cap = Math.max(0, Math.round(p.capacities[j]));
    const lb = Math.max(0, Math.min(cap, Math.round(p.lowerBounds[j])));
    if (lb > 0) {
      forcedEdges[j] = mcf.addEdge(facBase + j, T, lb, -FORCE_BONUS);
      if (cap - lb > 0) mcf.addEdge(facBase + j, T, cap - lb, 0);
    } else if (cap > 0) {
      mcf.addEdge(facBase + j, T, cap, 0);
    }
  }
  mcf.run(S, T);
  const flow = [];
  const facilityLoad = new Array(nF).fill(0);
  const unallocated = new Array(nS).fill(0);
  let value = 0;
  for (let i = 0; i < nS; i++) {
    const row = [];
    let assigned = 0;
    for (let k = 0; k < p.arcs[i].length; k++) {
      const ei = arcEdgeIndex[i][k];
      const fl = ei < 0 ? 0 : mcf.flowOn(ei);
      row.push(fl);
      assigned += fl;
      facilityLoad[p.arcs[i][k].facility] += fl;
      value += fl * p.arcs[i][k].value;
    }
    flow.push(row);
    unallocated[i] = Math.max(0, Math.round(p.supplies[i]) - assigned);
  }
  const lowerBoundsMet = new Array(nF).fill(true);
  for (let j = 0; j < nF; j++) {
    if (forcedEdges[j] >= 0) {
      const e = mcf.edges[forcedEdges[j]];
      lowerBoundsMet[j] = e.flow >= e.cap;
    }
  }
  return {
    flow,
    facilityLoad,
    value,
    unallocated,
    iterations: mcf.iterations,
    lowerBoundsMet
  };
}

// packages/engine/src/optimizer.ts
function selectVehicle(source, distanceKm, vehicles, net) {
  const density = STREAMS[source.stream].bulkDensityTPerM3;
  let best = null;
  for (const v of vehicles) {
    if (!v.allowedRoads.includes(source.access)) continue;
    if (v.fleetSize <= 0) continue;
    const payloadT = Math.min(v.massCapacityT, v.volumeM3 * density);
    if (payloadT <= 0.1) continue;
    const costPerT = transportCostPerTonne(distanceKm, payloadT, v, net.assumptions);
    if (!Number.isFinite(costPerT)) continue;
    if (!best || costPerT < best.costPerT) best = { vehicle: v, payloadT, costPerT };
  }
  return best;
}
function buildArcs(net) {
  const arcs = [];
  const physical = [];
  const bySource = [];
  const rejected = {
    "Facility offline": 0,
    "Stream not accepted at site": 0,
    "Pathway gate failed": 0,
    "Beyond maximum haul distance": 0,
    "Route blocked": 0,
    "No legal vehicle": 0
  };
  let generated = 0;
  const permCache = /* @__PURE__ */ new Map();
  const permFor = (s) => {
    let p = permCache.get(s);
    if (!p) {
      p = permanenceFor(s, net.assumptions.soilTempC);
      permCache.set(s, p);
    }
    return p;
  };
  const blocked = new Set(net.blockedArcs.map((b) => `${b.sourceId}>${b.facilityId}`));
  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const stream = STREAMS[src.stream];
    const row = [];
    for (let j = 0; j < net.facilities.length; j++) {
      const fac = net.facilities[j];
      generated++;
      if (fac.status === "offline" || fac.availability <= 0) {
        rejected["Facility offline"]++;
        continue;
      }
      if (blocked.has(`${src.id}>${fac.id}`)) {
        rejected["Route blocked"]++;
        continue;
      }
      if (fac.acceptedStreams.length > 0 && !fac.acceptedStreams.includes(src.stream)) {
        rejected["Stream not accepted at site"]++;
        continue;
      }
      const pathway = PATHWAYS[fac.pathway];
      const suit = suitability(stream, pathway);
      if (!suit.feasible) {
        rejected["Pathway gate failed"]++;
        continue;
      }
      const distanceKm = roadDistanceKm(
        src,
        fac,
        net.assumptions.circuityFactor,
        src.access
      );
      if (distanceKm > net.assumptions.maxHaulKm) {
        rejected["Beyond maximum haul distance"]++;
        continue;
      }
      const pick2 = selectVehicle(src, distanceKm, net.vehicles, net);
      if (!pick2) {
        rejected["No legal vehicle"]++;
        continue;
      }
      const phys = physicalPerTonne(
        src.stream,
        fac.pathway,
        fac.efficiency * suit.score ** 0.35,
        distanceKm,
        pick2.payloadT,
        pick2.vehicle
      );
      const perm = permFor(src.stream);
      const fac0 = baseFactors(perm.bc100, net.assumptions);
      const carbon = evaluateCarbon(phys, 1, fac0);
      const econ = economicsPerTonne(
        src.stream,
        fac.pathway,
        fac,
        distanceKm,
        pick2.payloadT,
        pick2.vehicle,
        carbon,
        net.assumptions
      );
      const arcIndex = arcs.length;
      arcs.push({
        sourceId: src.id,
        facilityId: fac.id,
        pathway: fac.pathway,
        stream: src.stream,
        distanceKm,
        crowKm: distanceKm / (net.assumptions.circuityFactor || 1),
        payloadT: pick2.payloadT,
        vehicleId: pick2.vehicle.id,
        netCarbonPerT: carbon.netT,
        durablePerT: carbon.durableT,
        avoidedPerT: carbon.avoidedT + carbon.substitutionT,
        emittedPerT: carbon.emittedT,
        marginInrPerT: econ.margin,
        tkmPerT: distanceKm,
        suitability: suit.score
      });
      physical.push(phys);
      row.push({ arcIndex, facility: j });
    }
    bySource.push(row);
  }
  return { arcs, bySource, rejected, generated, physical };
}
function objectiveScale(arcs) {
  let maxCarbon = 1e-6;
  let maxMargin = 1e-6;
  let maxTkm = 1e-6;
  for (const a of arcs) {
    maxCarbon = Math.max(maxCarbon, Math.abs(a.netCarbonPerT));
    maxMargin = Math.max(maxMargin, Math.abs(a.marginInrPerT));
    maxTkm = Math.max(maxTkm, a.tkmPerT);
  }
  return { maxCarbon, maxMargin, maxTkm };
}
var OBJ_SCALE_INT = 1e6;
function arcValue(a, mode, sc) {
  const carbonNorm = a.netCarbonPerT / sc.maxCarbon;
  const marginNorm = a.marginInrPerT / sc.maxMargin;
  const tkmNorm = a.tkmPerT / sc.maxTkm;
  switch (mode) {
    case "carbon_first":
      return Math.round(carbonNorm * OBJ_SCALE_INT + marginNorm * 100);
    case "profit_first":
      return Math.round(marginNorm * OBJ_SCALE_INT + carbonNorm * 100);
    case "balanced":
      return Math.round((0.5 * carbonNorm + 0.5 * marginNorm) * OBJ_SCALE_INT);
    case "logistics_first":
      return Math.round((carbonNorm - 0.55 * tkmNorm + 0.15 * marginNorm) * OBJ_SCALE_INT);
    default:
      return 0;
  }
}
function arcValueWeighted(a, w, sc) {
  const carbonNorm = a.netCarbonPerT / sc.maxCarbon;
  const marginNorm = a.marginInrPerT / sc.maxMargin;
  return Math.round((w * carbonNorm + (1 - w) * marginNorm) * OBJ_SCALE_INT);
}
function buildProblem(net, arcSet, values, closed, forcedOpen, capacityOverride) {
  const windowDays = net.assumptions.windowDays;
  const supplies = net.sources.map((s) => s.availableT);
  const capacities = net.facilities.map((f3, j) => {
    if (closed.has(j)) return 0;
    if (f3.status === "offline") return 0;
    const override = capacityOverride?.get(j);
    const base = f3.capacityTpd * f3.availability * windowDays;
    return override !== void 0 ? base + override : base;
  });
  const lowerBounds = net.facilities.map(
    (f3, j) => forcedOpen.has(j) ? f3.minFeedTpd * windowDays : 0
  );
  const arcs = arcSet.bySource.map(
    (row) => row.filter((r) => !closed.has(r.facility)).map((r) => ({ facility: r.facility, value: values[r.arcIndex] }))
  );
  return { supplies, capacities, lowerBounds, arcs };
}
function solveNode(net, arcSet, values, node, capacityOverride) {
  const problem = buildProblem(
    net,
    arcSet,
    values,
    node.closed,
    node.forcedOpen,
    capacityOverride
  );
  const sol = solveTransport(problem);
  const feasible = sol.lowerBoundsMet.every((ok, j) => ok || !node.forcedOpen.has(j));
  const flow = arcSet.bySource.map(() => []);
  for (let i = 0; i < arcSet.bySource.length; i++) {
    const kept = arcSet.bySource[i].filter((r) => !node.closed.has(r.facility));
    const row = new Array(arcSet.bySource[i].length).fill(0);
    let k = 0;
    for (let idx = 0; idx < arcSet.bySource[i].length; idx++) {
      if (node.closed.has(arcSet.bySource[i][idx].facility)) continue;
      row[idx] = sol.flow[i][k++];
    }
    flow[i] = row;
  }
  return {
    value: sol.value,
    flow,
    facilityLoad: sol.facilityLoad,
    iterations: sol.iterations,
    feasible
  };
}
function optimize(net, mode, options = {}) {
  const t0 = Date.now();
  const stages = [];
  const stage = (label, detail, start) => {
    stages.push({ label, detail, ms: Date.now() - start });
  };
  let tStage = Date.now();
  const arcSet = buildArcs(net);
  stage(
    "Build candidate network",
    `${arcSet.generated} source-facility pairs examined, ${arcSet.arcs.length} feasible arcs retained`,
    tStage
  );
  tStage = Date.now();
  const sc = objectiveScale(arcSet.arcs);
  const values = options.paretoWeight !== void 0 ? arcSet.arcs.map((a) => arcValueWeighted(a, options.paretoWeight, sc)) : arcSet.arcs.map((a) => arcValue(a, mode, sc));
  stage(
    "Price arcs under objective",
    `Objective "${mode}" scalarised against max carbon ${sc.maxCarbon.toFixed(2)} tCO\u2082e/t and max margin \u20B9${Math.round(sc.maxMargin)}/t`,
    tStage
  );
  const windowDays = net.assumptions.windowDays;
  const minFeedWindow = net.facilities.map((f3) => f3.minFeedTpd * windowDays);
  const maxNodes = options.maxNodes ?? 220;
  tStage = Date.now();
  const root = { closed: /* @__PURE__ */ new Set(), forcedOpen: /* @__PURE__ */ new Set(), bound: Infinity, depth: 0 };
  const rootOutcome = solveNode(net, arcSet, values, root, null);
  const lpBound = rootOutcome.value;
  let best = null;
  const readBest = () => best;
  let nodesExplored = 1;
  let nodesPruned = 0;
  let mcfIterations = rootOutcome.iterations;
  let candidateConfigurations = 1;
  const queue = [];
  const violationsOf = (outcome, node) => {
    const out = [];
    for (let j = 0; j < net.facilities.length; j++) {
      if (node.closed.has(j)) continue;
      const load = outcome.facilityLoad[j];
      if (load > 0.5 && load < minFeedWindow[j] - 0.5) out.push(j);
    }
    return out;
  };
  const consider = (node, outcome) => {
    if (!outcome.feasible) {
      nodesPruned++;
      return;
    }
    const v = violationsOf(outcome, node);
    if (v.length === 0) {
      if (!best || outcome.value > best.outcome.value) best = { node, outcome };
      return;
    }
    if (best && outcome.value <= best.outcome.value) {
      nodesPruned++;
      return;
    }
    queue.push({ node: { ...node, bound: outcome.value }, outcome });
  };
  consider(root, rootOutcome);
  while (queue.length > 0 && nodesExplored < maxNodes) {
    queue.sort((a, b) => b.outcome.value - a.outcome.value);
    const current = queue.shift();
    if (!current) break;
    const incumbentNode = readBest();
    if (incumbentNode && current.outcome.value <= incumbentNode.outcome.value) {
      nodesPruned++;
      continue;
    }
    const viol = violationsOf(current.outcome, current.node);
    if (viol.length === 0) continue;
    let worst = viol[0];
    let worstGap = minFeedWindow[worst] - current.outcome.facilityLoad[worst];
    for (const j of viol) {
      const gap = minFeedWindow[j] - current.outcome.facilityLoad[j];
      if (gap > worstGap) {
        worst = j;
        worstGap = gap;
      }
    }
    const closedChild = {
      closed: new Set(current.node.closed).add(worst),
      forcedOpen: new Set(current.node.forcedOpen),
      bound: current.outcome.value,
      depth: current.node.depth + 1
    };
    closedChild.forcedOpen.delete(worst);
    const outA = solveNode(net, arcSet, values, closedChild, null);
    nodesExplored++;
    candidateConfigurations++;
    mcfIterations += outA.iterations;
    consider(closedChild, outA);
    const openChild = {
      closed: new Set(current.node.closed),
      forcedOpen: new Set(current.node.forcedOpen).add(worst),
      bound: current.outcome.value,
      depth: current.node.depth + 1
    };
    const outB = solveNode(net, arcSet, values, openChild, null);
    nodesExplored++;
    candidateConfigurations++;
    mcfIterations += outB.iterations;
    consider(openChild, outB);
  }
  if (!best) {
    const repaired = {
      closed: new Set(violationsOf(rootOutcome, root)),
      forcedOpen: /* @__PURE__ */ new Set(),
      bound: lpBound,
      depth: 0
    };
    const out = solveNode(net, arcSet, values, repaired, null);
    nodesExplored++;
    best = { node: repaired, outcome: out };
  }
  const chosen = best;
  const gapPct = lpBound > 0 ? Math.max(0, (lpBound - chosen.outcome.value) / lpBound * 100) : 0;
  const provenOptimal = queue.length === 0 && nodesExplored < maxNodes;
  stage(
    "Branch and bound over facility operation",
    `${nodesExplored} nodes explored, ${nodesPruned} pruned, gap ${gapPct.toFixed(2)}%`,
    tStage
  );
  tStage = Date.now();
  const allocations = materialiseAllocations(net, arcSet, chosen.outcome.flow);
  const totals = computeTotals(net, allocations);
  stage(
    "Cost the selected configuration",
    `${allocations.length} active flows, ${totals.divertedT.toFixed(0)} t diverted`,
    tStage
  );
  const openFacilities = [];
  const idleFacilities = [];
  for (let j = 0; j < net.facilities.length; j++) {
    const load = chosen.outcome.facilityLoad[j] ?? 0;
    if (load > 0.5) openFacilities.push(net.facilities[j].id);
    else idleFacilities.push(net.facilities[j].id);
  }
  let shadowPrices = [];
  if (!options.skipShadowPrices) {
    tStage = Date.now();
    shadowPrices = computeShadowPrices(
      net,
      arcSet,
      values,
      chosen.node,
      chosen.outcome,
      mode,
      totals
    );
    stage(
      "Measure marginal value of capacity",
      `${shadowPrices.filter((s) => s.binding).length} binding constraints re-optimised`,
      tStage
    );
  }
  let rejectedAlternatives = [];
  if (!options.skipAlternatives) {
    tStage = Date.now();
    rejectedAlternatives = compareAlternatives(net, arcSet, values, chosen.outcome.value);
    stage(
      "Score rejected alternatives",
      `${rejectedAlternatives.length} alternative configurations evaluated against the chosen one`,
      tStage
    );
  }
  const telemetry = {
    arcsGenerated: arcSet.generated,
    arcsFeasible: arcSet.arcs.length,
    arcsRejected: arcSet.rejected,
    candidateConfigurations,
    bnbNodesExplored: nodesExplored,
    bnbNodesPruned: nodesPruned,
    mcfIterations,
    lpBound,
    incumbent: chosen.outcome.value,
    gapPct,
    provenOptimal,
    solveMs: Date.now() - t0,
    stages
  };
  return {
    objective: mode,
    allocations,
    openFacilities,
    idleFacilities,
    totals,
    telemetry,
    shadowPrices,
    rejectedAlternatives,
    windowDays,
    seed: net.assumptions.seed
  };
}
function materialiseAllocations(net, arcSet, flow) {
  const out = [];
  for (let i = 0; i < arcSet.bySource.length; i++) {
    for (let k = 0; k < arcSet.bySource[i].length; k++) {
      const tonnes = flow[i][k];
      if (!tonnes || tonnes <= 0.5) continue;
      const arcIndex = arcSet.bySource[i][k].arcIndex;
      const a = arcSet.arcs[arcIndex];
      const facility = net.facilities.find((f3) => f3.id === a.facilityId);
      const vehicle = net.vehicles.find((v) => v.id === a.vehicleId);
      if (!facility || !vehicle) continue;
      const trips = Math.ceil(tonnes / a.payloadT);
      const econ = economicsPerTonne(
        a.stream,
        a.pathway,
        facility,
        a.distanceKm,
        a.payloadT,
        vehicle,
        {
          durableT: a.durablePerT,
          avoidedT: a.avoidedPerT,
          substitutionT: 0,
          emittedT: a.emittedPerT,
          netT: a.netCarbonPerT
        },
        net.assumptions
      );
      out.push({
        sourceId: a.sourceId,
        facilityId: a.facilityId,
        pathway: a.pathway,
        stream: a.stream,
        tonnes,
        distanceKm: a.distanceKm,
        vehicleId: a.vehicleId,
        trips,
        payloadT: a.payloadT,
        netCarbonT: a.netCarbonPerT * tonnes,
        durableT: a.durablePerT * tonnes,
        avoidedT: a.avoidedPerT * tonnes,
        emittedT: a.emittedPerT * tonnes,
        marginInr: a.marginInrPerT * tonnes,
        revenueInr: (econ.productRevenue + econ.carbonRevenue) * tonnes,
        costInr: (econ.feedstockCost + econ.aggregationCost + econ.transportCost + econ.processingCost + econ.capexCost) * tonnes,
        tkm: a.distanceKm * tonnes
      });
    }
  }
  return out;
}
function computeTotals(net, allocations) {
  const suppliedT = net.sources.reduce((s, x) => s + x.availableT, 0);
  let divertedT = 0;
  let durable = 0;
  let avoided = 0;
  let emitted = 0;
  let net_ = 0;
  let revenue = 0;
  let cost = 0;
  let margin = 0;
  let tkm = 0;
  let trips = 0;
  let vehicleHours = 0;
  let transportEmissions = 0;
  const vehById = new Map(net.vehicles.map((v) => [v.id, v]));
  for (const a of allocations) {
    divertedT += a.tonnes;
    durable += a.durableT;
    avoided += a.avoidedT;
    emitted += a.emittedT;
    net_ += a.netCarbonT;
    revenue += a.revenueInr;
    cost += a.costInr;
    margin += a.marginInr;
    tkm += a.tkm;
    trips += a.trips;
    const v = vehById.get(a.vehicleId);
    if (v) {
      const speed = v.avgSpeedKmh;
      vehicleHours += a.trips * (2 * a.distanceKm / speed + 1.6);
      transportEmissions += v.dieselLPerKm * a.distanceKm * 1.78 * a.trips * 3.29 / 1e3;
    }
  }
  const fleetCapacityHours = net.vehicles.reduce(
    (s, v) => s + v.fleetSize * v.shiftHours * net.assumptions.windowDays,
    0
  );
  const vehicleDaysUsed = vehicleHours / 10;
  const fleetCapacityDays = fleetCapacityHours / 10;
  const processEmissions = Math.max(0, emitted - transportEmissions);
  const carbonRevenue = durable * net.assumptions.cdrPriceInrPerT + Math.max(0, avoided) * net.assumptions.vcmPriceInrPerT;
  return {
    suppliedT,
    divertedT,
    strandedT: Math.max(0, suppliedT - divertedT),
    divertedPct: suppliedT > 0 ? divertedT / suppliedT * 100 : 0,
    durableRemovalT: durable,
    avoidedEmissionsT: avoided,
    transportEmissionsT: transportEmissions,
    processEmissionsT: processEmissions,
    netCarbonT: net_,
    revenueInr: revenue,
    feedstockCostInr: 0,
    transportCostInr: 0,
    processingCostInr: cost,
    carbonRevenueInr: carbonRevenue,
    marginInr: margin,
    tkm,
    vehicleTrips: trips,
    vehicleDaysUsed,
    fleetUtilisationPct: fleetCapacityDays > 0 ? vehicleDaysUsed / fleetCapacityDays * 100 : 0,
    marginPerTonneInr: divertedT > 0 ? margin / divertedT : 0,
    abatementCostInrPerTco2e: Math.abs(net_) > 1e-6 ? -margin / net_ : 0
  };
}
function computeShadowPrices(net, arcSet, values, node, baseOutcome, mode, baseTotals) {
  const windowDays = net.assumptions.windowDays;
  const out = [];
  const deltaTpd = 1;
  const deltaT = deltaTpd * windowDays;
  for (let j = 0; j < net.facilities.length; j++) {
    const f3 = net.facilities[j];
    const capacityWindow = f3.capacityTpd * f3.availability * windowDays;
    const load = baseOutcome.facilityLoad[j] ?? 0;
    const utilisation = capacityWindow > 0 ? load / capacityWindow * 100 : 0;
    const binding = capacityWindow > 0 && load >= capacityWindow - 1;
    let valuePerExtraTonne = 0;
    let carbonPerExtraTonne = 0;
    let marginPerExtraTonne = 0;
    if (binding) {
      const override = /* @__PURE__ */ new Map([[j, deltaT]]);
      const bumped = solveNode(net, arcSet, values, node, override);
      valuePerExtraTonne = (bumped.value - baseOutcome.value) / deltaT;
      const bumpedTotals = computeTotals(net, materialiseAllocations(net, arcSet, bumped.flow));
      carbonPerExtraTonne = (bumpedTotals.netCarbonT - baseTotals.netCarbonT) / deltaT;
      marginPerExtraTonne = (bumpedTotals.marginInr - baseTotals.marginInr) / deltaT;
    }
    out.push({
      facilityId: f3.id,
      facilityName: f3.name,
      // Convert the scaled objective back into the unit the mode is denominated in.
      valuePerExtraTonne: unscaleObjective(valuePerExtraTonne, mode, arcSet),
      unit: objectiveUnit(mode),
      carbonPerExtraTonne,
      marginPerExtraTonne,
      binding,
      utilisationPct: utilisation
    });
  }
  return out.sort((a, b) => b.valuePerExtraTonne - a.valuePerExtraTonne);
}
function unscaleObjective(v, mode, arcSet) {
  const sc = objectiveScale(arcSet.arcs);
  switch (mode) {
    case "carbon_first":
      return v / OBJ_SCALE_INT * sc.maxCarbon;
    case "profit_first":
      return v / OBJ_SCALE_INT * sc.maxMargin;
    default:
      return v / OBJ_SCALE_INT;
  }
}
function objectiveUnit(mode) {
  switch (mode) {
    case "carbon_first":
      return "tCO\u2082e per extra tonne of capacity";
    case "profit_first":
      return "\u20B9 per extra tonne of capacity";
    default:
      return "objective points per extra tonne";
  }
}
function compareAlternatives(net, arcSet, values, bestValue) {
  const out = [];
  const windowDays = net.assumptions.windowDays;
  const scoreFlow = (flow) => {
    let v = 0;
    for (let i = 0; i < arcSet.bySource.length; i++) {
      for (let k = 0; k < arcSet.bySource[i].length; k++) {
        v += (flow[i][k] ?? 0) * values[arcSet.bySource[i][k].arcIndex];
      }
    }
    return v;
  };
  const nearest = nearestFeasibleAllocation(net, arcSet);
  const nearestValue = scoreFlow(nearest);
  out.push({
    label: "Nearest-facility heuristic (status quo operating practice)",
    objectiveValue: nearestValue,
    deltaVsBest: bestValue !== 0 ? (nearestValue - bestValue) / Math.abs(bestValue) * 100 : 0,
    reason: "What an operator does today: each lot goes to the closest site that will take it. Minimises haul but ignores pathway value and capacity contention."
  });
  const pathwaySet = new Set(net.facilities.map((f3) => f3.pathway));
  for (const pw of pathwaySet) {
    const closed = /* @__PURE__ */ new Set();
    net.facilities.forEach((f3, j) => {
      if (f3.pathway !== pw) closed.add(j);
    });
    if (closed.size === net.facilities.length) continue;
    const outcome = solveNode(
      net,
      arcSet,
      values,
      { closed, forcedOpen: /* @__PURE__ */ new Set(), bound: Infinity, depth: 0 },
      null
    );
    out.push({
      label: `${PATHWAYS[pw].short}-only network`,
      objectiveValue: outcome.value,
      deltaVsBest: bestValue !== 0 ? (outcome.value - bestValue) / Math.abs(bestValue) * 100 : 0,
      reason: `Restricting the whole network to ${PATHWAYS[pw].label.toLowerCase()} strands feedstock that this pathway cannot accept.`
    });
  }
  return out.sort((a, b) => b.objectiveValue - a.objectiveValue);
}
function nearestFeasibleAllocation(net, arcSet) {
  const windowDays = net.assumptions.windowDays;
  const remaining = net.facilities.map(
    (f3) => f3.status === "offline" ? 0 : f3.capacityTpd * f3.availability * windowDays
  );
  const flow = arcSet.bySource.map((row) => new Array(row.length).fill(0));
  const order = net.sources.map((s, i) => ({ i, t: s.availableT })).sort((a, b) => b.t - a.t);
  for (const { i } of order) {
    let left = net.sources[i].availableT;
    const candidates = arcSet.bySource[i].map((r, k) => ({ k, facility: r.facility, d: arcSet.arcs[r.arcIndex].distanceKm })).sort((a, b) => a.d - b.d);
    for (const c of candidates) {
      if (left <= 0.5) break;
      const take = Math.min(left, remaining[c.facility]);
      if (take <= 0.5) continue;
      flow[i][c.k] = take;
      remaining[c.facility] -= take;
      left -= take;
    }
  }
  return flow;
}
function baselineResult(net, mode) {
  const arcSet = buildArcs(net);
  const sc = objectiveScale(arcSet.arcs);
  const values = arcSet.arcs.map((a) => arcValue(a, mode, sc));
  const flow = nearestFeasibleAllocation(net, arcSet);
  const allocations = materialiseAllocations(net, arcSet, flow);
  const totals = computeTotals(net, allocations);
  const open = new Set(allocations.map((a) => a.facilityId));
  let value = 0;
  for (let i = 0; i < arcSet.bySource.length; i++) {
    for (let k = 0; k < arcSet.bySource[i].length; k++) {
      value += (flow[i][k] ?? 0) * values[arcSet.bySource[i][k].arcIndex];
    }
  }
  return {
    objective: mode,
    allocations,
    openFacilities: [...open],
    idleFacilities: net.facilities.filter((f3) => !open.has(f3.id)).map((f3) => f3.id),
    totals,
    telemetry: {
      arcsGenerated: arcSet.generated,
      arcsFeasible: arcSet.arcs.length,
      arcsRejected: arcSet.rejected,
      candidateConfigurations: 1,
      bnbNodesExplored: 0,
      bnbNodesPruned: 0,
      mcfIterations: 0,
      lpBound: value,
      incumbent: value,
      gapPct: 0,
      provenOptimal: false,
      solveMs: 0,
      stages: []
    },
    shadowPrices: [],
    rejectedAlternatives: [],
    windowDays: net.assumptions.windowDays,
    seed: net.assumptions.seed
  };
}

// packages/engine/src/routing.ts
function dist(net, a, b, access) {
  return roadDistanceKm(a, b, net.assumptions.circuityFactor, access);
}
function routeDistance(net, facility, stops) {
  if (stops.length === 0) return 0;
  let d = dist(net, facility, stops[0], stops[0].access);
  for (let i = 0; i < stops.length - 1; i++) {
    d += dist(net, stops[i], stops[i + 1], stops[i + 1].access);
  }
  d += dist(net, stops[stops.length - 1], facility, stops[stops.length - 1].access);
  return d;
}
function orOptImprove(net, facility, stops) {
  let current = stops.slice();
  let best = routeDistance(net, facility, current);
  let improved = true;
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes++;
    for (let i = 0; i < current.length; i++) {
      for (let j = 0; j < current.length; j++) {
        if (i === j) continue;
        const trial = current.slice();
        const [moved] = trial.splice(i, 1);
        trial.splice(j, 0, moved);
        const d = routeDistance(net, facility, trial);
        if (d < best - 1e-9) {
          best = d;
          current = trial;
          improved = true;
        }
      }
    }
  }
  return { stops: current, passes };
}
function clarkeWright(net, facility, loads, vehicle) {
  if (loads.length === 0) return [];
  let routes = loads.map((l) => [l]);
  const loadOf = (r) => r.reduce((s, x) => s + x.tonnes, 0);
  const volumeOf = (r) => r.reduce((s, x) => s + x.tonnes / STREAMS[x.source.stream].bulkDensityTPerM3, 0);
  const savings = [];
  for (let i = 0; i < loads.length; i++) {
    for (let j = i + 1; j < loads.length; j++) {
      const si = loads[i].source;
      const sj = loads[j].source;
      const value = dist(net, facility, si, si.access) + dist(net, facility, sj, sj.access) - dist(net, si, sj, sj.access);
      if (value > 0) savings.push({ a: i, b: j, value });
    }
  }
  savings.sort((x, y) => y.value - x.value || x.a - y.a || x.b - y.b);
  const routeOfLoad = /* @__PURE__ */ new Map();
  loads.forEach((_, i) => routeOfLoad.set(i, i));
  for (const s of savings) {
    const ra = routeOfLoad.get(s.a);
    const rb = routeOfLoad.get(s.b);
    if (ra === void 0 || rb === void 0 || ra === rb) continue;
    const merged = routes[ra].concat(routes[rb]);
    if (merged.length > 6) continue;
    if (loadOf(merged) > vehicle.massCapacityT + 1e-9) continue;
    if (volumeOf(merged) > vehicle.volumeM3 + 1e-9) continue;
    routes[ra] = merged;
    routes[rb] = [];
    for (const [k, v] of routeOfLoad) if (v === rb) routeOfLoad.set(k, ra);
  }
  routes = routes.filter((r) => r.length > 0);
  return routes.map((r) => {
    const improved = orOptImprove(
      net,
      facility,
      r.map((x) => x.source)
    );
    const ordered = improved.stops.map(
      (src) => r.find((x) => x.source.id === src.id)
    );
    return {
      stops: ordered,
      distanceKm: routeDistance(net, facility, improved.stops),
      passes: improved.passes
    };
  });
}
function planRoutes(net, allocations) {
  const srcById = new Map(net.sources.map((s) => [s.id, s]));
  const facById = new Map(net.facilities.map((f3) => [f3.id, f3]));
  const vehById = new Map(net.vehicles.map((v) => [v.id, v]));
  const routes = [];
  let totalDistanceKm = 0;
  let directHaulDistanceKm = 0;
  let totalTrips = 0;
  let vehicleHours = 0;
  let improvementPasses = 0;
  let massEquivalentTrips = 0;
  let volumeLimitedTonnes = 0;
  let movedTonnes = 0;
  const partials = /* @__PURE__ */ new Map();
  for (const a of allocations) {
    const src = srcById.get(a.sourceId);
    const fac = facById.get(a.facilityId);
    const veh = vehById.get(a.vehicleId);
    if (!src || !fac || !veh) continue;
    const fullTrips = Math.floor(a.tonnes / a.payloadT);
    const remainder = a.tonnes - fullTrips * a.payloadT;
    massEquivalentTrips += Math.ceil(a.tonnes / veh.massCapacityT);
    movedTonnes += a.tonnes;
    if (a.payloadT < veh.massCapacityT - 1e-6) volumeLimitedTonnes += a.tonnes;
    directHaulDistanceKm += Math.ceil(a.tonnes / a.payloadT) * a.distanceKm * 2;
    if (fullTrips > 0) {
      const distanceKm = a.distanceKm * 2 * fullTrips;
      totalDistanceKm += distanceKm;
      totalTrips += fullTrips;
      vehicleHours += fullTrips * (2 * a.distanceKm / veh.avgSpeedKmh + 1.6);
      const fuelL = veh.dieselLPerKm * a.distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO) * fullTrips;
      routes.push({
        id: `R-${a.sourceId}-${a.facilityId}-direct`,
        facilityId: fac.id,
        facilityName: fac.name,
        vehicleId: veh.id,
        vehicleLabel: veh.label,
        stops: [
          {
            sourceId: src.id,
            name: src.name,
            lat: src.lat,
            lon: src.lon,
            tonnesPicked: fullTrips * a.payloadT,
            cumulativeLoadT: a.payloadT
          }
        ],
        polyline: [
          { lat: fac.lat, lon: fac.lon },
          { lat: src.lat, lon: src.lon },
          { lat: fac.lat, lon: fac.lon }
        ],
        distanceKm,
        durationH: fullTrips * (2 * a.distanceKm / veh.avgSpeedKmh + 1.6),
        loadT: fullTrips * a.payloadT,
        payloadT: a.payloadT,
        utilisationPct: 100,
        limitedBy: a.payloadT < veh.massCapacityT - 1e-6 ? "volume" : "mass",
        costInr: 0,
        emissionsT: fuelL * DIESEL_WTW_KG_PER_L / 1e3
      });
    }
    if (remainder > 0.5) {
      const key = `${a.facilityId}|${a.vehicleId}`;
      const list = partials.get(key) ?? [];
      list.push({ source: src, tonnes: remainder, vehicleId: a.vehicleId, payloadT: a.payloadT });
      partials.set(key, list);
    }
  }
  for (const [key, loads] of partials) {
    const [facilityId, vehicleId] = key.split("|");
    const fac = facById.get(facilityId);
    const veh = vehById.get(vehicleId);
    if (!fac || !veh) continue;
    const built = clarkeWright(net, fac, loads, veh);
    for (let i = 0; i < built.length; i++) {
      const r = built[i];
      improvementPasses += r.passes;
      const loadT = r.stops.reduce((s, x) => s + x.tonnes, 0);
      const volumeM3 = r.stops.reduce(
        (s, x) => s + x.tonnes / STREAMS[x.source.stream].bulkDensityTPerM3,
        0
      );
      const limitedBy = volumeM3 / veh.volumeM3 > loadT / veh.massCapacityT ? "volume" : "mass";
      const utilisationPct = limitedBy === "volume" ? volumeM3 / veh.volumeM3 * 100 : loadT / veh.massCapacityT * 100;
      totalDistanceKm += r.distanceKm;
      totalTrips += 1;
      const durationH = r.distanceKm / veh.avgSpeedKmh + 0.8 * r.stops.length + 0.8;
      vehicleHours += durationH;
      const fuelL = veh.dieselLPerKm * r.distanceKm;
      let cumulative = 0;
      const stops = r.stops.map((x) => {
        cumulative += x.tonnes;
        return {
          sourceId: x.source.id,
          name: x.source.name,
          lat: x.source.lat,
          lon: x.source.lon,
          tonnesPicked: x.tonnes,
          cumulativeLoadT: cumulative
        };
      });
      const polyline = [
        { lat: fac.lat, lon: fac.lon },
        ...r.stops.map((x) => ({ lat: x.source.lat, lon: x.source.lon })),
        { lat: fac.lat, lon: fac.lon }
      ];
      routes.push({
        id: `R-${facilityId}-${vehicleId}-mr${i}`,
        facilityId: fac.id,
        facilityName: fac.name,
        vehicleId: veh.id,
        vehicleLabel: veh.label,
        stops,
        polyline,
        distanceKm: r.distanceKm,
        durationH,
        loadT,
        payloadT: Math.min(veh.massCapacityT, veh.volumeM3 * 0.15),
        utilisationPct,
        limitedBy,
        costInr: veh.dieselLPerKm * r.distanceKm * net.assumptions.dieselPriceInrPerL + veh.costInrPerKm * r.distanceKm * 0.45 + veh.fixedCostInrPerTrip,
        emissionsT: fuelL * DIESEL_WTW_KG_PER_L / 1e3
      });
    }
  }
  const fleetCapacityHours = net.vehicles.reduce(
    (s, v) => s + v.fleetSize * v.shiftHours * net.assumptions.windowDays,
    0
  );
  routes.sort((a, b) => b.distanceKm - a.distanceKm);
  return {
    routes,
    totalDistanceKm,
    directHaulDistanceKm,
    consolidationSavingPct: directHaulDistanceKm > 0 ? (directHaulDistanceKm - totalDistanceKm) / directHaulDistanceKm * 100 : 0,
    totalTrips,
    vehicleDaysUsed: vehicleHours / 10,
    fleetCapacityDays: fleetCapacityHours / 10,
    infeasibleTonnes: Math.max(0, vehicleHours - fleetCapacityHours) / 10,
    improvementPasses,
    massEquivalentTrips,
    extraTripsFromVolume: Math.max(0, totalTrips - massEquivalentTrips),
    volumeLimitedSharePct: movedTonnes > 0 ? volumeLimitedTonnes / movedTonnes * 100 : 0
  };
}

// packages/engine/src/bottleneck.ts
function inr(n) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `\u20B9${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `\u20B9${(n / 1e5).toFixed(1)} L`;
  return `\u20B9${Math.round(n).toLocaleString("en-IN")}`;
}
function strandedLots(net, result, arcSet) {
  const arcs = arcSet ?? buildArcs(net);
  const allocatedBySource = /* @__PURE__ */ new Map();
  for (const a of result.allocations) {
    allocatedBySource.set(a.sourceId, (allocatedBySource.get(a.sourceId) ?? 0) + a.tonnes);
  }
  const windowDays = net.assumptions.windowDays;
  const loadByFacility = /* @__PURE__ */ new Map();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }
  const out = [];
  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const allocated = allocatedBySource.get(src.id) ?? 0;
    const stranded = src.availableT - allocated;
    if (stranded <= 1) continue;
    const stream = STREAMS[src.stream];
    const row = arcs.bySource[i];
    let reason = "facility_capacity";
    let reasonText = "";
    let nearestKm = null;
    if (row.length === 0) {
      const gateFailures = net.facilities.filter(
        (f3) => !suitability(stream, PATHWAYS[f3.pathway]).feasible
      ).length;
      const nearestAny = Math.min(
        ...net.facilities.map(
          (f3) => roadDistanceKm(src, f3, net.assumptions.circuityFactor, src.access)
        )
      );
      nearestKm = Number.isFinite(nearestAny) ? nearestAny : null;
      if (gateFailures === net.facilities.length) {
        reason = "pathway_mismatch";
        const limiting = suitability(stream, PATHWAYS[net.facilities[0].pathway]).limitingFactor;
        reasonText = `No pathway in the network accepts ${stream.label.toLowerCase()}. Limiting property: ${limiting} (C:N ${stream.cnRatio}:1, moisture ${stream.moisturePct}%).`;
      } else if (nearestKm !== null && nearestKm > net.assumptions.maxHaulKm) {
        reason = "haul_uneconomic";
        reasonText = `Nearest compatible facility is ${nearestKm.toFixed(0)} km away, beyond the ${net.assumptions.maxHaulKm} km economic haul limit.`;
      } else {
        reason = "pathway_mismatch";
        reasonText = "No facility in range both accepts this stream and passes its pathway gates.";
      }
    } else {
      const distances = row.map((r) => arcs.arcs[r.arcIndex].distanceKm);
      nearestKm = Math.min(...distances);
      let headroom = 0;
      let bestValueArc = -Infinity;
      for (const r of row) {
        const fac = net.facilities[r.facility];
        const cap = fac.capacityTpd * fac.availability * windowDays;
        headroom += Math.max(0, cap - (loadByFacility.get(fac.id) ?? 0));
        bestValueArc = Math.max(bestValueArc, arcs.arcs[r.arcIndex].marginInrPerT);
      }
      if (headroom < 1) {
        reason = "facility_capacity";
        reasonText = `Every compatible facility within ${net.assumptions.maxHaulKm} km is at capacity. Nearest is ${nearestKm.toFixed(0)} km.`;
      } else if (bestValueArc < 0) {
        reason = "haul_uneconomic";
        reasonText = `Capacity exists but the best available route loses ${inr(-bestValueArc)}/t. The optimiser left it in the field rather than destroy value.`;
      } else {
        reason = "facility_capacity";
        reasonText = `Outbid for capacity by higher-value feedstock. ${headroom.toFixed(0)} t of headroom exists but is committed to better arcs.`;
      }
    }
    out.push({
      sourceId: src.id,
      name: src.name,
      stream: src.stream,
      tonnes: stranded,
      reason,
      reasonText,
      nearestFacilityKm: nearestKm,
      counterfactualEmissionsT: stranded * dryFraction(stream) * COUNTERFACTUALS[stream.counterfactual].tco2ePerTDry
    });
  }
  return out.sort((a, b) => b.tonnes - a.tonnes);
}
function detectBottlenecks(net, result, arcSet) {
  const arcs = arcSet ?? buildArcs(net);
  const out = [];
  const windowDays = net.assumptions.windowDays;
  const loadByFacility = /* @__PURE__ */ new Map();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }
  const shadowByFacility = new Map(result.shadowPrices.map((s) => [s.facilityId, s]));
  const stranded = strandedLots(net, result, arcs);
  const capacityFindings = [];
  for (const f3 of net.facilities) {
    if (f3.status === "offline") continue;
    const cap = f3.capacityTpd * f3.availability * windowDays;
    const load = loadByFacility.get(f3.id) ?? 0;
    if (cap <= 0) continue;
    const util = load / cap * 100;
    if (util < 97) continue;
    let reachableStranded = 0;
    for (const lot of stranded) {
      const srcIdx = net.sources.findIndex((s) => s.id === lot.sourceId);
      if (srcIdx < 0) continue;
      const hasArc = arcs.bySource[srcIdx].some((r) => net.facilities[r.facility].id === f3.id);
      if (hasArc) reachableStranded += lot.tonnes;
    }
    if (reachableStranded < 50) continue;
    const sp = shadowByFacility.get(f3.id);
    const marginalCarbon = sp?.carbonPerExtraTonne ?? 0;
    const marginalMargin = sp?.marginPerExtraTonne ?? 0;
    capacityFindings.push({
      id: `bn-cap-${f3.id}`,
      kind: "facility_capacity",
      severity: reachableStranded > 3e3 ? "critical" : reachableStranded > 1200 ? "high" : "moderate",
      title: `${f3.name} is capacity-bound`,
      detail: `Running at ${util.toFixed(0)}% of nameplate (${f3.capacityTpd} t/day). ${reachableStranded.toFixed(0)} t of compatible feedstock sits stranded within its catchment.`,
      carbonAtRiskT: marginalCarbon > 0 ? marginalCarbon * reachableStranded : reachableStranded * estimateCarbonPerT(net, arcs, f3.id),
      valueAtRiskInr: marginalMargin > 0 ? marginalMargin * reachableStranded : reachableStranded * Math.max(0, estimateMarginPerT(net, arcs, f3.id)),
      entityIds: [f3.id],
      recommendation: marginalCarbon > 0 || marginalMargin > 0 ? `Add throughput here. Ten more tonnes per day is worth ${(marginalCarbon * 10 * windowDays).toFixed(0)} tCO\u2082e and ${inr(marginalMargin * 10 * windowDays)} per window.` : `Capacity is binding but marginal value is flat \u2014 the real constraint is feedstock quality or geography, not tonnage.`,
      quantifiedUpside: sp && sp.binding ? `Measured by re-optimisation: ${marginalCarbon.toFixed(3)} tCO\u2082e and ${inr(marginalMargin)} per additional tonne of throughput.` : `Roughly ${(reachableStranded * estimateCarbonPerT(net, arcs, f3.id)).toFixed(0)} tCO\u2082e and ${inr(reachableStranded * Math.max(0, estimateMarginPerT(net, arcs, f3.id)))} per window are unreachable at current throughput.`
    });
  }
  capacityFindings.sort((a, b) => b.carbonAtRiskT - a.carbonAtRiskT);
  out.push(...capacityFindings.slice(0, 3));
  if (capacityFindings.length > 3) {
    const rest = capacityFindings.slice(3);
    out.push({
      id: "bn-cap-rest",
      kind: "facility_capacity",
      severity: "moderate",
      title: `${rest.length} further facilities are at capacity`,
      detail: rest.map((r) => r.title.replace(" is capacity-bound", "")).join(", ") + ".",
      carbonAtRiskT: rest.reduce((s, r) => s + r.carbonAtRiskT, 0),
      valueAtRiskInr: rest.reduce((s, r) => s + r.valueAtRiskInr, 0),
      entityIds: rest.flatMap((r) => r.entityIds),
      recommendation: "These are saturated but have lower marginal value than the three above. Debottleneck them only after the top three.",
      quantifiedUpside: `Together worth ${rest.reduce((s, r) => s + r.carbonAtRiskT, 0).toFixed(0)} tCO\u2082e per window if their catchments could be served.`
    });
  }
  const byReason = /* @__PURE__ */ new Map();
  for (const lot of stranded) {
    const key = `${lot.reason}|${lot.stream}`;
    const list = byReason.get(key) ?? [];
    list.push(lot);
    byReason.set(key, list);
  }
  for (const [key, lots] of byReason) {
    const [reason, streamId] = key.split("|");
    const tonnes = lots.reduce((s, l) => s + l.tonnes, 0);
    if (tonnes < 200) continue;
    const stream = STREAMS[streamId];
    const counterfactualT = lots.reduce((s, l) => s + l.counterfactualEmissionsT, 0);
    if (reason === "pathway_mismatch") {
      out.push({
        id: `bn-path-${streamId}`,
        kind: "pathway_mismatch",
        severity: tonnes > 1e3 ? "high" : "moderate",
        title: `${stream.label} has no viable pathway`,
        detail: lots[0].reasonText,
        carbonAtRiskT: counterfactualT,
        valueAtRiskInr: 0,
        entityIds: lots.map((l) => l.sourceId),
        recommendation: recommendForMismatch(streamId),
        quantifiedUpside: `${tonnes.toFixed(0)} t per window currently goes to ${COUNTERFACTUALS[stream.counterfactual].label.toLowerCase()}, worth ${counterfactualT.toFixed(0)} tCO\u2082e of avoidable emissions.`
      });
    } else if (reason === "haul_uneconomic") {
      out.push({
        id: `bn-haul-${streamId}`,
        kind: "haul_uneconomic",
        severity: "moderate",
        title: `${stream.label} stranded by geography`,
        detail: lots[0].reasonText,
        carbonAtRiskT: counterfactualT,
        valueAtRiskInr: 0,
        entityIds: lots.map((l) => l.sourceId),
        recommendation: `A satellite densification or pre-processing unit near these sources would raise bulk density and bring the haul inside the economic radius.`,
        quantifiedUpside: `${tonnes.toFixed(0)} t per window. At ${stream.bulkDensityTPerM3} t/m\xB3 these loads are volume-limited; densifying to 0.55 t/m\xB3 would cut transport cost per tonne by roughly 60%.`
      });
    }
  }
  if (result.totals.fleetUtilisationPct > 85) {
    out.push({
      id: "bn-fleet",
      kind: "fleet_capacity",
      severity: result.totals.fleetUtilisationPct > 98 ? "critical" : "high",
      title: "Fleet is the binding constraint",
      detail: `Vehicle-days required are ${result.totals.fleetUtilisationPct.toFixed(0)}% of the available fleet over the ${windowDays}-day window. ${result.totals.vehicleTrips.toLocaleString("en-IN")} trips are scheduled.`,
      carbonAtRiskT: 0,
      valueAtRiskInr: 0,
      entityIds: [],
      recommendation: "Add trucks or shift low-density loads to higher-volume trailers before adding processing capacity \u2014 plant headroom cannot be used without vehicles to fill it.",
      quantifiedUpside: `Low-density feedstock means most trucks are volume-limited, not mass-limited. Baling to a higher density adds effective fleet capacity without buying vehicles.`
    });
  }
  for (const f3 of net.facilities) {
    if (f3.status === "offline") continue;
    const load = loadByFacility.get(f3.id) ?? 0;
    if (load > 0.5) continue;
    if (!result.idleFacilities.includes(f3.id)) continue;
    const minWindow = f3.minFeedTpd * windowDays;
    out.push({
      id: `bn-minfeed-${f3.id}`,
      kind: "min_feed_unmet",
      severity: "moderate",
      title: `${f3.name} is idle`,
      detail: `The optimiser chose not to operate this site. Its minimum viable feed is ${f3.minFeedTpd} t/day (${minWindow.toFixed(0)} t per window); running it below that would not cover fixed costs.`,
      carbonAtRiskT: 0,
      valueAtRiskInr: f3.capexAmortInrPerT * minWindow,
      entityIds: [f3.id],
      recommendation: `Either secure a committed feedstock contract of at least ${f3.minFeedTpd} t/day within its catchment, or mothball the asset for this window.`,
      quantifiedUpside: `Idle capital charge is approximately ${inr(f3.capexAmortInrPerT * minWindow)} per window.`
    });
  }
  const order = { critical: 0, high: 1, moderate: 2, low: 3 };
  return out.sort(
    (a, b) => order[a.severity] - order[b.severity] || b.carbonAtRiskT - a.carbonAtRiskT
  );
}
function recommendForMismatch(streamId) {
  const s = STREAMS[streamId];
  if (s.cnRatio < 12) {
    return `C:N of ${s.cnRatio}:1 is below the stable window for both digestion and composting. Co-digest with a high-carbon feedstock \u2014 blending 1 part this stream to 2.5 parts press mud lifts the mixture above C:N 15 and makes the existing CBG capacity usable.`;
  }
  if (s.cnRatio > 45) {
    return `C:N of ${s.cnRatio}:1 is too carbon-rich to compost efficiently. Route to a thermal pathway, or blend with a nitrogen-rich stream.`;
  }
  if (s.moisturePct > 50) {
    return `At ${s.moisturePct}% moisture this stream cannot be pyrolysed or pelletised. Anaerobic digestion is the only viable route; add digester capacity in its catchment.`;
  }
  return `Add a pathway compatible with this feedstock's properties within its catchment.`;
}
function estimateCarbonPerT(net, arcs, facilityId) {
  const matching = arcs.arcs.filter((a) => a.facilityId === facilityId);
  if (matching.length === 0) return 0;
  return matching.reduce((s, a) => s + a.netCarbonPerT, 0) / matching.length;
}
function estimateMarginPerT(net, arcs, facilityId) {
  const matching = arcs.arcs.filter((a) => a.facilityId === facilityId);
  if (matching.length === 0) return 0;
  return matching.reduce((s, a) => s + a.marginInrPerT, 0) / matching.length;
}
function resilienceReport(net, base, mode) {
  const baseCarbon = networkLedger(
    base.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS
  ).netT;
  const n1 = [];
  const operating = net.facilities.filter((f3) => base.openFacilities.includes(f3.id));
  for (const f3 of operating) {
    const trial = cloneNetwork(net);
    const target = trial.facilities.find((x) => x.id === f3.id);
    if (!target) continue;
    target.status = "offline";
    target.availability = 0;
    const r = optimize(trial, mode, {
      maxNodes: 40,
      skipShadowPrices: true,
      skipAlternatives: true
    });
    const trialCarbon = networkLedger(
      r.allocations,
      trial.facilities,
      trial.vehicles,
      trial.assumptions,
      OWN_BASIS
    ).netT;
    const lossPct = baseCarbon > 0 ? Math.max(0, (baseCarbon - trialCarbon) / baseCarbon * 100) : 0;
    const beforeByFac = /* @__PURE__ */ new Map();
    for (const a of base.allocations) {
      beforeByFac.set(a.facilityId, (beforeByFac.get(a.facilityId) ?? 0) + a.tonnes);
    }
    const absorbedBy = [];
    const afterByFac = /* @__PURE__ */ new Map();
    for (const a of r.allocations) {
      afterByFac.set(a.facilityId, (afterByFac.get(a.facilityId) ?? 0) + a.tonnes);
    }
    for (const [fid, after] of afterByFac) {
      const before = beforeByFac.get(fid) ?? 0;
      if (after - before > 50) absorbedBy.push(fid);
    }
    n1.push({
      facilityId: f3.id,
      facilityName: f3.name,
      lossPct,
      strandedT: r.totals.strandedT - base.totals.strandedT,
      absorbedBy
    });
  }
  n1.sort((a, b) => b.lossPct - a.lossPct);
  const worst = n1[0] ?? { facilityId: "", facilityName: "none", lossPct: 0 };
  const meanLoss = n1.length > 0 ? n1.reduce((s, x) => s + x.lossPct, 0) / n1.length : 0;
  const arcs = buildArcs(net);
  let redundantT = 0;
  let totalT = 0;
  const loadByFacility = /* @__PURE__ */ new Map();
  for (const a of base.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }
  for (const a of base.allocations) {
    totalT += a.tonnes;
    const srcIdx = net.sources.findIndex((s) => s.id === a.sourceId);
    if (srcIdx < 0) continue;
    const alternatives = arcs.bySource[srcIdx].filter((r) => {
      const fac = net.facilities[r.facility];
      if (fac.id === a.facilityId) return false;
      const cap = fac.capacityTpd * fac.availability * net.assumptions.windowDays;
      return cap - (loadByFacility.get(fac.id) ?? 0) > a.tonnes * 0.5;
    });
    if (alternatives.length > 0) redundantT += a.tonnes;
  }
  const redundancyPct = totalT > 0 ? redundantT / totalT * 100 : 0;
  const fleetHeadroomPct = Math.max(0, 100 - base.totals.fleetUtilisationPct);
  const components = [
    {
      label: "Single-point exposure",
      value: Math.max(0, 100 - Math.min(100, worst.lossPct * 2.5)),
      weight: 0.45,
      note: `Worst single-facility outage costs ${worst.lossPct.toFixed(1)}% of net carbon (${worst.facilityName}).`
    },
    {
      label: "Average contingency loss",
      value: Math.max(0, 100 - Math.min(100, meanLoss * 6)),
      weight: 0.2,
      note: `Mean loss across ${n1.length} single-facility outages is ${meanLoss.toFixed(1)}%.`
    },
    {
      label: "Feedstock re-routability",
      value: redundancyPct,
      weight: 0.2,
      note: `${redundancyPct.toFixed(0)}% of allocated tonnage has a second facility with enough headroom to take it.`
    },
    {
      label: "Fleet headroom",
      value: fleetHeadroomPct,
      weight: 0.15,
      note: `${fleetHeadroomPct.toFixed(0)}% of vehicle-days are unused and available to absorb re-routing.`
    }
  ];
  const score = components.reduce((s, c) => s + c.value * c.weight, 0);
  const grade = score >= 80 ? "Strong" : score >= 65 ? "Adequate" : score >= 50 ? "Fragile" : "Critical";
  return {
    score,
    grade,
    worstCaseFacilityId: worst.facilityId,
    worstCaseFacilityName: worst.facilityName,
    worstCaseLossPct: worst.lossPct,
    meanLossPct: meanLoss,
    n1Results: n1,
    components,
    method: "N-1 contingency analysis: every operating facility is taken offline in turn and the network re-optimised. The score is a weighted blend of single-point exposure, average contingency loss, feedstock re-routability and fleet headroom."
  };
}
function opportunityScores(net, result) {
  const arcs = buildArcs(net);
  const sc = objectiveScale(arcs.arcs);
  const windowDays = net.assumptions.windowDays;
  const maxVolume = Math.max(...net.sources.map((s) => s.availableT), 1);
  const loadByFacility = /* @__PURE__ */ new Map();
  for (const a of result.allocations) {
    loadByFacility.set(a.facilityId, (loadByFacility.get(a.facilityId) ?? 0) + a.tonnes);
  }
  const out = [];
  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const row = arcs.bySource[i];
    if (row.length === 0) {
      out.push({
        sourceId: src.id,
        name: src.name,
        stream: src.stream,
        score: 0,
        tonnes: src.availableT,
        components: {
          volume: src.availableT / maxVolume,
          proximity: 0,
          carbonPotential: 0,
          conversionValue: 0,
          transportBurden: 0,
          facilityAvailability: 0
        },
        bestPathway: "composting",
        bestFacilityId: null,
        headroomT: 0,
        note: "No feasible pathway in range. This lot cannot currently be served by the network."
      });
      continue;
    }
    let best = row[0];
    let bestScore = -Infinity;
    for (const r of row) {
      const a = arcs.arcs[r.arcIndex];
      const v = a.netCarbonPerT / sc.maxCarbon + a.marginInrPerT / sc.maxMargin;
      if (v > bestScore) {
        bestScore = v;
        best = r;
      }
    }
    const bestArc = arcs.arcs[best.arcIndex];
    const nearestKm = Math.min(...row.map((r) => arcs.arcs[r.arcIndex].distanceKm));
    let headroom = 0;
    for (const r of row) {
      const fac = net.facilities[r.facility];
      const cap = fac.capacityTpd * fac.availability * windowDays;
      headroom += Math.max(0, cap - (loadByFacility.get(fac.id) ?? 0));
    }
    const components = {
      volume: src.availableT / maxVolume,
      proximity: Math.max(0, 1 - nearestKm / net.assumptions.maxHaulKm),
      carbonPotential: Math.max(0, bestArc.netCarbonPerT / sc.maxCarbon),
      conversionValue: Math.max(0, bestArc.marginInrPerT / sc.maxMargin),
      transportBurden: Math.max(0, 1 - bestArc.tkmPerT / sc.maxTkm),
      facilityAvailability: Math.min(1, headroom / Math.max(1, src.availableT))
    };
    const score = 100 * (0.18 * components.volume + 0.14 * components.proximity + 0.26 * components.carbonPotential + 0.22 * components.conversionValue + 0.1 * components.transportBurden + 0.1 * components.facilityAvailability);
    const allocated = result.allocations.filter((a) => a.sourceId === src.id).reduce((s, a) => s + a.tonnes, 0);
    out.push({
      sourceId: src.id,
      name: src.name,
      stream: src.stream,
      score,
      tonnes: src.availableT,
      components,
      bestPathway: bestArc.pathway,
      bestFacilityId: bestArc.facilityId,
      headroomT: headroom,
      note: allocated >= src.availableT - 1 ? "Fully allocated in the current plan." : allocated > 0 ? `${(src.availableT - allocated).toFixed(0)} t still unplaced.` : `Unplaced. Best theoretical route is ${PATHWAYS[bestArc.pathway].short} at ${bestArc.distanceKm.toFixed(0)} km.`
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

// packages/engine/src/forecast.ts
var SEASON = {
  paddy_straw: {
    peakWeek: 43,
    widthWeeks: 2.6,
    baseline: 0.04,
    note: "Kharif paddy harvest, mid-October to mid-November. The ~20-day window before wheat sowing is the entire reason burning happens."
  },
  wheat_straw: {
    peakWeek: 16,
    widthWeeks: 3,
    baseline: 0.06,
    note: "Rabi wheat harvest, April into May."
  },
  cotton_stalk: {
    peakWeek: 3,
    widthWeeks: 4.5,
    baseline: 0.05,
    note: "Stalk uprooting after the last cotton picking, December to February."
  },
  rice_husk: {
    peakWeek: 46,
    widthWeeks: 7,
    baseline: 0.28,
    note: "Follows milling rather than harvest, so it is broader and never reaches zero."
  },
  press_mud: {
    peakWeek: 4,
    widthWeeks: 8,
    baseline: 0.05,
    note: "Sugar crushing season, November through April. Nothing at all in the monsoon."
  },
  cattle_dung: {
    peakWeek: 2,
    widthWeeks: 20,
    baseline: 0.82,
    note: "Essentially continuous; a mild winter peak as animals are stall-fed more."
  },
  poultry_litter: {
    peakWeek: 50,
    widthWeeks: 18,
    baseline: 0.8,
    note: "Continuous, with flock cycles producing a shallow winter peak."
  },
  mandi_waste: {
    peakWeek: 22,
    widthWeeks: 12,
    baseline: 0.55,
    secondPeakWeek: 44,
    secondWidth: 6,
    secondHeight: 0.5,
    note: "Summer produce glut plus a festival-season secondary peak."
  },
  msw_organic: {
    peakWeek: 43,
    widthWeeks: 5,
    baseline: 0.78,
    note: "Broadly flat with a festival-season lift in October-November."
  }
};
function gaussianWeek(week, peak, width) {
  let d = Math.abs(week - peak);
  if (d > 26) d = 52 - d;
  return Math.exp(-(d * d) / (2 * width * width));
}
function seasonalMultiplier(stream, week) {
  const p = SEASON[stream];
  let v = p.baseline + (1 - p.baseline) * gaussianWeek(week, p.peakWeek, p.widthWeeks);
  if (p.secondPeakWeek !== void 0 && p.secondWidth && p.secondHeight) {
    v += p.secondHeight * gaussianWeek(week, p.secondPeakWeek, p.secondWidth);
  }
  return v;
}
function generateHistory(source, weeks) {
  const rng = makeRng(hashString(source.id + ":history"));
  const p = SEASON[source.stream];
  const peakMultiplier = seasonalMultiplier(source.stream, p.peakWeek);
  const weeklyAtPeak = source.availableT / 4.345;
  const scale = weeklyAtPeak / Math.max(1e-6, peakMultiplier);
  const out = [];
  let weather = 0;
  for (let i = 0; i < weeks; i++) {
    const week = i % 52;
    weather = 0.72 * weather + normal(rng, 0, 0.09);
    const trend = 1 + 0.035 * (i / 52);
    const seasonal = seasonalMultiplier(source.stream, week);
    const noise = normal(rng, 0, 0.06);
    const v = scale * seasonal * trend * (1 + weather + noise);
    out.push(Math.max(0, v));
  }
  return out;
}
function choleskySolve(A, b, lambda) {
  const n = b.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  const M = A.map((row, i) => row.map((v, j) => i === j ? v + lambda : v));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = M[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(1e-10, sum));
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i][k] * y[k];
    y[i] = sum / L[i][i];
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) sum -= L[k][i] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
}
var FEATURE_NAMES = [
  "intercept",
  "trend",
  "sin(1y)",
  "cos(1y)",
  "sin(2y)",
  "cos(2y)",
  "sin(3y)",
  "cos(3y)",
  "lag-1w",
  "lag-2w"
];
var HARMONICS = 3;
var LAGS = 2;
function featureRow(absoluteWeek, totalWeeks, lag1, lag2, scale) {
  const week = absoluteWeek % 52;
  const row = [1, absoluteWeek / Math.max(1, totalWeeks)];
  for (let k = 1; k <= HARMONICS; k++) {
    row.push(Math.sin(2 * Math.PI * k * week / 52));
    row.push(Math.cos(2 * Math.PI * k * week / 52));
  }
  row.push(lag1 / scale, lag2 / scale);
  return row;
}
function fitRidge(history, lambda = 0.35) {
  const scale = Math.max(1e-6, history.reduce((s, x) => s + x, 0) / history.length);
  const X = [];
  const y = [];
  for (let i = LAGS; i < history.length; i++) {
    X.push(featureRow(i, history.length, history[i - 1], history[i - 2], scale));
    y.push(history[i] / scale);
  }
  const p = X[0]?.length ?? 0;
  if (p === 0) return { coefficients: [], residualSd: 0, r2: 0, scale };
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let r = 0; r < X.length; r++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[r][a] * y[r];
      for (let b = a; b < p; b++) XtX[a][b] += X[r][a] * X[r][b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
  const beta = choleskySolve(XtX, Xty, lambda);
  let ssRes = 0;
  let ssTot = 0;
  const yMean = y.reduce((s, v) => s + v, 0) / y.length;
  for (let r = 0; r < X.length; r++) {
    let pred = 0;
    for (let a = 0; a < p; a++) pred += X[r][a] * beta[a];
    ssRes += (y[r] - pred) ** 2;
    ssTot += (y[r] - yMean) ** 2;
  }
  const residualSd = Math.sqrt(ssRes / Math.max(1, X.length - p)) * scale;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { coefficients: beta, residualSd, r2, scale };
}
function predictAhead(fit, history, horizon, totalWeeks) {
  const out = [];
  const buf = history.slice();
  for (let h = 0; h < horizon; h++) {
    const i = buf.length;
    const row = featureRow(i, totalWeeks, buf[i - 1], buf[i - 2], fit.scale);
    let pred = 0;
    for (let a = 0; a < row.length; a++) pred += row[a] * fit.coefficients[a];
    const v = Math.max(0, pred * fit.scale);
    out.push(v);
    buf.push(v);
  }
  return out;
}
function walkForwardMape(history, folds = 12) {
  let total = 0;
  let counted = 0;
  for (let f3 = folds; f3 >= 1; f3--) {
    const cut = history.length - f3;
    if (cut < 20) continue;
    const train = history.slice(0, cut);
    const fit = fitRidge(train);
    const pred = predictAhead(fit, train, 1, history.length)[0];
    const actual = history[cut];
    if (actual > 1e-3) {
      total += Math.abs(pred - actual) / actual;
      counted++;
    }
  }
  return counted > 0 ? total / counted * 100 : 0;
}
var WEEK_MS = 7 * 24 * 3600 * 1e3;
function forecastSource(source, asOf, historyWeeks = 104, horizonWeeks = 16) {
  const history = generateHistory(source, historyWeeks);
  const fit = fitRidge(history);
  const preds = predictAhead(fit, history, horizonWeeks, historyWeeks + horizonWeeks);
  const mape = walkForwardMape(history);
  const asOfMs = Date.parse(asOf + "T00:00:00Z");
  const points = [];
  const showFrom = Math.max(0, historyWeeks - 52);
  for (let i = showFrom; i < historyWeeks; i++) {
    const row = featureRow(i, historyWeeks, history[i - 1] ?? 0, history[i - 2] ?? 0, fit.scale);
    let pred = 0;
    for (let a = 0; a < row.length; a++) pred += row[a] * fit.coefficients[a];
    const fitted = Math.max(0, pred * fit.scale);
    points.push({
      weekIndex: i - historyWeeks,
      date: new Date(asOfMs - (historyWeeks - i) * WEEK_MS).toISOString().slice(0, 10),
      actual: history[i],
      predicted: fitted,
      lower: Math.max(0, fitted - 1.96 * fit.residualSd),
      upper: fitted + 1.96 * fit.residualSd
    });
  }
  for (let h = 0; h < horizonWeeks; h++) {
    const widen = Math.sqrt(1 + h * 0.22);
    points.push({
      weekIndex: h,
      date: new Date(asOfMs + h * WEEK_MS).toISOString().slice(0, 10),
      actual: null,
      predicted: preds[h],
      lower: Math.max(0, preds[h] - 1.96 * fit.residualSd * widen),
      upper: preds[h] + 1.96 * fit.residualSd * widen
    });
  }
  return {
    sourceId: source.id,
    stream: source.stream,
    horizonWeeks,
    points,
    backtestMapePct: mape,
    r2: fit.r2,
    featureNames: FEATURE_NAMES,
    coefficients: fit.coefficients,
    model: `Ridge regression (lambda 0.35) on ${HARMONICS} seasonal harmonics + trend + ${LAGS} autoregressive lags, closed-form via Cholesky. Trained on ${historyWeeks} weeks.`
  };
}
function forecastNetwork(sources, asOf, windowDays) {
  const bySource = {};
  const windowWeeks = Math.max(1, Math.round(windowDays / 7));
  let total = 0;
  let lower = 0;
  let upper = 0;
  let mapeWeighted = 0;
  let weight = 0;
  const weekTotals = /* @__PURE__ */ new Map();
  for (const s of sources) {
    const f3 = forecastSource(s, asOf);
    bySource[s.id] = f3;
    const future = f3.points.filter((p) => p.actual === null);
    for (let i = 0; i < Math.min(windowWeeks, future.length); i++) {
      total += future[i].predicted;
      lower += future[i].lower;
      upper += future[i].upper;
    }
    for (const p of future) {
      weekTotals.set(p.date, (weekTotals.get(p.date) ?? 0) + p.predicted);
    }
    mapeWeighted += f3.backtestMapePct * s.availableT;
    weight += s.availableT;
  }
  const peakWeeks = [...weekTotals.entries()].map(([date, tonnes]) => ({ date, tonnes })).sort((a, b) => b.tonnes - a.tonnes).slice(0, 4).sort((a, b) => a.date.localeCompare(b.date));
  return {
    bySource,
    windowTotalT: total,
    windowLowerT: lower,
    windowUpperT: upper,
    networkMapePct: weight > 0 ? mapeWeighted / weight : 0,
    peakWeeks
  };
}

// packages/engine/src/history.ts
var WEEK_MS2 = 7 * 24 * 3600 * 1e3;
var HISTORY_WEEKS = 104;
var historyCache = /* @__PURE__ */ new Map();
function weeklySupply(state) {
  const out = /* @__PURE__ */ new Map();
  for (const s of state.sources) {
    const key = `${s.id}:${s.availableT.toFixed(3)}`;
    let series = historyCache.get(key);
    if (!series) {
      series = generateHistory(s, HISTORY_WEEKS);
      historyCache.set(key, series);
    }
    out.set(s.id, series);
  }
  return out;
}
function netByFacility(state, allocations) {
  const dominant = dominantBiocharStream(allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  const byFacility = /* @__PURE__ */ new Map();
  for (const a of allocations) {
    const list = byFacility.get(a.facilityId);
    if (list) list.push(a);
    else byFacility.set(a.facilityId, [a]);
  }
  const out = {};
  for (const [id, list] of byFacility) {
    const agg = aggregateAllocations(list, state.facilities, state.vehicles, state.assumptions);
    out[id] = buildLedger(agg, state.assumptions, permanence, false).netT;
  }
  return out;
}
function tonnesByPathway(allocations) {
  const out = {};
  for (const a of allocations) out[a.pathway] = (out[a.pathway] ?? 0) + a.tonnes;
  return out;
}
function ledgerFor(state, allocations) {
  const agg = aggregateAllocations(
    allocations,
    state.facilities,
    state.vehicles,
    state.assumptions
  );
  const dominant = dominantBiocharStream(allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  return buildLedger(agg, state.assumptions, permanence, false);
}
function carbonHistory(state, objective, weeks = 20) {
  const series = weeklySupply(state);
  const windowWeeks = Math.max(1, Math.round(state.assumptions.windowDays / 7));
  const perWindow = state.assumptions.windowDays / 7;
  const asOfMs = Date.parse(state.asOf + "T00:00:00Z");
  const points = [];
  for (let back = weeks - 1; back >= 0; back--) {
    const w = HISTORY_WEEKS - 1 - back;
    const sources = state.sources.map((s) => {
      const weekly = series.get(s.id)?.[w] ?? 0;
      return { ...s, availableT: weekly * perWindow };
    });
    const weekState = { ...state, sources };
    const result = optimize(weekState, objective, {
      skipShadowPrices: true,
      skipAlternatives: true
    });
    const ledger = ledgerFor(weekState, result.allocations);
    const t = result.totals;
    points.push({
      weekIndex: -back,
      date: new Date(asOfMs - back * WEEK_MS2).toISOString().slice(0, 10),
      suppliedT: t.suppliedT,
      divertedT: t.divertedT,
      strandedT: t.strandedT,
      netT: ledger.netT,
      durableRemovalT: ledger.durableRemovalT,
      avoidedEmissionsT: ledger.avoidedEmissionsT,
      substitutionT: ledger.substitutionT,
      emissionsT: ledger.emissionsT,
      transportEmissionsT: t.transportEmissionsT,
      processEmissionsT: t.processEmissionsT,
      intensityTPerT: t.divertedT > 0 ? ledger.netT / t.divertedT : 0,
      tonnesByPathway: tonnesByPathway(result.allocations),
      netByFacility: netByFacility(weekState, result.allocations)
    });
  }
  const period = comparePeriods(points, windowWeeks);
  const drivers = changeDrivers(points, windowWeeks);
  return {
    points,
    period,
    drivers,
    narrative: composeNarrative(period, drivers),
    basis: `Each point is a full re-solve of the network on that week's observed supply, expressed as tCO\u2082e per ${state.assumptions.windowDays}-day window so it stays comparable to the headline figure. Supply varies; prices, assumptions and the facility estate are held at their current values, because no history exists for them.`
  };
}
function mean2(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function grouped(v) {
  return Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function comparePeriods(points, windowWeeks) {
  const n = Math.min(windowWeeks, Math.floor(points.length / 2));
  const current = points.slice(points.length - n);
  const previous = points.slice(points.length - 2 * n, points.length - n);
  const currentT = mean2(current.map((p) => p.netT));
  const previousT = mean2(previous.map((p) => p.netT));
  const deltaT = currentT - previousT;
  return {
    currentT,
    previousT,
    deltaT,
    deltaPct: previousT !== 0 ? deltaT / Math.abs(previousT) * 100 : 0,
    weeks: n,
    // More net carbon removed or avoided is an improvement.
    improving: deltaT >= 0
  };
}
function changeDrivers(points, windowWeeks) {
  const n = Math.min(windowWeeks, Math.floor(points.length / 2));
  if (n === 0) return [];
  const cur = points.slice(points.length - n);
  const prev = points.slice(points.length - 2 * n, points.length - n);
  const d = (f3) => mean2(cur.map(f3)) - mean2(prev.map(f3));
  const tonnesT = d((p) => p.divertedT);
  const drivers = [
    {
      key: "removal",
      label: "Durable removal",
      deltaT: d((p) => p.durableRemovalT),
      detail: "Carbon fixed in biochar, after the permanence adjustment"
    },
    {
      key: "avoided",
      label: "Avoided disposal",
      deltaT: d((p) => p.avoidedEmissionsT),
      detail: "Methane and N\u2082O not released by the counterfactual fate"
    },
    {
      key: "substitution",
      label: "Fossil displacement",
      deltaT: d((p) => p.substitutionT),
      detail: "Coal, CNG, grid power and synthetic nitrogen displaced"
    },
    {
      key: "transport",
      label: "Transport emissions",
      deltaT: -d((p) => p.transportEmissionsT),
      detail: "Well-to-wheel haulage including empty return legs"
    },
    {
      key: "process",
      label: "Processing emissions",
      deltaT: -d((p) => p.processEmissionsT),
      detail: "Parasitic grid draw, digester slip and windrow emissions"
    }
  ].filter((x) => Math.abs(x.deltaT) >= 0.5);
  drivers.sort((a, b) => Math.abs(b.deltaT) - Math.abs(a.deltaT));
  const shift = pathwayShift(cur, prev);
  if (shift) {
    drivers.push({
      key: "throughput",
      label: "Throughput shift",
      deltaT: 0,
      detail: `${grouped(shift.tonnes)} t ${shift.tonnes >= 0 ? "more" : "less"} routed to ${PATHWAYS[shift.pathway].short}` + (Math.abs(tonnesT) >= 1 ? ` and ${grouped(tonnesT)} t ${tonnesT >= 0 ? "more" : "less"} diverted overall` : "")
    });
  }
  return drivers;
}
function pathwayShift(cur, prev) {
  const ids = /* @__PURE__ */ new Set();
  for (const p of [...cur, ...prev]) {
    for (const k of Object.keys(p.tonnesByPathway)) ids.add(k);
  }
  let best = null;
  for (const id of ids) {
    const delta = mean2(cur.map((p) => p.tonnesByPathway[id] ?? 0)) - mean2(prev.map((p) => p.tonnesByPathway[id] ?? 0));
    if (!best || Math.abs(delta) > Math.abs(best.tonnes)) best = { pathway: id, tonnes: delta };
  }
  return best && Math.abs(best.tonnes) >= 1 ? best : null;
}
function composeNarrative(period, drivers) {
  const t = (x) => `${grouped(x)} tCO\u2082e`;
  if (Math.abs(period.deltaT) < 0.5) {
    return `Net impact held steady against the previous ${period.weeks}-week period, within half a tonne of CO\u2082e.`;
  }
  const direction = period.deltaT > 0 ? "increased" : "decreased";
  const scored = drivers.filter((x) => x.key !== "throughput" && Math.abs(x.deltaT) >= 0.5);
  const lead = scored[0];
  const shift = drivers.find((x) => x.key === "throughput");
  let s = `Net impact ${direction} by ${t(period.deltaT)} against the previous ${period.weeks}-week period.`;
  if (!lead) return s;
  s += ` The main driver was ${lead.label.toLowerCase()}, ${lead.deltaT > 0 ? "up" : "down"} ${t(lead.deltaT)}`;
  if (shift) s += `, on ${shift.detail}`;
  s += ".";
  const offset = scored.slice(1).find((x) => Math.sign(x.deltaT) !== Math.sign(lead.deltaT));
  if (offset) {
    s += ` Partially offset by ${offset.label.toLowerCase()}, ${offset.deltaT > 0 ? "up" : "down"} ${t(offset.deltaT)}.`;
  }
  return s;
}

// packages/engine/src/brief.ts
function splitLedger(ledger) {
  const sum = (pred) => ledger.lines.filter((l) => pred(l.key)).reduce((a, l) => a + l.valueT, 0);
  return {
    netT: ledger.netT,
    removalT: ledger.durableRemovalT,
    avoidedT: ledger.avoidedEmissionsT,
    substitutionT: ledger.substitutionT,
    grossBenefitT: ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT,
    // Charges are reported positive; the decomposition subtracts them.
    transportT: -sum((k) => k === "em_transport" || k === "em_aggregation"),
    processT: -sum((k) => k.startsWith("em_") && k !== "em_transport" && k !== "em_aggregation"),
    adjustmentT: -sum((k) => k === "char_permanence")
  };
}
function buildFlow(state, allocations) {
  const basis = inheritFrom(allocations);
  const byPathway = /* @__PURE__ */ new Map();
  for (const a of allocations) {
    const list = byPathway.get(a.pathway);
    if (list) list.push(a);
    else byPathway.set(a.pathway, [a]);
  }
  const facName = new Map(state.facilities.map((f3) => [f3.id, f3.name]));
  const bands = [];
  for (const [pathway, list] of byPathway) {
    const tonnes = list.reduce((a, x) => a + x.tonnes, 0);
    const netT = networkLedger(
      list,
      state.facilities,
      state.vehicles,
      state.assumptions,
      basis
    ).netT;
    const facT = /* @__PURE__ */ new Map();
    const strT = /* @__PURE__ */ new Map();
    for (const a of list) {
      facT.set(a.facilityId, (facT.get(a.facilityId) ?? 0) + a.tonnes);
      strT.set(a.stream, (strT.get(a.stream) ?? 0) + a.tonnes);
    }
    bands.push({
      pathway,
      label: PATHWAYS[pathway].short,
      tonnes,
      netT,
      perTonneT: tonnes > 0 ? netT / tonnes : 0,
      facilityCount: facT.size,
      topFacilities: [...facT.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, t]) => ({ id, name: facName.get(id) ?? id, tonnes: t })),
      topStreams: [...strT.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([stream, t]) => ({ stream, label: STREAMS[stream].label, tonnes: t }))
    });
  }
  bands.sort((a, b) => b.netT - a.netT);
  return bands;
}
function pickContributors(ranking) {
  const working = ranking.filter((r) => r.receivedT > 0);
  const idleCandidates = ranking.filter((r) => r.status === "online" && r.capacityT - r.receivedT > 1).sort((a, b) => b.capacityT - b.receivedT - (a.capacityT - a.receivedT));
  return {
    best: working[0] ?? null,
    weakestPerTonne: working.length > 1 ? [...working].sort((a, b) => a.perTonneT - b.perTonneT)[0] : null,
    largestIdle: idleCandidates[0] ?? null
  };
}
function composeHeadline(position, action, risk, trend) {
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  let s = `The current plan produces ${n(position.netT)} tCO\u2082e of net carbon impact across ${n(position.divertedT)} t of diverted material`;
  if (position.strandedT > 1) s += `, with ${n(position.strandedT)} t left unplaced`;
  s += ".";
  if (action) {
    const phrase = action.headline.charAt(0).toLowerCase() + action.headline.slice(1);
    s += ` The strongest measured upside is to ${phrase}, worth ${n(action.carbonDeltaT)} tCO\u2082e.`;
  } else {
    s += ` No tested change improved net carbon under the current constraints.`;
  }
  if (risk) {
    s += ` The largest identified resilience risk is losing ${risk.facilityName}, which the optimiser absorbs at a cost of ${n(risk.carbonDeltaT)} tCO\u2082e \u2014 ${n(risk.carbonLossPct, 1)}% of the network's carbon.`;
  }
  if (trend && Math.abs(trend.deltaPct) >= 1) {
    s += ` Against the previous ${trend.weeks}-week period the position has ${trend.improving ? "improved" : "weakened"} by ${n(Math.abs(trend.deltaPct), 1)}%.`;
  }
  return s;
}
function buildBrief(inputs) {
  const {
    state,
    result,
    version,
    ledger,
    history,
    opportunities,
    ranking,
    evidence,
    resilience,
    worstShock,
    objectives
  } = inputs;
  const split = splitLedger(ledger);
  const position = {
    ...split,
    suppliedT: result.totals.suppliedT,
    divertedT: result.totals.divertedT,
    strandedT: result.totals.strandedT,
    perTonneT: result.totals.divertedT > 0 ? ledger.netT / result.totals.divertedT : 0,
    uncertainty: ledger.uncertainty ? { p5: ledger.uncertainty.p5, p95: ledger.uncertainty.p95, draws: ledger.uncertainty.draws } : null
  };
  const trend = history ? {
    deltaT: history.period.deltaT,
    deltaPct: history.period.deltaPct,
    weeks: history.period.weeks,
    improving: history.period.improving,
    basis: history.basis,
    narrative: history.narrative
  } : null;
  const top = opportunities[0] ?? null;
  const action = top ? {
    headline: top.headline,
    carbonDeltaT: top.measure.carbonDeltaT,
    marginDeltaInr: top.measure.marginDeltaInr,
    tonnesDeltaT: top.measure.divertedDeltaT,
    scenario: top.scenario,
    why: top.why,
    whyNotAlready: top.whyNotAlready,
    facilityId: top.facilityId
  } : null;
  const worstRow = resilience.n1Results[0] ?? null;
  const risk = worstShock && worstRow ? {
    facilityId: resilience.worstCaseFacilityId,
    facilityName: resilience.worstCaseFacilityName,
    scenario: worstShock.scenario,
    baselineNetT: worstShock.baseline.netT,
    afterNetT: worstShock.after.netT,
    carbonDeltaT: worstShock.carbonDeltaT,
    carbonLossPct: resilience.worstCaseLossPct,
    marginDeltaInr: worstShock.marginDeltaInr,
    strandedDeltaT: worstShock.after.strandedT - worstShock.baseline.strandedT,
    flowsChanged: worstShock.flowChanges.length,
    facilitiesChanged: worstShock.changedFacilities.length,
    why: worstShock.why,
    resilienceScore: resilience.score,
    resilienceGrade: resilience.grade,
    resilienceMethod: resilience.method
  } : null;
  const methodology = {
    planningWindow: `${state.assumptions.windowDays}-day forward window to ${state.asOf}, solved under the ${OBJECTIVE_META[result.objective].label} objective.`,
    supplyBasis: "Per-source availability generated from the crop calendar with a seeded weather shock. Not collected from the field.",
    allocationBasis: "Min-cost flow with Johnson potentials over the feasible arc set, with branch and bound over which plants operate.",
    transportBasis: "Well-to-wheel diesel on the achievable payload, including the empty return leg, plus field aggregation.",
    processingBasis: "Parasitic grid draw at the Indian grid factor, digester methane slip, and turned-windrow composting rates rather than the static-pile default.",
    permanenceBasis: "Two-pool decay parameterised by the char H/C(org) ratio, Q10-corrected from the reference dataset to Indian soil temperature. Durable removal and avoided emissions are never summed.",
    trendBasis: history ? history.basis : "No trend computed for this brief.",
    limitations: [
      "Every carbon figure is a model output. Nothing in this network is a measurement.",
      "Biogenic CO\u2082 is excluded: only CH\u2084 and N\u2082O from the counterfactual fate are counted as a real atmospheric addition.",
      "The trend re-solves past supply; it is not a record of historical emissions.",
      "Opportunity and shock figures are differences between two modelled plans, not forecasts of realised outcomes."
    ]
  };
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    asOf: state.asOf,
    windowDays: state.assumptions.windowDays,
    version,
    objective: result.objective,
    objectiveLabel: OBJECTIVE_META[result.objective].label,
    headline: composeHeadline(position, action, risk, trend),
    whatChanged: trend && Math.abs(trend.deltaT) >= 0.5 ? trend.narrative : "No material network change identified in the current comparison window.",
    position,
    trend,
    flow: buildFlow(state, result.allocations),
    action,
    risk,
    objectives,
    contributors: pickContributors(ranking),
    evidence,
    methodology,
    notes: {
      action: action === null ? "No tested change improved net carbon under the current network constraints. The candidates and their measured outcomes are listed in Opportunities." : null,
      risk: risk === null ? "No single-facility contingency could be evaluated for this network." : null,
      trend: trend === null ? "No trend is available for this brief. A planning-window result is not a historical measurement, and none has been computed." : null
    }
  };
}

// packages/engine/src/scenario.ts
function scenarioDefs(net) {
  const facilityChoices = net.facilities.map((f3) => ({
    value: f3.id,
    label: `${f3.name} (${PATHWAYS[f3.pathway].short}, ${f3.capacityTpd} t/day)`
  }));
  const streamChoices = Object.keys(STREAMS).map((s) => ({
    value: s,
    label: STREAMS[s].label
  }));
  const districtChoices = [...new Set(net.sources.map((s) => s.district))].sort().map((d) => ({ value: d, label: d }));
  return [
    {
      kind: "facility_offline",
      label: "Facility outage",
      category: "disruption",
      description: "A processing plant stops accepting feedstock \u2014 unplanned shutdown, permit suspension or a major breakdown. The network must find somewhere else for everything it was taking.",
      demoHeadline: "Take a plant offline and watch the network re-route itself.",
      params: [
        {
          key: "facilityId",
          label: "Facility",
          type: "choice",
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? ""
        }
      ]
    },
    {
      kind: "facility_derate",
      label: "Capacity derating",
      category: "disruption",
      description: "A plant keeps running but at reduced throughput \u2014 a failed line, a feedstock quality problem, or a partial permit restriction.",
      demoHeadline: "Cut a plant to half capacity and see what gets displaced first.",
      params: [
        {
          key: "facilityId",
          label: "Facility",
          type: "choice",
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? ""
        },
        {
          key: "availability",
          label: "Remaining availability",
          type: "number",
          min: 0,
          max: 100,
          step: 5,
          unit: "%",
          defaultValue: 50
        }
      ]
    },
    {
      kind: "supply_surge",
      label: "Supply surge",
      category: "supply",
      description: "More feedstock arrives than planned \u2014 an early harvest, a burning ban that suddenly makes residue available, or a neighbouring district joining the scheme.",
      demoHeadline: "A burning ban puts 40% more straw on the market overnight.",
      params: [
        {
          key: "stream",
          label: "Stream",
          type: "choice",
          choices: streamChoices,
          defaultValue: "paddy_straw"
        },
        {
          key: "changePct",
          label: "Change in availability",
          type: "number",
          min: -80,
          max: 200,
          step: 5,
          unit: "%",
          defaultValue: 40
        }
      ]
    },
    {
      kind: "supply_shortage",
      label: "Supply shortfall",
      category: "supply",
      description: "Less feedstock than planned \u2014 rain-delayed harvest, competing buyers, or farmers choosing to burn anyway.",
      demoHeadline: "Rain delays the harvest and supply drops by a third.",
      params: [
        {
          key: "stream",
          label: "Stream",
          type: "choice",
          choices: streamChoices,
          defaultValue: "paddy_straw"
        },
        {
          key: "changePct",
          label: "Change in availability",
          type: "number",
          min: -90,
          max: 0,
          step: 5,
          unit: "%",
          defaultValue: -35
        }
      ]
    },
    {
      kind: "fleet_shortage",
      label: "Fleet shortage",
      category: "disruption",
      description: "Vehicles become unavailable \u2014 a transporter strike, seasonal competition for trucks, or maintenance backlog.",
      demoHeadline: "A transporter strike removes 40% of the truck fleet.",
      params: [
        {
          key: "changePct",
          label: "Change in fleet size",
          type: "number",
          min: -90,
          max: 100,
          step: 5,
          unit: "%",
          defaultValue: -40
        }
      ]
    },
    {
      kind: "diesel_price",
      label: "Diesel price move",
      category: "market",
      description: "Fuel price change. Affects transport cost but not transport emissions, so it reshapes the economics without changing the carbon arithmetic.",
      demoHeadline: "Diesel jumps to \u20B9120/litre and long hauls stop paying.",
      params: [
        {
          key: "price",
          label: "Diesel price",
          type: "number",
          min: 50,
          max: 180,
          step: 1,
          unit: "\u20B9/litre",
          defaultValue: 120
        }
      ]
    },
    {
      kind: "carbon_price",
      label: "Carbon price move",
      category: "market",
      description: "The durable-removal price moves. Because removal trades roughly twenty times above avoidance, this control decides whether pyrolysis or fossil displacement wins the network.",
      demoHeadline: "Removal prices double and the network pivots to biochar.",
      params: [
        {
          key: "cdrPrice",
          label: "Durable CDR price",
          type: "number",
          min: 0,
          max: 3e4,
          step: 500,
          unit: "\u20B9/tCO\u2082e",
          defaultValue: 21600
        }
      ]
    },
    {
      kind: "processing_cost",
      label: "Processing cost shock",
      category: "market",
      description: "Operating costs move across a pathway \u2014 power tariff change, labour, consumables or a maintenance cycle.",
      demoHeadline: "Pyrolysis opex rises 30% and the biochar case narrows.",
      params: [
        {
          key: "pathway",
          label: "Pathway",
          type: "choice",
          choices: Object.values(PATHWAYS).map((p) => ({ value: p.id, label: p.label })),
          defaultValue: "pyrolysis_biochar"
        },
        {
          key: "changePct",
          label: "Change in opex",
          type: "number",
          min: -50,
          max: 100,
          step: 5,
          unit: "%",
          defaultValue: 30
        }
      ]
    },
    {
      kind: "road_disruption",
      label: "Transport disruption",
      category: "disruption",
      description: "A district becomes hard to serve \u2014 flooding, a bridge closure or a protest blocking a corridor. Every arc out of that district is severed.",
      demoHeadline: "Flooding cuts a district off from the network entirely.",
      params: [
        {
          key: "district",
          label: "District",
          type: "choice",
          choices: districtChoices,
          defaultValue: districtChoices[0]?.value ?? ""
        }
      ]
    },
    {
      kind: "new_facility",
      label: "Commission new capacity",
      category: "strategy",
      description: "Add throughput at an existing site. The right question is not whether more capacity helps, but whether it helps *here* \u2014 which the shadow prices already answer.",
      demoHeadline: "Add 40 t/day where the shadow price says it is worth most.",
      params: [
        {
          key: "facilityId",
          label: "Site to expand",
          type: "choice",
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? ""
        },
        {
          key: "addTpd",
          label: "Additional capacity",
          type: "number",
          min: 5,
          max: 300,
          step: 5,
          unit: "t/day",
          defaultValue: 40
        }
      ]
    },
    {
      kind: "seasonal_shift",
      label: "Seasonal shift",
      category: "supply",
      description: "Move the planning window to a different point in the crop calendar. Straw disappears, press mud appears, and the optimal network is a different network.",
      demoHeadline: "Jump to the wheat harvest and watch the feedstock mix invert.",
      params: [
        {
          key: "weeksAhead",
          label: "Weeks ahead",
          type: "number",
          min: -26,
          max: 40,
          step: 1,
          unit: "weeks",
          defaultValue: 22
        }
      ]
    },
    {
      kind: "objective_change",
      label: "Change objective",
      category: "strategy",
      description: "Re-solve the same network under a different objective. Nothing physical changes; the answer does.",
      demoHeadline: "Switch from profit to carbon and watch the straw change destination.",
      params: [
        {
          key: "objective",
          label: "Objective",
          type: "choice",
          choices: Object.keys(OBJECTIVE_META).map((k) => ({
            value: k,
            label: OBJECTIVE_META[k].label
          })),
          defaultValue: "carbon_first"
        }
      ]
    }
  ];
}
function applyScenario(net, scenario, currentObjective) {
  const state = cloneNetwork(net);
  const p = scenario.params;
  const affected = [];
  let label = "";
  let objective = null;
  switch (scenario.kind) {
    case "facility_offline": {
      const f3 = state.facilities.find((x) => x.id === p.facilityId);
      if (f3) {
        f3.status = "offline";
        f3.availability = 0;
        affected.push(f3.id);
        label = `${f3.name} offline`;
      }
      break;
    }
    case "facility_derate": {
      const f3 = state.facilities.find((x) => x.id === p.facilityId);
      if (f3) {
        const pct = Number(p.availability) / 100;
        f3.availability = Math.max(0, Math.min(1, pct));
        f3.status = pct <= 0 ? "offline" : "derated";
        affected.push(f3.id);
        label = `${f3.name} derated to ${Number(p.availability).toFixed(0)}%`;
      }
      break;
    }
    case "supply_surge":
    case "supply_shortage": {
      const stream = p.stream;
      const mult = 1 + Number(p.changePct) / 100;
      for (const s of state.sources) {
        if (s.stream !== stream) continue;
        s.availableT = Math.max(0, s.availableT * mult);
        affected.push(s.id);
      }
      label = `${STREAMS[stream].label} availability ${Number(p.changePct) >= 0 ? "+" : ""}${Number(p.changePct)}%`;
      break;
    }
    case "fleet_shortage": {
      const mult = 1 + Number(p.changePct) / 100;
      for (const v of state.vehicles) {
        v.fleetSize = Math.max(0, Math.round(v.fleetSize * mult));
      }
      label = `Fleet size ${Number(p.changePct) >= 0 ? "+" : ""}${Number(p.changePct)}%`;
      break;
    }
    case "diesel_price": {
      state.assumptions.dieselPriceInrPerL = Number(p.price);
      label = `Diesel at \u20B9${Number(p.price)}/litre`;
      break;
    }
    case "carbon_price": {
      state.assumptions.cdrPriceInrPerT = Number(p.cdrPrice);
      label = `Durable CDR at \u20B9${Number(p.cdrPrice).toLocaleString("en-IN")}/tCO\u2082e`;
      break;
    }
    case "processing_cost": {
      const mult = 1 + Number(p.changePct) / 100;
      for (const f3 of state.facilities) {
        if (f3.pathway !== p.pathway) continue;
        f3.opexInrPerT = Math.max(0, f3.opexInrPerT * mult);
        affected.push(f3.id);
      }
      label = `${PATHWAYS[p.pathway].short} opex ${Number(p.changePct) >= 0 ? "+" : ""}${Number(p.changePct)}%`;
      break;
    }
    case "road_disruption": {
      const district = String(p.district);
      const cut = state.sources.filter((s) => s.district === district);
      for (const s of cut) {
        affected.push(s.id);
        for (const f3 of state.facilities) {
          if (f3.district === district) continue;
          state.blockedArcs.push({ sourceId: s.id, facilityId: f3.id });
        }
      }
      label = `${district} corridor severed`;
      break;
    }
    case "new_facility": {
      const f3 = state.facilities.find((x) => x.id === p.facilityId);
      if (f3) {
        f3.capacityTpd += Number(p.addTpd);
        f3.status = f3.status === "offline" ? "online" : f3.status;
        f3.availability = Math.max(f3.availability, 1);
        affected.push(f3.id);
        label = `${f3.name} +${Number(p.addTpd)} t/day`;
      }
      break;
    }
    case "seasonal_shift": {
      const weeks = Number(p.weeksAhead);
      const baseWeek = isoWeekOf(state.asOf);
      for (const s of state.sources) {
        const now = seasonalMultiplier(s.stream, baseWeek % 52);
        const then = seasonalMultiplier(s.stream, ((baseWeek + weeks) % 52 + 52) % 52);
        s.availableT = Math.max(0, s.availableT * then / Math.max(1e-6, now));
        affected.push(s.id);
      }
      const shifted = new Date(Date.parse(state.asOf + "T00:00:00Z") + weeks * 7 * 864e5);
      state.asOf = shifted.toISOString().slice(0, 10);
      label = `Window shifted ${weeks >= 0 ? "+" : ""}${weeks} weeks to ${state.asOf}`;
      break;
    }
    case "objective_change": {
      objective = p.objective;
      label = `Objective set to ${OBJECTIVE_META[objective].label}`;
      break;
    }
  }
  state.appliedScenarios.push(scenario);
  return { state, objective: objective ?? currentObjective, label, affectedEntityIds: affected };
}
function isoWeekOf(iso) {
  const d = new Date(Date.parse(iso + "T00:00:00Z"));
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / (7 * 864e5));
}
function keyOf(a) {
  return `${a.sourceId}|${a.facilityId}`;
}
function diffFlows(net, before, after) {
  const srcName = new Map(net.sources.map((s) => [s.id, s.name]));
  const facName = new Map(net.facilities.map((f3) => [f3.id, f3.name]));
  const b = /* @__PURE__ */ new Map();
  for (const a of before.allocations) b.set(keyOf(a), a);
  const af = /* @__PURE__ */ new Map();
  for (const a of after.allocations) af.set(keyOf(a), a);
  const bySourceBefore = /* @__PURE__ */ new Map();
  for (const a of before.allocations) {
    const l = bySourceBefore.get(a.sourceId) ?? [];
    l.push(a);
    bySourceBefore.set(a.sourceId, l);
  }
  const bySourceAfter = /* @__PURE__ */ new Map();
  for (const a of after.allocations) {
    const l = bySourceAfter.get(a.sourceId) ?? [];
    l.push(a);
    bySourceAfter.set(a.sourceId, l);
  }
  const changes = [];
  const sourceIds = /* @__PURE__ */ new Set([...bySourceBefore.keys(), ...bySourceAfter.keys()]);
  for (const sid of sourceIds) {
    const prev = bySourceBefore.get(sid) ?? [];
    const next = bySourceAfter.get(sid) ?? [];
    const prevFacs = new Set(prev.map((a) => a.facilityId));
    const nextFacs = new Set(next.map((a) => a.facilityId));
    const dropped = prev.filter((a) => !nextFacs.has(a.facilityId));
    const added = next.filter((a) => !prevFacs.has(a.facilityId));
    const usedAdds = /* @__PURE__ */ new Set();
    for (const d of dropped) {
      let bestIdx = -1;
      let bestGap = Infinity;
      added.forEach((a, idx) => {
        if (usedAdds.has(idx)) return;
        const gap = Math.abs(a.tonnes - d.tonnes);
        if (gap < bestGap) {
          bestGap = gap;
          bestIdx = idx;
        }
      });
      if (bestIdx >= 0 && bestGap < d.tonnes * 0.75) {
        const a = added[bestIdx];
        usedAdds.add(bestIdx);
        changes.push({
          sourceId: sid,
          sourceName: srcName.get(sid) ?? sid,
          fromFacilityId: d.facilityId,
          fromFacilityName: facName.get(d.facilityId) ?? d.facilityId,
          toFacilityId: a.facilityId,
          toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
          tonnes: a.tonnes,
          changeType: "rerouted",
          distanceDeltaKm: a.distanceKm - d.distanceKm,
          carbonDeltaT: a.netCarbonT - d.netCarbonT
        });
      } else {
        changes.push({
          sourceId: sid,
          sourceName: srcName.get(sid) ?? sid,
          fromFacilityId: d.facilityId,
          fromFacilityName: facName.get(d.facilityId) ?? d.facilityId,
          toFacilityId: null,
          toFacilityName: null,
          tonnes: d.tonnes,
          changeType: "dropped",
          distanceDeltaKm: -d.distanceKm,
          carbonDeltaT: -d.netCarbonT
        });
      }
    }
    added.forEach((a, idx) => {
      if (usedAdds.has(idx)) return;
      changes.push({
        sourceId: sid,
        sourceName: srcName.get(sid) ?? sid,
        fromFacilityId: null,
        fromFacilityName: null,
        toFacilityId: a.facilityId,
        toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        tonnes: a.tonnes,
        changeType: "added",
        distanceDeltaKm: a.distanceKm,
        carbonDeltaT: a.netCarbonT
      });
    });
    for (const a of next) {
      if (!prevFacs.has(a.facilityId)) continue;
      const prevA = b.get(keyOf(a));
      if (!prevA) continue;
      const delta = a.tonnes - prevA.tonnes;
      if (Math.abs(delta) < 25) continue;
      changes.push({
        sourceId: sid,
        sourceName: srcName.get(sid) ?? sid,
        fromFacilityId: a.facilityId,
        fromFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        toFacilityId: a.facilityId,
        toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        tonnes: Math.abs(delta),
        changeType: delta > 0 ? "increased" : "decreased",
        distanceDeltaKm: 0,
        carbonDeltaT: a.netCarbonT - prevA.netCarbonT
      });
    }
  }
  return changes.sort((a, b2) => b2.tonnes - a.tonnes);
}
function buildDeltas(net, before, after) {
  const mk = (key, label, unit, b, a, higherIsBetter) => ({
    key,
    label,
    unit,
    before: b,
    after: a,
    delta: a - b,
    deltaPct: Math.abs(b) > 1e-9 ? (a - b) / Math.abs(b) * 100 : 0,
    higherIsBetter
  });
  const B = before.totals;
  const A = after.totals;
  const bL = networkLedger(
    before.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS
  );
  const aL = networkLedger(
    after.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS
  );
  return [
    mk("divertedT", "Waste diverted", "t", B.divertedT, A.divertedT, true),
    mk("strandedT", "Waste stranded", "t", B.strandedT, A.strandedT, false),
    mk("netCarbonT", "Net carbon impact", "tCO\u2082e", bL.netT, aL.netT, true),
    mk(
      "durableRemovalT",
      "Durable removal",
      "tCO\u2082e",
      bL.durableRemovalT,
      aL.durableRemovalT,
      true
    ),
    mk(
      "avoidedEmissionsT",
      "Avoided emissions",
      "tCO\u2082e",
      bL.avoidedEmissionsT,
      aL.avoidedEmissionsT,
      true
    ),
    mk(
      "transportEmissionsT",
      "Transport emissions",
      "tCO\u2082e",
      B.transportEmissionsT,
      A.transportEmissionsT,
      false
    ),
    mk(
      "processEmissionsT",
      "Process emissions",
      "tCO\u2082e",
      B.processEmissionsT,
      A.processEmissionsT,
      false
    ),
    mk("marginInr", "Operating margin", "\u20B9", B.marginInr, A.marginInr, true),
    mk("revenueInr", "Revenue", "\u20B9", B.revenueInr, A.revenueInr, true),
    mk("tkm", "Transport burden", "t\xB7km", B.tkm, A.tkm, false),
    mk("vehicleTrips", "Vehicle trips", "trips", B.vehicleTrips, A.vehicleTrips, false),
    mk(
      "marginPerTonneInr",
      "Margin per tonne",
      "\u20B9/t",
      B.marginPerTonneInr,
      A.marginPerTonneInr,
      true
    )
  ];
}
function runScenario(net, scenario, mode, before) {
  const stages = [];
  let t = Date.now();
  const baseResult = before ?? optimize(net, mode);
  stages.push({
    label: "Establish baseline",
    detail: `Current plan: ${baseResult.totals.divertedT.toFixed(0)} t diverted, ${baseResult.totals.netCarbonT.toFixed(0)} tCO\u2082e net`,
    ms: Date.now() - t
  });
  t = Date.now();
  const applied = applyScenario(net, scenario, mode);
  stages.push({
    label: "Mutate network state",
    detail: applied.label || "Scenario applied",
    ms: Date.now() - t
  });
  t = Date.now();
  const afterResult = optimize(applied.state, applied.objective ?? mode);
  stages.push({
    label: "Re-optimise from scratch",
    detail: `${afterResult.telemetry.bnbNodesExplored} branch-and-bound nodes, ${afterResult.telemetry.arcsFeasible} feasible arcs, gap ${afterResult.telemetry.gapPct.toFixed(2)}%`,
    ms: Date.now() - t
  });
  t = Date.now();
  const flowChanges = diffFlows(applied.state, baseResult, afterResult);
  const deltas = buildDeltas(net, baseResult, afterResult);
  stages.push({
    label: "Attribute the difference",
    detail: `${flowChanges.length} flow changes identified`,
    ms: Date.now() - t
  });
  t = Date.now();
  const beforeBottlenecks = detectBottlenecks(net, baseResult);
  const afterBottlenecks = detectBottlenecks(applied.state, afterResult);
  const beforeIds = new Set(beforeBottlenecks.map((b) => b.id));
  const afterIds = new Set(afterBottlenecks.map((b) => b.id));
  const newBottlenecks = afterBottlenecks.filter((b) => !beforeIds.has(b.id));
  const resolvedBottleneckIds = beforeBottlenecks.filter((b) => !afterIds.has(b.id)).map((b) => b.id);
  stages.push({
    label: "Re-scan for bottlenecks",
    detail: `${newBottlenecks.length} new, ${resolvedBottleneckIds.length} resolved`,
    ms: Date.now() - t
  });
  return {
    scenario,
    label: applied.label,
    narrative: narrate(applied.label, baseResult, afterResult, flowChanges, deltas),
    before: baseResult,
    after: afterResult,
    deltas,
    flowChanges,
    newBottlenecks,
    resolvedBottleneckIds,
    affectedEntityIds: applied.affectedEntityIds,
    computeStages: stages
  };
}
function narrate(label, before, after, flows, deltas) {
  const out = [];
  const get = (k) => deltas.find((d) => d.key === k);
  const carbon = get("netCarbonT");
  const margin = get("marginInr");
  const stranded = get("strandedT");
  const tkm = get("tkm");
  out.push(`Scenario applied: ${label}.`);
  const rerouted = flows.filter((f3) => f3.changeType === "rerouted");
  const dropped = flows.filter((f3) => f3.changeType === "dropped");
  const reroutedT = rerouted.reduce((s, f3) => s + f3.tonnes, 0);
  const droppedT = dropped.reduce((s, f3) => s + f3.tonnes, 0);
  if (reroutedT > 0) {
    const avgExtraKm = rerouted.reduce((s, f3) => s + f3.distanceDeltaKm, 0) / Math.max(1, rerouted.length);
    out.push(
      `${reroutedT.toFixed(0)} t across ${rerouted.length} flows found a new destination, at an average ${avgExtraKm >= 0 ? "+" : ""}${avgExtraKm.toFixed(0)} km per haul.`
    );
  }
  if (droppedT > 0) {
    out.push(
      `${droppedT.toFixed(0)} t could not be re-placed anywhere in the network and is now stranded.`
    );
  }
  if (carbon) {
    const dir = carbon.delta >= 0 ? "rises" : "falls";
    out.push(
      `Net carbon ${dir} by ${Math.abs(carbon.delta).toFixed(0)} tCO\u2082e (${carbon.deltaPct >= 0 ? "+" : ""}${carbon.deltaPct.toFixed(1)}%), from ${carbon.before.toFixed(0)} to ${carbon.after.toFixed(0)}.`
    );
  }
  if (margin) {
    const dir = margin.delta >= 0 ? "improves" : "deteriorates";
    out.push(
      `Operating margin ${dir} by \u20B9${(Math.abs(margin.delta) / 1e5).toFixed(1)} lakh (${margin.deltaPct >= 0 ? "+" : ""}${margin.deltaPct.toFixed(1)}%).`
    );
  }
  if (tkm && Math.abs(tkm.deltaPct) > 3) {
    out.push(
      `Transport burden ${tkm.delta > 0 ? "increases" : "decreases"} by ${Math.abs(tkm.deltaPct).toFixed(1)}% to ${(tkm.after / 1e3).toFixed(0)}k tonne-kilometres.`
    );
  }
  if (stranded && Math.abs(stranded.delta) > 50) {
    out.push(
      `Stranded feedstock ${stranded.delta > 0 ? "rises" : "falls"} by ${Math.abs(stranded.delta).toFixed(0)} t.`
    );
  }
  const openBefore = new Set(before.openFacilities);
  const openAfter = new Set(after.openFacilities);
  const started = [...openAfter].filter((x) => !openBefore.has(x));
  const stopped = [...openBefore].filter((x) => !openAfter.has(x));
  if (started.length > 0 || stopped.length > 0) {
    out.push(
      `Operating set changes: ${started.length === 0 ? "no facilities" : started.length === 1 ? "one facility" : `${started.length} facilities`} start up and ${stopped.length === 0 ? "none" : stopped.length === 1 ? "one" : stopped.length} shut down.`
    );
  }
  return out;
}

// packages/engine/src/shock.ts
var GROUPS = [
  { key: "removal", label: "Durable removal", benefit: true, match: (l) => l.kind === "removal" },
  { key: "avoided", label: "Avoided disposal", benefit: true, match: (l) => l.kind === "avoided" },
  {
    key: "substitution",
    label: "Fossil displacement",
    benefit: true,
    match: (l) => l.kind === "substitution"
  },
  {
    key: "transport",
    label: "Transport emissions",
    benefit: false,
    match: (l) => l.key === "em_transport" || l.key === "em_aggregation"
  },
  {
    key: "processing",
    label: "Processing emissions",
    benefit: false,
    match: (l) => l.kind === "emission" && l.key !== "em_transport" && l.key !== "em_aggregation"
  },
  {
    key: "adjustment",
    label: "Permanence adjustment",
    benefit: false,
    match: (l) => l.kind === "adjustment"
  }
];
function diffLedgers(before, after) {
  const keys = /* @__PURE__ */ new Set();
  for (const l of before.lines) if (l.kind !== "total") keys.add(l.key);
  for (const l of after.lines) if (l.kind !== "total") keys.add(l.key);
  const out = [];
  for (const key of keys) {
    const b = before.lines.find((l) => l.key === key);
    const a = after.lines.find((l) => l.key === key);
    const meta = a ?? b;
    const bv = b?.valueT ?? 0;
    const av = a?.valueT ?? 0;
    if (Math.abs(av - bv) < 1e-9) continue;
    out.push({ key, label: meta.label, kind: meta.kind, before: bv, after: av, delta: av - bv });
  }
  out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return out;
}
function groupDeltas(lines) {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    delta: lines.filter(g.match).reduce((a, l) => a + l.delta, 0),
    benefit: g.benefit
  })).filter((g) => Math.abs(g.delta) > 1e-9);
}
function side(state, r) {
  const ledger = networkLedger(
    r.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS
  );
  return {
    s: {
      netT: ledger.netT,
      marginInr: r.totals.marginInr,
      divertedT: r.totals.divertedT,
      strandedT: r.totals.strandedT,
      tkm: r.totals.tkm
    },
    ledger
  };
}
function changedFacilities(state, before, after) {
  const beforeBasis = inheritFrom(before.allocations);
  const afterBasis = inheritFrom(after.allocations);
  const out = [];
  for (const f3 of state.facilities) {
    const bAlloc = before.allocations.filter((a) => a.facilityId === f3.id);
    const aAlloc = after.allocations.filter((a) => a.facilityId === f3.id);
    const bT = bAlloc.reduce((x, a) => x + a.tonnes, 0);
    const aT = aAlloc.reduce((x, a) => x + a.tonnes, 0);
    if (Math.abs(aT - bT) < 0.5) continue;
    const bC = networkLedger(
      bAlloc,
      state.facilities,
      state.vehicles,
      state.assumptions,
      beforeBasis
    ).netT;
    const aC = networkLedger(
      aAlloc,
      state.facilities,
      state.vehicles,
      state.assumptions,
      afterBasis
    ).netT;
    out.push({
      id: f3.id,
      name: f3.name,
      pathwayShort: PATHWAYS[f3.pathway].short,
      beforeT: bT,
      afterT: aT,
      tonnesDeltaT: aT - bT,
      beforeCarbonT: bC,
      afterCarbonT: aC,
      carbonDeltaT: aC - bC
    });
  }
  out.sort((a, b) => Math.abs(b.carbonDeltaT) - Math.abs(a.carbonDeltaT));
  return out;
}
function constraintChanges(before, after) {
  const bById = new Map(before.shadowPrices.map((s) => [s.facilityId, s]));
  const out = [];
  for (const a of after.shadowPrices) {
    const b = bById.get(a.facilityId);
    if (!b || b.binding === a.binding) continue;
    out.push({
      facilityId: a.facilityId,
      facilityName: a.facilityName,
      beforeBinding: b.binding,
      afterBinding: a.binding,
      beforeUtilPct: b.utilisationPct,
      afterUtilPct: a.utilisationPct,
      change: a.binding ? "became_binding" : "became_slack"
    });
  }
  return out;
}
function composeWhy(r, before, after) {
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  if (!r.physicallyChanged) {
    return `The optimiser produced the same allocation before and after. Net carbon moved by ${n(r.carbonDeltaT)} tCO\u2082e because the change altered how that allocation is valued or charged, not where material goes.`;
  }
  const lead = r.groupDeltas.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const moved = Math.abs(r.after.divertedT - r.baseline.divertedT);
  let s = `The optimiser re-solved from scratch and produced a different plan: `;
  const bits = [];
  if (moved > 0.5) {
    bits.push(
      `${n(moved)} t ${r.after.divertedT > r.baseline.divertedT ? "more" : "less"} material placed`
    );
  }
  if (r.changedFacilities.length > 0) {
    bits.push(`intake changed at ${r.changedFacilities.length} plant${r.changedFacilities.length > 1 ? "s" : ""}`);
  }
  if (r.flowChanges.length > 0) {
    bits.push(`${r.flowChanges.length} source-to-plant flows altered`);
  }
  s += bits.length > 0 ? bits.join(", ") + "." : "the same tonnage routed differently.";
  if (lead) {
    s += ` The largest carbon driver is ${lead.label.toLowerCase()}, ${lead.delta >= 0 ? "up" : "down"} ${n(lead.delta)} tCO\u2082e.`;
  }
  const flipped = r.constraints[0];
  if (flipped) {
    s += ` ${flipped.facilityName} capacity ` + (flipped.change === "became_binding" ? `became binding at ${n(flipped.afterUtilPct)}% \u2014 it is now limiting the network.` : `went slack, falling from ${n(flipped.beforeUtilPct)}% to ${n(flipped.afterUtilPct)}% utilisation.`);
  }
  return s;
}
function classify(carbonDeltaT, marginDeltaInr) {
  const c = carbonDeltaT >= 0;
  const m = marginDeltaInr >= 0;
  if (c && m) return "carbon_up_econ_up";
  if (c && !m) return "carbon_up_econ_down";
  if (!c && m) return "carbon_down_econ_up";
  return "carbon_down_econ_down";
}
function runShock(state, result, scenario, objective) {
  const t0 = Date.now();
  const run = runScenario(state, scenario, objective, result);
  const solveMs = Date.now() - t0;
  const b = side(state, run.before);
  const a = side(state, run.after);
  const lineDeltas = diffLedgers(b.ledger, a.ledger);
  const physicallyChanged = run.flowChanges.length > 0 || Math.abs(a.s.divertedT - b.s.divertedT) > 0.5 || run.before.allocations.length !== run.after.allocations.length;
  const out = {
    scenario,
    label: run.label,
    objective,
    baseline: b.s,
    after: a.s,
    carbonDeltaT: a.s.netT - b.s.netT,
    carbonDeltaPct: Math.abs(b.s.netT) > 1e-9 ? (a.s.netT - b.s.netT) / Math.abs(b.s.netT) * 100 : 0,
    marginDeltaInr: a.s.marginInr - b.s.marginInr,
    lineDeltas,
    groupDeltas: groupDeltas(lineDeltas),
    flowChanges: run.flowChanges,
    changedFacilities: changedFacilities(state, run.before, run.after),
    constraints: constraintChanges(run.before, run.after),
    narrative: run.narrative,
    why: "",
    classification: classify(a.s.netT - b.s.netT, a.s.marginInr - b.s.marginInr),
    stages: run.computeStages,
    physicallyChanged,
    unchangedReason: physicallyChanged ? null : "Network allocation unchanged: every source keeps its destination and tonnage.",
    solveMs
  };
  out.why = composeWhy(out, run.before, run.after);
  return out;
}
function compareObjectives(state, scenario, current) {
  const out = [];
  for (const mode of Object.keys(OBJECTIVE_META)) {
    const baseline = optimize(state, mode);
    const run = runScenario(state, scenario, mode, baseline);
    const b = side(state, run.before);
    const a = side(state, run.after);
    out.push({
      objective: mode,
      label: OBJECTIVE_META[mode].label,
      baselineNetT: b.s.netT,
      scenarioNetT: a.s.netT,
      carbonDeltaT: a.s.netT - b.s.netT,
      marginDeltaInr: a.s.marginInr - b.s.marginInr,
      isCurrent: mode === current
    });
  }
  out.sort((x, y) => y.carbonDeltaT - x.carbonDeltaT);
  return out;
}

// packages/engine/src/opportunity.ts
var UPRATE_TPD = 40;
function buildCandidates(state, result) {
  const out = [];
  const current = result.objective;
  for (const mode of Object.keys(OBJECTIVE_META)) {
    if (mode === current) continue;
    out.push({
      id: `objective:${mode}`,
      kind: "objective",
      headline: `Re-solve the network on ${OBJECTIVE_META[mode].label}`,
      scenario: { kind: "objective_change", params: { objective: mode } },
      facilityId: null,
      whyNotAlready: `The network is currently solved under the ${OBJECTIVE_META[current].label} objective, which weighs operating margin alongside carbon. The optimiser is doing exactly what it was asked; this changes the instruction rather than the network.`
    });
  }
  const facById = new Map(state.facilities.map((f3) => [f3.id, f3]));
  for (const s of result.shadowPrices) {
    if (!s.binding) continue;
    const f3 = facById.get(s.facilityId);
    if (!f3 || f3.status !== "online") continue;
    out.push({
      id: `capacity:${s.facilityId}`,
      kind: "capacity",
      headline: `Commission ${UPRATE_TPD} t/day more at ${s.facilityName}`,
      scenario: {
        kind: "new_facility",
        params: { facilityId: s.facilityId, addTpd: UPRATE_TPD }
      },
      facilityId: s.facilityId,
      whyNotAlready: `Capacity here is binding at ${s.utilisationPct.toFixed(0)}% of nameplate. The optimiser cannot route more material to this plant however valuable it would be \u2014 only added throughput can, and that is an investment decision rather than a routing one.`
    });
  }
  return out;
}
function measure(state, beforeResult, afterResult) {
  const before = networkLedger(
    beforeResult.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS
  );
  const after = networkLedger(
    afterResult.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS
  );
  const divertedDeltaT = afterResult.totals.divertedT - beforeResult.totals.divertedT;
  const carbonDeltaT = after.netT - before.netT;
  return {
    carbonBeforeT: before.netT,
    carbonAfterT: after.netT,
    carbonDeltaT,
    marginBeforeInr: beforeResult.totals.marginInr,
    marginAfterInr: afterResult.totals.marginInr,
    marginDeltaInr: afterResult.totals.marginInr - beforeResult.totals.marginInr,
    divertedBeforeT: beforeResult.totals.divertedT,
    divertedAfterT: afterResult.totals.divertedT,
    divertedDeltaT,
    strandedDeltaT: afterResult.totals.strandedT - beforeResult.totals.strandedT,
    tkmDeltaPct: beforeResult.totals.tkm > 0 ? (afterResult.totals.tkm - beforeResult.totals.tkm) / beforeResult.totals.tkm * 100 : 0,
    carbonPerAddedTonneT: Math.abs(divertedDeltaT) > 1 ? carbonDeltaT / divertedDeltaT : null
  };
}
function composeWhy2(c, m) {
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  const rupees = (v) => {
    const a = Math.abs(v);
    if (a >= 1e7) return `\u20B9${n(a / 1e7, 2)} Cr`;
    if (a >= 1e5) return `\u20B9${n(a / 1e5, 2)} L`;
    return `\u20B9${n(a)}`;
  };
  const cr = rupees;
  const bits = [];
  if (m.divertedDeltaT > 1) {
    bits.push(`${n(m.divertedDeltaT)} t more material is placed`);
  } else if (m.divertedDeltaT < -1) {
    bits.push(`${n(m.divertedDeltaT)} t less material is placed, but at a higher carbon value`);
  }
  if (m.strandedDeltaT < -1) bits.push(`${n(m.strandedDeltaT)} t less is left stranded`);
  let s = bits.length > 0 ? `Re-optimising with this change, ${bits.join(" and ")}, lifting net carbon by ${n(m.carbonDeltaT)} tCO\u2082e.` : `Re-optimising with this change lifted net carbon by ${n(m.carbonDeltaT)} tCO\u2082e on the same tonnage, by routing it better.`;
  if (m.carbonPerAddedTonneT !== null) {
    s += ` That is ${n(m.carbonPerAddedTonneT, 3)} tCO\u2082e per additional tonne moved.`;
  }
  if (m.marginDeltaInr > 1e5) {
    s += ` Operating margin also rises by ${cr(m.marginDeltaInr)}, so carbon and economics agree here.`;
  } else if (m.marginDeltaInr < -1e5) {
    s += ` Operating margin falls by ${cr(m.marginDeltaInr)}, so this is a genuine trade-off rather than a free gain.`;
  }
  return s;
}
function findOpportunities(state, result) {
  const candidates = buildCandidates(state, result);
  const opportunities = [];
  const rejected = [];
  const before = networkLedger(
    result.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS
  );
  for (const c of candidates) {
    const t0 = Date.now();
    const run = runScenario(state, c.scenario, result.objective, result);
    const solveMs = Date.now() - t0;
    const m = measure(state, result, run.after);
    if (m.carbonDeltaT <= 1) {
      rejected.push({
        id: c.id,
        headline: c.headline,
        carbonDeltaT: m.carbonDeltaT,
        marginDeltaInr: m.marginDeltaInr,
        reason: m.carbonDeltaT < -1 ? `Measured by re-optimisation: this would cost ${Math.abs(m.carbonDeltaT).toLocaleString("en-IN", { maximumFractionDigits: 0 })} tCO\u2082e.` : "Measured by re-optimisation: no material carbon change."
      });
      continue;
    }
    opportunities.push({
      id: c.id,
      kind: c.kind,
      headline: c.headline,
      scenario: c.scenario,
      scenarioLabel: run.label,
      measure: m,
      why: composeWhy2(c, m),
      whyNotAlready: c.whyNotAlready,
      flowChanges: run.flowChanges.slice().sort((a, b) => Math.abs(b.carbonDeltaT) - Math.abs(a.carbonDeltaT)).slice(0, 6),
      facilityId: c.facilityId,
      solveMs
    });
  }
  opportunities.sort((a, b) => b.measure.carbonDeltaT - a.measure.carbonDeltaT);
  rejected.sort((a, b) => b.carbonDeltaT - a.carbonDeltaT);
  return {
    current: {
      carbonT: before.netT,
      marginInr: result.totals.marginInr,
      divertedT: result.totals.divertedT,
      strandedT: result.totals.strandedT,
      objective: result.objective
    },
    opportunities,
    rejected,
    candidatesTested: candidates.length,
    basis: `Every figure here is the difference between two full optimiser runs: the current plan, and the plan after the change was applied to a clone of the network. Nothing is extrapolated. Both sides are modelled estimates for one ${state.assumptions.windowDays}-day planning window \u2014 a modelled improvement, not a guaranteed reduction, and not a carbon credit.`
  };
}
function explainOpportunity(state, result, scenario) {
  const run = runScenario(state, scenario, result.objective, result);
  return { run, measure: measure(state, result, run.after) };
}

// packages/engine/src/trace.ts
function f2(input, value, unit, factor = null, factorSource = null, uncertaintyPct = null) {
  return { input, value, unit, factor, factorSource, uncertaintyPct, status: "modelled" };
}
function provenanceFor(agg, soilTempC, gridEfTPerMwh, biocharStream) {
  const out = {};
  if (agg.biocharCarbonT > 0) {
    out.char_gross = [
      f2("Biochar produced", agg.biocharT, "t"),
      f2("Carbon locked in char", agg.biocharCarbonT, "t C"),
      f2(
        "Molar mass ratio CO\u2082:C",
        CO2_PER_C,
        "ratio",
        "44.009 / 12.011",
        "Stoichiometric constant",
        0
      )
    ];
    if (biocharStream) {
      const perm = permanenceFor(biocharStream, soilTempC);
      out.char_permanence = [
        f2("H/C(org) molar ratio of char", perm.hcOrgRatio, "ratio"),
        f2("Mean annual soil temperature", perm.soilTempC, "\xB0C"),
        f2(
          "Q10 temperature correction",
          perm.fT,
          "rate multiplier",
          `Q10 = ${perm.q10}, referenced to ${perm.referenceTempC} \xB0C`,
          "Woolf et al. 2021 ES&T 55:14795",
          15
        ),
        f2(
          "Fraction remaining at 100 years (BC\u2081\u2080\u2080)",
          perm.bc100,
          "fraction",
          perm.method,
          "Azzi et al. 2024 Geoderma 441:116761",
          15
        )
      ];
    }
  }
  for (const key of Object.keys(agg.dryTByCounterfactual)) {
    const dryT = agg.dryTByCounterfactual[key];
    if (dryT <= 0.01) continue;
    const cf = COUNTERFACTUALS[key];
    out[`avoided_${key}`] = [
      f2("Dry matter diverted from this fate", dryT, "t DM"),
      f2(
        "Counterfactual emission factor",
        cf.tco2ePerTDry,
        "tCO\u2082e/t DM",
        cf.basis,
        cf.source,
        cf.uncertaintyPct
      )
    ];
  }
  if (agg.cbgKg > 0) {
    out.sub_cng = [
      f2("Bio-CNG delivered", agg.cbgKg, "kg"),
      f2(
        "Fossil CNG displaced",
        EF.cngDisplaced.value,
        EF.cngDisplaced.unit,
        EF.cngDisplaced.label,
        EF.cngDisplaced.source,
        EF.cngDisplaced.uncertaintyPct
      )
    ];
  }
  if (agg.coalDisplacedMj > 0) {
    out.sub_coal = [
      // GJ and MWh rather than MJ and kWh: the ledger's own basis string quotes
      // these scales, and a provenance row that contradicts the line above it is
      // worse than no provenance row.
      f2("Thermal energy delivered to the boiler", agg.coalDisplacedMj / 1e3, "GJ"),
      f2(
        "Coal emission factor",
        EF.coal.value,
        EF.coal.unit,
        EF.coal.label,
        EF.coal.source,
        EF.coal.uncertaintyPct
      )
    ];
  }
  if (agg.kwhExported > 0) {
    out.sub_power = [
      f2("Electricity exported to grid", agg.kwhExported / 1e3, "MWh"),
      f2(
        "Indian grid emission factor",
        gridEfTPerMwh,
        "tCO\u2082e/MWh",
        EF.gridElectricity.label,
        EF.gridElectricity.source,
        EF.gridElectricity.uncertaintyPct
      )
    ];
  }
  if (agg.fertiliserNKg > 0) {
    out.sub_fert = [
      f2("Plant-available nitrogen in product", agg.fertiliserNKg, "kg N"),
      f2(
        "Synthetic nitrogen displaced",
        EF.syntheticFertiliserN.value,
        EF.syntheticFertiliserN.unit,
        EF.syntheticFertiliserN.label,
        EF.syntheticFertiliserN.source,
        EF.syntheticFertiliserN.uncertaintyPct
      )
    ];
  }
  if (agg.transportDieselL > 0) {
    out.em_transport = [
      f2("Diesel burned, laden and empty return", agg.transportDieselL, "litres"),
      f2("Tonne-kilometres hauled", agg.tkm, "t\xB7km"),
      f2(
        "Diesel well-to-wheel",
        DIESEL_WTW_KG_PER_L,
        "kgCO\u2082e/litre",
        `${EF.dieselCombustion.value} combustion + ${EF.dieselUpstream.value} upstream`,
        EF.dieselCombustion.source,
        EF.dieselCombustion.uncertaintyPct
      ),
      f2(
        "Empty-return fuel ratio",
        EMPTY_RETURN_FUEL_RATIO,
        "of laden burn",
        "Return legs run empty; fuel burn does not fall to zero",
        "Modelling assumption, stated at point of use",
        null
      )
    ];
  }
  if (agg.aggregationT > 0) {
    out.em_aggregation = [
      f2("Feedstock requiring field aggregation", agg.aggregationT, "t"),
      f2(
        "Raking, baling and loading",
        EF.baling.value,
        EF.baling.unit,
        EF.baling.label,
        EF.baling.source,
        EF.baling.uncertaintyPct
      )
    ];
  }
  if (agg.kwhImported > 0) {
    out.em_parasitic = [
      f2("Process electricity drawn from grid", agg.kwhImported / 1e3, "MWh"),
      f2(
        "Indian grid emission factor",
        gridEfTPerMwh,
        "tCO\u2082e/MWh",
        EF.gridElectricity.label,
        EF.gridElectricity.source,
        EF.gridElectricity.uncertaintyPct
      )
    ];
  }
  if (agg.ch4SlipM3 > 0) {
    out.em_ch4_slip = [
      f2("Fugitive methane from digester", agg.ch4SlipM3, "m\xB3 CH\u2084"),
      f2(
        "CH\u2084 global warming potential",
        EF.ch4Gwp.value,
        EF.ch4Gwp.unit,
        EF.ch4Gwp.label,
        EF.ch4Gwp.source,
        EF.ch4Gwp.uncertaintyPct
      )
    ];
  }
  if (agg.compostCh4T > 0 || agg.compostN2oT > 0) {
    out.em_compost = [
      f2("Direct CH\u2084 from windrow", agg.compostCh4T, "t CH\u2084"),
      f2("Direct N\u2082O from windrow", agg.compostN2oT, "t N\u2082O"),
      f2(
        "CH\u2084 / N\u2082O global warming potential",
        EF.ch4Gwp.value,
        `${EF.ch4Gwp.unit} / ${EF.n2oGwp.value}`,
        "AR6 GWP\u2081\u2080\u2080, turned-windrow rates rather than the static-pile default",
        EF.ch4Gwp.source,
        EF.ch4Gwp.uncertaintyPct
      )
    ];
  }
  return out;
}
function traceCandidates(state, result, limit = 40) {
  const srcName = new Map(state.sources.map((s) => [s.id, s.name]));
  const facName = new Map(state.facilities.map((x) => [x.id, x.name]));
  const netTotal = Math.abs(
    networkLedger(
      result.allocations,
      state.facilities,
      state.vehicles,
      state.assumptions,
      OWN_BASIS
    ).netT
  ) || 1;
  const dominant = dominantBiocharStream(result.allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  const ledgerNetFor = (a) => buildLedger(
    aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
    state.assumptions,
    permanence,
    false
  ).netT;
  return result.allocations.map((a) => ({
    key: `${a.sourceId}::${a.facilityId}`,
    sourceId: a.sourceId,
    sourceName: srcName.get(a.sourceId) ?? a.sourceId,
    facilityId: a.facilityId,
    facilityName: facName.get(a.facilityId) ?? a.facilityId,
    stream: a.stream,
    streamLabel: STREAMS[a.stream].label,
    pathway: a.pathway,
    pathwayLabel: PATHWAYS[a.pathway].short,
    tonnes: a.tonnes,
    distanceKm: a.distanceKm,
    netCarbonT: ledgerNetFor(a),
    sharePct: ledgerNetFor(a) / netTotal * 100
  })).sort((x, y) => Math.abs(y.netCarbonT) - Math.abs(x.netCarbonT)).slice(0, limit);
}
function traceAllocation(state, result, sourceId, facilityId) {
  const a = result.allocations.find(
    (x) => x.sourceId === sourceId && x.facilityId === facilityId
  );
  if (!a) return null;
  const source = state.sources.find((s) => s.id === sourceId);
  const facility = state.facilities.find((x) => x.id === facilityId);
  const vehicle = VEHICLE_BY_ID[a.vehicleId];
  if (!source || !facility || !vehicle) return null;
  const stream = STREAMS[a.stream];
  const pathway = PATHWAYS[a.pathway];
  const perTonne = physicalPerTonne(
    a.stream,
    a.pathway,
    facility.efficiency,
    a.distanceKm,
    a.payloadT,
    vehicle
  );
  const agg = emptyAggregate();
  addToAggregate(agg, perTonne, a.tonnes);
  const biocharStream = dominantBiocharStream(result.allocations);
  const permanence = biocharStream ? permanenceFor(biocharStream, state.assumptions.soilTempC) : null;
  const ledger = buildLedger(agg, state.assumptions, permanence, false);
  const provenance = provenanceFor(
    agg,
    state.assumptions.soilTempC,
    state.assumptions.gridEfTPerMwh,
    biocharStream
  );
  const straightKm = haversineKm(source, facility);
  const cf = COUNTERFACTUALS[perTonne.counterfactual];
  const netTotal = Math.abs(
    networkLedger(
      result.allocations,
      state.facilities,
      state.vehicles,
      state.assumptions,
      OWN_BASIS
    ).netT
  ) || 1;
  const stages = buildStages(a, stream.label, facility.name, pathway.short, perTonne, ledger, cf.label);
  return {
    key: `${a.sourceId}::${a.facilityId}`,
    sourceId,
    sourceName: source.name,
    facilityId,
    facilityName: facility.name,
    stream: a.stream,
    streamLabel: stream.label,
    pathway: a.pathway,
    pathwayLabel: pathway.short,
    tonnes: a.tonnes,
    distanceKm: a.distanceKm,
    netCarbonT: a.netCarbonT,
    sharePct: a.netCarbonT / netTotal * 100,
    allocation: a,
    source: {
      id: source.id,
      name: source.name,
      district: source.district,
      state: source.state,
      lat: source.lat,
      lon: source.lon,
      availableT: source.availableT,
      telemetryAgeH: source.telemetryAgeH,
      access: source.access
    },
    facility: {
      id: facility.id,
      name: facility.name,
      operator: facility.operator,
      district: facility.district,
      lat: facility.lat,
      lon: facility.lon,
      capacityTpd: facility.capacityTpd,
      efficiency: facility.efficiency,
      powerSource: facility.powerSource,
      commissioned: facility.commissioned
    },
    vehicle: { id: vehicle.id, label: vehicle.label, payloadT: a.payloadT, trips: a.trips },
    route: {
      roadKm: a.distanceKm,
      straightKm,
      circuity: straightKm > 0 ? a.distanceKm / straightKm : 1,
      tkm: a.tkm,
      dieselL: perTonne.transportDieselL * a.tonnes
    },
    pathwayDef: {
      id: pathway.id,
      label: pathway.label,
      short: pathway.short,
      maturity: pathway.maturity,
      producesDurableRemoval: pathway.producesDurableRemoval
    },
    counterfactual: {
      id: cf.id,
      label: cf.label,
      basis: cf.basis,
      source: cf.source
    },
    perTonne,
    ledger,
    provenance,
    stages,
    why: composeWhy3(a, stream.label, facility.name, pathway.short, ledger, cf.label)
  };
}
function buildStages(a, streamLabel, facilityName, pathwayShort, phys, ledger, counterfactualLabel) {
  const line = (key) => ledger.lines.find((l) => l.key === key)?.valueT ?? 0;
  const sum = (pred) => ledger.lines.filter((l) => pred(l.key)).reduce((x, l) => x + l.valueT, 0);
  const avoided = sum((k) => k.startsWith("avoided_"));
  const substitution = sum((k) => k.startsWith("sub_"));
  const removal = line("char_gross");
  const permanence = line("char_permanence");
  const transport = line("em_transport") + line("em_aggregation");
  const processing = sum(
    (k) => k.startsWith("em_") && k !== "em_transport" && k !== "em_aggregation"
  );
  const t1 = (v) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
  const stages = [
    {
      key: "waste",
      label: "Waste",
      headline: `${t1(a.tonnes)} t ${streamLabel.toLowerCase()}`,
      detail: `${t1(phys.dryT * a.tonnes)} t dry matter after moisture`,
      carbonT: null,
      carbonLabel: null,
      kind: null
    },
    {
      key: "source",
      // The avoided credit is booked here because collection is the act that
      // causes it: the material stops being burned the moment it is taken. The
      // raking and baling emission is NOT described here — it is charged under
      // transport, and a stage must not narrate a cost it does not carry.
      label: "Collection",
      headline: `Diverted from ${counterfactualLabel.toLowerCase()}`,
      detail: `${t1(phys.dryT * a.tonnes)} t dry matter that would otherwise have met that fate`,
      carbonT: avoided !== 0 ? avoided : null,
      carbonLabel: avoided !== 0 ? `Avoided: ${counterfactualLabel.toLowerCase()}` : null,
      kind: avoided !== 0 ? "avoided" : null
    },
    {
      key: "route",
      label: "Transport",
      headline: `${t1(a.distanceKm)} km \xB7 ${a.trips} trips`,
      detail: `${t1(a.payloadT)} t per load, ${t1(phys.transportDieselL * a.tonnes)} L diesel including empty returns`,
      carbonT: transport !== 0 ? transport : null,
      carbonLabel: transport !== 0 ? "Transport and aggregation emissions" : null,
      kind: transport !== 0 ? "emission" : null
    },
    {
      key: "facility",
      label: "Facility",
      headline: facilityName,
      detail: `Receives the load and runs it through the ${pathwayShort.toLowerCase()} line`,
      carbonT: null,
      carbonLabel: null,
      kind: null
    },
    {
      key: "pathway",
      label: "Pathway",
      headline: pathwayShort,
      detail: productDetail(phys),
      carbonT: substitution !== 0 ? substitution : null,
      carbonLabel: substitution !== 0 ? "Fossil energy and fertiliser displaced" : null,
      kind: substitution !== 0 ? "substitution" : null
    },
    {
      key: "processing",
      label: "Processing",
      headline: processing !== 0 ? "Plant emissions booked" : "No plant emissions",
      detail: processing !== 0 ? "Parasitic grid draw, digester slip and windrow losses" : "This pathway draws no grid power and vents no process gas",
      carbonT: processing !== 0 ? processing : null,
      carbonLabel: processing !== 0 ? "Processing emissions" : null,
      kind: processing !== 0 ? "emission" : null
    },
    {
      key: "outcome",
      label: "Carbon outcome",
      headline: `${t1(ledger.netT)} tCO\u2082e net`,
      detail: removal > 0 ? `${t1(removal)} tCO\u2082e fixed in char, ${t1(Math.abs(permanence))} written back for 100-year permanence` : "No durable removal on this pathway; the benefit is avoidance and displacement",
      carbonT: removal > 0 ? removal + permanence : null,
      carbonLabel: removal > 0 ? "Durable removal after permanence" : null,
      kind: removal > 0 ? "removal" : null
    }
  ];
  return stages;
}
function productDetail(phys) {
  const bits = [];
  const n = (v, dp = 1) => v.toLocaleString("en-IN", { maximumFractionDigits: dp });
  if (phys.biocharT > 0) bits.push(`${n(phys.biocharT * 1e3, 0)} kg biochar per tonne`);
  if (phys.cbgKg > 0) bits.push(`${n(phys.cbgKg)} kg bio-CNG per tonne`);
  if (phys.coalDisplacedMj > 0) bits.push(`${n(phys.coalDisplacedMj, 0)} MJ to the boiler per tonne`);
  if (phys.netKwh > 0) bits.push(`${n(phys.netKwh)} kWh exported per tonne`);
  if (phys.compostT > 0) bits.push(`${n(phys.compostT * 1e3, 0)} kg compost per tonne`);
  if (phys.digestateT > 0) bits.push(`${n(phys.digestateT * 1e3, 0)} kg digestate per tonne`);
  return bits.length ? bits.join(" \xB7 ") : "No saleable product recorded for this pathway";
}
function composeWhy3(a, streamLabel, facilityName, pathwayShort, ledger, counterfactualLabel) {
  const n = (v) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });
  const benefits = ledger.lines.filter((l) => l.valueT > 0 && l.kind !== "total");
  const charges = ledger.lines.filter((l) => l.valueT < 0 && l.kind !== "total");
  benefits.sort((x, y) => y.valueT - x.valueT);
  charges.sort((x, y) => x.valueT - y.valueT);
  const lead = benefits[0];
  const charge = charges[0];
  let s = `${n(a.tonnes)} t of ${streamLabel.toLowerCase()} travelled ${n(a.distanceKm)} km to ${facilityName} and was processed via ${pathwayShort.toLowerCase()}, giving ${n(ledger.netT)} tCO\u2082e net.`;
  if (lead) {
    s += ` Most of the benefit \u2014 ${n(lead.valueT)} tCO\u2082e \u2014 comes from ${lead.label.toLowerCase()}`;
    if (lead.key.startsWith("avoided_")) {
      s += `, because the material would otherwise have gone to ${counterfactualLabel.toLowerCase()}`;
    }
    s += ".";
  }
  if (charge) {
    s += ` Against that, ${n(charge.valueT)} tCO\u2082e is charged for ${charge.label.toLowerCase()}`;
    if (charge.key === "em_transport") s += `, which is what the ${n(a.distanceKm)} km haul costs`;
    s += ".";
  }
  return s;
}

// packages/engine/src/evidence.ts
function classify2(row) {
  if (!row.factor) return "derived";
  const src = row.factorSource ?? "";
  if (!src) return "derived";
  if (/assumption|configuration|stated at point of use/i.test(src)) return "assumption";
  return "referenced";
}
function emptyBasisCount() {
  return { referenced: 0, assumption: 0, derived: 0 };
}
function evidenceRegister(state, result, ledger) {
  const dominant = dominantBiocharStream(result.allocations);
  const agg = aggregateAllocations(
    result.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions
  );
  const provenance = provenanceFor(
    agg,
    state.assumptions.soilTempC,
    state.assumptions.gridEfTPerMwh,
    dominant
  );
  const counts = /* @__PURE__ */ new Map();
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  for (const a of result.allocations) {
    const one = buildLedger(
      aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
      state.assumptions,
      permanence,
      false
    );
    for (const l of one.lines) {
      if (l.kind === "total" || Math.abs(l.valueT) < 1e-9) continue;
      counts.set(l.key, (counts.get(l.key) ?? 0) + 1);
    }
  }
  return ledger.lines.filter((l) => l.kind !== "total").map((l) => {
    const rows = provenance[l.key] ?? [];
    const inputs = rows.map((r) => ({ ...r, basis: classify2(r) }));
    const inputsByBasis = emptyBasisCount();
    for (const i of inputs) inputsByBasis[i.basis]++;
    return {
      key: l.key,
      label: l.label,
      valueT: l.valueT,
      unit: "tCO\u2082e",
      kind: l.kind,
      // Every figure this engine produces is a model output. There is no
      // measured observation anywhere in the dataset, and this is the one
      // place that must never round that statement off.
      status: "modelled",
      calculation: l.basis,
      source: l.source,
      uncertaintyPct: l.uncertaintyPct,
      inputs,
      inputsByBasis,
      hasProvenance: inputs.length > 0,
      contributorCount: counts.get(l.key) ?? 0
    };
  });
}
function evidenceHealth(records) {
  const byStatus = {
    measured: 0,
    estimated: 0,
    modelled: 0,
    missing: 0
  };
  const inputsByBasis = emptyBasisCount();
  let inputsTotal = 0;
  for (const r of records) {
    byStatus[r.status]++;
    for (const i of r.inputs) {
      inputsByBasis[i.basis]++;
      inputsTotal++;
    }
  }
  const withoutProvenance = records.filter((r) => !r.hasProvenance).map((r) => r.key);
  byStatus.missing = withoutProvenance.length;
  const plural = (n, one, many) => n === 1 ? one : many;
  const statement = `All ${records.length} carbon figures in the current plan are model outputs. None is a measurement: this network's supply, routing and conversion are generated, so there is no observed emission anywhere in the dataset to report. Of the ${inputsTotal} inputs behind them, ${inputsByBasis.referenced} ${plural(inputsByBasis.referenced, "applies", "apply")} a factor with a published citation, ${inputsByBasis.assumption} ${plural(inputsByBasis.assumption, "is a modelling assumption", "are modelling assumptions")} stated at the point of use, and ${inputsByBasis.derived} ${plural(inputsByBasis.derived, "is a quantity", "are quantities")} the network model itself produced.`;
  const gapStatement = withoutProvenance.length === 0 ? `Every ledger line the plan produced has its inputs recorded. Note that this checks provenance coverage, not data quality \u2014 the network has no missing-input model, because every quantity in it is generated rather than collected. A real deployment would need one, and its absence is a property of this dataset rather than a clean bill of health.` : `${withoutProvenance.length} ledger line${withoutProvenance.length > 1 ? "s" : ""} (${withoutProvenance.join(", ")}) produced a value with no recorded inputs. The calculation basis is still shown, but the itemised breakdown is absent.`;
  return {
    totalRecords: records.length,
    byStatus,
    inputsTotal,
    inputsByBasis,
    linesWithoutProvenance: withoutProvenance,
    statement,
    gapStatement
  };
}
function lineContributors(state, result, lineKey) {
  const dominant = dominantBiocharStream(result.allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  const srcById = new Map(state.sources.map((s) => [s.id, s]));
  const facById = new Map(state.facilities.map((f3) => [f3.id, f3]));
  const rows = [];
  for (const a of result.allocations) {
    const one = buildLedger(
      aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
      state.assumptions,
      permanence,
      false
    );
    const line = one.lines.find((l) => l.key === lineKey);
    if (!line || Math.abs(line.valueT) < 1e-9) continue;
    rows.push({
      sourceId: a.sourceId,
      sourceName: srcById.get(a.sourceId)?.name ?? a.sourceId,
      facilityId: a.facilityId,
      facilityName: facById.get(a.facilityId)?.name ?? a.facilityId,
      stream: a.stream,
      streamLabel: STREAMS[a.stream].label,
      pathway: a.pathway,
      pathwayShort: PATHWAYS[a.pathway].short,
      tonnes: a.tonnes,
      distanceKm: a.distanceKm,
      valueT: line.valueT,
      sharePct: 0
    });
  }
  const total = rows.reduce((x, r) => x + r.valueT, 0);
  for (const r of rows) r.sharePct = total !== 0 ? r.valueT / total * 100 : 0;
  rows.sort((x, y) => Math.abs(y.valueT) - Math.abs(x.valueT));
  return rows;
}
function modelBasis(state, result, version) {
  return {
    windowDays: state.assumptions.windowDays,
    asOf: state.asOf,
    version,
    objective: result.objective,
    suppliedT: result.totals.suppliedT,
    divertedT: result.totals.divertedT,
    strandedT: result.totals.strandedT,
    facilitiesOnline: state.facilities.filter((f3) => f3.status === "online").length,
    facilitiesTotal: state.facilities.length,
    sourceCount: state.sources.length,
    assumptions: state.assumptions,
    supplyBasis: `Planning-window availability per source, generated from the crop calendar with a seeded weather shock. Not collected from the field.`,
    estateBasis: `The facility estate as currently configured, including any scenario mutations applied to this twin.`,
    resultBasis: `A forward-looking modelled estimate for one ${state.assumptions.windowDays}-day planning window. Not measured historical emissions, not verified, and not a carbon credit.`
  };
}

// packages/engine/src/facility.ts
function windowCapacityT(f3, windowDays) {
  return f3.capacityTpd * f3.availability * windowDays;
}
function ledgerForFacility(state, allocations, networkDominant) {
  const agg = aggregateAllocations(allocations, state.facilities, state.vehicles, state.assumptions);
  const permanence = networkDominant ? permanenceFor(networkDominant, state.assumptions.soilTempC) : null;
  return buildLedger(agg, state.assumptions, permanence, false);
}
function splitEmissions(ledger) {
  const sum = (pred) => ledger.lines.filter((l) => pred(l.key)).reduce((a, l) => a + l.valueT, 0);
  return {
    // Reported positive: these are charges, and a negative "charge" reads wrong.
    transportT: -sum((k) => k === "em_transport" || k === "em_aggregation"),
    processT: -sum((k) => k.startsWith("em_") && k !== "em_transport" && k !== "em_aggregation"),
    adjustmentT: -sum((k) => k === "char_permanence"),
    grossBenefitT: ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT
  };
}
function facilityRanking(state, result) {
  const dominant = dominantBiocharStream(result.allocations);
  const netTotal = Math.abs(
    networkLedger(
      result.allocations,
      state.facilities,
      state.vehicles,
      state.assumptions,
      OWN_BASIS
    ).netT
  ) || 1;
  return state.facilities.map((f3) => {
    const mine = result.allocations.filter((a) => a.facilityId === f3.id);
    const ledger = ledgerForFacility(state, mine, dominant);
    const received = mine.reduce((a, x) => a + x.tonnes, 0);
    const capacityT = windowCapacityT(f3, state.assumptions.windowDays);
    const split = splitEmissions(ledger);
    const tkm = mine.reduce((a, x) => a + x.tkm, 0);
    return {
      id: f3.id,
      name: f3.name,
      district: f3.district,
      status: f3.status,
      pathwayShort: PATHWAYS[f3.pathway].short,
      receivedT: received,
      capacityT,
      utilisationPct: capacityT > 0 ? received / capacityT * 100 : 0,
      netT: ledger.netT,
      perTonneT: received > 0 ? ledger.netT / received : 0,
      grossBenefitT: split.grossBenefitT,
      transportT: split.transportT,
      processT: split.processT,
      sharePct: ledger.netT / netTotal * 100,
      sourceCount: mine.length,
      meanHaulKm: received > 0 ? tkm / received : 0
    };
  }).sort((a, b) => b.netT - a.netT);
}
function facilityCarbon(state, result, facilityId, stranded = []) {
  const f3 = state.facilities.find((x) => x.id === facilityId);
  if (!f3) return null;
  const dominant = dominantBiocharStream(result.allocations);
  const mine = result.allocations.filter((a) => a.facilityId === facilityId);
  const ledger = ledgerForFacility(state, mine, dominant);
  const split = splitEmissions(ledger);
  const receivedT = mine.reduce((a, x) => a + x.tonnes, 0);
  const capacityT = windowCapacityT(f3, state.assumptions.windowDays);
  const netTotal = Math.abs(
    networkLedger(
      result.allocations,
      state.facilities,
      state.vehicles,
      state.assumptions,
      OWN_BASIS
    ).netT
  ) || 1;
  const srcById = new Map(state.sources.map((s) => [s.id, s]));
  const facNet = ledger.netT || 1;
  const totalTkm = mine.reduce((a, x) => a + x.tkm, 0) || 1;
  const arcs = mine.map((a) => {
    const s = srcById.get(a.sourceId);
    const arcLedger = ledgerForFacility(state, [a], dominant);
    return {
      sourceId: a.sourceId,
      sourceName: s?.name ?? a.sourceId,
      district: s?.district ?? "\u2014",
      lat: s?.lat ?? 0,
      lon: s?.lon ?? 0,
      stream: a.stream,
      streamLabel: STREAMS[a.stream].label,
      tonnes: a.tonnes,
      distanceKm: a.distanceKm,
      vehicleId: a.vehicleId,
      trips: a.trips,
      netCarbonT: arcLedger.netT,
      carbonPerT: a.tonnes > 0 ? arcLedger.netT / a.tonnes : 0,
      transportT: split.transportT * (a.tkm / totalTkm),
      sharePct: arcLedger.netT / facNet * 100
    };
  }).sort((x, y) => y.netCarbonT - x.netCarbonT);
  const byStream = /* @__PURE__ */ new Map();
  for (const a of mine) byStream.set(a.stream, (byStream.get(a.stream) ?? 0) + a.tonnes);
  const shadow = result.shadowPrices.find((s) => s.facilityId === facilityId) ?? null;
  const headroomT = Math.max(0, capacityT - receivedT);
  const profile = {
    id: f3.id,
    name: f3.name,
    operator: f3.operator,
    district: f3.district,
    state: f3.state,
    lat: f3.lat,
    lon: f3.lon,
    status: f3.status,
    pathway: f3.pathway,
    pathwayLabel: PATHWAYS[f3.pathway].label,
    pathwayShort: PATHWAYS[f3.pathway].short,
    producesDurableRemoval: PATHWAYS[f3.pathway].producesDurableRemoval,
    powerSource: f3.powerSource,
    commissioned: f3.commissioned,
    efficiency: f3.efficiency,
    capacityTpd: f3.capacityTpd,
    capacityT,
    receivedT,
    utilisationPct: capacityT > 0 ? receivedT / capacityT * 100 : 0,
    headroomT,
    ledger,
    netT: ledger.netT,
    perTonneT: receivedT > 0 ? ledger.netT / receivedT : 0,
    grossBenefitT: split.grossBenefitT,
    transportT: split.transportT,
    processT: split.processT,
    adjustmentT: split.adjustmentT,
    sharePct: ledger.netT / netTotal * 100,
    arcs,
    streams: [...byStream.entries()].map(([stream, tonnes]) => ({ stream, label: STREAMS[stream].label, tonnes })).sort((a, b) => b.tonnes - a.tonnes),
    shadow,
    why: "",
    opportunities: []
  };
  profile.why = composeWhy4(profile, state, result);
  profile.opportunities = findOpportunities2(profile, state, result, stranded);
  return profile;
}
function composeWhy4(p, state, result) {
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  if (p.status !== "online") {
    return `${p.name} is ${p.status.replace(/_/g, " ")} and received nothing this window, so it contributes no carbon either way.`;
  }
  if (p.receivedT <= 0) {
    return `${p.name} is online but received no material this window, so it contributes nothing to the net figure. The optimiser found better destinations for everything within its catchment.`;
  }
  const networkPerT = result.totals.divertedT > 0 ? networkLedger(
    result.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS
  ).netT / result.totals.divertedT : 0;
  const better = p.perTonneT >= networkPerT;
  const gap = Math.abs(p.perTonneT - networkPerT);
  let s = `${p.name} turns ${n(p.receivedT)} t into ${n(p.netT)} tCO\u2082e \u2014 ${n(p.perTonneT, 3)} per tonne, ${n(gap, 3)} ${better ? "above" : "below"} the network average of ${n(networkPerT, 3)}.`;
  const charges = p.transportT + p.processT;
  const chargeShare = p.grossBenefitT > 0 ? charges / p.grossBenefitT * 100 : 0;
  const meanHaul = p.receivedT > 0 ? p.arcs.reduce((a, x) => a + x.distanceKm * x.tonnes, 0) / p.receivedT : 0;
  const networkHaul = result.totals.divertedT > 0 ? result.totals.tkm / result.totals.divertedT : 0;
  if (p.transportT > p.processT * 1.5 && meanHaul > networkHaul * 1.15) {
    s += ` Transport is the dominant charge here: material travels ${n(meanHaul)} km on average against a network mean of ${n(networkHaul)} km, costing ${n(p.transportT)} tCO\u2082e.`;
  } else if (p.processT > p.transportT * 1.5) {
    s += ` Processing rather than haulage is the dominant charge, at ${n(p.processT)} tCO\u2082e against ${n(p.transportT)} tCO\u2082e for transport.`;
  } else if (chargeShare < 8 && p.grossBenefitT > 0) {
    s += ` Its charges are light \u2014 transport and processing together consume only ${n(chargeShare, 1)}% of the gross benefit.`;
  }
  if (p.producesDurableRemoval && p.ledger.durableRemovalT > 0) {
    s += ` It is one of the plants producing durable removal, ${n(p.ledger.durableRemovalT)} tCO\u2082e after the permanence adjustment.`;
  }
  return s;
}
function findOpportunities2(p, state, result, stranded) {
  const out = [];
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  if (p.status !== "online") return out;
  if (p.headroomT > 1 && stranded.length > 0) {
    const arcSet = buildArcs(state);
    const strandedIds = new Map(stranded.map((s) => [s.sourceId, s]));
    const reachable = arcSet.arcs.filter((a) => a.facilityId === p.id && strandedIds.has(a.sourceId) && a.netCarbonPerT > 0).map((a) => ({ arc: a, lot: strandedIds.get(a.sourceId) })).sort((x, y) => y.arc.netCarbonPerT - x.arc.netCarbonPerT);
    if (reachable.length > 0) {
      let remaining = p.headroomT;
      let gained = 0;
      let moved = 0;
      const names = [];
      for (const r of reachable) {
        if (remaining <= 1) break;
        const take = Math.min(remaining, r.lot.tonnes);
        if (take <= 1) continue;
        gained += take * r.arc.netCarbonPerT;
        moved += take;
        remaining -= take;
        if (names.length < 3) names.push(r.lot.name);
      }
      if (moved > 1) {
        out.push({
          kind: "idle_capacity",
          what: `Fill ${n(moved)} t of idle capacity from stranded material`,
          why: `${n(p.headroomT)} t of this plant's window capacity is unused, and ${n(moved)} t of stranded feedstock at ${names.join(", ")} has a feasible route here. The optimiser left it unplaced under the ${result.objective.replace(/_/g, " ")} objective, which weighs margin as well as carbon \u2014 re-solving on Carbon First is what would test whether it takes it.`,
          carbonDeltaT: gained,
          tonnes: moved,
          action: "objective",
          actionLabel: "Re-solve on Carbon First"
        });
      }
    }
  }
  if (p.shadow?.binding && p.shadow.carbonPerExtraTonne > 0) {
    const extraTpd = 10;
    const extraT = extraTpd * state.assumptions.windowDays;
    out.push({
      kind: "binding_capacity",
      what: `Add ${extraTpd} t/day of throughput`,
      why: `Capacity here is binding at ${n(p.utilisationPct, 0)}% utilisation. The marginal value of one more tonne was measured by re-optimising the whole network with the constraint relaxed, not inferred from this plant's average.`,
      carbonDeltaT: p.shadow.carbonPerExtraTonne * extraT,
      tonnes: extraT,
      action: "simulate",
      actionLabel: "Simulate in Scenarios"
    });
  }
  return out.sort((a, b) => b.carbonDeltaT - a.carbonDeltaT);
}
function compareFacilities(state, result, aId, bId) {
  const a = facilityCarbon(state, result, aId);
  const b = facilityCarbon(state, result, bId);
  if (!a || !b) return null;
  const meanHaul = (p) => p.receivedT > 0 ? p.arcs.reduce((x, r) => x + r.distanceKm * r.tonnes, 0) / p.receivedT : 0;
  const rows = [
    { key: "net", label: "Net carbon", unit: "tCO\u2082e", a: a.netT, b: b.netT, higherIsBetter: true },
    { key: "perT", label: "Carbon per tonne", unit: "tCO\u2082e/t", a: a.perTonneT, b: b.perTonneT, higherIsBetter: true },
    { key: "received", label: "Tonnes processed", unit: "t", a: a.receivedT, b: b.receivedT, higherIsBetter: true },
    { key: "gross", label: "Gross benefit", unit: "tCO\u2082e", a: a.grossBenefitT, b: b.grossBenefitT, higherIsBetter: true },
    { key: "transport", label: "Transport emissions", unit: "tCO\u2082e", a: a.transportT, b: b.transportT, higherIsBetter: false },
    { key: "process", label: "Processing emissions", unit: "tCO\u2082e", a: a.processT, b: b.processT, higherIsBetter: false },
    { key: "haul", label: "Mean haul", unit: "km", a: meanHaul(a), b: meanHaul(b), higherIsBetter: false },
    { key: "util", label: "Utilisation", unit: "%", a: a.utilisationPct, b: b.utilisationPct, higherIsBetter: true }
  ];
  const arcSet = buildArcs(state);
  const aArcs = new Map(arcSet.arcs.filter((x) => x.facilityId === aId).map((x) => [x.sourceId, x]));
  const bArcs = new Map(arcSet.arcs.filter((x) => x.facilityId === bId).map((x) => [x.sourceId, x]));
  const shared = [];
  for (const [sid, ax] of aArcs) {
    const bx = bArcs.get(sid);
    if (!bx) continue;
    const src = state.sources.find((s) => s.id === sid);
    shared.push({
      sourceId: sid,
      name: src?.name ?? sid,
      aPerT: ax.netCarbonPerT,
      bPerT: bx.netCarbonPerT,
      aKm: ax.distanceKm,
      bKm: bx.distanceKm
    });
  }
  shared.sort((x, y) => Math.abs((y.bPerT ?? 0) - (y.aPerT ?? 0)) - Math.abs((x.bPerT ?? 0) - (x.aPerT ?? 0)));
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  let summary;
  if (a.receivedT === 0 || b.receivedT === 0) {
    const idle = a.receivedT === 0 ? a : b;
    summary = `${idle.name} received nothing this window, so only its capacity and reachability can be compared \u2014 there is no carbon result to set against ${(idle === a ? b : a).name}.`;
  } else {
    const lead = a.perTonneT >= b.perTonneT ? a : b;
    const other = lead === a ? b : a;
    summary = `${lead.name} returns ${n(lead.perTonneT, 3)} tCO\u2082e per tonne against ${n(other.perTonneT, 3)} at ${other.name}.`;
    const haulGap = meanHaul(other) - meanHaul(lead);
    const procGap = (other.receivedT > 0 ? other.processT / other.receivedT : 0) - (lead.receivedT > 0 ? lead.processT / lead.receivedT : 0);
    if (Math.abs(haulGap) > 5 && haulGap > 0) {
      summary += ` Material reaching ${lead.name} travels ${n(haulGap)} km less on average.`;
    } else if (procGap > 1e-4) {
      summary += ` ${other.name} carries the heavier processing charge, ${n(procGap, 3)} tCO\u2082e more per tonne.`;
    } else if (lead.pathwayShort !== other.pathwayShort) {
      summary += ` They run different pathways \u2014 ${lead.pathwayShort} against ${other.pathwayShort} \u2014 so the difference is conversion chemistry rather than logistics.`;
    }
    if (shared.length > 0) {
      summary += ` ${shared.length} source${shared.length > 1 ? "s" : ""} can reach both, so the two can be compared arc for arc below.`;
    }
  }
  return {
    a: { id: a.id, name: a.name, pathwayShort: a.pathwayShort },
    b: { id: b.id, name: b.name, pathwayShort: b.pathwayShort },
    rows,
    sharedSources: shared.slice(0, 8),
    summary
  };
}

// packages/engine/src/pathwaychoice.ts
function materialCandidates(state) {
  return state.sources.map((s) => ({
    id: s.id,
    name: s.name,
    district: s.district,
    stream: s.stream,
    streamLabel: STREAMS[s.stream].label,
    availableT: s.availableT
  })).sort((a, b) => b.availableT - a.availableT);
}
function unavailableReason(state, sourceId, pathway, stream) {
  const src = state.sources.find((s) => s.id === sourceId);
  const sites = state.facilities.filter((f3) => f3.pathway === pathway);
  if (sites.length === 0) return `The network operates no ${PATHWAYS[pathway].short.toLowerCase()} plant.`;
  const online = sites.filter((f3) => f3.status === "online");
  if (online.length === 0) {
    return `All ${sites.length} ${PATHWAYS[pathway].short.toLowerCase()} plants are offline or under maintenance.`;
  }
  const accepting = online.filter((f3) => f3.acceptedStreams.includes(stream));
  if (accepting.length === 0) {
    return `No operating ${PATHWAYS[pathway].short.toLowerCase()} plant is permitted to accept ${STREAMS[stream].label.toLowerCase()}.`;
  }
  const inRange = accepting.filter(
    (f3) => roadDistanceKm(src, f3, state.assumptions.circuityFactor, src.access) <= state.assumptions.maxHaulKm
  );
  if (inRange.length === 0) {
    const nearest = Math.min(
      ...accepting.map(
        (f3) => roadDistanceKm(src, f3, state.assumptions.circuityFactor, src.access)
      )
    );
    return `The nearest accepting plant is ${nearest.toFixed(0)} km away, beyond the ${state.assumptions.maxHaulKm} km maximum haul.`;
  }
  const blocked = new Set(state.blockedArcs.map((b) => `${b.sourceId}>${b.facilityId}`));
  if (inRange.every((f3) => blocked.has(`${sourceId}>${f3.id}`))) {
    return "Every route to an accepting plant is currently blocked.";
  }
  if (!selectVehicle(src, 1, state.vehicles, state)) {
    return `No vehicle in the fleet is permitted on this site's ${src.access.replace(/_/g, " ")} access road.`;
  }
  return "No feasible route to an accepting plant in the current network.";
}
function pathwayDecision(state, result, sourceId, lens) {
  const src = state.sources.find((s) => s.id === sourceId);
  if (!src) return null;
  const stream = STREAMS[src.stream];
  const arcSet = buildArcs(state);
  const scale = objectiveScale(arcSet.arcs);
  const committed = /* @__PURE__ */ new Map();
  for (const a of result.allocations) {
    committed.set(a.facilityId, (committed.get(a.facilityId) ?? 0) + a.tonnes);
  }
  const mine = [];
  arcSet.arcs.forEach((arc, index) => {
    if (arc.sourceId === sourceId) mine.push({ arc, index });
  });
  const options = [];
  for (const pid of PATHWAY_IDS) {
    const def = PATHWAYS[pid];
    const suit = suitability(stream, def);
    const failed = suit.gates.find((g) => !g.pass);
    const base = {
      pathway: pid,
      label: def.label,
      short: def.short,
      maturity: def.maturity,
      producesDurableRemoval: def.producesDurableRemoval,
      feasible: suit.feasible,
      gates: suit.gates,
      blockedBy: suit.feasible ? null : failed ? `${failed.gate}: ${failed.detail}` : suit.limitingFactor,
      suitability: suit.score,
      inPlanT: result.allocations.filter((a) => a.sourceId === sourceId && a.pathway === pid).reduce((x, a) => x + a.tonnes, 0)
    };
    if (!suit.feasible) {
      options.push({
        ...base,
        unavailableReason: null,
        facility: null,
        route: null,
        perT: null,
        ledger: null,
        econ: null
      });
      continue;
    }
    const forPathway = mine.filter((m) => m.arc.pathway === pid);
    if (forPathway.length === 0) {
      options.push({
        ...base,
        unavailableReason: unavailableReason(state, sourceId, pid, src.stream),
        facility: null,
        route: null,
        perT: null,
        ledger: null,
        econ: null
      });
      continue;
    }
    let best = forPathway[0];
    let bestScore = arcValue(best.arc, lens, scale);
    for (const m of forPathway.slice(1)) {
      const v = arcValue(m.arc, lens, scale);
      if (v > bestScore) {
        best = m;
        bestScore = v;
      }
    }
    const arc = best.arc;
    const phys = arcSet.physical[best.index];
    const fac = state.facilities.find((f3) => f3.id === arc.facilityId);
    const agg = emptyAggregate();
    addToAggregate(agg, phys, src.availableT);
    const perm = def.producesDurableRemoval ? permanenceFor(src.stream, state.assumptions.soilTempC) : null;
    const ledger = buildLedger(agg, state.assumptions, perm, false);
    const per = (v) => v / Math.max(1e-9, src.availableT);
    const lineSum = (pred) => ledger.lines.filter((l) => pred(l.key)).reduce((x, l) => x + l.valueT, 0);
    const transportPerT = -per(lineSum((k) => k === "em_transport" || k === "em_aggregation"));
    const processPerT = -per(
      lineSum((k) => k.startsWith("em_") && k !== "em_transport" && k !== "em_aggregation")
    );
    const capacityT = fac.capacityTpd * fac.availability * state.assumptions.windowDays;
    const headroomT = Math.max(0, capacityT - (committed.get(fac.id) ?? 0));
    options.push({
      ...base,
      unavailableReason: null,
      facility: {
        id: fac.id,
        name: fac.name,
        district: fac.district,
        lat: fac.lat,
        lon: fac.lon,
        capacityTpd: fac.capacityTpd,
        efficiency: fac.efficiency,
        headroomT
      },
      route: {
        roadKm: arc.distanceKm,
        straightKm: haversineKm(src, fac),
        vehicleId: arc.vehicleId,
        payloadT: arc.payloadT,
        trips: Math.ceil(src.availableT / Math.max(0.1, arc.payloadT))
      },
      perT: {
        // net is taken from the arc because that is the figure the optimiser
        // ranked on; it agrees with the ledger to machine precision, and a test
        // holds it there.
        net: arc.netCarbonPerT,
        durable: per(ledger.durableRemovalT),
        avoided: per(ledger.avoidedEmissionsT),
        substitution: per(ledger.substitutionT),
        emitted: per(ledger.emissionsT),
        transport: transportPerT,
        process: processPerT
      },
      ledger,
      econ: {
        marginPerT: arc.marginInrPerT,
        marginTotal: arc.marginInrPerT * src.availableT
      }
    });
  }
  const resolved = options.filter((o) => o.perT !== null);
  const carbonBest = pick(resolved, (o) => o.perT.net);
  const economicBest = pick(resolved, (o) => o.econ.marginPerT);
  const lensBest = lens === "carbon_first" ? carbonBest : lens === "profit_first" ? economicBest : pick(resolved, (o) => lensScore(o, lens));
  const rank = (o) => o.perT ? 0 : o.feasible ? 1 : 2;
  options.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.perT && b.perT) return lensScore(b, lens) - lensScore(a, lens);
    return b.suitability - a.suitability;
  });
  return {
    source: {
      id: src.id,
      name: src.name,
      district: src.district,
      state: src.state,
      lat: src.lat,
      lon: src.lon,
      telemetryAgeH: src.telemetryAgeH
    },
    stream: src.stream,
    streamLabel: stream.label,
    availableT: src.availableT,
    lens,
    options,
    feasibleCount: options.filter((o) => o.feasible).length,
    resolvedCount: resolved.length,
    carbonBest,
    economicBest,
    lensBest,
    why: composeWhy5(resolved, carbonBest, src.availableT, stream.label),
    tradeoff: composeTradeoff(resolved, carbonBest, economicBest, src.availableT)
  };
}
function lensScore(o, lens) {
  if (!o.perT || !o.econ) return -Infinity;
  switch (lens) {
    case "carbon_first":
      return o.perT.net;
    case "profit_first":
      return o.econ.marginPerT;
    case "logistics_first":
      return o.route ? o.perT.net / Math.max(1, o.route.roadKm) : -Infinity;
    default:
      return o.perT.net;
  }
}
function pick(options, score) {
  let best = null;
  for (const o of options) {
    if (!best || score(o) > score(best)) best = o;
  }
  return best ? best.pathway : null;
}
function composeWhy5(resolved, carbonBest, availableT, streamLabel) {
  if (resolved.length === 0) {
    return `No pathway can currently take this material, so there is no carbon outcome to compare.`;
  }
  const win = resolved.find((o) => o.pathway === carbonBest);
  if (!win || !win.perT) return "No pathway produced a carbon result for this material.";
  const n = (v, dp = 2) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  if (resolved.length === 1) {
    return `${win.short} is the only pathway that can take this ${streamLabel.toLowerCase()}, at ${n(win.perT.net)} tCO\u2082e per tonne (${n(win.perT.net * availableT, 0)} tCO\u2082e over ${n(availableT, 0)} t).`;
  }
  const others = resolved.filter((o) => o.pathway !== carbonBest && o.perT);
  others.sort((a, b) => b.perT.net - a.perT.net);
  const second = others[0];
  let s = `${win.short} gives the highest net carbon for this material at ${n(win.perT.net)} tCO\u2082e per tonne`;
  if (second?.perT) {
    const gap = win.perT.net - second.perT.net;
    s += `, ${n(gap)} tCO\u2082e/t ahead of ${second.short}`;
    const benefitGap = win.perT.durable + win.perT.avoided + win.perT.substitution - (second.perT.durable + second.perT.avoided + second.perT.substitution);
    const emissionGap = second.perT.emitted - win.perT.emitted;
    if (Math.abs(benefitGap) > Math.abs(emissionGap)) {
      const part = win.perT.durable > second.perT.durable + 1e-6 ? "the carbon it locks into char" : win.perT.substitution > second.perT.substitution + 1e-6 ? "the fossil energy it displaces" : "the disposal emissions it avoids";
      s += `, because ${part} outweighs the difference`;
    } else if (emissionGap > 1e-6) {
      s += `, mostly because it emits ${n(emissionGap)} tCO\u2082e/t less in haulage and processing`;
    }
  }
  return s + ".";
}
function composeTradeoff(resolved, carbonBest, economicBest, availableT) {
  if (!carbonBest || !economicBest || carbonBest === economicBest) return null;
  const c = resolved.find((o) => o.pathway === carbonBest);
  const e = resolved.find((o) => o.pathway === economicBest);
  if (!c?.perT || !e?.perT || !c.econ || !e.econ) return null;
  const carbonLost = (c.perT.net - e.perT.net) * availableT;
  const moneyGained = (e.econ.marginPerT - c.econ.marginPerT) * availableT;
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  return `Choosing ${e.short} over ${c.short} earns \u20B9${n(moneyGained)} more on this material but gives up ${n(carbonLost)} tCO\u2082e \u2014 about \u20B9${n(moneyGained / Math.max(1e-9, carbonLost))} of margin per tonne of CO\u2082e forgone.`;
}
function comparePathwayPair(decision, fromId, toId) {
  const from = decision.options.find((o) => o.pathway === fromId);
  const to = decision.options.find((o) => o.pathway === toId);
  if (!from?.perT || !to?.perT || !from.econ || !to.econ) return null;
  const t = decision.availableT;
  const drivers = [];
  const push = (key, label, fromValue, toValue, detail, invert = false) => {
    const raw = toValue - fromValue;
    if (Math.abs(raw) < 1e-4) return;
    drivers.push({
      key,
      label,
      fromValue,
      toValue,
      deltaT: (invert ? -raw : raw) * t,
      detail
    });
  };
  push("durable", "Durable removal", from.perT.durable, to.perT.durable, "Carbon locked into char");
  push("avoided", "Avoided disposal", from.perT.avoided, to.perT.avoided, "Emissions the counterfactual fate would have released");
  push("substitution", "Fossil displacement", from.perT.substitution, to.perT.substitution, "Fossil energy and nitrogen displaced by the products");
  push("transport", "Transport emissions", from.perT.transport, to.perT.transport, "Haulage and field aggregation", true);
  push("process", "Processing emissions", from.perT.process, to.perT.process, "Plant power, digester slip and windrow losses", true);
  drivers.sort((a, b) => Math.abs(b.deltaT) - Math.abs(a.deltaT));
  const netDeltaPerT = to.perT.net - from.perT.net;
  const n = (v, dp = 0) => Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: dp });
  let summary = `Switching from ${from.short} to ${to.short} ${netDeltaPerT >= 0 ? "raises" : "reduces"} net carbon impact by ${n(Math.abs(netDeltaPerT) * t)} tCO\u2082e for this material (${n(Math.abs(netDeltaPerT), 2)} tCO\u2082e per tonne).`;
  const bits = [];
  if (from.facility && to.facility && from.facility.id !== to.facility.id) {
    bits.push(`the material now goes to ${to.facility.name} instead of ${from.facility.name}`);
  }
  if (from.route && to.route && Math.abs(to.route.roadKm - from.route.roadKm) >= 1) {
    const d = to.route.roadKm - from.route.roadKm;
    bits.push(`the haul ${d > 0 ? "lengthens" : "shortens"} by ${n(Math.abs(d))} km`);
  }
  if (bits.length) summary += ` In the network, ${bits.join(" and ")}.`;
  const lead = drivers[0];
  if (lead) {
    summary += ` The largest single driver is ${lead.label.toLowerCase()}, worth ${n(Math.abs(lead.deltaT))} tCO\u2082e ${lead.deltaT >= 0 ? "in favour of" : "against"} ${to.short}.`;
  }
  return {
    from: fromId,
    to: toId,
    fromLabel: from.short,
    toLabel: to.short,
    netDeltaPerT,
    netDeltaTotal: netDeltaPerT * t,
    marginDeltaTotal: (to.econ.marginPerT - from.econ.marginPerT) * t,
    drivers,
    summary
  };
}

// packages/engine/src/state.ts
var Twin = class {
  state;
  objective = "balanced";
  version = 0;
  events = [];
  cacheResult = null;
  cacheBaseline = null;
  cacheRouting = null;
  cacheLedger = null;
  cacheBottlenecks = null;
  cacheStranded = null;
  cacheOpportunities = null;
  cacheResilience = null;
  cacheForecast = null;
  cachePareto = null;
  cacheHistory = null;
  cacheFacilityRank = null;
  cacheOpportunityReport = null;
  cacheBrief = null;
  cacheEvidence = null;
  lastScenario = null;
  constructor() {
    this.state = buildNetwork();
    this.log("system", "info", "Network initialised", `${this.state.sources.length} sources, ${this.state.facilities.length} facilities, window ${this.state.assumptions.windowDays} days`, []);
  }
  // ── State access ──────────────────────────────────────────────────────────
  getState() {
    return this.state;
  }
  getObjective() {
    return this.objective;
  }
  getVersion() {
    return this.version;
  }
  invalidate(keepForecast = true) {
    this.version++;
    this.cacheResult = null;
    this.cacheBaseline = null;
    this.cacheRouting = null;
    this.cacheLedger = null;
    this.cacheBottlenecks = null;
    this.cacheStranded = null;
    this.cacheOpportunities = null;
    this.cacheResilience = null;
    this.cachePareto = null;
    this.cacheHistory = null;
    this.cacheFacilityRank = null;
    this.cacheEvidence = null;
    this.cacheOpportunityReport = null;
    this.cacheBrief = null;
    if (!keepForecast) this.cacheForecast = null;
  }
  setObjective(mode) {
    if (mode === this.objective) return;
    const prev = this.objective;
    this.objective = mode;
    this.invalidate();
    this.log(
      "optimization",
      "info",
      "Objective changed",
      `Optimisation objective switched from ${prev} to ${mode}. Network re-solved.`,
      []
    );
  }
  updateAssumptions(patch) {
    const changedSeason = patch.windowDays !== void 0 && patch.windowDays !== this.state.assumptions.windowDays;
    this.state.assumptions = { ...this.state.assumptions, ...patch };
    this.invalidate(!changedSeason);
    this.log(
      "system",
      "info",
      "Assumptions updated",
      Object.entries(patch).map(([k, v]) => `${k} = ${v}`).join(", "),
      []
    );
  }
  reset() {
    this.state = buildNetwork();
    this.objective = "balanced";
    this.invalidate(false);
    this.lastScenario = null;
    this.events = [];
    this.log("system", "info", "Network reset", "All scenario mutations cleared, baseline state restored.", []);
  }
  // ── Derived artefacts ─────────────────────────────────────────────────────
  getResult() {
    if (!this.cacheResult) {
      this.cacheResult = optimize(this.state, this.objective);
      this.log(
        "optimization",
        "info",
        "Network optimised",
        `${this.cacheResult.telemetry.arcsFeasible} feasible arcs, ${this.cacheResult.telemetry.bnbNodesExplored} branch-and-bound nodes, ${this.cacheResult.totals.divertedT.toFixed(0)} t allocated in ${this.cacheResult.telemetry.solveMs} ms`,
        []
      );
    }
    return this.cacheResult;
  }
  getBaseline() {
    if (!this.cacheBaseline) {
      this.cacheBaseline = baselineResult(this.state, this.objective);
    }
    return this.cacheBaseline;
  }
  getRouting() {
    if (!this.cacheRouting) {
      this.cacheRouting = planRoutes(this.state, this.getResult().allocations);
    }
    return this.cacheRouting;
  }
  getLedger() {
    if (!this.cacheLedger) {
      const result = this.getResult();
      const agg = aggregateAllocations(
        result.allocations,
        this.state.facilities,
        this.state.vehicles,
        this.state.assumptions
      );
      const dominant = dominantBiocharStream(result.allocations);
      const permanence = dominant ? permanenceFor(dominant, this.state.assumptions.soilTempC) : null;
      this.cacheLedger = buildLedger(agg, this.state.assumptions, permanence, true);
    }
    return this.cacheLedger;
  }
  getCarbonAggregate() {
    const result = this.getResult();
    return aggregateAllocations(
      result.allocations,
      this.state.facilities,
      this.state.vehicles,
      this.state.assumptions
    );
  }
  getEconomics() {
    return rollupEconomics(this.getResult().allocations);
  }
  getBottlenecks() {
    if (!this.cacheBottlenecks) {
      this.cacheBottlenecks = detectBottlenecks(this.state, this.getResult());
      for (const b of this.cacheBottlenecks.slice(0, 3)) {
        if (b.severity === "critical" || b.severity === "high") {
          this.log("alert", b.severity, b.title, b.detail, b.entityIds);
        }
      }
    }
    return this.cacheBottlenecks;
  }
  getStranded() {
    if (!this.cacheStranded) {
      this.cacheStranded = strandedLots(this.state, this.getResult());
    }
    return this.cacheStranded;
  }
  getOpportunities() {
    if (!this.cacheOpportunities) {
      this.cacheOpportunities = opportunityScores(this.state, this.getResult());
    }
    return this.cacheOpportunities;
  }
  getResilience() {
    if (!this.cacheResilience) {
      this.cacheResilience = resilienceReport(this.state, this.getResult(), this.objective);
      this.log(
        "system",
        "info",
        "Resilience assessed",
        `N-1 contingency analysis over ${this.cacheResilience.n1Results.length} facilities. Score ${this.cacheResilience.score.toFixed(0)}/100 (${this.cacheResilience.grade}).`,
        []
      );
    }
    return this.cacheResilience;
  }
  /**
   * Carbon over the trailing weeks, each point a real re-solve on that week's
   * observed supply. Memoised like every other derived artefact: twenty solves is
   * cheap enough to compute on demand but not cheap enough to repeat per request.
   */
  /**
   * Inputs behind each line of the network ledger. Derived from the same
   * aggregate the ledger was built from, so it cannot describe a different plan.
   */
  getProvenance() {
    const result = this.getResult();
    return provenanceFor(
      this.getCarbonAggregate(),
      this.state.assumptions.soilTempC,
      this.state.assumptions.gridEfTPerMwh,
      dominantBiocharStream(result.allocations)
    );
  }
  /**
   * The evidence register: every ledger line with its inputs, factor and citation.
   * Memoised because it runs one ledger per allocation to count contributors.
   */
  getEvidence() {
    if (!this.cacheEvidence) {
      const records = evidenceRegister(this.state, this.getResult(), this.getLedger());
      this.cacheEvidence = {
        records,
        health: evidenceHealth(records),
        basis: modelBasis(this.state, this.getResult(), this.version)
      };
    }
    return this.cacheEvidence;
  }
  /**
   * Carbon opportunities, each measured by actually applying the change to a
   * clone of the network and re-optimising. ~300 ms for the full sweep, so it is
   * memoised rather than approximated.
   */
  getCarbonOpportunities() {
    if (!this.cacheOpportunityReport) {
      this.cacheOpportunityReport = findOpportunities(this.state, this.getResult());
    }
    return this.cacheOpportunityReport;
  }
  /**
   * A shock, read as carbon. Never mutates the live network: runScenario works
   * on a deep clone and this returns a reading of that clone's solve.
   */
  runShock(scenario) {
    const res = runShock(this.state, this.getResult(), scenario, this.objective);
    this.log(
      "scenario",
      "info",
      `Shock evaluated: ${res.label}`,
      `Net carbon ${res.carbonDeltaT >= 0 ? "+" : ""}${res.carbonDeltaT.toFixed(0)} tCO\u2082e over ${res.solveMs} ms of re-optimisation.`,
      res.changedFacilities.map((f3) => f3.id)
    );
    return res;
  }
  /**
   * The Carbon Intelligence Brief.
   *
   * Pure composition: every artefact below is already memoised by its own
   * accessor, so a reader arriving here first pays for them once and every other
   * Carbon screen is then warm. The brief itself computes nothing.
   */
  getBrief() {
    if (!this.cacheBrief) {
      const result = this.getResult();
      const resilience = this.getResilience();
      const worst = resilience.worstCaseFacilityId ? this.runShock({
        kind: "facility_offline",
        params: { facilityId: resilience.worstCaseFacilityId }
      }) : null;
      this.cacheBrief = buildBrief({
        state: this.state,
        result,
        version: this.version,
        ledger: this.getLedger(),
        history: this.getCarbonHistory(),
        opportunities: this.getCarbonOpportunities().opportunities,
        ranking: this.getFacilityRanking(),
        evidence: this.getEvidence().health,
        resilience,
        worstShock: worst,
        objectives: worst ? this.compareShockObjectives(worst.scenario) : null
      });
    }
    return this.cacheBrief;
  }
  /** The same shock under every objective, each against its own baseline. */
  compareShockObjectives(scenario) {
    return compareObjectives(this.state, scenario, this.objective);
  }
  /** One opportunity re-run, with the scenario engine's own flow-level diff. */
  getOpportunityDetail(scenario) {
    return explainOpportunity(this.state, this.getResult(), scenario);
  }
  /** Which allocations produced one ledger line, and in what proportion. */
  getLineContributors(lineKey) {
    return lineContributors(this.state, this.getResult(), lineKey);
  }
  /** Every facility ranked by its contribution to the network's net carbon. */
  getFacilityRanking() {
    if (!this.cacheFacilityRank) {
      this.cacheFacilityRank = facilityRanking(this.state, this.getResult());
    }
    return this.cacheFacilityRank;
  }
  /** The carbon profile of one plant, with its feeding arcs and opportunities. */
  getFacilityCarbon(facilityId) {
    return facilityCarbon(this.state, this.getResult(), facilityId, this.getStranded());
  }
  /** Two plants set against each other, arc for arc where they share a source. */
  getFacilityComparison(aId, bId) {
    return compareFacilities(this.state, this.getResult(), aId, bId);
  }
  /** Sources offered as a material context for the pathway decision. */
  getMaterials() {
    return materialCandidates(this.state);
  }
  /**
   * Every pathway evaluated for one source's material under a comparison lens.
   * Not memoised: it is keyed by source and lens rather than by version alone,
   * and one call costs a single arc build.
   */
  getPathwayDecision(sourceId, lens) {
    return pathwayDecision(this.state, this.getResult(), sourceId, lens);
  }
  /** What switching between two pathways changes for that material. */
  getPathwayDiff(sourceId, lens, from, to) {
    const decision = this.getPathwayDecision(sourceId, lens);
    return decision ? comparePathwayPair(decision, from, to) : null;
  }
  /** Allocations offered for tracing, largest carbon contribution first. */
  getTraceCandidates() {
    return traceCandidates(this.state, this.getResult());
  }
  /** The full chain behind one allocation, or null if it is not in the plan. */
  getTrace(sourceId, facilityId) {
    return traceAllocation(this.state, this.getResult(), sourceId, facilityId);
  }
  getCarbonHistory() {
    if (!this.cacheHistory) {
      this.cacheHistory = carbonHistory(this.state, this.objective);
    }
    return this.cacheHistory;
  }
  getForecast() {
    if (!this.cacheForecast) {
      this.cacheForecast = forecastNetwork(
        this.state.sources,
        this.state.asOf,
        this.state.assumptions.windowDays
      );
      this.log(
        "forecast",
        "info",
        "Supply forecast refreshed",
        `Ridge model retrained on ${this.state.sources.length} sources. Network backtest MAPE ${this.cacheForecast.networkMapePct.toFixed(1)}%.`,
        []
      );
    }
    return this.cacheForecast;
  }
  /**
   * Carbon-versus-profit Pareto frontier, swept by re-solving the allocation at a
   * range of objective weights. Each point is a real optimisation, not a
   * interpolation between two endpoints.
   */
  getPareto() {
    if (this.cachePareto) return this.cachePareto;
    const arcSet = buildArcs(this.state);
    const sc = objectiveScale(arcSet.arcs);
    const windowDays = this.state.assumptions.windowDays;
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const w = i / 10;
      const values = arcSet.arcs.map((a) => arcValueWeighted(a, w, sc));
      const sol = solveTransport({
        supplies: this.state.sources.map((s) => s.availableT),
        capacities: this.state.facilities.map(
          (f3) => f3.status === "offline" ? 0 : f3.capacityTpd * f3.availability * windowDays
        ),
        lowerBounds: this.state.facilities.map(() => 0),
        arcs: arcSet.bySource.map(
          (row) => row.map((r) => ({ facility: r.facility, value: values[r.arcIndex] }))
        )
      });
      const allocations = materialiseAllocations(this.state, arcSet, sol.flow);
      const totals = computeTotals(this.state, allocations);
      points.push({
        weight: w,
        netCarbonT: totals.netCarbonT,
        marginInr: totals.marginInr,
        divertedT: totals.divertedT,
        isCurrent: false
      });
    }
    const current = this.getResult().totals;
    let bestIdx = 0;
    let bestGap = Infinity;
    points.forEach((p, i) => {
      const gap = Math.abs(p.netCarbonT - current.netCarbonT) / Math.max(1, current.netCarbonT) + Math.abs(p.marginInr - current.marginInr) / Math.max(1, Math.abs(current.marginInr));
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    });
    if (points[bestIdx]) points[bestIdx].isCurrent = true;
    this.cachePareto = points;
    return points;
  }
  snapshot() {
    return {
      version: this.version,
      asOf: this.state.asOf,
      objective: this.objective,
      network: this.state,
      result: this.getResult(),
      baseline: this.getBaseline(),
      routing: this.getRouting(),
      ledger: this.getLedger(),
      economics: this.getEconomics(),
      bottlenecks: this.getBottlenecks(),
      stranded: this.getStranded(),
      opportunities: this.getOpportunities()
    };
  }
  // ── Scenarios ─────────────────────────────────────────────────────────────
  /** Runs a scenario without committing it — a preview, not a state change. */
  previewScenario(scenario) {
    const res = runScenario(this.state, scenario, this.objective, this.getResult());
    this.lastScenario = res;
    this.log(
      "scenario",
      "info",
      `Scenario simulated: ${res.label}`,
      res.narrative.slice(1, 3).join(" "),
      res.affectedEntityIds
    );
    return res;
  }
  /** Applies a scenario permanently to the live network state. */
  commitScenario(scenario) {
    const res = this.previewScenario(scenario);
    const out = applyScenario(this.state, scenario, this.objective);
    this.state = out.state;
    if (out.objective) this.objective = out.objective;
    this.invalidate(scenario.kind !== "seasonal_shift");
    this.log(
      "scenario",
      "high",
      `Scenario committed: ${out.label}`,
      "Live network state mutated. All downstream results recomputed.",
      out.affectedEntityIds
    );
    return res;
  }
  getLastScenario() {
    return this.lastScenario;
  }
  // ── Event log ─────────────────────────────────────────────────────────────
  log(kind, severity, title, detail, entityIds) {
    this.events.unshift({
      id: `EV-${Date.now().toString(36)}-${this.events.length}`,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      kind,
      severity,
      title,
      detail,
      entityIds
    });
    if (this.events.length > 200) this.events.length = 200;
  }
  getEvents() {
    return this.events;
  }
};

// packages/engine/src/copilot.ts
var nf = (n, d = 0) => n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
function inr2(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}\u20B9${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}\u20B9${(abs / 1e5).toFixed(2)} L`;
  return `${sign}\u20B9${nf(abs)}`;
}
var TOOL_DEFS = [
  {
    name: "get_network_state",
    description: "Current network: source count, facility count, objective, window, assumptions.",
    parameters: {}
  },
  {
    name: "get_optimization_result",
    description: "The current optimal plan: totals, open facilities, solver telemetry.",
    parameters: {}
  },
  {
    name: "get_waste_sources",
    description: "Waste sources, optionally filtered by stream or district.",
    parameters: {
      stream: { type: "string", description: "Feedstock stream id" },
      district: { type: "string", description: "District name" }
    }
  },
  {
    name: "get_facilities",
    description: "Processing facilities with utilisation and current allocation.",
    parameters: { pathway: { type: "string", description: "Pathway id" } }
  },
  {
    name: "explain_facility_selection",
    description: "Why a given facility was selected, what it receives and from where.",
    parameters: {
      facilityId: { type: "string", description: "Facility id", required: true }
    }
  },
  {
    name: "get_carbon_ledger",
    description: "Full carbon ledger with every line, permanence report and uncertainty band.",
    parameters: {}
  },
  {
    name: "get_economics",
    description: "Revenue, cost and margin rollup by pathway and facility.",
    parameters: {}
  },
  {
    name: "get_bottlenecks",
    description: "Detected bottlenecks with severity, quantified consequence and recommendation.",
    parameters: {}
  },
  {
    name: "get_stranded",
    description: "Feedstock the network cannot place, with an attributed reason per lot.",
    parameters: {}
  },
  {
    name: "get_shadow_prices",
    description: "Marginal value of one extra tonne/day of capacity at each facility.",
    parameters: {}
  },
  {
    name: "get_resilience",
    description: "N-1 contingency analysis and resilience score.",
    parameters: {}
  },
  {
    name: "get_forecast",
    description: "Supply forecast with backtest accuracy, optionally for one source.",
    parameters: { sourceId: { type: "string", description: "Source id" } }
  },
  {
    name: "compare_pathways",
    description: "Carbon, cost, revenue and feasibility of every pathway for one feedstock.",
    parameters: { stream: { type: "string", description: "Feedstock stream id", required: true } }
  },
  {
    name: "run_scenario",
    description: "Simulate a disruption or market change and return the before/after difference.",
    parameters: {
      kind: { type: "string", description: "Scenario kind", required: true },
      params: { type: "object", description: "Scenario parameters" }
    }
  },
  {
    name: "get_opportunities",
    description: "Opportunity score per source with its component breakdown.",
    parameters: {}
  }
];
function callTool(twin2, name, args) {
  const net = twin2.getState();
  const result = twin2.getResult();
  switch (name) {
    case "get_network_state":
      return {
        result: {
          sources: net.sources.length,
          facilities: net.facilities.length,
          objective: twin2.getObjective(),
          asOf: net.asOf,
          windowDays: net.assumptions.windowDays,
          assumptions: net.assumptions,
          appliedScenarios: net.appliedScenarios
        },
        summary: `${net.sources.length} sources, ${net.facilities.length} facilities, objective ${twin2.getObjective()}`
      };
    case "get_optimization_result":
      return {
        result: {
          totals: result.totals,
          openFacilities: result.openFacilities,
          idleFacilities: result.idleFacilities,
          telemetry: result.telemetry
        },
        summary: `${nf(result.totals.divertedT)} t diverted, ${nf(result.totals.netCarbonT)} tCO2e net, margin ${inr2(result.totals.marginInr)}`
      };
    case "get_waste_sources": {
      let rows = net.sources;
      if (args.stream) rows = rows.filter((s) => s.stream === args.stream);
      if (args.district) rows = rows.filter((s) => s.district === args.district);
      const allocated = /* @__PURE__ */ new Map();
      for (const a of result.allocations) {
        allocated.set(a.sourceId, (allocated.get(a.sourceId) ?? 0) + a.tonnes);
      }
      return {
        result: rows.map((s) => ({
          id: s.id,
          name: s.name,
          district: s.district,
          stream: s.stream,
          availableT: s.availableT,
          allocatedT: allocated.get(s.id) ?? 0
        })),
        summary: `${rows.length} sources matched`
      };
    }
    case "get_facilities": {
      let rows = net.facilities;
      if (args.pathway) rows = rows.filter((f3) => f3.pathway === args.pathway);
      const load = /* @__PURE__ */ new Map();
      for (const a of result.allocations) {
        load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
      }
      return {
        result: rows.map((f3) => {
          const cap = f3.capacityTpd * f3.availability * net.assumptions.windowDays;
          const l = load.get(f3.id) ?? 0;
          return {
            id: f3.id,
            name: f3.name,
            pathway: f3.pathway,
            district: f3.district,
            capacityTpd: f3.capacityTpd,
            status: f3.status,
            allocatedT: l,
            utilisationPct: cap > 0 ? l / cap * 100 : 0
          };
        }),
        summary: `${rows.length} facilities matched`
      };
    }
    case "explain_facility_selection": {
      const f3 = net.facilities.find((x) => x.id === args.facilityId);
      if (!f3) return { result: null, summary: "facility not found" };
      const feeds = result.allocations.filter((a) => a.facilityId === f3.id);
      const cap = f3.capacityTpd * f3.availability * net.assumptions.windowDays;
      const total = feeds.reduce((s, a) => s + a.tonnes, 0);
      const sp = result.shadowPrices.find((s) => s.facilityId === f3.id);
      return {
        result: {
          facility: f3,
          capacityWindowT: cap,
          allocatedT: total,
          utilisationPct: cap > 0 ? total / cap * 100 : 0,
          shadowPrice: sp,
          feeds: feeds.map((a) => ({
            sourceId: a.sourceId,
            sourceName: net.sources.find((s) => s.id === a.sourceId)?.name ?? a.sourceId,
            stream: a.stream,
            tonnes: a.tonnes,
            distanceKm: a.distanceKm,
            netCarbonPerT: a.netCarbonT / Math.max(1e-9, a.tonnes),
            marginPerT: a.marginInr / Math.max(1e-9, a.tonnes)
          })).sort((a, b) => b.tonnes - a.tonnes)
        },
        summary: `${f3.name}: ${nf(total)} t from ${feeds.length} sources`
      };
    }
    case "get_carbon_ledger": {
      const l = twin2.getLedger();
      return {
        result: l,
        summary: `net ${nf(l.netT)} tCO2e (durable ${nf(l.durableRemovalT)}, avoided ${nf(l.avoidedEmissionsT)})`
      };
    }
    case "get_economics": {
      const e = twin2.getEconomics();
      return { result: e, summary: `margin ${inr2(e.marginInr)}` };
    }
    case "get_bottlenecks": {
      const b = twin2.getBottlenecks();
      return { result: b, summary: `${b.length} bottlenecks detected` };
    }
    case "get_stranded": {
      const s = twin2.getStranded();
      return {
        result: s,
        summary: `${nf(s.reduce((x, y) => x + y.tonnes, 0))} t stranded across ${s.length} lots`
      };
    }
    case "get_shadow_prices":
      return {
        result: result.shadowPrices,
        summary: `${result.shadowPrices.filter((s) => s.binding).length} binding capacity constraints`
      };
    case "get_resilience": {
      const r = twin2.getResilience();
      return { result: r, summary: `score ${r.score.toFixed(0)}/100 (${r.grade})` };
    }
    case "get_forecast": {
      const f3 = twin2.getForecast();
      if (args.sourceId) {
        const one = f3.bySource[String(args.sourceId)];
        return {
          result: one,
          summary: one ? `MAPE ${one.backtestMapePct.toFixed(1)}%` : "source not found"
        };
      }
      return {
        result: {
          windowTotalT: f3.windowTotalT,
          windowLowerT: f3.windowLowerT,
          windowUpperT: f3.windowUpperT,
          networkMapePct: f3.networkMapePct,
          peakWeeks: f3.peakWeeks
        },
        summary: `${nf(f3.windowTotalT)} t expected, backtest MAPE ${f3.networkMapePct.toFixed(1)}%`
      };
    }
    case "compare_pathways": {
      const rows = comparePathways(twin2, String(args.stream));
      return { result: rows, summary: `${rows.length} pathways evaluated` };
    }
    case "run_scenario": {
      const scenario = {
        kind: args.kind,
        params: args.params ?? {}
      };
      const r = twin2.previewScenario(scenario);
      return {
        result: {
          label: r.label,
          narrative: r.narrative,
          deltas: r.deltas,
          flowChanges: r.flowChanges.slice(0, 12),
          newBottlenecks: r.newBottlenecks
        },
        summary: r.label
      };
    }
    case "get_opportunities": {
      const o = twin2.getOpportunities();
      return { result: o, summary: `${o.length} sources scored` };
    }
    default:
      return { result: null, summary: `unknown tool ${name}` };
  }
}
function comparePathways(twin2, streamId) {
  const net = twin2.getState();
  const stream = STREAMS[streamId];
  const result = twin2.getResult();
  const rows = [];
  for (const pid of Object.keys(PATHWAYS)) {
    const p = PATHWAYS[pid];
    const suit = suitability(stream, p);
    if (!suit.feasible) {
      const failed = suit.gates.find((g) => !g.pass);
      rows.push({
        pathway: pid,
        label: p.short,
        feasible: false,
        blockedBy: failed ? `${failed.gate}: ${failed.detail}` : suit.limitingFactor,
        suitability: 0,
        netCarbonPerT: 0,
        durablePerT: 0,
        revenuePerT: 0,
        marginPerT: 0,
        bestFacility: null,
        bestDistanceKm: null,
        note: `Excluded by the ${suit.limitingFactor} gate.`
      });
      continue;
    }
    const allocs = result.allocations.filter((a) => a.stream === streamId && a.pathway === pid);
    let netCarbonPerT = 0;
    let durablePerT = 0;
    let marginPerT = 0;
    let bestFacility = null;
    let bestDistanceKm = null;
    if (allocs.length > 0) {
      const t = allocs.reduce((s, a) => s + a.tonnes, 0);
      netCarbonPerT = allocs.reduce((s, a) => s + a.netCarbonT, 0) / t;
      durablePerT = allocs.reduce((s, a) => s + a.durableT, 0) / t;
      marginPerT = allocs.reduce((s, a) => s + a.marginInr, 0) / t;
      const biggest = allocs.slice().sort((a, b) => b.tonnes - a.tonnes)[0];
      bestFacility = net.facilities.find((f3) => f3.id === biggest.facilityId)?.name ?? null;
      bestDistanceKm = biggest.distanceKm;
    }
    const y = pathwayYield(stream, pid, 1);
    let revenuePerT = 0;
    revenuePerT += y.biocharT * PRICES.biochar.price;
    revenuePerT += y.cbgKg * PRICES.bio_cng.price;
    revenuePerT += y.pelletT * PRICES.pellets.price;
    revenuePerT += y.compostT * PRICES.compost.price;
    revenuePerT += y.digestateT * PRICES.digestate.price;
    if (y.netKwh > 0) revenuePerT += y.netKwh * PRICES.electricity.price;
    rows.push({
      pathway: pid,
      label: p.short,
      feasible: true,
      blockedBy: "",
      suitability: suit.score,
      netCarbonPerT,
      durablePerT,
      revenuePerT,
      marginPerT,
      bestFacility,
      bestDistanceKm,
      note: allocs.length > 0 ? `${nf(allocs.reduce((s, a) => s + a.tonnes, 0))} t currently routed this way.` : `Feasible but not selected under the ${OBJECTIVE_META[twin2.getObjective()].label} objective. Limiting factor: ${suit.limitingFactor}.`
    });
  }
  return rows.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.netCarbonPerT - a.netCarbonPerT);
}
function normalise(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function resolveEntities(twin2, question) {
  const q = normalise(question);
  const net = twin2.getState();
  const out = {};
  let bestFac = null;
  for (const f3 of net.facilities) {
    const tokens = normalise(f3.name).split(" ").filter((t) => t.length > 3);
    let score = 0;
    for (const t of tokens) if (q.includes(t)) score += t.length;
    if (q.includes(f3.id.toLowerCase())) score += 50;
    if (score > 4 && (!bestFac || score > bestFac.score)) {
      bestFac = { id: f3.id, name: f3.name, score };
    }
  }
  if (bestFac) {
    out.facilityId = bestFac.id;
    out.facilityName = bestFac.name;
  }
  let bestSrc = null;
  for (const s of net.sources) {
    const tokens = normalise(s.name).split(" ").filter((t) => t.length > 3);
    let score = 0;
    for (const t of tokens) if (q.includes(t)) score += t.length;
    if (q.includes(s.id.toLowerCase())) score += 50;
    if (score > 5 && (!bestSrc || score > bestSrc.score)) {
      bestSrc = { id: s.id, name: s.name, score };
    }
  }
  if (bestSrc) {
    out.sourceId = bestSrc.id;
    out.sourceName = bestSrc.name;
  }
  for (const sid of Object.keys(STREAMS)) {
    const label = normalise(STREAMS[sid].label);
    if (q.includes(label) || q.includes(normalise(sid.replace(/_/g, " ")))) {
      out.stream = sid;
      break;
    }
  }
  if (!out.stream) {
    if (/\bstraw\b/.test(q) && /\bpaddy|rice\b/.test(q)) out.stream = "paddy_straw";
    else if (/\bstubble\b/.test(q)) out.stream = "paddy_straw";
    else if (/\bdung|manure|cattle\b/.test(q)) out.stream = "cattle_dung";
    else if (/\bmsw|municipal|city waste\b/.test(q)) out.stream = "msw_organic";
  }
  for (const pid of Object.keys(PATHWAYS)) {
    const p = PATHWAYS[pid];
    if (q.includes(normalise(p.short)) || q.includes(normalise(p.label))) {
      out.pathway = pid;
      break;
    }
  }
  if (!out.pathway) {
    if (/\bbiochar|pyrolys/.test(q)) out.pathway = "pyrolysis_biochar";
    else if (/\bcbg|bio ?cng|biogas|digest/.test(q)) out.pathway = "anaerobic_digestion_cbg";
    else if (/\bpellet|co ?fir/.test(q)) out.pathway = "pellet_cofiring";
    else if (/\bcompost/.test(q)) out.pathway = "composting";
    else if (/\bgasif/.test(q)) out.pathway = "gasification_power";
  }
  for (const d of new Set(net.sources.map((s) => s.district))) {
    if (q.includes(normalise(d))) {
      out.district = d;
      break;
    }
  }
  return out;
}
var INTENT_PATTERNS = [
  { intent: "why_facility", patterns: [/why (was|is|did).*(facility|plant|site|selected|chosen|picked)/, /why.*(send|route|go).*(to)/, /explain.*(selection|choice)/], weight: 3 },
  { intent: "what_if_shutdown", patterns: [/what happens if/, /what if.*(shut|close|offline|down|fail|trip)/, /if.*(shuts? down|goes offline|breaks)/, /simulate/], weight: 4 },
  { intent: "underutilised", patterns: [/under ?utilis|under ?util|idle|spare capacity|not being used|unused/], weight: 3 },
  { intent: "bottleneck", patterns: [/bottleneck|constraint|limiting|blocked|what.*holding|choke/], weight: 3 },
  { intent: "carbon_explain", patterns: [/how (much|is).*(carbon|co2|tco2)/, /carbon (ledger|breakdown|accounting|impact)/, /where.*carbon.*(come|from)/, /net carbon/], weight: 2 },
  { intent: "carbon_change", patterns: [/why did.*(carbon|co2).*(drop|fall|decrease|increase|rise|change)/, /carbon.*(went|down|up)/], weight: 4 },
  { intent: "best_pathway", patterns: [/which pathway|best pathway|highest (profit|carbon|value)|what should.*(do with|happen to)|compare pathway/], weight: 3 },
  { intent: "forecast", patterns: [/forecast|predict|next (month|week|quarter)|how much.*(will|expect)|upcoming|seasonal/], weight: 3 },
  { intent: "economics", patterns: [/margin|profit|revenue|cost|money|economics|rupee|payback|abatement cost/], weight: 2 },
  { intent: "resilience", patterns: [/resilien|robust|fragile|single point|n-?1|contingency/], weight: 3 },
  { intent: "shadow_price", patterns: [/shadow price|marginal value|where.*(invest|expand|add capacity)|worth (adding|expanding)/], weight: 4 },
  { intent: "stranded", patterns: [/stranded|left over|not (collected|processed|placed)|unallocated|burn(ed|ing)? anyway|wasted/], weight: 3 },
  { intent: "compare_objectives", patterns: [/carbon.*(vs|versus|compared).*(profit|margin)/, /objective|trade.?off|switch.*(mode|objective)/], weight: 3 },
  { intent: "permanence", patterns: [/permanen|durab|bc100|how long.*(last|stay|store)|q10|soil temperature/], weight: 4 },
  { intent: "overview", patterns: [/overview|summary|status|how are we doing|what.?s happening|brief/], weight: 2 }
];
function classify3(question) {
  const q = normalise(question);
  let best = "overview";
  let bestScore = 0;
  for (const row of INTENT_PATTERNS) {
    let score = 0;
    for (const p of row.patterns) if (p.test(q)) score += row.weight;
    if (score > bestScore) {
      bestScore = score;
      best = row.intent;
    }
  }
  return best;
}
function ask(twin2, question) {
  const intent = classify3(question);
  const entities = resolveEntities(twin2, question);
  const toolCalls = [];
  const use = (name, args = {}) => {
    const { result, summary } = callTool(twin2, name, args);
    toolCalls.push({ name, args, summary });
    return result;
  };
  const net = twin2.getState();
  const objectiveLabel = OBJECTIVE_META[twin2.getObjective()].label;
  let answer = "";
  let followUps = [];
  switch (intent) {
    case "why_facility": {
      const fid = entities.facilityId ?? twin2.getResult().openFacilities[0];
      const info = use("explain_facility_selection", { facilityId: fid });
      if (!info) {
        answer = 'I could not identify which facility you mean. Try naming it, for example "Why was Sangrur Biochar Works selected?".';
        break;
      }
      const f3 = info.facility;
      const p = PATHWAYS[f3.pathway];
      const lines = [];
      lines.push(
        `**${f3.name}** runs the ${p.label.toLowerCase()} pathway at ${f3.capacityTpd} t/day. Under the ${objectiveLabel} objective it is allocated **${nf(info.allocatedT)} t** this window \u2014 ${info.utilisationPct.toFixed(0)}% of its available capacity.`
      );
      if (info.feeds.length > 0) {
        lines.push("\nIt was selected for these flows because of what each one is worth on arrival:\n");
        lines.push("| Source | Stream | Tonnes | Haul | Net carbon | Margin |");
        lines.push("| --- | --- | ---: | ---: | ---: | ---: |");
        for (const fd of info.feeds.slice(0, 6)) {
          lines.push(
            `| ${fd.sourceName} | ${STREAMS[fd.stream].label} | ${nf(fd.tonnes)} t | ${fd.distanceKm.toFixed(0)} km | ${fd.netCarbonPerT.toFixed(2)} tCO\u2082e/t | ${inr2(fd.marginPerT)}/t |`
          );
        }
      }
      if (info.shadowPrice?.binding) {
        lines.push(
          `
Capacity here is **binding**. The marginal value of one more tonne per day is ${info.shadowPrice.valuePerExtraTonne.toFixed(3)} ${info.shadowPrice.unit} \u2014 which is why the optimiser fills it before cheaper alternatives.`
        );
      } else {
        lines.push(
          `
Capacity here is not binding, so the allocation is set by arc value rather than by scarcity.`
        );
      }
      answer = lines.join("\n");
      followUps = [
        `What happens if ${f3.name} shuts down?`,
        "Where should we add capacity next?"
      ];
      break;
    }
    case "what_if_shutdown": {
      const fid = entities.facilityId ?? use("get_shadow_prices").find((s) => s.binding)?.facilityId ?? twin2.getResult().openFacilities[0];
      const fac = net.facilities.find((f3) => f3.id === fid);
      const sc = use("run_scenario", { kind: "facility_offline", params: { facilityId: fid } });
      const carbon = sc.deltas.find((d) => d.key === "netCarbonT");
      const margin = sc.deltas.find((d) => d.key === "marginInr");
      const stranded = sc.deltas.find((d) => d.key === "strandedT");
      const lines = [];
      lines.push(`I simulated taking **${fac?.name ?? fid}** offline and re-optimised the entire network.
`);
      lines.push("| Metric | Before | After | Change |");
      lines.push("| --- | ---: | ---: | ---: |");
      for (const d of [carbon, margin, stranded].filter(Boolean)) {
        const fmt = (v) => d.unit === "\u20B9" ? inr2(v) : `${nf(v)} ${d.unit}`;
        lines.push(
          `| ${d.label} | ${fmt(d.before)} | ${fmt(d.after)} | ${d.delta >= 0 ? "+" : ""}${d.deltaPct.toFixed(1)}% |`
        );
      }
      lines.push("");
      for (const n of sc.narrative.slice(1)) lines.push(`- ${n}`);
      const reroutes = sc.flowChanges.filter((f3) => f3.changeType === "rerouted");
      if (reroutes.length > 0) {
        lines.push("\nLargest re-routes:\n");
        for (const r of reroutes.slice(0, 5)) {
          lines.push(
            `- ${nf(r.tonnes)} t from **${r.sourceName}**: ${r.fromFacilityName} \u2192 ${r.toFacilityName} (${r.distanceDeltaKm >= 0 ? "+" : ""}${r.distanceDeltaKm.toFixed(0)} km)`
          );
        }
      }
      answer = lines.join("\n");
      followUps = ["How resilient is the network overall?", "Which bottleneck should we fix first?"];
      break;
    }
    case "underutilised": {
      const facs = use("get_facilities");
      const sources = use("get_waste_sources");
      const idle = facs.filter((f3) => f3.utilisationPct < 60).sort((a, b) => a.utilisationPct - b.utilisationPct);
      const under = sources.filter((s) => s.allocatedT < s.availableT * 0.5 && s.availableT > 200).sort((a, b) => b.availableT - a.availableT - (b.allocatedT - a.allocatedT));
      const lines = [];
      if (under.length > 0) {
        lines.push(`**${under.length} sources** are running below half their available tonnage:
`);
        lines.push("| Source | Stream | Available | Allocated | Unused |");
        lines.push("| --- | --- | ---: | ---: | ---: |");
        for (const s of under.slice(0, 8)) {
          lines.push(
            `| ${s.name} | ${STREAMS[s.stream].label} | ${nf(s.availableT)} t | ${nf(s.allocatedT)} t | ${nf(s.availableT - s.allocatedT)} t |`
          );
        }
      }
      if (idle.length > 0) {
        lines.push(`
**Facilities with spare capacity:**
`);
        for (const f3 of idle.slice(0, 6)) {
          lines.push(
            `- ${f3.name} (${PATHWAYS[f3.pathway].short}) at ${f3.utilisationPct.toFixed(0)}% \u2014 ${nf(f3.capacityTpd * net.assumptions.windowDays - f3.allocatedT)} t of headroom`
          );
        }
        lines.push(
          `
Spare plant capacity alongside unplaced feedstock usually means a *compatibility* or *distance* problem rather than a tonnage problem. Ask about stranded feedstock to see the attributed reason per lot.`
        );
      }
      answer = lines.join("\n") || "Everything is running near capacity; no meaningful slack in the network.";
      followUps = ["Why is that feedstock stranded?", "Which pathway would suit it?"];
      break;
    }
    case "bottleneck": {
      const bs = use("get_bottlenecks");
      if (bs.length === 0) {
        answer = "No bottlenecks currently detected at the configured thresholds.";
        break;
      }
      const lines = [`I found **${bs.length} bottlenecks**. In order of severity:
`];
      for (const b of bs.slice(0, 5)) {
        lines.push(`**${b.title}** \u2014 ${b.severity.toUpperCase()}`);
        lines.push(`${b.detail}`);
        if (b.carbonAtRiskT > 1) lines.push(`Carbon at risk: ${nf(b.carbonAtRiskT)} tCO\u2082e per window.`);
        lines.push(`*Recommendation:* ${b.recommendation}`);
        lines.push(`*Upside:* ${b.quantifiedUpside}
`);
      }
      answer = lines.join("\n");
      followUps = ["Where should we add capacity next?", "What happens if the biggest plant fails?"];
      break;
    }
    case "carbon_explain": {
      const l = use("get_carbon_ledger");
      const lines = [
        `Net carbon impact for this window is **${nf(l.netT)} tCO\u2082e**, built up like this:
`,
        "| Line | tCO\u2082e | Basis |",
        "| --- | ---: | --- |"
      ];
      for (const line of l.lines) {
        if (line.kind === "total") continue;
        lines.push(`| ${line.label} | ${line.valueT >= 0 ? "+" : ""}${nf(line.valueT)} | ${line.basis} |`);
      }
      lines.push(`| **Net** | **${nf(l.netT)}** | |`);
      lines.push(
        `
The two carbon products are deliberately kept apart: **${nf(l.durableRemovalT)} tCO\u2082e of durable removal** (biochar, priced at ${inr2(CARBON_MARKETS.durableCdr.price)}/t) and **${nf(l.avoidedEmissionsT)} tCO\u2082e of avoided emissions** (priced at ${inr2(CARBON_MARKETS.avoidedEmission.price)}/t). They are not fungible and are never summed into one headline.`
      );
      if (l.uncertainty) {
        lines.push(
          `
Monte Carlo over ${nf(l.uncertainty.draws)} draws of every emission factor gives a 90% interval of **${nf(l.uncertainty.p5)} to ${nf(l.uncertainty.p95)} tCO\u2082e** (median ${nf(l.uncertainty.p50)}).`
        );
      }
      answer = lines.join("\n");
      followUps = ["How durable is the biochar carbon?", "What is the abatement cost per tonne?"];
      break;
    }
    case "permanence": {
      const l = use("get_carbon_ledger");
      const perm = l.permanence;
      if (!perm) {
        answer = "No biochar is being produced in the current plan, so there is no permanence figure to report.";
        break;
      }
      const euro = permanenceFor(
        twin2.getResult().allocations.find((a) => a.durableT > 0)?.stream ?? "paddy_straw",
        14.9
      );
      answer = [
        `Biochar carbon in this plan is modelled with a two-pool first-order decay, parameterised by the char's H/C(org) ratio of **${perm.hcOrgRatio.toFixed(2)}** \u2014 comfortably inside the < 0.7 durability gate that both the European Biochar Certificate and the Puro Standard require.`,
        ``,
        `The important correction is temperature. The harmonised biochar decomposition dataset is reported at **${perm.referenceTempC} \xB0C** soil temperature, which is northern Europe. Indian agricultural soils sit near **${perm.soilTempC} \xB0C**. Applying the published Q10 relation gives Q10 = ${perm.q10.toFixed(2)} and a decay-rate ratio of **${perm.fT.toFixed(3)}** \u2014 biochar decays about ${((perm.fT - 1) * 100).toFixed(0)}% faster here.`,
        ``,
        `| | 100-year permanence (BC\u2081\u2080\u2080) |`,
        `| --- | ---: |`,
        `| At the ${perm.referenceTempC} \xB0C reference | ${(euro.bc100 * 100).toFixed(1)}% |`,
        `| At ${perm.soilTempC} \xB0C (this network) | **${(perm.bc100 * 100).toFixed(1)}%** |`,
        ``,
        `Using the European default here would overstate durable removal by roughly ${((euro.bc100 - perm.bc100) / perm.bc100 * 100).toFixed(1)}%. The ledger applies the India-calibrated figure.`
      ].join("\n");
      followUps = ["Show me the full carbon ledger", "What would happen if CDR prices doubled?"];
      break;
    }
    case "carbon_change": {
      const last = twin2.getLastScenario();
      if (!last) {
        answer = "No scenario has been run in this session yet, so there is no before/after to compare. Run a scenario \u2014 a facility outage or a price move \u2014 and I will attribute the change flow by flow.";
        break;
      }
      const carbon = last.deltas.find((d) => d.key === "netCarbonT");
      const lines = [`The last change was: **${last.label}**.
`];
      if (carbon) {
        lines.push(
          `Net carbon moved from ${nf(carbon.before)} to ${nf(carbon.after)} tCO\u2082e, a change of ${carbon.delta >= 0 ? "+" : ""}${nf(carbon.delta)} (${carbon.deltaPct.toFixed(1)}%).
`
        );
      }
      const contributors = last.flowChanges.filter((f3) => Math.abs(f3.carbonDeltaT) > 1).slice(0, 6);
      if (contributors.length > 0) {
        lines.push("Largest contributions to that change:\n");
        for (const c of contributors) {
          lines.push(
            `- **${c.sourceName}** ${c.changeType}: ${nf(c.tonnes)} t, ${c.carbonDeltaT >= 0 ? "+" : ""}${c.carbonDeltaT.toFixed(0)} tCO\u2082e${c.toFacilityName ? ` (\u2192 ${c.toFacilityName})` : ""}`
          );
        }
      }
      answer = lines.join("\n");
      break;
    }
    case "best_pathway": {
      const stream = entities.stream ?? "paddy_straw";
      const rows = use("compare_pathways", { stream });
      const s = STREAMS[stream];
      const lines = [
        `Pathway comparison for **${s.label}** (moisture ${s.moisturePct}%, ash ${s.ashPct}%, C:N ${s.cnRatio}:1, lignin ${s.ligninPct}%, bulk density ${s.bulkDensityTPerM3} t/m\xB3):
`,
        "| Pathway | Feasible | Net carbon | Durable | Margin | Note |",
        "| --- | --- | ---: | ---: | ---: | --- |"
      ];
      for (const r of rows) {
        lines.push(
          `| ${r.label} | ${r.feasible ? "yes" : "**no**"} | ${r.feasible ? `${r.netCarbonPerT.toFixed(2)} tCO\u2082e/t` : "\u2014"} | ${r.feasible ? `${r.durablePerT.toFixed(2)}` : "\u2014"} | ${r.feasible ? `${inr2(r.marginPerT)}/t` : "\u2014"} | ${r.feasible ? r.note : r.blockedBy} |`
        );
      }
      const bestCarbon = rows.filter((r) => r.feasible).sort((a, b) => b.netCarbonPerT - a.netCarbonPerT)[0];
      const bestMargin = rows.filter((r) => r.feasible).sort((a, b) => b.marginPerT - a.marginPerT)[0];
      if (bestCarbon && bestMargin) {
        if (bestCarbon.pathway === bestMargin.pathway) {
          lines.push(`
**${bestCarbon.label}** wins on both carbon and margin for this feedstock \u2014 an unusually easy call.`);
        } else {
          lines.push(
            `
This feedstock has a genuine trade-off: **${bestCarbon.label}** delivers the most carbon (${bestCarbon.netCarbonPerT.toFixed(2)} tCO\u2082e/t) while **${bestMargin.label}** delivers the most margin (${inr2(bestMargin.marginPerT)}/t). Which one the optimiser picks is decided by the active objective, currently ${objectiveLabel}.`
          );
        }
      }
      answer = lines.join("\n");
      followUps = ["Compare carbon-first against profit-first", "Show the Pareto frontier"];
      break;
    }
    case "forecast": {
      const f3 = use("get_forecast", entities.sourceId ? { sourceId: entities.sourceId } : {});
      if (entities.sourceId && f3) {
        const future = f3.points.filter((p) => p.actual === null).slice(0, 8);
        const lines = [
          `Supply forecast for **${entities.sourceName}** (${STREAMS[f3.stream].label}).`,
          `Model: ${f3.model}`,
          `Walk-forward backtest MAPE: **${f3.backtestMapePct.toFixed(1)}%**, in-sample R\xB2 ${f3.r2.toFixed(3)}.
`,
          "| Week of | Forecast | 95% interval |",
          "| --- | ---: | --- |"
        ];
        for (const p of future) {
          lines.push(`| ${p.date} | ${nf(p.predicted)} t | ${nf(p.lower)} \u2013 ${nf(p.upper)} t |`);
        }
        answer = lines.join("\n");
      } else {
        answer = [
          `Across all ${net.sources.length} sources, expected supply over the next ${net.assumptions.windowDays} days is **${nf(f3.windowTotalT)} t** (90% interval ${nf(f3.windowLowerT)} to ${nf(f3.windowUpperT)} t).`,
          ``,
          `Forecast accuracy is measured, not assumed: a walk-forward backtest across the network gives a weighted MAPE of **${f3.networkMapePct.toFixed(1)}%**.`,
          ``,
          `Peak supply weeks ahead:`,
          ...f3.peakWeeks.map((p) => `- ${p.date}: ${nf(p.tonnes)} t`)
        ].join("\n");
      }
      followUps = ["What happens at the wheat harvest?", "Do we have capacity for the peak?"];
      break;
    }
    case "economics": {
      const e = use("get_economics");
      const r = use("get_optimization_result");
      const lines = [
        `Under the ${objectiveLabel} objective, the network turns ${nf(r.totals.divertedT)} t of residue into an operating margin of **${inr2(r.totals.marginInr)}** over ${net.assumptions.windowDays} days \u2014 ${inr2(r.totals.marginPerTonneInr)} per tonne.
`,
        `Carbon revenue alone is ${inr2(r.totals.carbonRevenueInr)}, of which the durable-removal share is what carries the biochar case.
`,
        "| Pathway | Tonnes | Revenue | Margin | Margin/t |",
        "| --- | ---: | ---: | ---: | ---: |"
      ];
      for (const [pid, v] of Object.entries(e.byPathway)) {
        lines.push(
          `| ${PATHWAYS[pid].short} | ${nf(v.tonnes)} | ${inr2(v.revenue)} | ${inr2(v.margin)} | ${inr2(v.margin / Math.max(1, v.tonnes))} |`
        );
      }
      lines.push(
        `
Marginal abatement cost is **${inr2(r.totals.abatementCostInrPerTco2e)} per tCO\u2082e**. A negative figure means the abatement pays for itself before any carbon revenue.`
      );
      answer = lines.join("\n");
      followUps = ["Which pathway has the best abatement cost?", "What if diesel hits \u20B9120?"];
      break;
    }
    case "resilience": {
      const r = use("get_resilience");
      const lines = [
        `**Network resilience: ${r.score.toFixed(0)}/100 \u2014 ${r.grade}**
`,
        r.method,
        "",
        "| Component | Score | Weight | Note |",
        "| --- | ---: | ---: | --- |"
      ];
      for (const c of r.components) {
        lines.push(`| ${c.label} | ${c.value.toFixed(0)} | ${(c.weight * 100).toFixed(0)}% | ${c.note} |`);
      }
      lines.push(
        `
The worst single-facility contingency is **${r.worstCaseFacilityName}**, whose loss would cost ${r.worstCaseLossPct.toFixed(1)}% of net carbon. Average loss across all ${r.n1Results.length} contingencies is ${r.meanLossPct.toFixed(1)}%.`
      );
      answer = lines.join("\n");
      followUps = [`What happens if ${r.worstCaseFacilityName} shuts down?`];
      break;
    }
    case "shadow_price": {
      const sp = use("get_shadow_prices");
      const binding = sp.filter((s) => s.binding);
      if (binding.length === 0) {
        answer = "No facility capacity constraint is currently binding, so additional capacity has no marginal value at present. The limiting factor is elsewhere \u2014 check bottlenecks.";
        break;
      }
      const lines = [
        `Capacity constraints are measured by re-optimisation: I add one tonne per day of headroom at each binding facility and re-solve the whole network. The difference is the true marginal value, including every knock-on reallocation.
`,
        "| Facility | Utilisation | Marginal carbon | Marginal margin | Per 10 t/day added |",
        "| --- | ---: | ---: | ---: | ---: |"
      ];
      const windowDays = net.assumptions.windowDays;
      for (const s of binding.slice(0, 8)) {
        lines.push(
          `| ${s.facilityName} | ${s.utilisationPct.toFixed(0)}% | ${s.carbonPerExtraTonne.toFixed(2)} tCO\u2082e/t | ${inr2(s.marginPerExtraTonne)}/t | ${nf(s.carbonPerExtraTonne * 10 * windowDays)} tCO\u2082e, ${inr2(s.marginPerExtraTonne * 10 * windowDays)} |`
        );
      }
      const top = binding[0];
      lines.push(
        `
Capital should go to **${top.facilityName}** first. Adding 10 t/day there is worth ${nf(top.carbonPerExtraTonne * 10 * windowDays)} tCO\u2082e and ${inr2(top.marginPerExtraTonne * 10 * windowDays)} per ${windowDays}-day window. Everywhere else in the network, an extra tonne of capacity is worth less.`
      );
      answer = lines.join("\n");
      followUps = [`Simulate adding 40 t/day at ${binding[0].facilityName}`];
      break;
    }
    case "stranded": {
      const st = use("get_stranded");
      const total = st.reduce((s, l) => s + l.tonnes, 0);
      const byReason = /* @__PURE__ */ new Map();
      for (const l of st) {
        const e = byReason.get(l.reason) ?? { t: 0, text: l.reasonText };
        e.t += l.tonnes;
        byReason.set(l.reason, e);
      }
      const lines = [
        `**${nf(total)} t** of the ${nf(twin2.getResult().totals.suppliedT)} t available cannot be placed this window. Every lot has an attributed reason rather than being lumped into "unallocated":
`,
        "| Reason | Tonnes | What it means |",
        "| --- | ---: | --- |"
      ];
      for (const [reason, v] of [...byReason.entries()].sort((a, b) => b[1].t - a[1].t)) {
        lines.push(`| ${reason.replace(/_/g, " ")} | ${nf(v.t)} t | ${v.text} |`);
      }
      const co2 = st.reduce((s, l) => s + l.counterfactualEmissionsT, 0);
      lines.push(
        `
If nothing changes, that material goes to its counterfactual fate, which carries **${nf(co2)} tCO\u2082e** of avoidable emissions this window.`
      );
      lines.push(`
Largest individual lots:
`);
      for (const l of st.slice(0, 5)) {
        lines.push(`- ${nf(l.tonnes)} t at **${l.name}** (${STREAMS[l.stream].label}) \u2014 ${l.reasonText}`);
      }
      answer = lines.join("\n");
      followUps = ["Which bottleneck causes the most stranding?", "Where should we add capacity?"];
      break;
    }
    case "compare_objectives": {
      const pareto = twin2.getPareto();
      toolCalls.push({
        name: "get_pareto_frontier",
        args: {},
        summary: `${pareto.length} weighted re-solves`
      });
      const pure0 = pareto[0];
      const pure1 = pareto[pareto.length - 1];
      const lines = [
        `The trade-off is real and measurable. I re-solved the network at ${pareto.length} objective weights between pure profit and pure carbon:
`,
        "| Weight on carbon | Net carbon | Margin | Diverted |",
        "| ---: | ---: | ---: | ---: |"
      ];
      for (const p of pareto.filter((_, i) => i % 2 === 0)) {
        lines.push(
          `| ${(p.weight * 100).toFixed(0)}% | ${nf(p.netCarbonT)} tCO\u2082e | ${inr2(p.marginInr)} | ${nf(p.divertedT)} t |`
        );
      }
      const carbonGain = pure1.netCarbonT - pure0.netCarbonT;
      const marginLoss = pure0.marginInr - pure1.marginInr;
      lines.push(
        `
Going from pure profit to pure carbon buys **${nf(carbonGain)} tCO\u2082e** and costs **${inr2(marginLoss)}** \u2014 an implied switching cost of ${inr2(marginLoss / Math.max(1, carbonGain))} per tCO\u2082e. Compare that against the ${inr2(CARBON_MARKETS.durableCdr.price)}/t removal price to decide whether the carbon-first configuration is actually the profitable one.`
      );
      answer = lines.join("\n");
      followUps = ["Switch to carbon first", "What drives the difference?"];
      break;
    }
    default: {
      const r = use("get_optimization_result");
      const b = use("get_bottlenecks");
      const st = use("get_stranded");
      const lines = [
        `**Network status \u2014 ${net.asOf}, ${net.assumptions.windowDays}-day window, ${objectiveLabel} objective**
`,
        `- ${nf(r.totals.divertedT)} t of ${nf(r.totals.suppliedT)} t diverted (${r.totals.divertedPct.toFixed(1)}%)`,
        `- Net carbon **${nf(r.totals.netCarbonT)} tCO\u2082e**, of which ${nf(r.totals.durableRemovalT)} t is durable removal`,
        `- Operating margin **${inr2(r.totals.marginInr)}** (${inr2(r.totals.marginPerTonneInr)}/t)`,
        `- ${r.openFacilities.length} of ${net.facilities.length} facilities operating`,
        `- Solver: ${nf(r.telemetry.arcsFeasible)} feasible arcs, ${r.telemetry.bnbNodesExplored} branch-and-bound nodes, ${r.telemetry.gapPct.toFixed(2)}% bound gap, ${r.telemetry.solveMs} ms`,
        ``,
        b.length > 0 ? `The binding issue right now is **${b[0].title}**. ${b[0].recommendation}` : `No bottlenecks detected.`,
        ``,
        `${nf(st.reduce((s, l) => s + l.tonnes, 0))} t remains unplaced.`
      ];
      answer = lines.join("\n");
      followUps = [
        "Which bottleneck should we fix first?",
        "What happens if the largest plant goes offline?",
        "Where should we add capacity?"
      ];
    }
  }
  return {
    answer,
    toolCalls,
    intent,
    entities,
    engine: "deterministic",
    followUps
  };
}
var SUGGESTED_QUESTIONS = [
  "What is the network doing right now?",
  "Why was that facility selected?",
  "What happens if the largest plant goes offline?",
  "Which waste sources are underutilised?",
  "What is our highest-carbon-impact bottleneck?",
  "How durable is the biochar carbon we are producing?",
  "Which pathway gives the highest profit for paddy straw?",
  "Where should we add capacity next?",
  "How much carbon could we sequester next month?",
  "Show me carbon versus profit across objectives",
  "Why is feedstock being stranded?",
  "How resilient is the network?"
];

// packages/api/src/validate.ts
function validateScenarioParams(def, net, raw) {
  const given = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const known = def.params.map((p) => p.key);
  for (const key of Object.keys(given)) {
    if (!known.includes(key)) {
      return {
        error: `Scenario "${def.kind}" has no parameter "${key}". Expected: ${known.join(", ")}.`
      };
    }
  }
  const params = {};
  for (const p of def.params) {
    const supplied = given[p.key];
    if (supplied === void 0 || supplied === null || supplied === "") {
      params[p.key] = p.defaultValue;
      continue;
    }
    if (p.type === "number") {
      const n = Number(supplied);
      if (!Number.isFinite(n)) {
        return { error: `Parameter "${p.label}" must be a number.` };
      }
      if (p.min !== void 0 && n < p.min) {
        return { error: `Parameter "${p.label}" must be at least ${p.min}${p.unit ?? ""}.` };
      }
      if (p.max !== void 0 && n > p.max) {
        return { error: `Parameter "${p.label}" must be at most ${p.max}${p.unit ?? ""}.` };
      }
      params[p.key] = n;
      continue;
    }
    const s = String(supplied);
    if (p.type === "choice") {
      if (!p.choices?.some((c) => c.value === s)) {
        return {
          error: `Parameter "${p.label}" must be one of: ${(p.choices ?? []).map((c) => c.value).join(", ")}.`
        };
      }
    } else if (!entityExists(net, p.entityType, s)) {
      return { error: `Parameter "${p.label}" does not name a known ${p.entityType ?? "entity"}.` };
    }
    params[p.key] = s;
  }
  return { params };
}
function entityExists(net, kind, id) {
  switch (kind) {
    case "facility":
      return net.facilities.some((f3) => f3.id === id);
    case "source":
      return net.sources.some((s) => s.id === id);
    case "district":
      return net.sources.some((s) => s.district === id);
    case "stream":
      return Object.hasOwn(STREAMS, id);
    default:
      return false;
  }
}

// packages/engine/src/index.ts
var PRODUCT = {
  name: "TERRAFLUX",
  tagline: "Circular Carbon Network Operating System",
  problemStatement: "HackOut\u201926 PS11 \u2014 Waste-to-Carbon Value Chain",
  region: "Punjab \xB7 Haryana \xB7 Chandigarh",
  dataNotice: "All entity names, volumes and capacities are synthetic. District coordinates are real. Emission factors, prices and scientific relations are cited from published sources at the point of use."
};

// packages/api/src/demo.ts
var DEMO_SCRIPT = {
  totalSeconds: 180,
  steps: [
    {
      id: "step-1",
      seconds: 25,
      route: "/map",
      title: "The network exists",
      say: "This is a real waste-to-carbon network across Punjab and Haryana. Forty-two aggregation points, eighteen processing facilities, five conversion pathways. Fifty-seven thousand tonnes of residue available in this thirty-day window \u2014 most of which, today, gets burned in the field.",
      action: "Network Map loads. Sources, facilities and active flows draw in.",
      command: { kind: "none" },
      watchFor: "Supply available and the density of unserved sources"
    },
    {
      id: "step-2",
      seconds: 30,
      route: "/optimization",
      title: "The system decides",
      say: "The optimiser is not scoring a list. It builds every feasible source-facility-pathway arc, prices each one in carbon and in rupees, and solves the allocation exactly with min-cost flow inside a branch and bound over which plants run at all. It reports its own optimality gap.",
      action: "Run the optimiser. Watch the stages and the solver telemetry.",
      command: { kind: "runOptimization" },
      watchFor: "Feasible arcs, branch-and-bound nodes, bound gap, solve time"
    },
    {
      id: "step-3",
      seconds: 25,
      route: "/carbon",
      title: "Every number is traceable",
      say: "The carbon ledger shows the arithmetic, not a headline. Biogenic CO2 is excluded. Durable removal and avoided emissions are never added together. And biochar permanence is corrected from the European reference soil temperature to twenty-six degrees \u2014 biochar decays about forty-five percent faster in Indian soil, which most accounting in this space gets wrong.",
      action: "Open the ledger and expand the permanence panel.",
      command: { kind: "none" },
      watchFor: "BC100 at 26 \xB0C versus 14.9 \xB0C, and the P5\u2013P95 uncertainty band"
    },
    {
      id: "step-4",
      seconds: 25,
      route: "/optimization",
      title: "The objective changes the network",
      say: "Switch from Profit First to Carbon First. Nothing physical changes \u2014 but paddy straw stops going to pyrolysis and starts going to pellet co-firing, because displacing coal beats locking forty percent of the carbon in char. The map redraws. That is a real trade-off, not a filter.",
      action: "Switch objective to Carbon First.",
      command: { kind: "setObjective", mode: "carbon_first" },
      watchFor: "Net carbon up, margin down, and the pathway mix inverting"
    },
    {
      id: "step-5",
      seconds: 45,
      route: "/scenarios",
      title: "Something breaks",
      say: "Now take the largest pellet plant offline. The network re-optimises from scratch \u2014 not a patch, a full re-solve. Watch the routes redraw, the waste reallocate, and the system tell you exactly which flows moved, how far, and what it cost in carbon and rupees.",
      action: "Run the facility-outage scenario on Panipat Co-firing Feed Plant.",
      command: {
        kind: "runScenario",
        scenario: "facility_offline",
        params: { facilityId: "FAC-PL-03" }
      },
      watchFor: "Routes animating to new destinations; the before/after delta bar"
    },
    {
      id: "step-6",
      seconds: 20,
      route: "/bottlenecks",
      title: "And it tells you what to do",
      say: "The system does not stop at reporting damage. It measures the marginal value of capacity by re-optimising with one extra tonne per day at every binding facility, and ranks where the next rupee of capital should go. That is the difference between a dashboard and an operating system.",
      action: "Open Bottlenecks and read the top shadow price.",
      command: { kind: "none" },
      watchFor: "Marginal tCO2e and rupees per additional tonne of capacity"
    },
    {
      id: "step-7",
      seconds: 10,
      route: "/copilot",
      title: "Ask it anything",
      say: "And every one of those numbers is available to the copilot, which answers from the same engine the screens read. It never invents a figure \u2014 it calls a tool, and shows you which one.",
      action: 'Ask: "Where should we add capacity next?"',
      command: { kind: "none" },
      watchFor: "The tool-call trace beneath the answer"
    }
  ]
};

// packages/api/src/index.ts
var PORT = Number(process.env.PORT ?? 5174);
var HOST = process.env.HOST ?? "127.0.0.1";
var twin = new Twin();
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  res.end(payload);
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body is not valid JSON");
  }
}
var VALID_OBJECTIVES = new Set(Object.keys(OBJECTIVE_META));
var ASSUMPTION_BOUNDS = ASSUMPTION_META;
var webDist;
function getWebDist() {
  if (webDist !== void 0) return webDist;
  try {
    webDist = resolve(fileURLToPath(new URL("../../web/dist", import.meta.url)));
  } catch {
    webDist = null;
  }
  return webDist;
}
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};
async function serveStatic(res, urlPath) {
  const dist2 = getWebDist();
  if (!dist2) return false;
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = join(dist2, rel === "/" || rel === "\\" ? "index.html" : rel);
  if (!file.startsWith(dist2)) return false;
  try {
    const st = await stat(file);
    if (st.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(dist2, "index.html");
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "content-length": buf.length
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}
var GET = {
  "/api/health": (_req, res) => json(res, 200, { ok: true, version: twin.getVersion() }),
  /** Everything the client needs once, at boot. */
  "/api/bootstrap": (_req, res) => {
    const net = twin.getState();
    json(res, 200, {
      product: PRODUCT,
      network: {
        sources: net.sources,
        facilities: net.facilities,
        vehicles: net.vehicles,
        assumptions: net.assumptions,
        asOf: net.asOf
      },
      reference: {
        streams: STREAMS,
        pathways: PATHWAYS,
        counterfactuals: COUNTERFACTUALS,
        season: SEASON,
        objectives: OBJECTIVE_META,
        assumptionMeta: ASSUMPTION_META,
        emissionFactors: EF_LIST,
        prices: PRICE_LIST,
        carbonMarkets: CARBON_MARKETS,
        vehicles: VEHICLES
      },
      scenarios: scenarioDefs(net),
      copilot: { suggested: SUGGESTED_QUESTIONS, tools: TOOL_DEFS },
      demo: DEMO_SCRIPT
    });
  },
  "/api/state": (_req, res) => {
    const net = twin.getState();
    json(res, 200, {
      version: twin.getVersion(),
      objective: twin.getObjective(),
      assumptions: net.assumptions,
      asOf: net.asOf,
      appliedScenarios: net.appliedScenarios,
      sources: net.sources,
      facilities: net.facilities,
      vehicles: net.vehicles,
      events: twin.getEvents().slice(0, 60)
    });
  },
  "/api/optimization": (_req, res) => json(res, 200, {
    version: twin.getVersion(),
    objective: twin.getObjective(),
    result: twin.getResult(),
    baseline: twin.getBaseline().totals
  }),
  "/api/routing": (_req, res) => json(res, 200, twin.getRouting()),
  "/api/carbon": (_req, res) => json(res, 200, {
    ledger: twin.getLedger(),
    aggregate: twin.getCarbonAggregate(),
    totals: twin.getResult().totals,
    // Derived from the same aggregate the ledger was built from, so the
    // evidence panel cannot describe a different plan than the lines above it.
    provenance: twin.getProvenance()
  }),
  "/api/brief": (_req, res) => json(res, 200, twin.getBrief()),
  "/api/opportunities": (_req, res) => json(res, 200, twin.getCarbonOpportunities()),
  "/api/evidence": (_req, res) => json(res, 200, twin.getEvidence()),
  "/api/evidence/contributors": (_req, res, url) => {
    const line = url.searchParams.get("line");
    if (!line) return json(res, 400, { error: 'A ledger line "line" key is required.' });
    const rows = twin.getLineContributors(line);
    if (rows.length === 0) {
      return json(res, 200, { line, contributors: [], note: "No allocation in the current plan contributes to this line." });
    }
    json(res, 200, { line, contributors: rows, note: null });
  },
  "/api/facilities/carbon": (_req, res) => json(res, 200, twin.getFacilityRanking()),
  "/api/facilities/profile": (_req, res, url) => {
    const id = url.searchParams.get("id");
    if (!id) return json(res, 400, { error: 'A facility "id" is required.' });
    const profile = twin.getFacilityCarbon(id);
    if (!profile) return json(res, 404, { error: `No facility "${id}" in the network.` });
    json(res, 200, profile);
  },
  "/api/facilities/compare": (_req, res, url) => {
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (!a || !b) return json(res, 400, { error: 'Both "a" and "b" facility ids are required.' });
    if (a === b) return json(res, 400, { error: "Pick two different facilities to compare." });
    const cmp = twin.getFacilityComparison(a, b);
    if (!cmp) return json(res, 404, { error: "One of those facilities is not in the network." });
    json(res, 200, cmp);
  },
  "/api/materials": (_req, res) => json(res, 200, twin.getMaterials()),
  "/api/pathways/decision": (_req, res, url) => {
    const sourceId = url.searchParams.get("sourceId");
    if (!sourceId) return json(res, 400, { error: 'A "sourceId" is required.' });
    const lens = String(url.searchParams.get("lens") ?? "carbon_first");
    if (!VALID_OBJECTIVES.has(lens)) {
      return json(res, 400, {
        error: `Unknown lens "${lens}". Expected one of: ${[...VALID_OBJECTIVES].join(", ")}.`
      });
    }
    const decision = twin.getPathwayDecision(sourceId, lens);
    if (!decision) return json(res, 404, { error: `No source "${sourceId}" in the network.` });
    json(res, 200, decision);
  },
  "/api/pathways/diff": (_req, res, url) => {
    const sourceId = url.searchParams.get("sourceId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!sourceId || !from || !to) {
      return json(res, 400, { error: '"sourceId", "from" and "to" are all required.' });
    }
    const lens = String(url.searchParams.get("lens") ?? "carbon_first");
    if (!VALID_OBJECTIVES.has(lens)) {
      return json(res, 400, { error: `Unknown lens "${lens}".` });
    }
    if (!(from in PATHWAYS) || !(to in PATHWAYS)) {
      return json(res, 400, {
        error: `Unknown pathway. Expected one of: ${Object.keys(PATHWAYS).join(", ")}.`
      });
    }
    const diff = twin.getPathwayDiff(
      sourceId,
      lens,
      from,
      to
    );
    if (!diff) {
      return json(res, 404, {
        error: "Those two pathways cannot be compared for this material: at least one has no feasible destination in the current network."
      });
    }
    json(res, 200, diff);
  },
  "/api/trace/candidates": (_req, res) => json(res, 200, twin.getTraceCandidates()),
  "/api/trace": (_req, res, url) => {
    const sourceId = url.searchParams.get("sourceId");
    const facilityId = url.searchParams.get("facilityId");
    if (!sourceId || !facilityId) {
      return json(res, 400, {
        error: 'Both "sourceId" and "facilityId" are required to trace a contribution.'
      });
    }
    const trace = twin.getTrace(sourceId, facilityId);
    if (!trace) {
      return json(res, 404, {
        error: `No allocation from ${sourceId} to ${facilityId} in the current plan. It may have been stranded, or the plan may have changed.`
      });
    }
    json(res, 200, trace);
  },
  // Split from /api/carbon because it costs twenty optimiser runs: the Carbon Home
  // renders its headline immediately and fills the trend in when this arrives.
  "/api/carbon/history": (_req, res) => json(res, 200, twin.getCarbonHistory()),
  "/api/economics": (_req, res) => json(res, 200, {
    rollup: twin.getEconomics(),
    totals: twin.getResult().totals,
    allocations: twin.getResult().allocations
  }),
  "/api/bottlenecks": (_req, res) => json(res, 200, {
    bottlenecks: twin.getBottlenecks(),
    stranded: twin.getStranded(),
    opportunities: twin.getOpportunities()
  }),
  "/api/resilience": (_req, res) => json(res, 200, twin.getResilience()),
  "/api/forecast": (_req, res, url) => {
    const sourceId = url.searchParams.get("sourceId");
    const f3 = twin.getForecast();
    if (sourceId) {
      const one = f3.bySource[sourceId];
      if (!one) return json(res, 404, { error: `Unknown source ${sourceId}` });
      return json(res, 200, one);
    }
    json(res, 200, f3);
  },
  "/api/pareto": (_req, res) => json(res, 200, twin.getPareto()),
  "/api/pathways": (_req, res, url) => {
    const stream = url.searchParams.get("stream");
    if (!stream || !(stream in STREAMS)) {
      return json(res, 400, { error: 'Query parameter "stream" is required and must be a known stream id.' });
    }
    json(res, 200, { stream, rows: comparePathways(twin, stream) });
  },
  "/api/events": (_req, res) => json(res, 200, twin.getEvents()),
  "/api/scenarios": (_req, res) => json(res, 200, scenarioDefs(twin.getState()))
};
var POST = {
  "/api/objective": async (req, res) => {
    const body = await readBody(req);
    const mode = String(body.mode ?? "");
    if (!VALID_OBJECTIVES.has(mode)) {
      return json(res, 400, {
        error: `Unknown objective "${mode}". Expected one of: ${[...VALID_OBJECTIVES].join(", ")}.`
      });
    }
    twin.setObjective(mode);
    json(res, 200, { objective: twin.getObjective(), version: twin.getVersion() });
  },
  "/api/assumptions": async (req, res) => {
    const body = await readBody(req);
    const patch = {};
    for (const [k, v] of Object.entries(body)) {
      const meta = ASSUMPTION_BOUNDS[k];
      if (!meta) {
        return json(res, 400, { error: `Unknown assumption "${k}".` });
      }
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return json(res, 400, { error: `Assumption "${k}" must be a number.` });
      }
      if (n < meta.min || n > meta.max) {
        return json(res, 400, {
          error: `Assumption "${k}" must be between ${meta.min} and ${meta.max} ${meta.unit}.`
        });
      }
      patch[k] = n;
    }
    twin.updateAssumptions(patch);
    json(res, 200, { assumptions: twin.getState().assumptions, version: twin.getVersion() });
  },
  "/api/shock": async (req, res) => {
    const body = await readBody(req);
    const kind = String(body.kind ?? "");
    const net = twin.getState();
    const defs = scenarioDefs(net);
    const def = defs.find((d) => d.kind === kind);
    if (!def) {
      return json(res, 400, {
        error: `Unknown scenario "${kind}". Expected one of: ${defs.map((d) => d.kind).join(", ")}.`
      });
    }
    const checked = validateScenarioParams(def, net, body.params);
    if ("error" in checked) return json(res, 400, { error: checked.error });
    const scenario = { kind, params: checked.params };
    const shock = twin.runShock(scenario);
    const objectives = body.compareObjectives === true ? twin.compareShockObjectives(scenario) : null;
    json(res, 200, { shock, objectives });
  },
  "/api/scenario": async (req, res) => {
    const body = await readBody(req);
    const kind = String(body.kind ?? "");
    const net = twin.getState();
    const defs = scenarioDefs(net);
    const def = defs.find((d) => d.kind === kind);
    if (!def) {
      return json(res, 400, {
        error: `Unknown scenario "${kind}". Expected one of: ${defs.map((d) => d.kind).join(", ")}.`
      });
    }
    const checked = validateScenarioParams(def, net, body.params);
    if ("error" in checked) return json(res, 400, { error: checked.error });
    const scenario = {
      kind,
      params: checked.params
    };
    const commit = body.commit === true;
    const result = commit ? twin.commitScenario(scenario) : twin.previewScenario(scenario);
    json(res, 200, { committed: commit, version: twin.getVersion(), result });
  },
  "/api/copilot": async (req, res) => {
    const body = await readBody(req);
    const question = String(body.question ?? "").trim();
    if (!question) return json(res, 400, { error: "A question is required." });
    if (question.length > 2e3) return json(res, 400, { error: "Question is too long." });
    json(res, 200, ask(twin, question));
  },
  "/api/ai/insights": async (req, res) => {
    const { generateStructuredInsight: generateStructuredInsight2 } = await Promise.resolve().then(() => (init_ai(), ai_exports));
    const body = await readBody(req);
    const templateKey = String(body.templateKey ?? "");
    const dataPackage = typeof body.dataPackage === "object" ? body.dataPackage : {};
    if (!templateKey) return json(res, 400, { error: "templateKey is required." });
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      return json(res, 503, {
        error: "AI insights are not configured on this server. Set GROQ_API_KEY or GEMINI_API_KEY to enable them."
      });
    }
    try {
      const { insight, provider } = await generateStructuredInsight2(templateKey, dataPackage);
      json(res, 200, { insight, provider });
    } catch (err) {
      json(res, 500, { error: err.message || "Failed to generate insight" });
    }
  },
  "/api/reset": async (_req, res) => {
    twin.reset();
    json(res, 200, { ok: true, version: twin.getVersion() });
  }
};
async function handleRequest(req, res) {
  const started = Date.now();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    if (req.method === "GET" && GET[url.pathname]) {
      await GET[url.pathname](req, res, url);
    } else if (req.method === "POST" && POST[url.pathname]) {
      await POST[url.pathname](req, res, url);
    } else if (url.pathname.startsWith("/api/")) {
      json(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
    } else if (!await serveStatic(res, url.pathname)) {
      json(res, 404, {
        error: "Not found. In development the client is served by Vite on port 5173."
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api] ${req.method} ${url.pathname} failed:`, err);
    if (!res.headersSent) json(res, 500, { error: message });
  }
  const ms = Date.now() - started;
  if (url.pathname.startsWith("/api/") && ms > 150) {
    console.log(`[api] ${req.method} ${url.pathname} ${ms}ms`);
  }
}
function isDirectRun() {
  try {
    if (process.argv[1] === void 0) return false;
    return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isDirectRun()) {
  const server = createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    const t = Date.now();
    twin.getResult();
    console.log(`
  TERRAFLUX  ${PRODUCT.tagline}
  ${PRODUCT.problemStatement}

  API      http://${HOST}:${PORT}
  Network  ${twin.getState().sources.length} sources, ${twin.getState().facilities.length} facilities, ${PRODUCT.region}
  Warmup   first solve in ${Date.now() - t} ms

  All demo data is synthetic. Emission factors and prices are cited from published sources.
`);
  });
}

// packages/api/src/vercel-entry.ts
function restorePath(req) {
  if (!req.url) return;
  const url = new URL(req.url, "http://localhost");
  const original = url.searchParams.get("__path");
  if (original === null) return;
  url.searchParams.delete("__path");
  const query = url.searchParams.toString();
  req.url = `/api/${original.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
}
async function handler(req, res) {
  try {
    restorePath(req);
    await handleRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "").split("\n").slice(0, 6) : [];
    console.error("[api] request failed:", err);
    if (res.headersSent) {
      res.end();
      return;
    }
    const body = JSON.stringify({
      error: "The carbon engine failed to handle this request.",
      detail: message,
      where: stack
    });
    res.writeHead(500, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store"
    });
    res.end(body);
  }
}
export {
  handler as default
};
