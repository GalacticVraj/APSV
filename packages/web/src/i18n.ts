/**
 * i18n Localization Layer for TerraFlux Waste Generator Module.
 *
 * Supports English, Hindi (हिन्दी), Punjabi (ਪੰਜਾਬੀ), and Marathi (मराठी).
 * Persists language choice in localStorage.
 */

export type LanguageCode = 'en' | 'hi' | 'pa' | 'mr';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  region: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'Global' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'North India' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'Punjab & Haryana' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'Maharashtra' },
];

const STORAGE_KEY = 'terraflux_generator_lang';

export function getSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['en', 'hi', 'pa', 'mr'].includes(saved)) {
      return saved as LanguageCode;
    }
  } catch {
    // fallback
  }
  return 'en';
}

export function saveLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export const DICTIONARY: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Persona Landing
    select_role: 'Select Your Role',
    role_subtitle: 'Choose your entry point into the TerraFlux network',
    role_generator: 'WASTE GENERATOR',
    role_generator_sub: 'Farmer / Waste Producer',
    role_facility: 'FACILITY',
    role_facility_sub: 'Processing Infrastructure',
    role_carbon: 'CARBON',
    role_carbon_sub: 'Ledger & Permanence',
    role_economy: 'ECONOMY',
    role_economy_sub: 'Markets & Abatement',

    // Language Selector
    select_language: 'Select Language',
    select_language_sub: 'Choose your preferred language for the Waste Generator module',
    continue_btn: 'Proceed →',

    // Nav
    nav_home: 'My Material',
    nav_pathway: 'Best Pathway',
    nav_journey: 'Follow My Tonne',
    nav_lang: 'Language',
    nav_back_terminal: '← Operator Terminal',

    // Header & Offline
    farmer_module_title: 'Farmer Waste Portal',
    synced_status: '2 min ago · Offline Ready',

    // Home / My Material
    hero_available_label: 'Available Material',
    hero_available_value: '8.4 Tonnes Available',
    hero_material_type: 'Paddy Straw (Agricultural Residue)',
    hero_status: 'Ready for Pickup Today',
    
    rec_badge: 'TERRAFLUX RECOMMENDED PATHWAY',
    rec_title: 'BIOCHAR → Facility 02 (Batala)',
    rec_meta: '18.4 km haul · +4.8 tCO₂e carbon saved · ₹12,400 est. value',
    view_best_pathway_btn: 'View Best Pathway →',

    quick_facts: 'Quick Material Facts',
    fact_moisture: 'Moisture: 14% (Dry - Ideal for Pyrolysis)',
    fact_ash: 'Ash Content: 12% (Standard)',
    fact_pickup: 'Expected Pickup: Within 24 Hours',

    // Best Pathway Screen
    pathways_title: 'Pathway Comparison',
    pathways_sub: 'Evaluate conversion pathways for your 8.4 tonnes of paddy straw',
    recommended_badge: 'RECOMMENDED',
    rec_reason_biochar: 'Highest combined carbon + economic value for this material.',
    rec_reason_biogas: 'Closer haul distance, but yields lower net carbon durability.',
    rec_reason_compost: 'Simplest processing, but lower monetary return.',

    val_per_tonne: 'Value / Tonne',
    net_carbon: 'Net Carbon',
    haul_distance: 'Distance',
    process_time: 'Est. Processing',

    what_changed_title: 'What Changed?',
    delta_biochar_to_biogas: '₹1,200 less value, but 6.2 km closer haul.',
    delta_biochar_to_compost: '₹3,400 less value, but requires zero drying prep.',
    delta_biogas_to_biochar: '₹1,200 more value & +1.6 tCO₂e carbon removal.',

    select_this_pathway: 'Select This Pathway',

    // Follow My Tonne (Journey)
    journey_title: 'Material Journey',
    journey_sub: 'Track how your waste transforms into carbon removal and cash',
    
    step_waste: 'MY WASTE',
    step_waste_desc: '8.4 tonnes of paddy straw collected at farm gate.',
    
    step_collection: 'COLLECTION',
    step_collection_desc: '16t baled truck dispatched. Route distance: 18.4 km.',
    
    step_facility: 'FACILITY',
    step_facility_desc: 'Arrives at Facility 02 (Batala Pyrolysis Unit).',
    
    step_processing: 'PROCESSING',
    step_processing_desc: 'Converted into high-carbon biochar at 550°C.',
    
    step_carbon: 'CARBON',
    step_carbon_desc: '+4.8 tCO₂e durable carbon removal locked for 100 years.',
    
    step_value: 'VALUE',
    step_value_desc: '₹12,400 total value credited to farmer account.',

    // Common
    coming_soon: 'Coming Soon',
    coming_soon_desc: 'This module is under active deployment. Use the Waste Generator module or return to the Operator Terminal.',
    back_to_entry: '← Back to Role Entry',

    // True Landing (/welcome)
    welcome_eyebrow: 'CIRCULAR CARBON NETWORK OPERATING SYSTEM',
    welcome_subtitle: 'Waste to Carbon Value Chain · Punjab & Haryana',
    welcome_tagline: 'Connecting Waste. Creating Value. Building a Cleaner Tomorrow.',
    select_role_btn: 'Select Role',
    farmer_app_btn: 'Farmer App',
    control_tower_btn: 'Control Tower Terminal',
    welcome_footer_left: 'Less Waste',
    welcome_footer_mid: 'More Value',
    welcome_footer_right: 'Greener Tomorrow',

    // Change 8 — Waste Intake Questionnaire v2
    intake_cat_heading: 'What type of waste do you have?',
    cat_agri_title: 'Agricultural Waste',
    cat_agri_sub: 'Crop & farm residue',
    cat_muni_title: 'Municipal Waste',
    cat_muni_sub: 'Organic city waste',
    cat_live_title: 'Livestock Waste',
    cat_live_sub: 'Manure & dairy waste',
    cat_ind_title: 'Industrial Waste',
    cat_ind_sub: 'Process & biomass',

    wizard_step_of: 'Step {step} of {total}',
    btn_back_step: '← Back',
    btn_next_step: 'Next Step →',
    btn_complete_intake: 'Complete & View Recommendation →',
    why_we_ask: 'Why we ask ⓘ',
    why_ask_agri: 'Agricultural residue is often suitable for biochar/pyrolysis, but moisture, quantity, seasonality and transport distance strongly affect what is possible.',
    why_ask_muni: 'Usually anaerobic digestion/biogas, depending on composition, contamination and operating conditions.',
    why_ask_live: 'A major feedstock for the biogas/co-digestion pathway — anaerobic digestion, potentially blended with other suitable feedstocks.',
    why_ask_ind: 'Depending on characteristics, this may suit biogas/CBG, biochar/thermal conversion, or another processing pathway.',
    other_placeholder: 'Please specify details...',
    location_district_label: 'Village / District Location',
    location_district_placeholder: 'e.g. Batala, Gurdaspur',
    use_map_location: '📍 Use map location',
    map_location_captured: '✓ Map location captured (31.81° N, 75.20° E)',
    dont_know: "Don't know",

    // Agri Questions
    agri_q1_title: 'What type of agricultural waste do you have?',
    agri_q1_helper: 'paddy straw, wheat straw, husk, stalks, leaves, pruning waste',
    opt_paddy_straw: 'Paddy straw',
    opt_wheat_straw: 'Wheat straw',
    opt_corn_stalks: 'Corn stalks',
    opt_husk: 'Husk',
    opt_sugarcane_residue: 'Sugarcane residue',
    opt_pruning_waste: 'Pruning/woody waste',
    opt_other: 'Other',

    agri_q2_title: 'How much waste is available?',
    unit_tonnes: 'tonnes',
    unit_kg: 'kg',

    agri_q3_title: 'Where is the waste located?',
    agri_q4_title: 'When is the waste available?',
    opt_one_time: 'One-time',
    opt_seasonal: 'Seasonal',
    opt_monthly: 'Monthly',
    opt_year_round: 'Year-round',

    agri_q5_title: 'What is the approximate moisture level?',
    opt_dry: 'Dry',
    opt_moderately_wet: 'Moderately wet',
    opt_very_wet: 'Very wet',

    agri_q6_title: 'Is the waste currently being burned, dumped, composted, or stored?',
    opt_burned: 'Burned',
    opt_dumped: 'Dumped',
    opt_stored: 'Stored',
    opt_composting: 'Composting',

    // Muni Questions
    muni_q1_title: 'What type of municipal waste is available?',
    muni_q1_helper: 'household food waste, market waste, garden waste, municipal biodegradable waste',
    opt_food_waste: 'Food/kitchen waste',
    opt_market_waste: 'Vegetable/fruit market waste',
    opt_garden_waste: 'Garden waste',
    opt_mixed_organic: 'Mixed organic waste',

    muni_q2_title: 'Where is the waste located?',
    muni_q3_title: 'How much waste is generated?',
    unit_tonnes_day: 'tonnes/day',
    unit_tonnes_week: 'tonnes/week',
    unit_tonnes_month: 'tonnes/month',

    muni_q4_title: 'Is the waste source-segregated?',
    opt_yes: 'Yes',
    opt_partially: 'Partially',
    opt_no: 'No',

    muni_q5_title: 'What is the approximate moisture level?',
    opt_low: 'Low',
    opt_medium: 'Medium',
    opt_high: 'High',

    muni_q6_title: 'Does the waste contain contaminants?',
    opt_very_little: 'Very little',
    opt_some_contaminants: 'Some plastic/inert material',
    opt_high_contamination: 'High contamination',

    muni_q7_title: 'Where is the waste collected from?',
    opt_residential: 'Residential area',
    opt_market: 'Market',
    opt_public_facility: 'Public facility',
    opt_multiple_locations: 'Multiple locations',

    muni_q8_title: 'How frequently is it available?',
    opt_daily: 'Daily',
    opt_weekly: 'Weekly',

    // Livestock Questions
    live_q1_title: 'What type of animal waste do you have?',
    live_q1_helper: 'cattle dung, poultry manure, dairy waste',
    opt_cattle_dung: 'Cattle dung',
    opt_poultry_manure: 'Poultry manure',
    opt_dairy_waste: 'Dairy waste',

    live_q2_title: 'How much is available?',
    unit_per_day: 'per day',
    unit_per_month: 'per month',

    live_q3_title: 'Where is it generated?',
    opt_facility_farm: 'Farm',
    opt_facility_dairy: 'Dairy',
    opt_facility_poultry: 'Poultry facility',

    live_q4_title: 'Is the waste mixed with other materials?',
    opt_crop_residue: 'Crop residue',
    opt_water_slurry: 'Water/slurry',

    live_q5_title: 'What is its approximate moisture condition?',
    opt_semi_wet: 'Semi-wet',

    live_q6_title: 'Is the supply continuous?',
    opt_irregular: 'Irregular',

    live_q7_title: 'Do you currently send it somewhere?',
    opt_biogas_plant: 'Biogas plant',
    opt_agri_use: 'Agricultural use',
    opt_no_current_use: 'No current use',

    // Industrial Questions
    ind_q1_title: 'What type of industrial waste do you generate?',
    ind_q1_helper: 'press mud, bagasse, food-processing waste, industrial organic residues',
    opt_press_mud: 'Press mud',
    opt_bagasse: 'Bagasse',
    opt_food_processing: 'Food-processing waste',
    opt_wood_biomass: 'Wood/biomass residue',
    opt_organic_industrial: 'Organic industrial waste',

    ind_q2_title: 'How much waste is generated?',
    ind_q3_title: 'Where is the waste located?',
    ind_q4_title: 'What is the moisture condition?',
    ind_q5_title: 'Is the waste biodegradable/organic?',
    ind_q6_title: 'Is the waste mixed with chemicals or hazardous materials?',
    ind_q7_title: 'How frequently is it generated?',
    ind_q8_title: 'What happens to the waste currently?',
    opt_sold: 'Sold',
    opt_reused: 'Reused',
  },

  hi: {
    // Persona Landing
    select_role: 'अपनी भूमिका चुनें',
    role_subtitle: 'टेराफ्लक्स नेटवर्क में अपना प्रवेश बिंदु चुनें',
    role_generator: 'अपशिष्ट उत्पादक',
    role_generator_sub: 'किसान / कचरा उत्पादक',
    role_facility: 'प्रसंस्करण केंद्र',
    role_facility_sub: 'संयंत्र और क्षमता',
    role_carbon: 'कार्बन बहीखाता',
    role_carbon_sub: 'कार्बन सिंक और स्थायित्व',
    role_economy: 'आर्थिक मूल्य',
    role_economy_sub: 'बाजार और आय',

    // Language Selector
    select_language: 'भाषा चुनें',
    select_language_sub: 'अपशिष्ट उत्पादक मॉड्यूल के लिए अपनी पसंदीदा भाषा चुनें',
    continue_btn: 'आगे बढ़ें →',

    // Nav
    nav_home: 'मेरी सामग्री',
    nav_pathway: 'सर्वश्रेष्ठ मार्ग',
    nav_journey: 'यात्रा ट्रैक करें',
    nav_lang: 'भाषा बदलें',
    nav_back_terminal: '← ऑपरेटिंग टर्मिनल',

    // Header & Offline
    farmer_module_title: 'किसान अपशिष्ट पोर्टल',
    synced_status: '2 मिनट पहले सिंक हुआ · ऑफ़लाइन तैयार',

    // Home / My Material
    hero_available_label: 'उपलब्ध सामग्री',
    hero_available_value: '8.4 टन उपलब्ध',
    hero_material_type: 'धान की पराली (कृषि अवशेष)',
    hero_status: 'आज उठाव के लिए तैयार',
    
    rec_badge: 'टेराफ्लक्स की अनुशंसित योजना',
    rec_title: 'बायोचार → फैसिलिटी 02 (बटाला)',
    rec_meta: '18.4 किमी दूरी · +4.8 टन कार्बन बचत · ₹12,400 अनुमानित मूल्य',
    view_best_pathway_btn: 'सर्वश्रेष्ठ मार्ग देखें →',

    quick_facts: 'सामग्री विवरण',
    fact_moisture: 'नमी: 14% (सूखा - पायरोलिसिस के लिए उपयुक्त)',
    fact_ash: 'राख: 12% (मानक)',
    fact_pickup: 'उठाव समय: 24 घंटे के भीतर',

    // Best Pathway Screen
    pathways_title: 'मार्गों की तुलना',
    pathways_sub: 'आपकी 8.4 टन पराली के लिए सर्वोत्तम विकल्प',
    recommended_badge: 'अनुशंसित',
    rec_reason_biochar: 'इस सामग्री के लिए उच्चतम कार्बन और आर्थिक मूल्य।',
    rec_reason_biogas: 'कम दूरी, लेकिन कार्बन स्थायित्व थोड़ा कम।',
    rec_reason_compost: 'सरल प्रक्रिया, लेकिन कम वित्तीय लाभ।',

    val_per_tonne: 'मूल्य / टन',
    net_carbon: 'शुद्ध कार्बन',
    haul_distance: 'दूरी',
    process_time: 'अनुमानित समय',

    what_changed_title: 'क्या बदला?',
    delta_biochar_to_biogas: '₹1,200 कम मूल्य, लेकिन 6.2 किमी पास।',
    delta_biochar_to_compost: '₹3,400 कम मूल्य, लेकिन सुखाने की आवश्यकता नहीं।',
    delta_biogas_to_biochar: '₹1,200 अधिक मूल्य और +1.6 टन अतिरिक्त कार्बन बचत।',

    select_this_pathway: 'यह मार्ग चुनें',

    // Follow My Tonne (Journey)
    journey_title: 'सामग्री की यात्रा',
    journey_sub: 'देखें कि आपका कचरा कार्बन बचत और पैसे में कैसे बदलता है',
    
    step_waste: 'मेरा कचरा',
    step_waste_desc: 'खेत पर 8.4 टन धान की पराली एकत्र।',
    
    step_collection: 'परिवहन',
    step_collection_desc: '16 टन क्षमता वाला ट्रक रवाना। दूरी: 18.4 किमी।',
    
    step_facility: 'संयंत्र',
    step_facility_desc: 'फैसिलिटी 02 (बटाला बायोचार यूनिट) पर आगमन।',
    
    step_processing: 'प्रसंस्करण',
    step_processing_desc: '550°C पर बायोचार में परिवर्तित।',
    
    step_carbon: 'कार्बन बचत',
    step_carbon_desc: '+4.8 टन कार्बन 100 वर्षों के लिए सुरक्षित।',
    
    step_value: 'वित्तीय लाभ',
    step_value_desc: '₹12,400 कुल मूल्य किसान खाते में जमा।',

    // Common
    coming_soon: 'शीघ्र उपलब्ध',
    coming_soon_desc: 'यह मॉड्यूल विकास के अधीन है। कृपया अपशिष्ट उत्पादक पर जाएँ।',
    back_to_entry: '← मुख्य मेनू पर लौटें',

    // True Landing (/welcome)
    welcome_eyebrow: 'सर्कुलर कार्बन नेटवर्क ऑपरेटिंग सिस्टम',
    welcome_subtitle: 'अपशिष्ट से कार्बन मूल्य श्रृंखला · पंजाब और हरियाणा',
    welcome_tagline: 'अपशिष्ट को जोड़ना। मूल्य बनाना। स्वच्छ कल का निर्माण।',
    select_role_btn: 'भूमिका चुनें',
    farmer_app_btn: 'किसान ऐप',
    control_tower_btn: 'कंट्रोल टॉवर टर्मिनल',
    welcome_footer_left: 'कम अपशिष्ट',
    welcome_footer_mid: 'अधिक मूल्य',
    welcome_footer_right: 'हरित भविष्य',

    // Change 8 — Waste Intake Questionnaire v2
    intake_cat_heading: 'आपके पास किस प्रकार का अपशिष्ट है?',
    cat_agri_title: 'कृषि अपशिष्ट',
    cat_agri_sub: 'फसल और खेत अवशेष',
    cat_muni_title: 'नगरपालिका अपशिष्ट',
    cat_muni_sub: 'शहरी जैविक कचरा',
    cat_live_title: 'पशुधन अपशिष्ट',
    cat_live_sub: 'गोबर और डेयरी कचरा',
    cat_ind_title: 'औद्योगिक अपशिष्ट',
    cat_ind_sub: 'प्रक्रिया और बायोमास अवशेष',

    wizard_step_of: 'चरण {step} / {total}',
    btn_back_step: '← पीछे जाएं',
    btn_next_step: 'अगला चरण →',
    btn_complete_intake: 'पूरा करें और अनुशंसा देखें →',
    why_we_ask: 'हम यह क्यों पूछते हैं ⓘ',
    why_ask_agri: 'कृषि अवशेष अक्सर बायोचार/पायरोलिसिस के लिए उपयुक्त होते हैं।',
    why_ask_muni: 'संरचना और स्वच्छता के आधार पर बायोगैस के लिए उपयुक्त।',
    why_ask_live: 'बायोगैस और सह-पाचन प्रक्रिया के लिए मुख्य कच्चा माल।',
    why_ask_ind: 'विशेषताओं के आधार पर बायोगैस या थर्मल रूपांतरण के लिए उपयुक्त।',
    other_placeholder: 'कृपया अन्य विवरण लिखें...',
    location_district_label: 'गांव / जिला स्थान',
    location_district_placeholder: 'उदा. बटाला, गुरदासपुर',
    use_map_location: '📍 मानचित्र स्थान का उपयोग करें',
    map_location_captured: '✓ स्थान दर्ज किया गया (31.81° N, 75.20° E)',
    dont_know: 'पता नहीं',

    // Agri
    agri_q1_title: 'आपके पास किस प्रकार का कृषि अपशिष्ट है?',
    agri_q1_helper: 'धान की पराली, गेहूं की भूसी, डंठल, छिलके',
    opt_paddy_straw: 'धान की पराली',
    opt_wheat_straw: 'गेहूं की भूसी',
    opt_corn_stalks: 'मक्के का डंठल',
    opt_husk: 'छिलका / भुट्टा',
    opt_sugarcane_residue: 'गन्ने की खोई',
    opt_pruning_waste: 'लकड़ी / छंटाई कचरा',
    opt_other: 'अन्य',

    agri_q2_title: 'कितनी मात्रा उपलब्ध है?',
    unit_tonnes: 'टन',
    unit_kg: 'किग्रा',

    agri_q3_title: 'अपशिष्ट कहाँ स्थित है?',
    agri_q4_title: 'अपशिष्ट कब उपलब्ध है?',
    opt_one_time: 'एक बार',
    opt_seasonal: 'मौसमी',
    opt_monthly: 'मासिक',
    opt_year_round: 'साल भर',

    agri_q5_title: 'अनुमानित नमी का स्तर क्या है?',
    opt_dry: 'सूखा',
    opt_moderately_wet: 'मध्यम गीला',
    opt_very_wet: 'बहुत गीला',

    agri_q6_title: 'क्या वर्तमान में कचरा जलाया, फेंका, कंपोस्ट या स्टोर किया जाता है?',
    opt_burned: 'जलाया जाता है',
    opt_dumped: 'फेंका जाता है',
    opt_stored: 'स्टोर किया जाता है',
    opt_composting: 'कंपोस्ट बनाया जाता है',
  },

  pa: {
    // Persona Landing
    select_role: 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ',
    role_subtitle: 'ਟੈਰਾਫਲਕਸ ਨੈੱਟਵਰਕ ਵਿੱਚ ਆਪਣਾ ਦਾਖਲਾ ਪੁਆਇੰਟ ਚੁਣੋ',
    role_generator: 'ਕਚਰਾ ਉਤਪਾਦਕ',
    role_generator_sub: 'ਕਿਸਾਨ / ਰਹਿੰਦ-ਖੂੰਹਦ ਉਤਪਾਦਕ',
    role_facility: 'ਪ੍ਰੋਸੈਸਿੰਗ ਪਲਾਂਟ',
    role_facility_sub: 'ਪਲਾਂਟ ਅਤੇ ਸਮਰੱਥਾ',
    role_carbon: 'ਕਾਰਬਨ ਖਾਤਾ',
    role_carbon_sub: 'ਕਾਰਬਨ ਬੱਚਤ ਅਤੇ ਸਥਿਰਤਾ',
    role_economy: 'ਆਰਥਿਕ ਮੁੱਲ',
    role_economy_sub: 'ਮੰਡੀ ਅਤੇ ਆਮਦਨ',

    // Language Selector
    select_language: 'ਭਾਸ਼ਾ ਚੁਣੋ',
    select_language_sub: 'ਕਚਰਾ ਉਤਪਾਦਕ ਮੋਡਿਊਲ ਲਈ ਆਪਣੀ ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ ਚੁਣੋ',
    continue_btn: 'ਅੱਗੇ ਵਧੋ →',

    // Nav
    nav_home: 'ਮੇਰੀ ਪਰਾਲੀ',
    nav_pathway: 'ਸਭ ਤੋਂ ਵਧੀਆ ਰਸਤਾ',
    nav_journey: 'ਸਫਰ ਟਰੈਕ ਕਰੋ',
    nav_lang: 'ਭਾਸ਼ਾ ਬਦਲੋ',
    nav_back_terminal: '← ਆਪਰੇਟਿੰਗ ਟਰਮੀਨਲ',

    // Header & Offline
    farmer_module_title: 'ਕਿਸਾਨ ਰਹਿੰਦ-ਖੂੰਹਦ ਪੋਰਟਲ',
    synced_status: '2 ਮਿੰਟ ਪਹਿਲਾਂ ਸਿੰਕ ਹੋਇਆ · ਆਫਲਾਈਨ ਤਿਆਰ',

    // Home / My Material
    hero_available_label: 'ਮੌਜੂਦ ਪਰਾਲੀ',
    hero_available_value: '8.4 ਟਨ ਮੌਜੂਦ',
    hero_material_type: 'ਝੋਨੇ ਦੀ ਪਰਾਲੀ (ਖੇਤੀਬਾੜੀ ਰਹਿੰਦ-ਖੂੰਹਦ)',
    hero_status: 'ਅੱਜ ਚੁੱਕਣ ਲਈ ਤਿਆਰ',
    
    rec_badge: 'ਟੈਰਾਫਲਕਸ ਦੀ ਸਿਫਾਰਸ਼',
    rec_title: 'ਬਾਇਓਚਾਰ → ਫੈਸਿਲਿਟੀ 02 (ਬਟਾਲਾ)',
    rec_meta: '18.4 ਕਿਲੋਮੀਟਰ ਦੂਰੀ · +4.8 ਟਨ ਕਾਰਬਨ ਬੱਚਤ · ₹12,400 ਅੰਦਾਜ਼ਨ ਮੁੱਲ',
    view_best_pathway_btn: 'ਸਭ ਤੋਂ ਵਧੀਆ ਰਸਤਾ ਦੇਖੋ →',

    quick_facts: 'ਪਰਾਲੀ ਦੇ ਤੱਥ',
    fact_moisture: 'ਸਿੱਲ: 14% (ਸੁੱਕੀ - ਪਾਇਰੋਲਿਸਿਸ ਲਈ ਢੁਕਵੀਂ)',
    fact_ash: 'ਸੁਆਹ: 12% (ਮਿਆਰੀ)',
    fact_pickup: 'ਚੁੱਕਣ ਦਾ ਸਮਾਂ: 24 ਘੰਟਿਆਂ ਦੇ ਅੰਦਰ',

    // Best Pathway Screen
    pathways_title: 'ਰਸਤਿਆਂ ਦੀ ਤੁਲਨਾ',
    pathways_sub: 'ਤੁਹਾਡੀ 8.4 ਟਨ ਪਰਾਲੀ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਵਿਕਲਪ',
    recommended_badge: 'ਸਿਫਾਰਸ਼ੀ',
    rec_reason_biochar: 'ਇਸ ਪਰਾਲੀ ਲਈ ਸਭ ਤੋਂ ਵੱਧ ਕਾਰਬਨ ਅਤੇ ਆਰਥਿਕ ਮੁੱਲ।',
    rec_reason_biogas: 'ਘੱਟ ਦੂਰੀ, ਪਰ ਕਾਰਬਨ ਸਥਿਰਤਾ ਥੋੜ੍ਹੀ ਘੱਟ।',
    rec_reason_compost: 'ਸਧਾਰਨ ਤਰੀਕਾ, ਪਰ ਘੱਟ ਵਿੱਤੀ ਲਾਭ।',

    val_per_tonne: 'ਮੁੱਲ / ਟਨ',
    net_carbon: 'ਕਾਰਬਨ ਬੱਚਤ',
    haul_distance: 'ਦੂਰੀ',
    process_time: 'ਅੰਦਾਜ਼ਨ ਸਮਾਂ',

    what_changed_title: 'ਕੀ ਬਦਲਿਆ?',
    delta_biochar_to_biogas: '₹1,200 ਘੱਟ ਮੁੱਲ, ਪਰ 6.2 ਕਿਲੋਮੀਟਰ ਨੇੜੇ।',
    delta_biochar_to_compost: '₹3,400 ਘੱਟ ਮੁੱਲ, ਪਰ ਸੁਕਾਉਣ ਦੀ ਲੋੜ ਨਹੀਂ।',
    delta_biogas_to_biochar: '₹1,200 ਵੱਧ ਮੁੱਲ ਅਤੇ +1.6 ਟਨ ਵਾਧੂ ਕਾਰਬਨ ਬੱਚਤ।',

    select_this_pathway: 'ਇਹ ਰਸਤਾ ਚੁਣੋ',

    // Follow My Tonne (Journey)
    journey_title: 'ਪਰਾਲੀ ਦਾ ਸਫਰ',
    journey_sub: 'ਦੇਖੋ ਕਿ ਤੁਹਾਡੀ ਪਰਾਲੀ ਕਾਰਬਨ ਬੱਚਤ ਅਤੇ ਪੈਸਿਆਂ ਵਿੱਚ ਕਿਵੇਂ ਬਦਲਦੀ ਹੈ',
    
    step_waste: 'ਮੇਰੀ ਪਰਾਲੀ',
    step_waste_desc: 'ਖੇਤ ਵਿੱਚ 8.4 ਟਨ ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਇਕੱਠੀ।',
    
    step_collection: 'ਟ੍ਰਾਂਸਪੋਰਟ',
    step_collection_desc: '16 ਟਨ ਟਰੱਕ ਰਵਾਨਾ। ਦੂਰੀ: 18.4 ਕਿਲੋਮੀਟਰ।',
    
    step_facility: 'ਪਲਾਂਟ',
    step_facility_desc: 'ਫੈਸਿਲਿਟੀ 02 (ਬਟਾਲਾ ਬਾਇਓਚਾਰ ਯੂਨਿਟ) ਪਹੁੰਚ।',
    
    step_processing: 'ਪ੍ਰੋਸੈਸਿੰਗ',
    step_processing_desc: '550°C ਤੇ ਬਾਇਓਚਾਰ ਵਿੱਚ ਤਬਦੀਲ।',
    
    step_carbon: 'ਕਾਰਬਨ ਬੱਚਤ',
    step_carbon_desc: '+4.8 ਟਨ ਕਾਰਬਨ 100 ਸਾਲਾਂ ਲਈ ਸੁਰੱਖਿਅਤ।',
    
    step_value: 'ਆਮਦਨ',
    step_value_desc: '₹12,400 ਕੁੱਲ ਰਕਮ ਕਿਸਾਨ ਖਾਤੇ ਵਿੱਚ ਜਮ੍ਹਾ।',

    // Common
    coming_soon: 'ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ',
    coming_soon_desc: 'ਇਹ ਮੋਡਿਊਲ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਚਰਾ ਉਤਪਾਦਕ ਮੋਡਿਊਲ ਵਰਤੋ।',
    back_to_entry: '← ਮੁੱਖ ਮੇਨੂ ਤੇ ਵਾਪਸ',

    // True Landing (/welcome)
    welcome_eyebrow: 'ਸਰਕੂਲਰ ਕਾਰਬਨ ਨੈੱਟਵਰਕ ਆਪਰੇਟਿੰਗ ਸਿਸਟਮ',
    welcome_subtitle: 'ਕਚਰੇ ਤੋਂ ਕਾਰਬਨ ਮੁੱਲ ਲੜੀ · ਪੰਜਾਬ ਅਤੇ ਹਰਿਆਣਾ',
    welcome_tagline: 'ਕਚਰੇ ਨੂੰ ਜੋੜਨਾ। ਮੁੱਲ ਬਣਾਉਣਾ। ਇੱਕ ਸਵੱਛ ਭਵਿੱਖ ਦਾ ਨਿਰਮਾਣ।',
    select_role_btn: 'ਭੂਮਿਕਾ ਚੁਣੋ',
    farmer_app_btn: 'ਕਿਸਾਨ ਐਪ',
    control_tower_btn: 'ਕੰਟਰੋਲ ਟਾਵਰ ਟਰਮੀਨਲ',
    welcome_footer_left: 'ਘੱਟ ਕਚਰਾ',
    welcome_footer_mid: 'ਵੱਧ ਮੁੱਲ',
    welcome_footer_right: 'ਹਰਿਆ ਭਰਿਆ ਭਵਿੱਖ',
  },

  mr: {
    // Persona Landing
    select_role: 'आपली भूमिका निवडा',
    role_subtitle: 'टेराफ्लक्स नेटवर्कमध्ये आपला प्रवेश बिंदू निवडा',
    role_generator: 'कचरा उत्पादक',
    role_generator_sub: 'शेतकरी / कचरा उत्पादक',
    role_facility: 'प्रक्रिया केंद्र',
    role_facility_sub: 'प्रक्रिया प्रकल्प',
    role_carbon: 'कार्बन नोंदवही',
    role_carbon_sub: 'कार्बन बचत व स्थैर्य',
    role_economy: 'आर्थिक मूल्य',
    role_economy_sub: 'बाजार व उत्पन्न',

    // Language Selector
    select_language: 'भाषा निवडा',
    select_language_sub: 'कचरा उत्पादक मॉडेलसाठी आपली आवडती भाषा निवडा',
    continue_btn: 'पुढे जा →',

    // Nav
    nav_home: 'माझा कचरा',
    nav_pathway: 'सर्वोत्तम मार्ग',
    nav_journey: 'प्रवास ट्रॅक करा',
    nav_lang: 'भाषा बदला',
    nav_back_terminal: '← ऑपरेटिंग टर्मिनल्स',

    // Header & Offline
    farmer_module_title: 'शेतकरी कचरा पोर्टल',
    synced_status: '२ मिनिटांपूर्वी सिंक झाले · ऑफलाइन तयार',

    // Home / My Material
    hero_available_label: 'उपलब्ध साहित्य',
    hero_available_value: '8.4 टन उपलब्ध',
    hero_material_type: 'भाताचा पेंडा (शेतीचा कचरा)',
    hero_status: 'आज संकलनासाठी तयार',
    
    rec_badge: 'टेराफ्लक्सची शिफारस',
    rec_title: 'बायोचार → फॅसिलिटी 02 (बटाला)',
    rec_meta: '18.4 किमी अंतर · +4.8 टन कार्बन बचत · ₹12,400 अंदाज मूल्य',
    view_best_pathway_btn: 'सर्वोत्तम मार्ग पहा →',

    quick_facts: 'साहित्य माहिती',
    fact_moisture: 'ओलसरपणा: 14% (कोरडे - पायरोलिसिससाठी योग्य)',
    fact_ash: 'राख: 12% (मानक)',
    fact_pickup: 'वेळ: 24 तासांच्या आत',

    // Best Pathway Screen
    pathways_title: 'मार्गांची तुलना',
    pathways_sub: 'तुमच्या 8.4 टन कचऱ्यासाठी सर्वोत्तम पर्याय',
    recommended_badge: 'शिफारस केलेले',
    rec_reason_biochar: 'या साहित्यासाठी सर्वोच्च कार्बन आणि आर्थिक मूल्य.',
    rec_reason_biogas: 'कमी अंतर, पण कार्बन स्थैर्य थोडे कमी.',
    rec_reason_compost: 'सोपी प्रक्रिया, पण कमी उत्पन्न.',

    val_per_tonne: 'मूल्य / टन',
    net_carbon: 'निव्वळ कार्बन',
    haul_distance: 'अंतर',
    process_time: 'अंदाजे वेळ',

    what_changed_title: 'काय बदलले?',
    delta_biochar_to_biogas: '₹1,200 कमी उत्पन्न, पण 6.2 किमी जवळ.',
    delta_biochar_to_compost: '₹3,400 कमी उत्पन्न, पण वाळवण्याची गरज नाही.',
    delta_biogas_to_biochar: '₹1,200 जास्त उत्पन्न आणि +1.6 टन अतिरिक्त कार्बन बचत.',

    select_this_pathway: 'हा मार्ग निवडा',

    // Follow My Tonne (Journey)
    journey_title: 'साहित्याचा प्रवास',
    journey_sub: 'पहा तुमचा कचरा कार्बन बचत आणि पैशात कसा बदलतो',
    
    step_waste: 'माझा कचरा',
    step_waste_desc: 'शेतावर 8.4 टन भाताचा पेंडा जमा.',
    
    step_collection: 'वाहतूक',
    step_collection_desc: '16 टन क्षमतेचा ट्रक रवाना. अंतर: 18.4 किमी.',
    
    step_facility: 'प्रकल्प',
    step_facility_desc: 'फॅसिलिटी 02 (बटाला बायोचार युनिट) येथे आगमन.',
    
    step_processing: 'प्रक्रिया',
    step_processing_desc: '550°C वर बायोचारमध्ये रूपांतरित.',
    
    step_carbon: 'कार्बन बचत',
    step_carbon_desc: '+4.8 टन कार्बन 100 वर्षांसाठी सुरक्षित.',
    
    step_value: 'उत्पन्न',
    step_value_desc: '₹12,400 एकूण रक्कम शेतकरी खात्यात जमा.',

    // Common
    coming_soon: 'लवकरच येत आहे',
    coming_soon_desc: 'हे मॉडेल प्रगतीपथावर आहे. कृपया कचरा उत्पादक मॉडेल वापरा.',
    back_to_entry: '← मुख्य मेनूवर जा',

    // True Landing (/welcome)
    welcome_eyebrow: 'सर्क्युलर कार्बन नेटवर्क ऑपरेटिंग सिस्टम',
    welcome_subtitle: 'कचरा ते कार्बन मूल्य साखळी · पंजाब आणि हरियाणा',
    welcome_tagline: 'कचरा जोडणे. मूल्य निर्माण करणे. स्वच्छ उद्याची निर्मिती.',
    select_role_btn: 'भूमिका निवडा',
    farmer_app_btn: 'शेतकरी ॲप',
    control_tower_btn: 'कंट्रोल टॉवर टर्मिनल',
    welcome_footer_left: 'कमी कचरा',
    welcome_footer_mid: 'अधिक मूल्य',
    welcome_footer_right: 'हिरवे भविष्य',
  },
};

export function t(lang: LanguageCode, key: string): string {
  return DICTIONARY[lang]?.[key] ?? DICTIONARY['en']?.[key] ?? key;
}
