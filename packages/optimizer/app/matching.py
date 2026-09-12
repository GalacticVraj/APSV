"""
CarbonLoop Matching Engine

Computes a weighted score (0-100) for each generator-facility pair.

Formula:
    score = (
        0.30 * distance_score(distance_km) +
        0.25 * capacity_score(remaining_capacity_t, capacity_t_month) +
        0.30 * type_compatibility(waste_type, accepted_types) +
        0.15 * efficiency_score(efficiency_pct)
    ) * 100

Where:
    distance_score   = max(0.0, 1.0 - distance_km / 200.0)
                       Linear decay to 0 at 200 km.
    capacity_score   = remaining_capacity_t / capacity_t_month
                       Clipped to [0, 1].
    type_compatibility:
                       1.0 if waste_type in accepted_waste_types
                       0.0 otherwise
    efficiency_score = efficiency_pct / 100.0

Weights are set based on domain knowledge:
    - distance (0.30): collection cost and transport emissions are material constraints
    - type compatibility (0.30): waste-type mismatch makes a facility completely unusable
    - remaining capacity (0.25): over-committed facilities must be deprioritized
    - efficiency (0.15): secondary signal; affects output quality but not feasibility
"""

import math
from typing import Optional
from pydantic import BaseModel
import numpy as np


# ─── Input/output models ──────────────────────────────────────────────────────

class FacilityInput(BaseModel):
    id: str
    lat: float
    lng: float
    conversion_type: str
    remaining_capacity_t: float
    capacity_t_month: float
    accepted_waste_types: list[str]
    efficiency_pct: float
    service_radius_km: float


class MatchRequest(BaseModel):
    listing_id: str
    generator_lat: float
    generator_lng: float
    waste_type: str
    volume_t: float
    facilities: list[FacilityInput]


class ScoreBreakdown(BaseModel):
    distance_score: float
    capacity_score: float
    type_compatibility: float
    efficiency_score: float


class MatchResult(BaseModel):
    facility_id: str
    score: float
    distance_km: float
    explanation: str
    breakdown: ScoreBreakdown


# ─── Weights (document clearly for ARCHITECTURE.md) ───────────────────────────
W_DISTANCE = 0.30
W_CAPACITY = 0.25
W_TYPE_FIT = 0.30
W_EFFICIENCY = 0.15

assert abs(W_DISTANCE + W_CAPACITY + W_TYPE_FIT + W_EFFICIENCY - 1.0) < 1e-9, \
    "Weights must sum to 1.0"

MAX_DISTANCE_KM = 200.0  # Score decays to 0 beyond this distance


# ─── Haversine distance ───────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km using the Haversine formula."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ─── Individual score functions ───────────────────────────────────────────────

def distance_score(distance_km: float) -> float:
    """Linear decay from 1.0 at 0 km to 0.0 at MAX_DISTANCE_KM. Capped at [0, 1]."""
    return float(np.clip(1.0 - distance_km / MAX_DISTANCE_KM, 0.0, 1.0))


def capacity_score(remaining_t: float, total_t: float) -> float:
    """Fraction of capacity still available. Clipped to [0, 1]."""
    if total_t <= 0:
        return 0.0
    return float(np.clip(remaining_t / total_t, 0.0, 1.0))


def type_compatibility(waste_type: str, accepted_types: list[str]) -> float:
    """
    Returns 1.0 if waste_type is in the facility's accepted_waste_types, else 0.0.
    Binary compatibility: a facility that cannot process a waste type is never matched.
    """
    return 1.0 if waste_type in accepted_types else 0.0


def efficiency_score(efficiency_pct: float) -> float:
    """Normalize 0-100% efficiency to 0.0-1.0."""
    return float(np.clip(efficiency_pct / 100.0, 0.0, 1.0))


# ─── Explanation generator ────────────────────────────────────────────────────

def generate_explanation(
    facility: FacilityInput,
    score: float,
    distance_km: float,
    d_score: float,
    c_score: float,
    t_compat: float,
    e_score: float,
) -> str:
    """Generate a plain-language explanation for why this facility was matched."""
    parts = []

    if distance_km < 50:
        parts.append(f"{facility.id[:8]} is within {distance_km:.0f} km (excellent proximity)")
    elif distance_km < 150:
        parts.append(f"{facility.id[:8]} is {distance_km:.0f} km away (acceptable distance)")
    else:
        parts.append(f"{facility.id[:8]} is {distance_km:.0f} km away (distance penalty applied)")

    capacity_pct = int(c_score * 100)
    if capacity_pct > 70:
        parts.append(f"has good remaining capacity ({capacity_pct}% available)")
    elif capacity_pct > 30:
        parts.append(f"has moderate remaining capacity ({capacity_pct}% available)")
    else:
        parts.append(f"is near capacity ({capacity_pct}% available)")

    conversion_labels = {
        "biochar_pyrolysis": "biochar pyrolysis",
        "anaerobic_digestion": "anaerobic digestion (biogas)",
        "aerobic_composting": "aerobic composting",
        "vermicomposting": "vermicomposting",
    }
    method = conversion_labels.get(facility.conversion_type, facility.conversion_type)
    parts.append(f"uses {method} at {facility.efficiency_pct:.0f}% conversion efficiency")

    waste_label = facility.accepted_waste_types[0].replace("_", " ") if facility.accepted_waste_types else "unknown"
    parts.append(f"accepts {waste_label} and related types")

    explanation = ". ".join(part.capitalize() for part in parts)
    explanation += f". Overall match score: {score:.1f}/100."
    return explanation


# ─── Main matching function ───────────────────────────────────────────────────

def compute_matches(req: MatchRequest) -> list[MatchResult]:
    """
    Compute match scores for all facilities. Returns sorted results (descending score).
    Facilities outside their service_radius_km or with 0 capacity are excluded.
    """
    results: list[MatchResult] = []

    for facility in req.facilities:
        # Compute great-circle distance
        dist_km = haversine_km(
            req.generator_lat, req.generator_lng,
            facility.lat, facility.lng,
        )

        # Exclude facilities outside their declared service radius
        if dist_km > facility.service_radius_km:
            continue

        # Exclude facilities with no remaining capacity
        if facility.remaining_capacity_t <= 0:
            continue

        # Compute individual scores
        d = distance_score(dist_km)
        c = capacity_score(facility.remaining_capacity_t, facility.capacity_t_month)
        t = type_compatibility(req.waste_type, facility.accepted_waste_types)
        e = efficiency_score(facility.efficiency_pct)

        # Type incompatibility is a hard exclusion
        if t == 0.0:
            continue

        raw_score = W_DISTANCE * d + W_CAPACITY * c + W_TYPE_FIT * t + W_EFFICIENCY * e
        final_score = round(raw_score * 100, 2)

        explanation = generate_explanation(facility, final_score, dist_km, d, c, t, e)

        results.append(MatchResult(
            facility_id=facility.id,
            score=final_score,
            distance_km=round(dist_km, 2),
            explanation=explanation,
            breakdown=ScoreBreakdown(
                distance_score=round(d, 4),
                capacity_score=round(c, 4),
                type_compatibility=t,
                efficiency_score=round(e, 4),
            ),
        ))

    # Sort by score descending
    results.sort(key=lambda r: r.score, reverse=True)
    return results
