"""
CarbonLoop Route Optimization Engine

Implements a nearest-neighbor TSP heuristic for multi-pickup collection routing.

Algorithm:
  1. Start at the depot.
  2. At each step, choose the nearest unvisited pickup that fits within the
     vehicle capacity and whose pickup window has not closed.
  3. Repeat until all eligible pickups are visited or vehicle is full.
  4. Estimate travel time assuming average speed of 40 km/h for urban routes.

This is a constructive greedy heuristic, not an exact solver. It runs in O(n^2)
and is suitable for up to ~50 stops per route in real time. For larger instances,
consider Google OR-Tools VRP solver (not included to avoid heavy dependencies).
"""

import math
from datetime import datetime
from pydantic import BaseModel


# ─── Models ───────────────────────────────────────────────────────────────────

class PickupStop(BaseModel):
    id: str
    lat: float
    lng: float
    volume_t: float
    pickup_window_start: str
    pickup_window_end: str


class RouteRequest(BaseModel):
    pickups: list[PickupStop]
    depot_lat: float
    depot_lng: float
    vehicle_capacity_t: float


class StopResult(BaseModel):
    pickup_id: str
    order: int
    lat: float
    lng: float
    eta_min: float


class RouteResult(BaseModel):
    stops: list[StopResult]
    total_distance_km: float
    total_time_min: float


# ─── Helpers ──────────────────────────────────────────────────────────────────

AVERAGE_SPEED_KMH = 40.0  # Conservative average for Indian urban/peri-urban roads
STOP_DWELL_MIN = 15.0      # Loading time per stop in minutes


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def travel_time_min(distance_km: float) -> float:
    return (distance_km / AVERAGE_SPEED_KMH) * 60.0


# ─── Main optimization function ───────────────────────────────────────────────

def optimize_route(req: RouteRequest) -> RouteResult:
    """
    Nearest-neighbor greedy TSP heuristic with capacity and time-window constraints.

    Returns an ordered list of stops with estimated arrival times from depot departure.
    Pickups that cannot be included (due to capacity or window conflicts) are skipped.
    """
    remaining = list(req.pickups)
    current_lat = req.depot_lat
    current_lng = req.depot_lng
    current_load_t = 0.0
    cumulative_time_min = 0.0
    total_distance_km = 0.0
    ordered_stops: list[StopResult] = []
    order = 1

    now = datetime.utcnow()

    while remaining:
        # Filter out stops that exceed remaining capacity or whose window has closed
        eligible = []
        for stop in remaining:
            if current_load_t + stop.volume_t > req.vehicle_capacity_t:
                continue
            try:
                window_end = datetime.fromisoformat(stop.pickup_window_end.replace("Z", "+00:00"))
                if window_end.replace(tzinfo=None) < now:
                    continue
            except (ValueError, AttributeError):
                pass  # If we cannot parse the window, assume it is still open
            eligible.append(stop)

        if not eligible:
            break

        # Find nearest eligible stop
        nearest = min(
            eligible,
            key=lambda s: haversine_km(current_lat, current_lng, s.lat, s.lng),
        )
        distance_to_next = haversine_km(current_lat, current_lng, nearest.lat, nearest.lng)
        travel = travel_time_min(distance_to_next)
        cumulative_time_min += travel + STOP_DWELL_MIN
        total_distance_km += distance_to_next

        ordered_stops.append(StopResult(
            pickup_id=nearest.id,
            order=order,
            lat=nearest.lat,
            lng=nearest.lng,
            eta_min=round(cumulative_time_min, 1),
        ))

        current_lat = nearest.lat
        current_lng = nearest.lng
        current_load_t += nearest.volume_t
        remaining.remove(nearest)
        order += 1

    return RouteResult(
        stops=ordered_stops,
        total_distance_km=round(total_distance_km, 2),
        total_time_min=round(cumulative_time_min, 1),
    )
