"""Geometry helpers that work without PostGIS. PostGIS is used when the database is PostgreSQL."""

import json
import math
from typing import Any

from shapely.geometry import mapping, shape
from shapely.ops import unary_union


def polygon_rect(minx: float, miny: float, maxx: float, maxy: float) -> dict:
    ring = [
        [round(minx, 6), round(miny, 6)],
        [round(maxx, 6), round(miny, 6)],
        [round(maxx, 6), round(maxy, 6)],
        [round(minx, 6), round(maxy, 6)],
        [round(minx, 6), round(miny, 6)],
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def as_feature(geometry: dict, properties: dict) -> dict:
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def feature_collection(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def loads_geometry(value: str | dict | None) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    return json.loads(value)


def union_geojson(geometries: list[dict]) -> dict:
    merged = unary_union([shape(geom) for geom in geometries])
    return mapping(merged)


def centroid_lat_lon(geometry: dict) -> tuple[float, float]:
    point = shape(geometry).centroid
    return float(point.y), float(point.x)


def approximate_area_sq_km(geometry: dict) -> float:
    geom = shape(geometry)
    minx, miny, maxx, maxy = geom.bounds
    mid_lat = (miny + maxy) / 2
    width_km = (maxx - minx) * 111.32 * math.cos(math.radians(mid_lat))
    height_km = (maxy - miny) * 110.57
    return round(abs(width_km * height_km), 3)


def geometry_bounds(geometry: dict) -> tuple[float, float, float, float]:
    minx, miny, maxx, maxy = shape(geometry).bounds
    return float(minx), float(miny), float(maxx), float(maxy)


def bounds_intersect(
    left: tuple[float, float, float, float],
    right: tuple[float, float, float, float],
) -> bool:
    return not (left[2] < right[0] or right[2] < left[0] or left[3] < right[1] or right[3] < left[1])


def filter_features_by_bbox(features: list[dict], minx: float, miny: float, maxx: float, maxy: float) -> list[dict]:
    box = (minx, miny, maxx, maxy)
    kept = []
    for feature in features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        if bounds_intersect(geometry_bounds(geometry), box):
            kept.append(feature)
    return kept


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def dumps(geometry: dict[str, Any]) -> str:
    return json.dumps(geometry)
