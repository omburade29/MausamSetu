#!/bin/sh
set -e
python - <<'PY'
import os, time
from sqlalchemy import create_engine, text
url = os.environ.get("DATABASE_URL", "")
if url.startswith("sqlite"):
    raise SystemExit(0)
for _ in range(40):
    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        break
    except Exception:
        time.sleep(2)
else:
    raise SystemExit("database not ready")
PY
python -m scripts.bootstrap
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
