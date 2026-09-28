"""Shared labels. Downscaled values are never described as official forecasts."""

DISCLAIMER = (
    "These figures are model-generated estimates for agro-meteorological decision support. "
    "They are not official India Meteorological Department (IMD) forecasts and must not be "
    "cited as such. Confirm with local observation and official advisories before high-cost actions."
)

PANCHAYAT_SOURCE_LABEL = (
    "Model-generated downscaled estimate. Not an official IMD forecast."
)
BLOCK_SOURCE_LABEL = (
    "Coarse block-level forecast input from the demo provider. Not a live official feed."
)
OBSERVED_SOURCE_LABEL = "Demo historical observation (synthetic station/panchayat series)."
ADVISORY_DISCLAIMER = (
    "General decision support only. This advisory is not an official agronomic prescription. "
    "An agriculture officer should review it before it is treated as guidance for farmers. "
    + DISCLAIMER
)

TARGET_VARIABLES = [
    "rainfall_mm",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_percent",
    "wind_speed_kmh",
    "cloud_cover_percent",
]

VARIABLE_UNITS = {
    "rainfall_mm": "mm",
    "temperature_min_c": "°C",
    "temperature_max_c": "°C",
    "humidity_percent": "%",
    "wind_speed_kmh": "km/h",
    "wind_direction_deg": "°",
    "cloud_cover_percent": "%",
    "probability_of_rain": "probability",
}

LAND_COVER_CODES = {
    "agriculture": 0,
    "forest": 1,
    "settlement": 2,
    "water": 3,
    "fallow": 4,
    "unknown": -1,
}
