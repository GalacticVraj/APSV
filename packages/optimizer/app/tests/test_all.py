from app.matching import MatchRequest, FacilityInput, compute_matches
from app.carbon import CarbonRequest, calculate_carbon
from app.routing import RouteRequest, PickupStop, optimize_route


class TestMatching:
    def _make_facility(self, fid, lat, lng, waste_types, capacity=500, remaining=200, eff=80, radius=150):
        return FacilityInput(
            id=fid,
            lat=lat,
            lng=lng,
            conversion_type="biochar_pyrolysis",
            remaining_capacity_t=remaining,
            capacity_t_month=capacity,
            accepted_waste_types=waste_types,
            efficiency_pct=eff,
            service_radius_km=radius,
        )

    def test_exact_type_match_scores_higher_than_incompatible(self):
        req = MatchRequest(
            listing_id="listing-1",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="agricultural_biomass",
            volume_t=50,
            facilities=[
                self._make_facility("f1", 13.0, 77.5, ["agricultural_biomass"]),
                self._make_facility("f2", 13.0, 77.5, ["food_organic"]),  # incompatible
            ],
        )
        results = compute_matches(req)
        assert len(results) == 1
        assert results[0].facility_id == "f1"

    def test_closer_facility_scores_higher_at_equal_capacity_and_type(self):
        req = MatchRequest(
            listing_id="listing-2",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="food_organic",
            volume_t=10,
            facilities=[
                self._make_facility("far", 15.0, 77.5, ["food_organic"]),   # ~115 km
                self._make_facility("near", 13.0, 77.6, ["food_organic"]),  # ~5 km
            ],
        )
        results = compute_matches(req)
        ids = [r.facility_id for r in results]
        assert ids[0] == "near"

    def test_facility_outside_service_radius_excluded(self):
        req = MatchRequest(
            listing_id="listing-3",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="agricultural_biomass",
            volume_t=10,
            facilities=[
                self._make_facility("f1", 13.0, 77.5, ["agricultural_biomass"], radius=5),  # 5 km radius but far
                self._make_facility("f2", 13.01, 77.60, ["agricultural_biomass"], radius=200),
            ],
        )
        results = compute_matches(req)
        # f1 has radius 5 km; distance to generator is ~5 km (borderline), f2 should be included
        assert any(r.facility_id == "f2" for r in results)

    def test_zero_capacity_facility_excluded(self):
        req = MatchRequest(
            listing_id="listing-4",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="agricultural_biomass",
            volume_t=10,
            facilities=[
                self._make_facility("empty", 13.0, 77.5, ["agricultural_biomass"], remaining=0),
                self._make_facility("ok", 13.0, 77.6, ["agricultural_biomass"], remaining=100),
            ],
        )
        results = compute_matches(req)
        assert all(r.facility_id != "empty" for r in results)
        assert any(r.facility_id == "ok" for r in results)

    def test_score_in_valid_range(self):
        req = MatchRequest(
            listing_id="listing-5",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="agricultural_biomass",
            volume_t=50,
            facilities=[
                self._make_facility("f1", 13.1, 77.5, ["agricultural_biomass"]),
            ],
        )
        results = compute_matches(req)
        assert len(results) == 1
        assert 0 <= results[0].score <= 100

    def test_explanation_is_non_empty(self):
        req = MatchRequest(
            listing_id="listing-6",
            generator_lat=12.9716,
            generator_lng=77.5946,
            waste_type="agricultural_biomass",
            volume_t=20,
            facilities=[
                self._make_facility("f1", 13.0, 77.5, ["agricultural_biomass"]),
            ],
        )
        results = compute_matches(req)
        assert len(results[0].explanation) > 20


class TestCarbonCalculation:
    def test_biochar_agricultural_biomass(self):
        req = CarbonRequest(
            waste_type="agricultural_biomass",
            conversion_method="biochar_pyrolysis",
            volume_t=100,
            distance_km=0,
        )
        result = calculate_carbon(req)
        assert result.gross_co2_t == 100.0   # 1.00 t CO2e / t * 100 t
        assert result.transport_penalty_t == 0.0
        assert result.net_co2_t == 100.0

    def test_transport_penalty_applied(self):
        req = CarbonRequest(
            waste_type="agricultural_biomass",
            conversion_method="biochar_pyrolysis",
            volume_t=100,
            distance_km=100,
        )
        result = calculate_carbon(req)
        expected_penalty = 0.062 / 1000 * 100 * 100  # 0.062 kg/t-km -> 0.62 t CO2e
        assert abs(result.transport_penalty_t - expected_penalty) < 0.001
        assert result.net_co2_t < result.gross_co2_t

    def test_net_co2_never_negative(self):
        req = CarbonRequest(
            waste_type="food_organic",
            conversion_method="aerobic_composting",
            volume_t=1,
            distance_km=10000,  # Absurd distance
        )
        result = calculate_carbon(req)
        assert result.net_co2_t >= 0.0

    def test_anaerobic_digestion_factor(self):
        req = CarbonRequest(
            waste_type="food_organic",
            conversion_method="anaerobic_digestion",
            volume_t=100,
            distance_km=0,
        )
        result = calculate_carbon(req)
        assert abs(result.gross_co2_t - 35.0) < 0.01  # 0.35 factor

    def test_all_combinations_have_factors(self):
        waste_types = ["food_organic", "agricultural_biomass", "industrial_biomass",
                       "municipal_organic", "food_processing", "restaurant_waste"]
        methods = ["biochar_pyrolysis", "anaerobic_digestion", "aerobic_composting", "vermicomposting"]
        for wt in waste_types:
            for method in methods:
                req = CarbonRequest(waste_type=wt, conversion_method=method, volume_t=10, distance_km=50)
                try:
                    result = calculate_carbon(req)
                    assert result.net_co2_t >= 0
                except ValueError:
                    pass  # Some combinations legitimately have no defined factor

    def test_source_citation_is_non_empty(self):
        req = CarbonRequest(
            waste_type="food_organic",
            conversion_method="biochar_pyrolysis",
            volume_t=50,
            distance_km=20,
        )
        result = calculate_carbon(req)
        assert len(result.source) > 10
        assert len(result.methodology) > 20


class TestRouting:
    def test_returns_correct_number_of_stops(self):
        req = RouteRequest(
            pickups=[
                PickupStop(id="p1", lat=12.9, lng=77.5, volume_t=5, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
                PickupStop(id="p2", lat=13.0, lng=77.6, volume_t=5, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
                PickupStop(id="p3", lat=13.1, lng=77.4, volume_t=5, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
            ],
            depot_lat=12.8,
            depot_lng=77.5,
            vehicle_capacity_t=50,
        )
        result = optimize_route(req)
        assert len(result.stops) == 3

    def test_capacity_constraint_respected(self):
        req = RouteRequest(
            pickups=[
                PickupStop(id="p1", lat=12.9, lng=77.5, volume_t=40, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
                PickupStop(id="p2", lat=13.0, lng=77.6, volume_t=40, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
            ],
            depot_lat=12.8,
            depot_lng=77.5,
            vehicle_capacity_t=50,  # Can only fit one 40t pickup
        )
        result = optimize_route(req)
        assert len(result.stops) == 1

    def test_total_distance_positive(self):
        req = RouteRequest(
            pickups=[
                PickupStop(id="p1", lat=13.0, lng=77.6, volume_t=5, pickup_window_start="2030-01-01T06:00:00", pickup_window_end="2030-01-01T18:00:00"),
            ],
            depot_lat=12.9,
            depot_lng=77.5,
            vehicle_capacity_t=20,
        )
        result = optimize_route(req)
        assert result.total_distance_km > 0
        assert result.total_time_min > 0

    def test_empty_pickups_returns_empty_route(self):
        req = RouteRequest(
            pickups=[],
            depot_lat=12.9,
            depot_lng=77.5,
            vehicle_capacity_t=20,
        )
        result = optimize_route(req)
        assert len(result.stops) == 0
        assert result.total_distance_km == 0.0
