"""Database session and optional PostGIS geometry sync."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        url = settings.resolve_sqlite()
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
        _session_factory = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def SessionLocal() -> Session:
    get_engine()
    assert _session_factory is not None
    return _session_factory()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_engine() -> None:
    """Used by tests that swap DATABASE_URL before the engine is created."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


def init_db() -> None:
    from app import models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        ensure_postgis()


def ensure_postgis() -> None:
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return
    tables = ("states", "districts", "blocks", "panchayats")
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        for table in tables:
            conn.execute(
                text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS geom geometry(Geometry, 4326)"
                )
            )
        for table in tables:
            conn.execute(
                text(
                    f"""
                    UPDATE {table}
                    SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326)
                    WHERE geometry IS NOT NULL
                      AND (geom IS NULL OR ST_IsEmpty(geom))
                    """
                )
            )
            conn.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS idx_{table}_geom ON {table} USING GIST (geom)"
                )
            )


def panchayat_ids_in_bbox(db: Session, minx: float, miny: float, maxx: float, maxy: float) -> list[int] | None:
    """Return matching ids when PostGIS is available, else None so the caller filters in Python."""
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return None
    rows = db.execute(
        text(
            """
            SELECT id FROM panchayats
            WHERE geom IS NOT NULL
              AND geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
            """
        ),
        {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy},
    ).all()
    return [int(row[0]) for row in rows]
