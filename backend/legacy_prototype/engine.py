"""Deterministic block-to-panchayat downscaling prototype.

The contextual model redistributes a coarse block forecast with bounded
local adjustments. It is not a physical weather model, and a finer grid
is not treated as proof of accuracy.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor

PREDICTORS = [
    "elevation",
    "location",
    "land_cover",
    "soil_moisture",
    "distance_water",
    "vegetation",
]

PREDICTOR_LABELS = {
    "elevation": "Elevation",
    "location": "Location",
    "land_cover": "Land-cover proxy",
    "soil_moisture": "Soil-moisture proxy",
    "distance_water": "Distance from water",
    "vegetation": "Vegetation proxy",
}

VARIABLES = ["rainfall_mm", "temperature_c", "humidity_pct", "wind_kmh"]

VARIABLE_META = {
    "rainfall_mm": {"label": "Rainfall", "unit": "mm", "decimals": 1},
    "temperature_c": {"label": "Temperature", "unit": "°C", "decimals": 1},
    "humidity_pct": {"label": "Humidity", "unit": "%", "decimals": 0},
    "wind_kmh": {"label": "Wind", "unit": "km/h", "decimals": 1},
}

CORE_WEIGHTS = {
    "elevation": 0.30,
    "location": 0.25,
    "land_cover": 0.20,
    "soil_moisture": 0.15,
    "distance_water": 0.10,
}
VEGETATION_WEIGHT = 0.10

# Signed sensitivity applied to a predictor normalized to [-1, 1].
EFFECT_SIGN = {
    "rainfall_mm": {
        "elevation": -0.45,
        "location": 0.55,
        "land_cover": -0.15,
        "soil_moisture": 0.70,
        "distance_water": -1.0,
        "vegetation": 0.30,
    },
    "temperature_c": {
        "elevation": -0.90,
        "location": 0.25,
        "land_cover": 0.15,
        "soil_moisture": -0.55,
        "distance_water": 0.80,
        "vegetation": -0.70,
    },
    "humidity_pct": {
        "elevation": -0.35,
        "location": -0.20,
        "land_cover": 0.10,
        "soil_moisture": 0.85,
        "distance_water": -0.90,
        "vegetation": 0.40,
    },
    "wind_kmh": {
        "elevation": 0.55,
        "location": 0.20,
        "land_cover": -0.25,
        "soil_moisture": -0.10,
        "distance_water": 0.45,
        "vegetation": -0.85,
    },
}

LIMITS = {
    "rainfall_mm": (0.0, 250.0),
    "temperature_c": (8.0, 48.0),
    "humidity_pct": (20.0, 98.0),
    "wind_kmh": (0.0, 80.0),
}

RIVER_LAT = 20.422
RIVER_LON = 86.62
MODEL_LIMITATIONS = {
    "contextual_baseline": (
        "Transparent weighted adjustment. It redistributes the block forecast "
        "using relative geographic context inside this block. It is not a "
        "physical weather model and it does not create new observed skill by itself."
    ),
    "random_forest": (
        "Random Forest trained on deterministic synthetic samples for this "
        "prototype. Feature importance is impurity-based and indicative only. "
        "It is not an operational forecast model."
    ),
}


def clamp(value: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, value)))


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(min(1.0, a)))


def normalize(values: list[float]) -> list[float]:
    lo = min(values)
    hi = max(values)
    if abs(hi - lo) < 1e-9:
        return [0.0 for _ in values]
    return [2.0 * (value - lo) / (hi - lo) - 1.0 for value in values]


def active_weights(selected: list[str]) -> dict[str, float]:
    chosen = [key for key in PREDICTORS if key in selected]
    if not chosen:
        return {}
    use_veg = "vegetation" in chosen
    raw: dict[str, float] = {}
    for key in chosen:
        if key == "vegetation":
            continue
        raw[key] = CORE_WEIGHTS[key] * (1.0 - VEGETATION_WEIGHT if use_veg else 1.0)
    if use_veg:
        raw["vegetation"] = VEGETATION_WEIGHT if len(chosen) > 1 else 1.0
    total = sum(raw.values())
    if total <= 0:
        return {}
    return {key: value / total for key, value in raw.items()}


def apply_adjustment(block_value: float, raw: float, variable: str) -> tuple[float, float]:
    """Return the bounded downscaled value and the adjustment that was applied.

    Rainfall and wind are multiplicative. Temperature and humidity are additive
    so a percentage change is not applied to degrees or relative humidity.
    """
    if variable == "rainfall_mm":
        factor = clamp(raw * 0.62, -0.30, 0.42)
        value = clamp(block_value * (1.0 + factor), *LIMITS[variable])
        return value, factor
    if variable == "temperature_c":
        delta = clamp(raw * 2.8, -3.2, 3.2)
        value = clamp(block_value + delta, *LIMITS[variable])
        return value, delta
    if variable == "humidity_pct":
        delta = clamp(raw * 8.0, -12.0, 12.0)
        value = clamp(block_value + delta, *LIMITS[variable])
        return value, delta
    if variable == "wind_kmh":
        factor = clamp(raw * 0.40, -0.28, 0.38)
        value = clamp(block_value * (1.0 + factor), *LIMITS[variable])
        return value, factor
    raise ValueError(f"Unsupported weather variable: {variable}")


def round_value(value: float, variable: str) -> float:
    return round(float(value), int(VARIABLE_META[variable]["decimals"]))


def uncertainty_category(score: float) -> str:
    if score < 0.33:
        return "Low uncertainty"
    if score < 0.50:
        return "Moderate uncertainty"
    return "High uncertainty"


def synthetic_reference(block: dict[str, float], panchayat: dict[str, Any]) -> dict[str, float]:
    """Uncentered simulated reference for one Panchayat.

    This is not an observation. It uses a creek-distance and elevation process
    that the contextual weights do not copy verbatim. Validation reads the
    recentered field from data/reference_values.json.
    """
    distance = haversine_km(
        float(panchayat["latitude"]),
        float(panchayat["longitude"]),
        RIVER_LAT,
        RIVER_LON,
    )
    elevation = float(panchayat["elevation"])
    moisture = 0.55 if panchayat.get("soil_moisture") is None else float(panchayat["soil_moisture"])
    vegetation = 0.55 if panchayat.get("vegetation") is None else float(panchayat["vegetation"])
    rain = block["rainfall_mm"] * (0.62 + 0.58 * math.exp(-distance / 4.8))
    rain += (10.0 - elevation) * 0.35 + (moisture - 0.5) * 6.0
    temp = block["temperature_c"] + (elevation - 10.0) * -0.08 + distance * 0.18
    temp -= (vegetation - 0.5) * 1.4
    humidity = block["humidity_pct"] + (0.5 - distance / 12.0) * 10.0
    humidity += (moisture - 0.5) * 8.0 - (elevation - 10.0) * 0.15
    wind = block["wind_kmh"] * (0.85 + distance / 30.0) + (1.0 - vegetation) * 4.0 - moisture
    return {
        "rainfall_mm": round_value(clamp(rain, *LIMITS["rainfall_mm"]), "rainfall_mm"),
        "temperature_c": round_value(clamp(temp, *LIMITS["temperature_c"]), "temperature_c"),
        "humidity_pct": round_value(clamp(humidity, *LIMITS["humidity_pct"]), "humidity_pct"),
        "wind_kmh": round_value(clamp(wind, *LIMITS["wind_kmh"]), "wind_kmh"),
    }


def reference_field(block: dict[str, float], panchayats: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """Recenter the simulated reference so each variable's mean matches the block.

    Downscaling is tested as a spatial pattern around the block guidance, not as
    a license to invent a different block-wide bias. Clamping can leave a small
    residual mean difference.
    """
    raw = {item["id"]: synthetic_reference(block, item) for item in panchayats}
    centered: dict[str, dict[str, float]] = {item["id"]: {} for item in panchayats}
    for variable in VARIABLES:
        values = [raw[item["id"]][variable] for item in panchayats]
        shift = float(block[variable]) - (sum(values) / len(values))
        for item in panchayats:
            adjusted = clamp(raw[item["id"]][variable] + shift, *LIMITS[variable])
            centered[item["id"]][variable] = round_value(adjusted, variable)
    return centered


def _location_raw(lat: float, lon: float, origin_lat: float, origin_lon: float) -> float:
    return (lon - origin_lon) * 6.0 + (lat - origin_lat) * 1.5


def _predictor_frame(
    panchayats: list[dict[str, Any]],
    origin: tuple[float, float],
) -> dict[str, dict[str, list[Any]]]:
    origin_lat, origin_lon = origin
    raw: dict[str, list[float | None]] = {key: [] for key in PREDICTORS}
    for item in panchayats:
        raw["elevation"].append(None if item.get("elevation") is None else float(item["elevation"]))
        raw["location"].append(
            _location_raw(float(item["latitude"]), float(item["longitude"]), origin_lat, origin_lon)
        )
        raw["land_cover"].append(None if item.get("land_cover") is None else float(item["land_cover"]))
        raw["soil_moisture"].append(
            None if item.get("soil_moisture") is None else float(item["soil_moisture"])
        )
        raw["distance_water"].append(
            None if item.get("distance_water") is None else float(item["distance_water"])
        )
        raw["vegetation"].append(None if item.get("vegetation") is None else float(item["vegetation"]))

    frame: dict[str, dict[str, list[Any]]] = {}
    for key, values in raw.items():
        present = [value for value in values if value is not None]
        fill = float(np.median(present)) if present else 0.0
        imputed = [value is None for value in values]
        filled = [fill if value is None else float(value) for value in values]
        frame[key] = {
            "raw": filled,
            "imputed": imputed,
            "available": [not flag for flag in imputed],
            "normalized": normalize(filled),
        }
    return frame


def _contextual_raw(
    index: int,
    variable: str,
    weights: dict[str, float],
    frame: dict[str, dict[str, list[Any]]],
) -> tuple[float, dict[str, float]]:
    effects: dict[str, float] = {}
    raw = 0.0
    for key, weight in weights.items():
        effect = float(EFFECT_SIGN[variable][key]) * float(frame[key]["normalized"][index])
        effects[key] = effect
        raw += weight * effect
    return raw, effects


def _train_forest(
    block_value: float,
    variable: str,
    selected: list[str],
    origin: tuple[float, float],
) -> tuple[RandomForestRegressor, float, list[str]]:
    rng = np.random.RandomState(42)
    count = 180
    elevation = rng.uniform(2.0, 22.0, count)
    latitude = rng.uniform(20.37, 20.53, count)
    longitude = rng.uniform(86.47, 86.64, count)
    land_cover = rng.uniform(0.35, 0.90, count)
    moisture = rng.uniform(0.25, 0.95, count)
    distance_water = rng.uniform(0.2, 9.0, count)
    vegetation = rng.uniform(0.30, 0.85, count)
    location = (longitude - origin[1]) * 6.0 + (latitude - origin[0]) * 1.5
    columns = {
        "elevation": elevation,
        "location": location,
        "land_cover": land_cover,
        "soil_moisture": moisture,
        "distance_water": distance_water,
        "vegetation": vegetation,
    }
    spans = {
        "elevation": (11.0, 9.0),
        "location": (0.0, 0.55),
        "land_cover": (0.65, 0.25),
        "soil_moisture": (0.55, 0.30),
        "distance_water": (4.0, 4.0),
        "vegetation": (0.58, 0.22),
    }
    weights = active_weights(selected)
    raw = np.zeros(count)
    for key, weight in weights.items():
        center, span = spans[key]
        normalized = np.clip((columns[key] - center) / span, -1.2, 1.2)
        raw += weight * EFFECT_SIGN[variable][key] * normalized
    targets = np.array([apply_adjustment(block_value, float(item), variable)[0] for item in raw])
    noise = {"rainfall_mm": 0.8, "temperature_c": 0.15, "humidity_pct": 0.6, "wind_kmh": 0.35}[variable]
    targets = targets + rng.normal(0.0, noise, count)
    features = [key for key in PREDICTORS if key in weights]
    matrix = np.column_stack([columns[key] for key in features])
    model = RandomForestRegressor(
        n_estimators=60,
        max_depth=5,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=1,
    )
    model.fit(matrix, targets)
    residual = float(np.mean(np.abs(model.predict(matrix) - targets)))
    return model, residual, features


def _score_uncertainty(
    *,
    completeness: float,
    distance_norm: float,
    disagreement: float,
    model_residual: float,
    data_quality: float,
    reference_available: bool,
    missing_count: int,
) -> float:
    score = (
        0.28 * (1.0 - completeness)
        + 0.22 * distance_norm
        + 0.18 * disagreement
        + 0.18 * model_residual
        + 0.14 * (1.0 - data_quality)
        + 0.12 * missing_count
    )
    if not reference_available:
        score += 0.08
    return clamp(score, 0.05, 0.92)


def _explain(
    category: str,
    score: float,
    completeness: float,
    distance_km: float,
    imputed: list[str],
    data_quality: float,
) -> str:
    imputed_text = (
        "Imputed predictors: " + ", ".join(PREDICTOR_LABELS[key] for key in imputed) + "."
        if imputed
        else "No selected predictors were imputed for this Panchayat."
    )
    return (
        f"{category} ({score:.2f} on a 0–1 prototype scale). "
        f"Predictor completeness is {completeness:.0%}. "
        f"Distance from the block representative point is {distance_km:.1f} km. "
        f"Data-quality flag is {data_quality:.0%}. {imputed_text} "
        "The score combines completeness, distance, predictor disagreement, "
        "model residual, and data quality. It is a transparency aid, not a measured forecast error."
    )


def run_models(
    panchayats: list[dict[str, Any]],
    block_values: dict[str, float],
    origin: tuple[float, float],
    references: dict[str, dict[str, float]],
    model_name: str,
    selected: list[str],
) -> dict[str, Any]:
    if model_name not in MODEL_LIMITATIONS:
        raise ValueError(f"Unknown model: {model_name}")
    weights = active_weights(selected)
    frame = _predictor_frame(panchayats, origin)
    distances = [
        haversine_km(float(item["latitude"]), float(item["longitude"]), origin[0], origin[1])
        for item in panchayats
    ]
    max_distance = max(distances) if distances else 1.0
    if max_distance < 1e-6:
        max_distance = 1.0

    forests: dict[str, tuple[RandomForestRegressor, float, list[str]]] = {}
    if model_name == "random_forest" and weights:
        for variable in VARIABLES:
            forests[variable] = _train_forest(float(block_values[variable]), variable, selected, origin)

    rows: list[dict[str, Any]] = []
    importance_acc: dict[str, dict[str, float]] = {variable: {key: 0.0 for key in weights} for variable in VARIABLES}

    for index, item in enumerate(panchayats):
        forecasts: dict[str, float] = {}
        baselines: dict[str, float] = {}
        adjustments: dict[str, float] = {}
        uncertainty_by_variable: dict[str, dict[str, Any]] = {}
        contributions: dict[str, list[dict[str, Any]]] = {}
        ref = references.get(item["id"])

        for variable in VARIABLES:
            block_value = float(block_values[variable])
            baselines[variable] = round_value(block_value, variable)
            raw, effects = _contextual_raw(index, variable, weights, frame)
            contextual_value, contextual_adjustment = apply_adjustment(block_value, raw, variable)
            model_residual = clamp(abs(raw) * 0.65 + 0.10, 0.0, 1.0)
            value = contextual_value
            adjustment = contextual_adjustment

            if model_name == "random_forest" and weights:
                forest, train_mae, features = forests[variable]
                vector = [float(frame[key]["raw"][index]) for key in features]
                predicted = float(forest.predict(np.array([vector]))[0])
                value = clamp(predicted, *LIMITS[variable])
                if variable in ("temperature_c", "humidity_pct"):
                    adjustment = value - block_value
                else:
                    adjustment = 0.0 if abs(block_value) < 1e-9 else (value / block_value) - 1.0
                scale = {"rainfall_mm": 12.0, "temperature_c": 2.5, "humidity_pct": 8.0, "wind_kmh": 6.0}[variable]
                model_residual = clamp(train_mae / scale, 0.0, 1.0)
            elif not weights:
                value = block_value
                adjustment = 0.0
                model_residual = 0.85

            forecasts[variable] = round_value(value, variable)
            adjustments[variable] = round(float(adjustment), 4)

            components = [weights[key] * effects[key] for key in weights]
            if components:
                std = float(np.std(components))
                mean_abs = float(np.mean(np.abs(components)))
                disagreement = clamp(std / (mean_abs + 0.05), 0.0, 1.0)
            else:
                disagreement = 1.0

            selected_keys = list(weights.keys())
            available = [key for key in selected_keys if frame[key]["available"][index]]
            completeness = (len(available) / len(selected_keys)) if selected_keys else 0.0
            quality = float(item.get("data_quality") or 0.7)
            score = _score_uncertainty(
                completeness=completeness,
                distance_norm=distances[index] / max_distance,
                disagreement=disagreement,
                model_residual=model_residual,
                data_quality=quality,
                reference_available=ref is not None,
                missing_count=sum(1 for key in selected_keys if frame[key]["imputed"][index]),
            )
            category = uncertainty_category(score)
            imputed = [key for key in selected_keys if frame[key]["imputed"][index]]
            confidence = int(round((1.0 - score) * 100))
            uncertainty_by_variable[variable] = {
                "value": round(score, 3),
                "category": category,
                "confidence": confidence,
                "explanation": _explain(category, score, completeness, distances[index], imputed, quality),
                "completeness": round(completeness, 3),
                "distance_km": round(distances[index], 2),
                "model_residual": round(model_residual, 3),
            }
            contribution_rows = []
            for key in PREDICTORS:
                if key not in weights:
                    continue
                weighted = weights[key] * effects[key]
                importance_acc[variable][key] += abs(weighted)
                contribution_rows.append(
                    {
                        "id": key,
                        "label": PREDICTOR_LABELS[key],
                        "normalized": round(float(frame[key]["normalized"][index]), 3),
                        "weighted_effect": round(float(weighted), 4),
                        "weight": round(float(weights[key]), 4),
                        "available": bool(frame[key]["available"][index]),
                        "imputed": bool(frame[key]["imputed"][index]),
                    }
                )
            contributions[variable] = contribution_rows

        rows.append(
            {
                "panchayat_id": item["id"],
                "name": item["name"],
                "latitude": float(item["latitude"]),
                "longitude": float(item["longitude"]),
                "geometry": item["geometry"],
                "forecasts": forecasts,
                "baseline": baselines,
                "reference": ref,
                "adjustments": adjustments,
                "uncertainty_by_variable": uncertainty_by_variable,
                "predictor_contributions": contributions,
                "predictors": {
                    "elevation_m": item.get("elevation"),
                    "land_cover": item.get("land_cover"),
                    "soil_moisture": item.get("soil_moisture"),
                    "distance_to_water_km": item.get("distance_water"),
                    "vegetation": item.get("vegetation"),
                    "data_quality": item.get("data_quality"),
                },
                "data_quality": float(item.get("data_quality") or 0.7),
                "source": "demo_simulation",
                "is_simulated": True,
            }
        )

    feature_importance: dict[str, list[dict[str, Any]]] = {}
    for variable in VARIABLES:
        if model_name == "random_forest" and variable in forests:
            _model, _mae, features = forests[variable]
            pairs = [
                {
                    "id": key,
                    "label": PREDICTOR_LABELS[key],
                    "value": round(float(score), 4),
                    "kind": "impurity_importance",
                }
                for key, score in zip(features, forests[variable][0].feature_importances_)
            ]
        else:
            total = sum(importance_acc[variable].values()) or 1.0
            pairs = [
                {
                    "id": key,
                    "label": PREDICTOR_LABELS[key],
                    "value": round(importance_acc[variable][key] / total, 4),
                    "kind": "mean_absolute_weight_share",
                }
                for key in weights
            ]
        pairs.sort(key=lambda row: row["value"], reverse=True)
        feature_importance[variable] = pairs

    return {
        "panchayats": rows,
        "weights": {key: round(value, 4) for key, value in weights.items()},
        "feature_importance": feature_importance,
        "model_limitation": MODEL_LIMITATIONS[model_name],
    }
