"""Seed, train, and generate forecasts when the database is empty."""

from app.database import SessionLocal, init_db
from app.models import PanchayatForecast, User
from app.services.demo_seed import persist_demo
from app.services.pipeline import generate_and_store, train_and_store


def bootstrap() -> dict:
    init_db()
    db = SessionLocal()
    summary = {}
    try:
        if db.query(User).count() == 0:
            summary["seed"] = persist_demo(db)
        else:
            summary["seed"] = {"seeded": False, "reason": "users already exist"}
        from app.models import ModelRun

        if db.query(ModelRun).count() == 0:
            summary["train"] = train_and_store(db)
        else:
            summary["train"] = {"trained": False, "reason": "model runs already exist"}
        if db.query(PanchayatForecast).count() == 0:
            summary["forecasts"] = generate_and_store(db)
        else:
            summary["forecasts"] = {"stored": db.query(PanchayatForecast).count(), "reason": "forecasts already exist"}
    finally:
        db.close()
    return summary


if __name__ == "__main__":
    print(bootstrap())
