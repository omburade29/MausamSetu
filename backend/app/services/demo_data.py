"""Synthetic Maharashtra demonstration geography and weather.

Boundaries are regular cells, not official administrative polygons.
Village names are illustrative labels for the demo.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

from app.geospatial.geometry import approximate_area_sq_km, as_feature, feature_collection, polygon_rect, union_geojson

BLOCKS = {
    "HAV": {"name": "Haveli", "district": "PUNE", "lon": 73.80, "lat": 18.42},
    "BAR": {"name": "Baramati", "district": "PUNE", "lon": 74.22, "lat": 18.18},
    "RAH": {"name": "Rahuri", "district": "AHI", "lon": 74.42, "lat": 19.30},
    "SHR": {"name": "Shrirampur", "district": "AHI", "lon": 74.68, "lat": 19.48},
}

# name, code suffix, elevation m, slope deg, aspect deg, land cover, distance to water km
VILLAGES = {
    "HAV": [
        ("Khadakwasla", 580, 8, 210, "agriculture", 0.6),
        ("Donaje", 690, 11, 180, "forest", 9.0),
        ("Nanded", 640, 7, 160, "agriculture", 4.2),
        ("Kirkatwadi", 610, 6, 200, "settlement", 6.5),
        ("Kothrud", 600, 4, 90, "settlement", 8.0),
        ("Bavdhan", 720, 12, 250, "forest", 11.0),
    ],
    "BAR": [
        ("Malegaon", 540, 2, 40, "agriculture", 7.0),
        ("Undawadi", 510, 2, 20, "agriculture", 3.5),
        ("Kanheri", 560, 3, 80, "fallow", 12.0),
        ("Korhale", 530, 2, 10, "agriculture", 5.0),
        ("Jalgaon KP", 500, 1, 350, "agriculture", 2.0),
        ("Pandare", 575, 4, 120, "fallow", 14.0),
    ],
    "RAH": [
        ("Tilapur", 520, 2, 30, "agriculture", 0.8),
        ("Wambori", 540, 3, 60, "agriculture", 1.5),
        ("Deolali", 500, 2, 15, "agriculture", 0.4),
        ("Guha", 560, 4, 100, "fallow", 6.0),
        ("Sade", 530, 2, 45, "agriculture", 2.2),
        ("Mhaisgaon", 590, 5, 140, "agriculture", 8.5),
    ],
    "SHR": [
        ("Belapur", 540, 2, 70, "agriculture", 1.2),
        ("Naur", 560, 3, 110, "agriculture", 4.0),
        ("Undirgaon", 580, 4, 150, "fallow", 9.0),
        ("Khandala", 610, 6, 190, "forest", 13.0),
        ("Goverdhan", 550, 2, 80, "settlement", 5.5),
        ("Nimgaon", 530, 2, 50, "agriculture", 2.8),
    ],
}

CELL_WIDTH = 0.045
CELL_HEIGHT = 0.040


def build_demo_bundle(history_days: int = 180, leads: list[int] | None = None, today: date | None = None) -> dict:
    leads = leads or [24, 72, 120]
    today = today or date.today()
    places = _places()
    block_elev = (
        pd.DataFrame(places)
        .groupby("block_code")["elevation_mean"]
        .mean()
        .to_dict()
    )
    history = [today - timedelta(days=history_days - index) for index in range(history_days)]
    # history[0] is the oldest day, history[-1] is yesterday when history_days covers through yesterday.
    if history[-1] != today - timedelta(days=1):
        history = [today - timedelta(days=history_days - index) for index in range(history_days)]
    future = [today + timedelta(days=offset) for offset in range(5)]
    observations, truth = _simulate_truth(places, history + future, block_elev)
    observations = [row for row in observations if _as_date(row["observation_time"]) < today]
    block_forecasts = _block_forecasts(places, truth, history, future, leads)
    return {
        "states": [_state(places)],
        "districts": _districts(places),
        "blocks": _blocks(places),
        "panchayats": places,
        "observations": observations,
        "block_forecasts": block_forecasts,
        "environmental_features": _environment(places),
        "crops": _crops(),
        "water_geojson": _water(),
        "meta": {
            "history_days": history_days,
            "leads": leads,
            "today": today.isoformat(),
            "boundary_note": "Synthetic demonstration cells. Not official administrative boundaries.",
        },
    }


def _places() -> list[dict]:
    rows = []
    for block_code, spec in BLOCKS.items():
        for index, village in enumerate(VILLAGES[block_code]):
            name, elev, slope, aspect, cover, water = village
            col = index % 2
            row = index // 2
            minx = spec["lon"] + col * CELL_WIDTH
            miny = spec["lat"] + row * CELL_HEIGHT
            geometry = polygon_rect(minx, miny, minx + CELL_WIDTH, miny + CELL_HEIGHT)
            lat = miny + CELL_HEIGHT / 2
            lon = minx + CELL_WIDTH / 2
            rows.append(
                {
                    "name": name,
                    "code": f"{block_code}-{index + 1:02d}",
                    "block_code": block_code,
                    "district_code": spec["district"],
                    "latitude": round(lat, 5),
                    "longitude": round(lon, 5),
                    "area_sq_km": approximate_area_sq_km(geometry),
                    "elevation_mean": elev,
                    "slope_mean": slope,
                    "aspect_mean": aspect,
                    "land_cover_type": cover,
                    "distance_to_water_km": water,
                    "geometry": geometry,
                }
            )
    return rows


def _blocks(places: list[dict]) -> list[dict]:
    rows = []
    for code, spec in BLOCKS.items():
        geoms = [place["geometry"] for place in places if place["block_code"] == code]
        rows.append(
            {
                "name": spec["name"],
                "code": code,
                "district_code": spec["district"],
                "geometry": union_geojson(geoms),
            }
        )
    return rows


def _districts(places: list[dict]) -> list[dict]:
    specs = {
        "PUNE": ("Pune", "MH"),
        "AHI": ("Ahilyanagar", "MH"),
    }
    rows = []
    for code, (name, state_code) in specs.items():
        geoms = [place["geometry"] for place in places if place["district_code"] == code]
        rows.append({"name": name, "code": code, "state_code": state_code, "geometry": union_geojson(geoms)})
    return rows


def _state(places: list[dict]) -> dict:
    return {
        "name": "Maharashtra",
        "code": "MH",
        "geometry": union_geojson([place["geometry"] for place in places]),
    }


def _environment(places: list[dict]) -> list[dict]:
    lons = [place["longitude"] for place in places]
    lats = [place["latitude"] for place in places]
    lon_span = max(lons) - min(lons) or 1
    lat_span = max(lats) - min(lats) or 1
    rows = []
    for place in places:
        rows.append(
            {
                "panchayat_code": place["code"],
                "elevation_m": place["elevation_mean"],
                "slope_degree": place["slope_mean"],
                "aspect_degree": place["aspect_mean"],
                "land_cover": place["land_cover_type"],
                "distance_to_water_km": place["distance_to_water_km"],
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "normalized_x": (place["longitude"] - min(lons)) / lon_span,
                "normalized_y": (place["latitude"] - min(lats)) / lat_span,
            }
        )
    return rows


def _crops() -> list[dict]:
    return [
        {
            "name": "Wheat",
            "scientific_name": "Triticum aestivum",
            "season": "rabi",
            "typical_duration_days": 130,
            "stages": [
                ("Sowing", 0, 20),
                ("Crown root initiation", 21, 40),
                ("Tillering", 41, 70),
                ("Flowering", 71, 95),
                ("Grain filling", 96, 115),
                ("Harvest", 116, 130),
            ],
        },
        {
            "name": "Rice",
            "scientific_name": "Oryza sativa",
            "season": "kharif",
            "typical_duration_days": 140,
            "stages": [
                ("Nursery", 0, 20),
                ("Transplanting", 21, 35),
                ("Tillering", 36, 70),
                ("Panicle initiation", 71, 95),
                ("Grain filling", 96, 125),
                ("Harvest", 126, 140),
            ],
        },
        {
            "name": "Cotton",
            "scientific_name": "Gossypium hirsutum",
            "season": "kharif",
            "typical_duration_days": 180,
            "stages": [
                ("Sowing", 0, 20),
                ("Square formation", 21, 50),
                ("Flowering", 51, 90),
                ("Boll development", 91, 150),
                ("Harvest", 151, 180),
            ],
        },
    ]


def _water() -> dict:
    lake = polygon_rect(73.80, 18.41, 73.86, 18.45)
    canal = polygon_rect(74.42, 19.30, 74.50, 19.33)
    return feature_collection(
        [
            as_feature(lake, {"name": "Demo lake near Khadakwasla", "kind": "lake"}),
            as_feature(canal, {"name": "Demo canal near Rahuri", "kind": "canal"}),
        ]
    )


def _simulate_truth(places: list[dict], days: list[date], block_elev: dict) -> tuple[list[dict], dict]:
    rng = np.random.default_rng(42)
    observations = []
    truth: dict[tuple[str, date], dict] = {}
    for day in days:
        doy = day.timetuple().tm_yday
        monsoon = max(0.0, math.sin((doy - 140) * 2 * math.pi / 365))
        heat = math.sin((doy - 45) * 2 * math.pi / 365)
        for place in places:
            elev_delta = place["elevation_mean"] - block_elev[place["block_code"]]
            oro = 1 + 0.85 * (elev_delta / 80)
            lapse = -0.0065 * (place["elevation_mean"] - 550)
            tmax = 32.2 + 6.2 * heat - 1.6 * monsoon + lapse
            tmin = tmax - 12.0 + 1.4 * math.exp(-place["distance_to_water_km"] / 4) + lapse
            pulse = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(doy * 0.73 + place["longitude"]))
            rain = (monsoon**1.25) * 24 * oro * pulse
            if monsoon < 0.18:
                rain *= 0.08
            if monsoon > 0.45 and doy % 9 == (int(place["elevation_mean"]) % 6):
                rain += 18 * max(oro, 0.4)
            rain = max(0.0, rain + float(rng.normal(0, 0.8)))
            tmax += float(rng.normal(0, 0.25))
            tmin += float(rng.normal(0, 0.2))
            humidity = 56 + 24 * monsoon + 16 * math.exp(-place["distance_to_water_km"] / 3.2) - 0.015 * (
                place["elevation_mean"] - 550
            )
            humidity += float(rng.normal(0, 1.5))
            wind = 8 + 4 * math.sin(doy / 8) + 0.02 * (place["elevation_mean"] - 550)
            wind += 2 if place["land_cover_type"] == "fallow" else 0
            wind += float(rng.normal(0, 0.6))
            direction = (230 + 30 * math.sin(doy / 11) + place["aspect_mean"] / 12) % 360
            cloud = 22 + 58 * monsoon + min(35, rain * 1.1) + float(rng.normal(0, 3))
            record = {
                "rainfall_mm": round(rain, 2),
                "temperature_min_c": round(tmin, 2),
                "temperature_max_c": round(max(tmin + 0.5, tmax), 2),
                "humidity_percent": round(float(np.clip(humidity, 15, 98)), 2),
                "wind_speed_kmh": round(max(0.0, wind), 2),
                "wind_direction_deg": round(float(direction), 1),
                "cloud_cover_percent": round(float(np.clip(cloud, 0, 100)), 2),
            }
            truth[(place["code"], day)] = record
            quality = "ok"
            stored = dict(record)
            roll = float(rng.random())
            if roll < 0.03:
                stored["humidity_percent"] = None
                quality = "missing"
            elif roll < 0.05:
                stored["wind_speed_kmh"] = None
                stored["wind_direction_deg"] = None
                quality = "missing"
            elif roll < 0.07:
                quality = "suspect"
            observations.append(
                {
                    "panchayat_code": place["code"],
                    "observation_time": datetime(day.year, day.month, day.day, 6, 0, tzinfo=timezone.utc),
                    "data_source": "demo_observation",
                    "quality_flag": quality,
                    **stored,
                }
            )
    return observations, truth


def _block_forecasts(places, truth, history: list[date], future: list[date], leads: list[int]) -> list[dict]:
    rng = np.random.default_rng(7)
    by_block: dict[str, list[str]] = {}
    for place in places:
        by_block.setdefault(place["block_code"], []).append(place["code"])
    rows = []
    for day in history:
        for lead in leads:
            rows.extend(_one_block_day(by_block, truth, day, lead, rng, noise=0.55 * (lead / 24)))
    for offset, day in enumerate(future):
        lead = 24 * (offset + 1)
        rows.extend(_one_block_day(by_block, truth, day, lead, rng, noise=0.7 * (lead / 24)))
    return rows


def _one_block_day(by_block, truth, day: date, lead: int, rng, noise: float) -> list[dict]:
    rows = []
    issue = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) - timedelta(hours=lead)
    for block_code, codes in by_block.items():
        members = [truth[(code, day)] for code in codes]
        def mean(field):
            return float(np.mean([item[field] for item in members]))

        rain = max(0.0, mean("rainfall_mm") * 0.9 + 0.6 + float(rng.normal(0, noise)))
        tmax = mean("temperature_max_c") + 0.55 + float(rng.normal(0, 0.2 * max(noise, 0.2)))
        tmin = mean("temperature_min_c") + 0.25 + float(rng.normal(0, 0.15 * max(noise, 0.2)))
        humidity = mean("humidity_percent") - 3 + float(rng.normal(0, noise))
        wind = max(0.0, mean("wind_speed_kmh") + float(rng.normal(0, 0.4)))
        cloud = mean("cloud_cover_percent") + float(rng.normal(0, 2))
        pop = float(np.clip(1 - math.exp(-max(rain, 0) / 8), 0.02, 0.95))
        rows.append(
            {
                "block_code": block_code,
                "forecast_time": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
                "issue_time": issue,
                "lead_time_hours": lead,
                "rainfall_mm": round(rain, 2),
                "temperature_min_c": round(min(tmin, tmax - 0.4), 2),
                "temperature_max_c": round(tmax, 2),
                "humidity_percent": round(float(np.clip(humidity, 10, 100)), 2),
                "wind_speed_kmh": round(wind, 2),
                "wind_direction_deg": round(mean("wind_direction_deg"), 1),
                "cloud_cover_percent": round(float(np.clip(cloud, 0, 100)), 2),
                "probability_of_rain": round(pop, 3),
                "source": "demo_block_forecast",
                "quality_flag": "ok",
            }
        )
    return rows


def _as_date(value: datetime) -> date:
    return value.date()
