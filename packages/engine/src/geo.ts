/**
 * Geodesy and projection.
 *
 * We deliberately do not call a routing API. A live demo that depends on an
 * external road-network service has a single point of failure that no amount of
 * engineering elsewhere can compensate for. Instead we use great-circle distance
 * multiplied by a documented circuity factor, and we surface that factor in the
 * UI as a tunable assumption rather than hiding it.
 *
 * Circuity factor 1.28: ratio of road distance to straight-line distance observed
 * across Indian NH/SH inter-district pairs. Rural last-mile links are worse, so
 * the factor is scaled by road class.
 */

import type { GeoPoint, RoadClass } from './types.ts';

const EARTH_RADIUS_KM = 6371.0088;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Extra circuity contributed by the last-mile road class. */
export const ROAD_CLASS_CIRCUITY: Record<RoadClass, number> = {
  national_highway: 1.0,
  state_highway: 1.06,
  rural_road: 1.14,
};

export const ROAD_CLASS_SPEED_FACTOR: Record<RoadClass, number> = {
  national_highway: 1.0,
  state_highway: 0.82,
  rural_road: 0.6,
};

/** Road distance estimate in km. */
export function roadDistanceKm(
  a: GeoPoint,
  b: GeoPoint,
  circuityFactor: number,
  access: RoadClass,
): number {
  return haversineKm(a, b) * circuityFactor * ROAD_CLASS_CIRCUITY[access];
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection for the custom map renderer
// ─────────────────────────────────────────────────────────────────────────────

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Web-Mercator y. We render our own map rather than loading raster tiles, so the
 * projection lives here and the whole map works with no network access.
 */
export function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + toRad(clamped) / 2));
}

export interface Projector {
  project(p: GeoPoint): { x: number; y: number };
  unproject(x: number, y: number): GeoPoint;
  scale: number;
}

/**
 * Fit a geographic bounding box into a pixel viewport, preserving aspect ratio.
 */
export function makeProjector(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 24,
): Projector {
  const x0 = bounds.minLon;
  const x1 = bounds.maxLon;
  const y0 = mercatorY(bounds.minLat);
  const y1 = mercatorY(bounds.maxLat);

  const spanX = Math.max(1e-9, x1 - x0);
  const spanY = Math.max(1e-9, y1 - y0);

  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);

  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanY * scale) / 2;

  return {
    scale,
    project(p: GeoPoint) {
      return {
        x: offsetX + (p.lon - x0) * scale,
        // screen y grows downward, mercator y grows northward
        y: offsetY + (y1 - mercatorY(p.lat)) * scale,
      };
    },
    unproject(x: number, y: number) {
      const lon = x0 + (x - offsetX) / scale;
      const my = y1 - (y - offsetY) / scale;
      const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * (180 / Math.PI);
      return { lat, lon };
    },
  };
}

/** Bounding box over a set of points, with a relative margin. */
export function boundsOf(points: GeoPoint[], marginPct = 0.06): Bounds {
  if (points.length === 0) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const dLat = Math.max(0.05, (maxLat - minLat) * marginPct);
  const dLon = Math.max(0.05, (maxLon - minLon) * marginPct);
  return {
    minLat: minLat - dLat,
    maxLat: maxLat + dLat,
    minLon: minLon - dLon,
    maxLon: maxLon + dLon,
  };
}

/**
 * Quadratic Bezier control point for drawing a flow arc between two nodes.
 * Arcs read better than straight lines when many flows converge on one facility,
 * and the curvature encodes direction without needing arrowheads everywhere.
 */
export function arcControlPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bend = 0.18,
): { cx: number; cy: number } {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  return { cx: mx - dy * bend, cy: my + dx * bend };
}
