"""Train downscaling models on the seeded history and store verification metrics."""

from app.database import SessionLocal, init_db
from app.services.pipeline import train_and_store


def main():
    init_db()
    db = SessionLocal()
    try:
        result = train_and_store(db)
    finally:
        db.close()
    print(result)


if __name__ == "__main__":
    main()
