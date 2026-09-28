"""Generate stored panchayat estimates and sample advisories from block forecasts."""

from app.database import SessionLocal, init_db
from app.services.pipeline import generate_and_store


def main():
    init_db()
    db = SessionLocal()
    try:
        result = generate_and_store(db)
    finally:
        db.close()
    print(result)


if __name__ == "__main__":
    main()
