"""Prototype agricultural advisories derived from downscaled demo forecasts."""

from __future__ import annotations

from typing import Any

DISCLAIMER = (
    "Prototype advisory generated from demo downscaled data. "
    "Verify with official local guidance."
)

RANK = {"Low": 0, "Moderate": 1, "High": 2}


def _card(
    panchayat: dict[str, Any],
    *,
    risk_level: str,
    weather_condition: str,
    actions: list[str],
    reason: str,
    date: str,
    confidence: int,
    uncertainty_category: str,
    priority: str,
) -> dict[str, Any]:
    return {
        "panchayat_id": panchayat["panchayat_id"],
        "panchayat": panchayat["name"],
        "risk_level": risk_level,
        "weather_condition": weather_condition,
        "recommended_farm_action": " ".join(actions),
        "recommended_actions": actions,
        "reason": reason,
        "validity": (
            f"Prototype validity: selected forecast date {date}. "
            "Re-check if the block guidance changes."
        ),
        "data_confidence": confidence,
        "uncertainty_category": uncertainty_category,
        "advisory_priority": priority,
        "crop_context": "Illustrative kharif paddy setting for the demo. Not a farm survey.",
        "disclaimer": DISCLAIMER,
        "source": "demo_simulation",
        "is_simulated": True,
    }


def build_advisories(panchayats: list[dict[str, Any]], date: str, variable: str) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for item in panchayats:
        rain = float(item["forecasts"]["rainfall_mm"])
        temp = float(item["forecasts"]["temperature_c"])
        wind = float(item["forecasts"]["wind_kmh"])
        humidity = float(item["forecasts"]["humidity_pct"])
        uncertainty = item["uncertainty_by_variable"][variable]
        category = uncertainty["category"]
        confidence = int(uncertainty["confidence"])
        drafts: list[dict[str, Any]] = []

        if rain >= 50:
            drafts.append(
                {
                    "risk_level": "High",
                    "weather_condition": f"Heavy rainfall signal ({rain:.1f} mm)",
                    "actions": [
                        "Avoid irrigation.",
                        "Delay fertilizer application.",
                        "Check drainage.",
                        "Protect harvested produce.",
                    ],
                    "reason": (
                        "The downscaled rainfall estimate is in the heavy-rain prototype band "
                        "for this date. Thresholds here are demonstration bands, not IMD criteria."
                    ),
                }
            )
        elif rain >= 35:
            drafts.append(
                {
                    "risk_level": "Moderate",
                    "weather_condition": f"Elevated rainfall signal ({rain:.1f} mm)",
                    "actions": [
                        "Avoid irrigation.",
                        "Delay fertilizer application.",
                        "Check drainage.",
                        "Protect harvested produce.",
                    ],
                    "reason": (
                        "Rainfall is below the heavy-rain prototype band but high enough that "
                        "extra irrigation and fertilizer application are poor fits for this demo rule set."
                    ),
                }
            )
        elif rain < 15:
            drafts.append(
                {
                    "risk_level": "Moderate",
                    "weather_condition": f"Low rainfall signal ({rain:.1f} mm)",
                    "actions": [
                        "Conserve soil moisture.",
                        "Review irrigation planning.",
                        "Consider mulching where appropriate.",
                    ],
                    "reason": "The downscaled rainfall estimate is in the low-rain prototype band.",
                }
            )

        if temp >= 34:
            drafts.append(
                {
                    "risk_level": "High" if temp >= 37 else "Moderate",
                    "weather_condition": f"High temperature signal ({temp:.1f} °C)",
                    "actions": [
                        "Irrigate during cooler hours.",
                        "Monitor crop heat stress.",
                        "Avoid unnecessary field operations at midday.",
                    ],
                    "reason": "The downscaled temperature estimate is in the heat-stress prototype band.",
                }
            )

        if wind >= 25:
            drafts.append(
                {
                    "risk_level": "High" if wind >= 38 else "Moderate",
                    "weather_condition": f"High wind signal ({wind:.1f} km/h)",
                    "actions": [
                        "Secure temporary structures.",
                        "Inspect crops and support systems.",
                        "Avoid spraying during strong winds.",
                    ],
                    "reason": "The downscaled wind estimate is in the strong-wind prototype band.",
                }
            )

        if category == "High uncertainty":
            drafts.append(
                {
                    "risk_level": "Moderate",
                    "weather_condition": "High uncertainty",
                    "actions": [
                        "Verify with local observations.",
                        "Treat the recommendation as indicative.",
                    ],
                    "reason": (
                        "Missing predictors, distance from the block representative point, "
                        "or a weak data-quality flag widened the uncertainty band."
                    ),
                }
            )

        if not drafts:
            drafts.append(
                {
                    "risk_level": "Low",
                    "weather_condition": (
                        f"No prototype caution band crossed "
                        f"(rain {rain:.1f} mm, {temp:.1f} °C, humidity {humidity:.0f}%, wind {wind:.1f} km/h)"
                    ),
                    "actions": [
                        "Continue routine field monitoring.",
                        "Compare with the block guidance before changing plans.",
                    ],
                    "reason": "Downscaled estimates sit outside the prototype caution bands for this date.",
                }
            )

        priority = max(drafts, key=lambda draft: RANK[draft["risk_level"]])["risk_level"]
        item["advisory_priority"] = priority
        for draft in drafts:
            cards.append(
                _card(
                    item,
                    risk_level=draft["risk_level"],
                    weather_condition=draft["weather_condition"],
                    actions=draft["actions"],
                    reason=draft["reason"],
                    date=date,
                    confidence=confidence,
                    uncertainty_category=category,
                    priority=priority,
                )
            )
    return cards
