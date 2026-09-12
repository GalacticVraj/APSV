"""
CarbonLoop Optimizer Service - Main FastAPI application

Provides three endpoints:
  POST /match   - compute weighted match scores for generator-facility pairs
  POST /route   - optimize collection route for a set of pickups (nearest-neighbor TSP)
  POST /carbon  - calculate net CO2 sequestered for a given pickup
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from .matching import MatchRequest, MatchResult, compute_matches
from .routing import RouteRequest, RouteResult, optimize_route
from .carbon import CarbonRequest, CarbonResult, calculate_carbon

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("optimizer")

app = FastAPI(
    title="CarbonLoop Optimizer",
    description="Matching, routing, and carbon accounting engine for CarbonLoop",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "carbonloop-optimizer"}


@app.post("/match", response_model=list[MatchResult])
def match_endpoint(req: MatchRequest) -> list[MatchResult]:
    """
    Compute weighted match scores between one waste listing and a set of facilities.
    Returns results sorted by score descending.
    """
    try:
        results = compute_matches(req)
        logger.info(
            "Match computed: listing=%s, candidates=%d, results=%d",
            req.listing_id,
            len(req.facilities),
            len(results),
        )
        return results
    except Exception as e:
        logger.exception("Match computation failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/route", response_model=RouteResult)
def route_endpoint(req: RouteRequest) -> RouteResult:
    """
    Optimize a collection route for a set of pickup stops.
    Uses nearest-neighbor heuristic with time-window constraints.
    """
    try:
        result = optimize_route(req)
        logger.info(
            "Route optimized: stops=%d, distance=%.1f km, time=%.0f min",
            len(result.stops),
            result.total_distance_km,
            result.total_time_min,
        )
        return result
    except Exception as e:
        logger.exception("Route optimization failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/carbon", response_model=CarbonResult)
def carbon_endpoint(req: CarbonRequest) -> CarbonResult:
    """
    Calculate net CO2 sequestered for a given waste pickup.
    Applies gross sequestration factor minus transport emission penalty.
    """
    try:
        result = calculate_carbon(req)
        logger.info(
            "Carbon calculated: type=%s, method=%s, volume=%.1f t, net_co2=%.3f t",
            req.waste_type,
            req.conversion_method,
            req.volume_t,
            result.net_co2_t,
        )
        return result
    except Exception as e:
        logger.exception("Carbon calculation failed")
        raise HTTPException(status_code=500, detail=str(e))
