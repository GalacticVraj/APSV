import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// HTTP client for the Python FastAPI optimizer service
const optimizerClient: AxiosInstance = axios.create({
  baseURL: process.env.OPTIMIZER_URL || 'http://localhost:8000',
  timeout: 30000, // 30 second timeout for optimization calls
  headers: { 'Content-Type': 'application/json' },
});

export interface MatchRequest {
  listing_id: string;
  generator_lat: number;
  generator_lng: number;
  waste_type: string;
  volume_t: number;
  facilities: Array<{
    id: string;
    lat: number;
    lng: number;
    conversion_type: string;
    remaining_capacity_t: number;
    capacity_t_month: number;
    accepted_waste_types: string[];
    efficiency_pct: number;
    service_radius_km: number;
  }>;
}

export interface MatchResult {
  facility_id: string;
  score: number;
  distance_km: number;
  explanation: string;
  breakdown: {
    distance_score: number;
    capacity_score: number;
    type_compatibility: number;
    efficiency_score: number;
  };
}

export interface RouteRequest {
  pickups: Array<{
    id: string;
    lat: number;
    lng: number;
    volume_t: number;
    pickup_window_start: string;
    pickup_window_end: string;
  }>;
  depot_lat: number;
  depot_lng: number;
  vehicle_capacity_t: number;
}

export interface RouteResult {
  stops: Array<{
    pickup_id: string;
    order: number;
    lat: number;
    lng: number;
    eta_min: number;
  }>;
  total_distance_km: number;
  total_time_min: number;
}

export interface CarbonRequest {
  waste_type: string;
  conversion_method: string;
  volume_t: number;
  distance_km: number;
}

export interface CarbonResult {
  gross_co2_t: number;
  transport_penalty_t: number;
  net_co2_t: number;
  methodology: string;
  emission_factor: number;
  source: string;
}

async function withFallback<T>(fn: () => Promise<T>, fallback: T, context: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const error = err as Error;
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED') {
        logger.warn(`Optimizer service unavailable, using fallback for ${context}`);
      } else {
        logger.error(`Optimizer call failed for ${context}`, { error: error.message });
      }
    } else {
      logger.error(`Optimizer unexpected error for ${context}`, { error: error.message });
    }
    return fallback;
  }
}

export async function computeMatches(req: MatchRequest): Promise<MatchResult[]> {
  return withFallback(
    async () => {
      const response = await optimizerClient.post<MatchResult[]>('/match', req);
      return response.data;
    },
    [],
    'computeMatches'
  );
}

export async function optimizeRoute(req: RouteRequest): Promise<RouteResult | null> {
  return withFallback(
    async () => {
      const response = await optimizerClient.post<RouteResult>('/route', req);
      return response.data;
    },
    null,
    'optimizeRoute'
  );
}

export async function calculateCarbon(req: CarbonRequest): Promise<CarbonResult | null> {
  return withFallback(
    async () => {
      const response = await optimizerClient.post<CarbonResult>('/carbon', req);
      return response.data;
    },
    null,
    'calculateCarbon'
  );
}
