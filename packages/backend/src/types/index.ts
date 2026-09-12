// Shared TypeScript types used across the backend

export type UserRole = 'generator' | 'facility_operator' | 'logistics_partner' | 'municipal_admin' | 'platform_admin';

export type WasteType =
  | 'food_organic'
  | 'agricultural_biomass'
  | 'industrial_biomass'
  | 'municipal_organic'
  | 'food_processing'
  | 'restaurant_waste';

export type ConversionMethod =
  | 'biochar_pyrolysis'
  | 'anaerobic_digestion'
  | 'aerobic_composting'
  | 'vermicomposting';

export type PickupStatus =
  | 'requested'
  | 'scheduled'
  | 'in_transit'
  | 'delivered'
  | 'verified'
  | 'cancelled';

export type MatchStatus = 'pending' | 'accepted' | 'counter_proposed' | 'declined' | 'expired';

export type ListingFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  verified: boolean;
  profile_verified: boolean;
  created_at: Date;
}

export interface Generator {
  id: string;
  user_id: string;
  site_name: string;
  lat: number;
  lng: number;
  waste_types: WasteType[];
  avg_volume_t_month: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description?: string;
}

export interface Facility {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  conversion_type: ConversionMethod;
  capacity_t_month: number;
  remaining_capacity_t: number;
  accepted_waste_types: WasteType[];
  efficiency_pct: number;
  service_radius_km: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description?: string;
  verified: boolean;
}

export interface WasteListing {
  id: string;
  generator_id: string;
  waste_type: WasteType;
  volume_t: number;
  frequency: ListingFrequency;
  pickup_window_start: Date;
  pickup_window_end: Date;
  status: 'open' | 'matched' | 'completed' | 'cancelled';
  notes?: string;
  created_at: Date;
}

export interface Match {
  id: string;
  listing_id: string;
  facility_id: string;
  score: number;
  status: MatchStatus;
  explanation_text?: string;
  counter_proposed_window?: { start: Date; end: Date };
  created_at: Date;
}

export interface Pickup {
  id: string;
  match_id: string;
  logistics_partner_id?: string;
  status: PickupStatus;
  scheduled_at?: Date;
  delivered_at?: Date;
  verified_at?: Date;
  distance_km?: number;
  co2_sequestered_t?: number;
  vehicle_type?: string;
  notes?: string;
  created_at: Date;
}

export interface LogisticsRoute {
  id: string;
  logistics_partner_id: string;
  stops: RouteStop[];
  total_distance_km: number;
  total_time_min: number;
  date: Date;
  created_at: Date;
}

export interface RouteStop {
  pickup_id: string;
  order: number;
  lat: number;
  lng: number;
  address: string;
  eta_min: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: Date;
}

export interface CarbonCredit {
  id: string;
  pickup_id: string;
  tonnes_co2: number;
  methodology: string;
  verified: boolean;
  issued_at: Date;
}

export interface PlatformStats {
  total_waste_diverted_t: number;
  total_co2_sequestered_t: number;
  active_facilities: number;
  active_generators: number;
  completed_pickups: number;
}
