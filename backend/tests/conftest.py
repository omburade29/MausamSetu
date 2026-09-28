import os
import tempfile
from pathlib import Path

_root = Path(tempfile.mkdtemp(prefix="agro-test-"))
os.environ["DATABASE_URL"] = "sqlite:///" + (_root / "test.db").as_posix()
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-32b"
os.environ["AUTO_BOOTSTRAP"] = "false"
os.environ["ENABLE_SCHEDULER"] = "false"
os.environ["DEMO_HISTORY_DAYS"] = "48"
os.environ["DEMO_LEADS"] = "24"
os.environ["MODEL_DIR"] = str(_root / "models")
os.environ["UPLOAD_DIR"] = str(_root / "uploads")
os.environ["RATE_LIMIT_PER_MINUTE"] = "5000"
os.environ["SPATIAL_SMOOTH_WEIGHT"] = "0"
os.environ["APP_ENV"] = "test"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def ready():
    from app.config import get_settings

    get_settings.cache_clear()
    from app.database import SessionLocal, init_db, reset_engine
    from app.services.demo_seed import persist_demo
    from app.services.pipeline import generate_and_store, train_and_store

    reset_engine()
    init_db()
    db = SessionLocal()
    persist_demo(db)
    train_and_store(db)
    generate_and_store(db)
    db.close()
    yield


@pytest.fixture()
def client(ready):
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client

