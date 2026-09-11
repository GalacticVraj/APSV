import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

// India-based demo seed data
// Covers 5 cities: Bengaluru, Pune, Chennai, Hyderabad, Delhi NCR

export async function seed(knex: Knex): Promise<void> {
  // Clear in reverse dependency order
  await knex('disputes').del();
  await knex('carbon_credits').del();
  await knex('notifications').del();
  await knex('logistics_routes').del();
  await knex('pickups').del();
  await knex('matches').del();
  await knex('waste_listings').del();
  await knex('facilities').del();
  await knex('generators').del();
  await knex('profiles').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const now = new Date();

  // ─── Admin user ────────────────────────────────────────────────────────────
  await knex('users').insert({
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    email: 'admin@carbonloop.in',
    password_hash: passwordHash,
    role: 'platform_admin',
    verified: true,
    profile_verified: true,
    created_at: now,
    updated_at: now,
  });
  await knex('profiles').insert({
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    user_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    org_name: 'CarbonLoop Platform',
    phone: '+91 80000 00001',
    city: 'Bengaluru',
    state: 'Karnataka',
    created_at: now,
    updated_at: now,
  });

  // ─── Generator users (12 generators) ─────────────────────────────────────
  const generatorUsers = [
    { id: 'bbbbbbbb-0000-0000-0000-000000000001', email: 'green.farms@example.in', orgName: 'Green Valley Farms', city: 'Bengaluru', state: 'Karnataka' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'mandyafarms@example.in', orgName: 'Mandya Agro Co-op', city: 'Mandya', state: 'Karnataka' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000003', email: 'hotel.savor@example.in', orgName: 'Hotel Savor Group', city: 'Pune', state: 'Maharashtra' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000004', email: 'pune.mmc@example.in', orgName: 'Pune Municipal Market', city: 'Pune', state: 'Maharashtra' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000005', email: 'kasaragod.spice@example.in', orgName: 'Kasaragod Spice Processors', city: 'Kasaragod', state: 'Kerala' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000006', email: 'chennai.wetmarkets@example.in', orgName: 'Chennai Koyambedu Market', city: 'Chennai', state: 'Tamil Nadu' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000007', email: 'hyd.food.park@example.in', orgName: 'Hyderabad Food Park Ltd', city: 'Hyderabad', state: 'Telangana' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000008', email: 'delhi.canteen@example.in', orgName: 'Delhi Canteen Collective', city: 'New Delhi', state: 'Delhi' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000009', email: 'gurugram.hotels@example.in', orgName: 'Gurugram Hospitality Association', city: 'Gurugram', state: 'Haryana' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000010', email: 'nashik.grapes@example.in', orgName: 'Nashik Grape Growers Cooperative', city: 'Nashik', state: 'Maharashtra' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000011', email: 'tirupur.textiles@example.in', orgName: 'Tirupur Textile Waste Unit', city: 'Tirupur', state: 'Tamil Nadu' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000012', email: 'ludhiana.agro@example.in', orgName: 'Ludhiana Agro Industries', city: 'Ludhiana', state: 'Punjab' },
  ];

  for (const u of generatorUsers) {
    await knex('users').insert({
      id: u.id,
      email: u.email,
      password_hash: passwordHash,
      role: 'generator',
      verified: true,
      profile_verified: true,
      created_at: now,
      updated_at: now,
    });
    await knex('profiles').insert({
      id: u.id,
      user_id: u.id,
      org_name: u.orgName,
      phone: '+91 98' + Math.floor(Math.random() * 90000000 + 10000000),
      city: u.city,
      state: u.state,
      created_at: now,
      updated_at: now,
    });
  }

  // ─── Facility operator users (8 facilities) ───────────────────────────────
  const facilityUsers = [
    { id: 'cccccccc-0000-0000-0000-000000000001', email: 'biochar.karnataka@example.in', orgName: 'Karnataka Biochar Solutions' },
    { id: 'cccccccc-0000-0000-0000-000000000002', email: 'biogasmaharashtra@example.in', orgName: 'Maharashtra Biogas Systems' },
    { id: 'cccccccc-0000-0000-0000-000000000003', email: 'compostnaturals@example.in', orgName: 'CompostNaturals Pvt Ltd' },
    { id: 'cccccccc-0000-0000-0000-000000000004', email: 'greengas.hyd@example.in', orgName: 'GreenGas Hyderabad' },
    { id: 'cccccccc-0000-0000-0000-000000000005', email: 'delhicompost@example.in', orgName: 'Delhi Urban Compost Collective' },
    { id: 'cccccccc-0000-0000-0000-000000000006', email: 'tnbiochar@example.in', orgName: 'Tamil Nadu Biochar Initiative' },
    { id: 'cccccccc-0000-0000-0000-000000000007', email: 'punebiogas@example.in', orgName: 'Pune Clean Energy Biogas' },
    { id: 'cccccccc-0000-0000-0000-000000000008', email: 'punjabbioenergy@example.in', orgName: 'Punjab BioEnergy Park' },
  ];

  for (const u of facilityUsers) {
    await knex('users').insert({
      id: u.id,
      email: u.email,
      password_hash: passwordHash,
      role: 'facility_operator',
      verified: true,
      profile_verified: true,
      created_at: now,
      updated_at: now,
    });
    await knex('profiles').insert({
      id: u.id,
      user_id: u.id,
      org_name: u.orgName,
      phone: '+91 99' + Math.floor(Math.random() * 90000000 + 10000000),
      created_at: now,
      updated_at: now,
    });
  }

  // ─── Logistics partner ────────────────────────────────────────────────────
  await knex('users').insert({
    id: 'dddddddd-0000-0000-0000-000000000001',
    email: 'logistics@greenmove.in',
    password_hash: passwordHash,
    role: 'logistics_partner',
    verified: true,
    profile_verified: true,
    created_at: now,
    updated_at: now,
  });
  await knex('profiles').insert({
    id: 'dddddddd-0000-0000-0000-000000000001',
    user_id: 'dddddddd-0000-0000-0000-000000000001',
    org_name: 'GreenMove Logistics',
    city: 'Bengaluru',
    state: 'Karnataka',
    created_at: now,
    updated_at: now,
  });

  // ─── Generators (12 sites) ────────────────────────────────────────────────
  const generators = [
    {
      id: 'eeeeeeee-0000-0000-0000-000000000001',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000001',
      site_name: 'Green Valley Farm, Anekal',
      lat: 12.7109, lng: 77.6967,
      waste_types: ['agricultural_biomass', 'food_organic'],
      avg_volume_t_month: 45,
      address: 'Survey No. 12, Anekal Taluk',
      city: 'Bengaluru', state: 'Karnataka', pincode: '562106',
      description: 'Mixed vegetable and paddy farm producing straw, husk, and organic kitchen waste.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000002',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000002',
      site_name: 'Mandya Sugarcane Processing Unit',
      lat: 12.5218, lng: 76.8952,
      waste_types: ['agricultural_biomass', 'industrial_biomass'],
      avg_volume_t_month: 120,
      address: 'KIADB Industrial Area, Mandya',
      city: 'Mandya', state: 'Karnataka', pincode: '571401',
      description: 'Sugarcane bagasse and press mud from sugar processing.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000003',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000003',
      site_name: 'Hotel Savor Central Kitchen, Pune',
      lat: 18.5204, lng: 73.8567,
      waste_types: ['food_organic', 'restaurant_waste'],
      avg_volume_t_month: 8,
      address: 'Koregaon Park, Pune',
      city: 'Pune', state: 'Maharashtra', pincode: '411001',
      description: 'Daily food waste from 3 hotel properties in central Pune.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000004',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000004',
      site_name: 'Pune Market Yard',
      lat: 18.4861, lng: 73.8520,
      waste_types: ['municipal_organic', 'food_organic'],
      avg_volume_t_month: 60,
      address: 'Market Yard, Gultekdi, Pune',
      city: 'Pune', state: 'Maharashtra', pincode: '411037',
      description: 'APMC wholesale vegetable and fruit market organic waste.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000005',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000005',
      site_name: 'Kasaragod Cashew Processing Facility',
      lat: 12.4996, lng: 74.9869,
      waste_types: ['industrial_biomass', 'agricultural_biomass'],
      avg_volume_t_month: 35,
      address: 'Kasaragod Industrial Estate',
      city: 'Kasaragod', state: 'Kerala', pincode: '671121',
      description: 'Cashew shell and nut processing biomass waste.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000006',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000006',
      site_name: 'Koyambedu Wholesale Market',
      lat: 13.0727, lng: 80.1941,
      waste_types: ['municipal_organic', 'food_organic'],
      avg_volume_t_month: 90,
      address: 'Koyambedu Market Complex, Chennai',
      city: 'Chennai', state: 'Tamil Nadu', pincode: '600107',
      description: 'Largest vegetable and fruit wholesale market in South India.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000007',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000007',
      site_name: 'Hyderabad Food Processing Park',
      lat: 17.4065, lng: 78.4772,
      waste_types: ['food_processing', 'industrial_biomass'],
      avg_volume_t_month: 200,
      address: 'Patancheru Industrial Area, Hyderabad',
      city: 'Hyderabad', state: 'Telangana', pincode: '502319',
      description: 'Multi-tenant food processing park generating processing rejects and offcuts.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000008',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000008',
      site_name: 'Delhi Canteen Collective (Central Zone)',
      lat: 28.6139, lng: 77.2090,
      waste_types: ['restaurant_waste', 'food_organic'],
      avg_volume_t_month: 12,
      address: 'Connaught Place, New Delhi',
      city: 'New Delhi', state: 'Delhi', pincode: '110001',
      description: 'Network of government and institutional canteens in central Delhi.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000009',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000009',
      site_name: 'Gurugram Hotel District Waste Aggregator',
      lat: 28.4595, lng: 77.0266,
      waste_types: ['restaurant_waste', 'food_organic'],
      avg_volume_t_month: 25,
      address: 'DLF Cyber City Area, Gurugram',
      city: 'Gurugram', state: 'Haryana', pincode: '122002',
      description: 'Aggregated food waste from 15 premium hotels in Gurugram.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000010',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000010',
      site_name: 'Nashik Grape Processing Estate',
      lat: 19.9975, lng: 73.7898,
      waste_types: ['agricultural_biomass', 'food_processing'],
      avg_volume_t_month: 80,
      address: 'Dindori Road, Nashik',
      city: 'Nashik', state: 'Maharashtra', pincode: '422202',
      description: 'Grape marc, vine cuttings, and pomace from winery operations.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000011',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000011',
      site_name: 'Tirupur Textile Industry Biomass',
      lat: 11.1085, lng: 77.3411,
      waste_types: ['industrial_biomass', 'agricultural_biomass'],
      avg_volume_t_month: 55,
      address: 'Avinashi Road, Tirupur',
      city: 'Tirupur', state: 'Tamil Nadu', pincode: '641603',
      description: 'Cotton gin waste, seed husks, and natural fiber processing rejects.',
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000012',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000012',
      site_name: 'Ludhiana Rice and Wheat Straw',
      lat: 30.9010, lng: 75.8573,
      waste_types: ['agricultural_biomass'],
      avg_volume_t_month: 300,
      address: 'Sahnewal, Ludhiana',
      city: 'Ludhiana', state: 'Punjab', pincode: '141120',
      description: 'Paddy straw and wheat chaff from extensive Punjab farmlands.',
    },
  ];

  for (const g of generators) {
    await knex('generators').insert({
      ...g,
      waste_types: JSON.stringify(g.waste_types),
      created_at: now,
      updated_at: now,
    });
  }

  // ─── Facilities (8 sites) ─────────────────────────────────────────────────
  const facilities = [
    {
      id: 'ffffffff-0000-0000-0000-000000000001',
      user_id: 'cccccccc-0000-0000-0000-000000000001',
      name: 'Karnataka Biochar Plant, Tumkur',
      lat: 13.3379, lng: 77.1173,
      conversion_type: 'biochar_pyrolysis',
      capacity_t_month: 500,
      remaining_capacity_t: 210,
      accepted_waste_types: ['agricultural_biomass', 'industrial_biomass'],
      efficiency_pct: 88,
      service_radius_km: 150,
      address: 'KIADB Industrial Area, Tumkur',
      city: 'Tumkur', state: 'Karnataka', pincode: '572102',
      verified: true,
      description: 'State-of-the-art slow pyrolysis plant producing certified biochar for soil amendment.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000002',
      user_id: 'cccccccc-0000-0000-0000-000000000002',
      name: 'Maharashtra Biogas Digester, Pune',
      lat: 18.5822, lng: 73.9142,
      conversion_type: 'anaerobic_digestion',
      capacity_t_month: 300,
      remaining_capacity_t: 95,
      accepted_waste_types: ['food_organic', 'restaurant_waste', 'food_processing'],
      efficiency_pct: 82,
      service_radius_km: 80,
      address: 'Chakan MIDC, Pune',
      city: 'Pune', state: 'Maharashtra', pincode: '410501',
      verified: true,
      description: 'Wet anaerobic digestion facility supplying CNG to nearby industrial units.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000003',
      user_id: 'cccccccc-0000-0000-0000-000000000003',
      name: 'CompostNaturals Windrow, Bengaluru',
      lat: 12.9716, lng: 77.5946,
      conversion_type: 'aerobic_composting',
      capacity_t_month: 150,
      remaining_capacity_t: 72,
      accepted_waste_types: ['food_organic', 'municipal_organic', 'restaurant_waste'],
      efficiency_pct: 75,
      service_radius_km: 50,
      address: 'Yelahanka, Bengaluru',
      city: 'Bengaluru', state: 'Karnataka', pincode: '560064',
      verified: true,
      description: 'Certified aerobic windrow composting with NABL-tested output compost.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000004',
      user_id: 'cccccccc-0000-0000-0000-000000000004',
      name: 'GreenGas Hyderabad Biogas Plant',
      lat: 17.3850, lng: 78.4867,
      conversion_type: 'anaerobic_digestion',
      capacity_t_month: 400,
      remaining_capacity_t: 180,
      accepted_waste_types: ['food_organic', 'food_processing', 'municipal_organic', 'restaurant_waste'],
      efficiency_pct: 85,
      service_radius_km: 120,
      address: 'Jeedimetla Industrial Area, Hyderabad',
      city: 'Hyderabad', state: 'Telangana', pincode: '500055',
      verified: true,
      description: 'High-efficiency biogas plant connected to city gas grid under PNGRB license.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000005',
      user_id: 'cccccccc-0000-0000-0000-000000000005',
      name: 'Delhi Urban Compost Center, Narela',
      lat: 28.8535, lng: 77.0849,
      conversion_type: 'aerobic_composting',
      capacity_t_month: 200,
      remaining_capacity_t: 130,
      accepted_waste_types: ['municipal_organic', 'food_organic', 'restaurant_waste'],
      efficiency_pct: 70,
      service_radius_km: 60,
      address: 'Narela Industrial Area, Delhi',
      city: 'New Delhi', state: 'Delhi', pincode: '110040',
      verified: false,
      description: 'PPP-model urban composting facility under Delhi Solid Waste Management project.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000006',
      user_id: 'cccccccc-0000-0000-0000-000000000006',
      name: 'Tamil Nadu Biochar Center, Coimbatore',
      lat: 11.0168, lng: 76.9558,
      conversion_type: 'biochar_pyrolysis',
      capacity_t_month: 350,
      remaining_capacity_t: 220,
      accepted_waste_types: ['agricultural_biomass', 'industrial_biomass', 'food_processing'],
      efficiency_pct: 86,
      service_radius_km: 200,
      address: 'SIPCOT Industrial Complex, Coimbatore',
      city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641050',
      verified: true,
      description: 'Flash pyrolysis system producing high-carbon biochar for agricultural export.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000007',
      user_id: 'cccccccc-0000-0000-0000-000000000007',
      name: 'Pune Clean Energy Biogas, Hadapsar',
      lat: 18.5018, lng: 73.9260,
      conversion_type: 'anaerobic_digestion',
      capacity_t_month: 180,
      remaining_capacity_t: 55,
      accepted_waste_types: ['food_organic', 'food_processing', 'restaurant_waste'],
      efficiency_pct: 80,
      service_radius_km: 60,
      address: 'Hadapsar Industrial Estate, Pune',
      city: 'Pune', state: 'Maharashtra', pincode: '411013',
      verified: true,
      description: 'Community-scale biogas digester supplying electricity to 200 households.',
    },
    {
      id: 'ffffffff-0000-0000-0000-000000000008',
      user_id: 'cccccccc-0000-0000-0000-000000000008',
      name: 'Punjab BioEnergy Park, Ludhiana',
      lat: 30.8553, lng: 75.7020,
      conversion_type: 'biochar_pyrolysis',
      capacity_t_month: 800,
      remaining_capacity_t: 400,
      accepted_waste_types: ['agricultural_biomass'],
      efficiency_pct: 90,
      service_radius_km: 200,
      address: 'Focal Point Industrial Area, Ludhiana',
      city: 'Ludhiana', state: 'Punjab', pincode: '141010',
      verified: true,
      description: 'Large-scale pyrolysis facility addressing Punjab paddy straw burning crisis.',
    },
  ];

  for (const f of facilities) {
    await knex('facilities').insert({
      ...f,
      accepted_waste_types: JSON.stringify(f.accepted_waste_types),
      created_at: now,
      updated_at: now,
    });
  }

  // ─── Sample waste listings ────────────────────────────────────────────────
  const futureDate = (daysFromNow: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    return d;
  };
  const pastDate = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d;
  };

  const listings = [
    {
      id: '11111111-0000-0000-0000-000000000001',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000001',
      waste_type: 'agricultural_biomass',
      volume_t: 40,
      frequency: 'monthly',
      pickup_window_start: futureDate(3),
      pickup_window_end: futureDate(7),
      status: 'matched',
    },
    {
      id: '11111111-0000-0000-0000-000000000002',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000002',
      waste_type: 'agricultural_biomass',
      volume_t: 100,
      frequency: 'monthly',
      pickup_window_start: futureDate(5),
      pickup_window_end: futureDate(10),
      status: 'matched',
    },
    {
      id: '11111111-0000-0000-0000-000000000003',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000003',
      waste_type: 'restaurant_waste',
      volume_t: 6,
      frequency: 'weekly',
      pickup_window_start: futureDate(1),
      pickup_window_end: futureDate(4),
      status: 'open',
    },
    {
      id: '11111111-0000-0000-0000-000000000004',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000006',
      waste_type: 'municipal_organic',
      volume_t: 80,
      frequency: 'monthly',
      pickup_window_start: futureDate(2),
      pickup_window_end: futureDate(6),
      status: 'matched',
    },
    {
      id: '11111111-0000-0000-0000-000000000005',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000007',
      waste_type: 'food_processing',
      volume_t: 180,
      frequency: 'monthly',
      pickup_window_start: futureDate(4),
      pickup_window_end: futureDate(8),
      status: 'matched',
    },
    // Completed listings for carbon history
    {
      id: '11111111-0000-0000-0000-000000000010',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000001',
      waste_type: 'agricultural_biomass',
      volume_t: 38,
      frequency: 'monthly',
      pickup_window_start: pastDate(60),
      pickup_window_end: pastDate(55),
      status: 'completed',
    },
    {
      id: '11111111-0000-0000-0000-000000000011',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000012',
      waste_type: 'agricultural_biomass',
      volume_t: 250,
      frequency: 'monthly',
      pickup_window_start: pastDate(45),
      pickup_window_end: pastDate(40),
      status: 'completed',
    },
    {
      id: '11111111-0000-0000-0000-000000000012',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000004',
      waste_type: 'municipal_organic',
      volume_t: 55,
      frequency: 'monthly',
      pickup_window_start: pastDate(30),
      pickup_window_end: pastDate(25),
      status: 'completed',
    },
    {
      id: '11111111-0000-0000-0000-000000000013',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000007',
      waste_type: 'food_processing',
      volume_t: 160,
      frequency: 'monthly',
      pickup_window_start: pastDate(15),
      pickup_window_end: pastDate(10),
      status: 'completed',
    },
    {
      id: '11111111-0000-0000-0000-000000000014',
      generator_id: 'eeeeeeee-0000-0000-0000-000000000006',
      waste_type: 'municipal_organic',
      volume_t: 75,
      frequency: 'monthly',
      pickup_window_start: pastDate(20),
      pickup_window_end: pastDate(15),
      status: 'completed',
    },
  ];

  for (const l of listings) {
    await knex('waste_listings').insert({ ...l, created_at: l.pickup_window_start, updated_at: now });
  }

  // ─── Matches ──────────────────────────────────────────────────────────────
  const matches = [
    {
      id: '22222222-0000-0000-0000-000000000001',
      listing_id: '11111111-0000-0000-0000-000000000001',
      facility_id: 'ffffffff-0000-0000-0000-000000000001',
      score: 87.4,
      status: 'accepted',
      explanation_text: 'Karnataka Biochar Plant is within 90 km and has 210 t/month remaining capacity. Biochar pyrolysis is highly compatible with agricultural biomass and achieves 88% conversion efficiency.',
    },
    {
      id: '22222222-0000-0000-0000-000000000002',
      listing_id: '11111111-0000-0000-0000-000000000002',
      facility_id: 'ffffffff-0000-0000-0000-000000000008',
      score: 92.1,
      status: 'accepted',
      explanation_text: 'Punjab BioEnergy Park is the highest-capacity biochar facility for agricultural biomass in North India with 90% efficiency and 400 t remaining capacity.',
    },
    {
      id: '22222222-0000-0000-0000-000000000003',
      listing_id: '11111111-0000-0000-0000-000000000004',
      facility_id: 'ffffffff-0000-0000-0000-000000000006',
      score: 78.5,
      status: 'accepted',
      explanation_text: 'Tamil Nadu Biochar Center accepts food processing waste and has ample remaining capacity for this volume.',
    },
    {
      id: '22222222-0000-0000-0000-000000000004',
      listing_id: '11111111-0000-0000-0000-000000000005',
      facility_id: 'ffffffff-0000-0000-0000-000000000004',
      score: 89.2,
      status: 'accepted',
      explanation_text: 'GreenGas Hyderabad is within 20 km, accepts food processing waste, and has high remaining capacity of 180 t/month.',
    },
    // Historical matches for completed pickups
    {
      id: '22222222-0000-0000-0000-000000000010',
      listing_id: '11111111-0000-0000-0000-000000000010',
      facility_id: 'ffffffff-0000-0000-0000-000000000001',
      score: 85.2,
      status: 'accepted',
      explanation_text: 'Historical match: Karnataka Biochar for Green Valley Farm biomass.',
    },
    {
      id: '22222222-0000-0000-0000-000000000011',
      listing_id: '11111111-0000-0000-0000-000000000011',
      facility_id: 'ffffffff-0000-0000-0000-000000000008',
      score: 93.5,
      status: 'accepted',
      explanation_text: 'Historical match: Punjab BioEnergy Park for Ludhiana paddy straw.',
    },
    {
      id: '22222222-0000-0000-0000-000000000012',
      listing_id: '11111111-0000-0000-0000-000000000012',
      facility_id: 'ffffffff-0000-0000-0000-000000000002',
      score: 76.8,
      status: 'accepted',
      explanation_text: 'Historical match: Maharashtra Biogas for Pune market yard.',
    },
    {
      id: '22222222-0000-0000-0000-000000000013',
      listing_id: '11111111-0000-0000-0000-000000000013',
      facility_id: 'ffffffff-0000-0000-0000-000000000004',
      score: 88.1,
      status: 'accepted',
      explanation_text: 'Historical match: GreenGas for Hyderabad Food Park.',
    },
    {
      id: '22222222-0000-0000-0000-000000000014',
      listing_id: '11111111-0000-0000-0000-000000000014',
      facility_id: 'ffffffff-0000-0000-0000-000000000006',
      score: 79.3,
      status: 'accepted',
      explanation_text: 'Historical match: TN Biochar for Koyambedu market.',
    },
  ];

  for (const m of matches) {
    await knex('matches').insert({ ...m, created_at: now, updated_at: now });
  }

  // ─── Pickups (active and historical verified) ─────────────────────────────
  const pickups = [
    // Active pickups
    { id: '33333333-0000-0000-0000-000000000001', match_id: '22222222-0000-0000-0000-000000000001', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'scheduled', scheduled_at: futureDate(4), distance_km: 87.3 },
    { id: '33333333-0000-0000-0000-000000000002', match_id: '22222222-0000-0000-0000-000000000002', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'in_transit', scheduled_at: futureDate(6), distance_km: 15.2 },
    { id: '33333333-0000-0000-0000-000000000003', match_id: '22222222-0000-0000-0000-000000000003', status: 'requested', distance_km: 110.5 },
    { id: '33333333-0000-0000-0000-000000000004', match_id: '22222222-0000-0000-0000-000000000004', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'scheduled', scheduled_at: futureDate(5), distance_km: 19.8 },
    // Historical verified pickups with CO2 data
    { id: '33333333-0000-0000-0000-000000000010', match_id: '22222222-0000-0000-0000-000000000010', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'verified', scheduled_at: pastDate(58), delivered_at: pastDate(56), verified_at: pastDate(55), distance_km: 87.3, co2_sequestered_t: 35.64 },
    { id: '33333333-0000-0000-0000-000000000011', match_id: '22222222-0000-0000-0000-000000000011', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'verified', scheduled_at: pastDate(43), delivered_at: pastDate(41), verified_at: pastDate(40), distance_km: 15.2, co2_sequestered_t: 248.8 },
    { id: '33333333-0000-0000-0000-000000000012', match_id: '22222222-0000-0000-0000-000000000012', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'verified', scheduled_at: pastDate(28), delivered_at: pastDate(26), verified_at: pastDate(25), distance_km: 34.5, co2_sequestered_t: 19.05 },
    { id: '33333333-0000-0000-0000-000000000013', match_id: '22222222-0000-0000-0000-000000000013', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'verified', scheduled_at: pastDate(13), delivered_at: pastDate(11), verified_at: pastDate(10), distance_km: 19.8, co2_sequestered_t: 55.52 },
    { id: '33333333-0000-0000-0000-000000000014', match_id: '22222222-0000-0000-0000-000000000014', logistics_partner_id: 'dddddddd-0000-0000-0000-000000000001', status: 'verified', scheduled_at: pastDate(18), delivered_at: pastDate(16), verified_at: pastDate(15), distance_km: 490.0, co2_sequestered_t: 63.21 },
  ];

  for (const p of pickups) {
    await knex('pickups').insert({ ...p, created_at: pastDate(65), updated_at: now });
  }

  // ─── Carbon credits for verified pickups ─────────────────────────────────
  const carbonCredits = [
    { id: '44444444-0000-0000-0000-000000000010', pickup_id: '33333333-0000-0000-0000-000000000010', tonnes_co2: 35.64, methodology: 'Biochar pyrolysis: IPCC AR6 WG3 Ch.7 (1.00 t CO2e/t agricultural biomass) minus DEFRA 2023 transport penalty (0.062 kg CO2e/t-km)', source_reference: 'IPCC AR6 WG3 2022; UK DEFRA GHG Conversion Factors 2023', verified: true, issued_at: pastDate(55) },
    { id: '44444444-0000-0000-0000-000000000011', pickup_id: '33333333-0000-0000-0000-000000000011', tonnes_co2: 248.8, methodology: 'Biochar pyrolysis: IPCC AR6 WG3 Ch.7 (1.00 t CO2e/t agricultural biomass) minus DEFRA 2023 transport penalty', source_reference: 'IPCC AR6 WG3 2022; UK DEFRA GHG Conversion Factors 2023', verified: true, issued_at: pastDate(40) },
    { id: '44444444-0000-0000-0000-000000000012', pickup_id: '33333333-0000-0000-0000-000000000012', tonnes_co2: 19.05, methodology: 'Anaerobic digestion: EPA WARM v15 Ch.4 (0.35 t CO2e/t food organic) minus DEFRA 2023 transport penalty', source_reference: 'US EPA WARM v15 2019; UK DEFRA GHG Conversion Factors 2023', verified: true, issued_at: pastDate(25) },
    { id: '44444444-0000-0000-0000-000000000013', pickup_id: '33333333-0000-0000-0000-000000000013', tonnes_co2: 55.52, methodology: 'Anaerobic digestion: EPA WARM v15 Ch.4 (0.35 t CO2e/t food processing) minus DEFRA 2023 transport penalty', source_reference: 'US EPA WARM v15 2019; UK DEFRA GHG Conversion Factors 2023', verified: true, issued_at: pastDate(10) },
    { id: '44444444-0000-0000-0000-000000000014', pickup_id: '33333333-0000-0000-0000-000000000014', tonnes_co2: 63.21, methodology: 'Biochar pyrolysis: IPCC AR6 WG3 Ch.7 (1.00 t CO2e/t agricultural biomass) minus DEFRA 2023 transport penalty', source_reference: 'IPCC AR6 WG3 2022; UK DEFRA GHG Conversion Factors 2023', verified: true, issued_at: pastDate(15) },
  ];

  for (const cc of carbonCredits) {
    await knex('carbon_credits').insert({ ...cc, created_at: cc.issued_at, updated_at: now });
  }

  console.log('Seed complete: 12 generators, 8 facilities, 10 listings, 9 matches, 9 pickups, 5 carbon credits seeded.');
}
