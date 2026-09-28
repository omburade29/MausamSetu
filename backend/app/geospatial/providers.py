"""Forecast providers.

The demo provider reads block forecasts stored in the application database.
The official provider is an explicit placeholder: it does not invent agency data.
"""

from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.models import BlockForecast


class OfficialProviderNotConfigured(RuntimeError):
    pass


class ForecastProvider(Protocol):
    name: str

    def fetch_block_forecasts(self, db: Session, start: datetime, end: datetime) -> list[BlockForecast]:
        ...


class DemoForecastProvider:
    name = "demo"

    def fetch_block_forecasts(self, db: Session, start: datetime, end: datetime) -> list[BlockForecast]:
        return (
            db.query(BlockForecast)
            .filter(BlockForecast.forecast_time >= start, BlockForecast.forecast_time <= end)
            .order_by(BlockForecast.forecast_time)
            .all()
        )


class OfficialAgencyProvider:
    """Placeholder for a licensed IMD or state agro-met feed.

    Wire credentials through environment variables in a future adapter.
    This class intentionally raises instead of returning fabricated official data.
    """

    name = "official-placeholder"

    def fetch_block_forecasts(self, db: Session, start: datetime, end: datetime) -> list[BlockForecast]:
        raise OfficialProviderNotConfigured(
            "No official forecast provider is configured. "
            "Set FORECAST_PROVIDER=demo or implement OfficialAgencyProvider against a licensed feed. "
            "This placeholder does not invent official IMD data."
        )


def get_provider(name: str) -> DemoForecastProvider | OfficialAgencyProvider:
    if name == "official":
        return OfficialAgencyProvider()
    return DemoForecastProvider()
