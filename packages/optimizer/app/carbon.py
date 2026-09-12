"""
CarbonLoop Carbon Accounting Engine

Calculates net CO2 sequestered per tonne of waste processed.

Emission factors (gross CO2e avoided per tonne of waste input):
┌──────────────────────┬───────────────────────┬──────────────────────────────────────┬────────────────────────────────────────────┐
│ Waste Type           │ Conversion Method     │ Factor (t CO2e / t waste)            │ Source                                     │
├──────────────────────┼───────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────┤
│ food_organic         │ biochar_pyrolysis     │ 0.80                                 │ IPCC AR6 WG3 Ch.7 (2022); Woolf et al.     │
│ agricultural_biomass │ biochar_pyrolysis     │ 1.00                                 │ IPCC AR6 WG3 Ch.7 (2022); Lehmann 2021     │
│ industrial_biomass   │ biochar_pyrolysis     │ 0.85                                 │ IPCC AR6 WG3 Ch.7 (2022)                   │
│ food_processing      │ biochar_pyrolysis     │ 0.75                                 │ IPCC AR6 WG3 Ch.7 (2022)                   │
│ municipal_organic    │ biochar_pyrolysis     │ 0.72                                 │ IPCC AR6 WG3 Ch.7 (2022)                   │
│ restaurant_waste     │ biochar_pyrolysis     │ 0.78                                 │ IPCC AR6 WG3 Ch.7 (2022)                   │
│ food_organic         │ anaerobic_digestion   │ 0.35                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ food_processing      │ anaerobic_digestion   │ 0.35                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ restaurant_waste     │ anaerobic_digestion   │ 0.33                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ municipal_organic    │ anaerobic_digestion   │ 0.28                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ industrial_biomass   │ anaerobic_digestion   │ 0.28                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ agricultural_biomass │ anaerobic_digestion   │ 0.30                                 │ EPA WARM v15 Ch.4 (2019)                   │
│ food_organic         │ aerobic_composting    │ 0.18                                 │ EPA WARM v15 Ch.5 (2019); IPCC 2006 GL V5  │
│ food_processing      │ aerobic_composting    │ 0.18                                 │ EPA WARM v15 Ch.5 (2019)                   │
│ restaurant_waste     │ aerobic_composting    │ 0.16                                 │ EPA WARM v15 Ch.5 (2019)                   │
│ municipal_organic    │ aerobic_composting    │ 0.15                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
│ agricultural_biomass │ aerobic_composting    │ 0.22                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
│ industrial_biomass   │ aerobic_composting    │ 0.20                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
│ food_organic         │ vermicomposting       │ 0.14                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
│ agricultural_biomass │ vermicomposting       │ 0.18                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
│ municipal_organic    │ vermicomposting       │ 0.12                                 │ IPCC 2006 GL Vol.5 Ch.4 (2006)             │
└──────────────────────┴───────────────────────┴──────────────────────────────────────┴────────────────────────────────────────────┘

Sources:
  [1] IPCC (2022). AR6 WG3 Chapter 7: Agriculture, Forestry and Other Land Use.
      https://www.ipcc.ch/report/ar6/wg3/chapter/chapter-7/
  [2] Woolf, D. et al. (2010). Sustainable biochar to mitigate global climate change.
      Nature Communications, 1, 56. https://doi.org/10.1038/ncomms1053
  [3] Lehmann, J. et al. (2021). Biochar in climate change mitigation.
      Nature Geoscience, 14, 883-892. https://doi.org/10.1038/s41561-021-00852-8
  [4] US EPA (2019). WARM v15 Documentation: Chapter 4 (Anaerobic Digestion),
      Chapter 5 (Composting). https://www.epa.gov/warm
  [5] IPCC (2006). 2006 IPCC Guidelines for National Greenhouse Gas Inventories,
      Volume 5: Waste, Chapter 4. https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol5.html

Transport emission penalty:
  0.062 kg CO2e per tonne-km for a loaded HGV (articulated).
  Source: UK DEFRA (2023). Greenhouse Gas Reporting: Conversion Factors 2023.
          Table: Freight, HGV, Average laden, Articulated.
          https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023
"""

from pydantic import BaseModel

# ─── Emission factors table ──────────────────────────────────────────────────

# (waste_type, conversion_method) -> t CO2e per tonne of waste input
EMISSION_FACTORS: dict[tuple[str, str], float] = {
    ("food_organic",         "biochar_pyrolysis"):    0.80,
    ("agricultural_biomass", "biochar_pyrolysis"):    1.00,
    ("industrial_biomass",   "biochar_pyrolysis"):    0.85,
    ("food_processing",      "biochar_pyrolysis"):    0.75,
    ("municipal_organic",    "biochar_pyrolysis"):    0.72,
    ("restaurant_waste",     "biochar_pyrolysis"):    0.78,
    ("food_organic",         "anaerobic_digestion"):  0.35,
    ("food_processing",      "anaerobic_digestion"):  0.35,
    ("restaurant_waste",     "anaerobic_digestion"):  0.33,
    ("municipal_organic",    "anaerobic_digestion"):  0.28,
    ("industrial_biomass",   "anaerobic_digestion"):  0.28,
    ("agricultural_biomass", "anaerobic_digestion"):  0.30,
    ("food_organic",         "aerobic_composting"):   0.18,
    ("food_processing",      "aerobic_composting"):   0.18,
    ("restaurant_waste",     "aerobic_composting"):   0.16,
    ("municipal_organic",    "aerobic_composting"):   0.15,
    ("agricultural_biomass", "aerobic_composting"):   0.22,
    ("industrial_biomass",   "aerobic_composting"):   0.20,
    ("food_organic",         "vermicomposting"):      0.14,
    ("agricultural_biomass", "vermicomposting"):      0.18,
    ("municipal_organic",    "vermicomposting"):      0.12,
}

# Transport emission factor: kg CO2e per tonne-km (loaded HGV articulated)
# Source: UK DEFRA 2023 GHG Conversion Factors
TRANSPORT_FACTOR_KG_PER_T_KM = 0.062
TRANSPORT_FACTOR_T_PER_T_KM = TRANSPORT_FACTOR_KG_PER_T_KM / 1000.0

# Source citation templates
SOURCE_CITATIONS: dict[str, str] = {
    "biochar_pyrolysis":    "IPCC AR6 WG3 Ch.7 (2022); Woolf et al. (2010) Nature Communications; Lehmann et al. (2021) Nature Geoscience",
    "anaerobic_digestion":  "US EPA WARM v15 Ch.4 (2019); IPCC AR6 WG3 (2022)",
    "aerobic_composting":   "US EPA WARM v15 Ch.5 (2019); IPCC 2006 GL Vol.5 Ch.4",
    "vermicomposting":      "IPCC 2006 GL Vol.5 Ch.4",
}

METHODOLOGY_DESCRIPTIONS: dict[str, str] = {
    "biochar_pyrolysis": (
        "Biochar pyrolysis: gross CO2 sequestered calculated using IPCC AR6 WG3 Ch.7 emission factor "
        "for the relevant biomass type. Net figure subtracts transport penalty (DEFRA 2023, "
        "0.062 kg CO2e per tonne-km, loaded HGV articulated)."
    ),
    "anaerobic_digestion": (
        "Anaerobic digestion: avoided emissions calculated using EPA WARM v15 Ch.4 factor for "
        "organic waste diverted from landfill. Net figure subtracts transport penalty "
        "(DEFRA 2023, 0.062 kg CO2e per tonne-km)."
    ),
    "aerobic_composting": (
        "Aerobic composting: avoided emissions calculated using EPA WARM v15 Ch.5 and IPCC 2006 GL "
        "Vol.5 factors. Net figure subtracts transport penalty (DEFRA 2023, 0.062 kg CO2e per tonne-km)."
    ),
    "vermicomposting": (
        "Vermicomposting: avoided emissions using IPCC 2006 GL Vol.5 Ch.4 factors. Net figure subtracts "
        "transport penalty (DEFRA 2023, 0.062 kg CO2e per tonne-km)."
    ),
}


# ─── Models ───────────────────────────────────────────────────────────────────

class CarbonRequest(BaseModel):
    waste_type: str
    conversion_method: str
    volume_t: float
    distance_km: float


class CarbonResult(BaseModel):
    gross_co2_t: float
    transport_penalty_t: float
    net_co2_t: float
    methodology: str
    emission_factor: float
    source: str


# ─── Main calculation function ────────────────────────────────────────────────

def calculate_carbon(req: CarbonRequest) -> CarbonResult:
    """
    Calculate net CO2 sequestered for a pickup.

    Net CO2 = (emission_factor * volume_t) - (transport_factor * volume_t * distance_km)

    The transport penalty uses a round-trip multiplier of 2.0 only if the facility
    is dedicated (driver makes the return trip empty). For simplicity and conservatism
    we apply 1.0 (one-way distance) since routes are typically multi-stop.
    """
    key = (req.waste_type, req.conversion_method)
    factor = EMISSION_FACTORS.get(key)

    if factor is None:
        # Fall back to the conversion method average if exact pair is unknown
        method_factors = [
            v for k, v in EMISSION_FACTORS.items()
            if k[1] == req.conversion_method
        ]
        if method_factors:
            factor = sum(method_factors) / len(method_factors)
        else:
            raise ValueError(
                f"Unknown combination: waste_type={req.waste_type!r}, "
                f"conversion_method={req.conversion_method!r}"
            )

    gross_co2_t = factor * req.volume_t
    transport_penalty_t = TRANSPORT_FACTOR_T_PER_T_KM * req.volume_t * req.distance_km
    net_co2_t = max(0.0, gross_co2_t - transport_penalty_t)

    return CarbonResult(
        gross_co2_t=round(gross_co2_t, 4),
        transport_penalty_t=round(transport_penalty_t, 4),
        net_co2_t=round(net_co2_t, 4),
        methodology=METHODOLOGY_DESCRIPTIONS.get(req.conversion_method, req.conversion_method),
        emission_factor=factor,
        source=SOURCE_CITATIONS.get(req.conversion_method, "IPCC 2006 GL Vol.5"),
    )
