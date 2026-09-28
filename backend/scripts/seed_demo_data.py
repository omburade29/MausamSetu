"""Create tables and load the synthetic demonstration dataset."""

import argparse

from app.database import SessionLocal, init_db
from app.services.demo_seed import persist_demo


def main():
    parser = argparse.ArgumentParser(description="Seed demonstration geography, weather, crops, and users")
    parser.add_argument("--reset", action="store_true", help="Replace existing demonstration rows")
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        result = persist_demo(db, reset=args.reset)
    finally:
        db.close()
    print(result)


if __name__ == "__main__":
    main()
