"""Add Local Government Directory names to the location selectors.

Maharashtra demo places that already have weather are kept. Matching names are
not duplicated. New rows are names and coordinates only, not official boundaries.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import duckdb
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Block, District, Panchayat, State

ROOT = Path(__file__).resolve().parents[2] / "data" / "india"
PARQUET = {
    "states": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.parquet",
    "districts": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/districts/LGD_Districts.parquet",
    "blocks": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/blocks/LGD_Blocks.parquet",
    "panchayats": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/panchayats/LGD_panchayats.parquet",
}
ALIASES = {
    "ahmadnagar": "ahilyanagar",
    "ahmednagar": "ahilyanagar",
    "aurangabad": "chhatrapati sambhajinagar",
    "osmanabad": "dharashiv",
}


def norm(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()
    return ALIASES.get(text, text)


def title_name(value: str) -> str:
    text = " ".join(str(value or "").split())
    return text.title() if text.isupper() else text


def export_tables() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    jobs = {
        "states.csv": f"""
            SELECT State_LGD AS state_lgd, STNAME AS name
            FROM read_parquet('{PARQUET["states"]}')
        """,
        "districts.csv": f"""
            SELECT state_lgd, dist_lgd, dtname AS name
            FROM read_parquet('{PARQUET["districts"]}')
        """,
        "blocks.csv": f"""
            SELECT state_lgd, dist_lgd, block_lgd, block_name AS name
            FROM read_parquet('{PARQUET["blocks"]}')
        """,
        "panchayats.csv": f"""
            SELECT gpcode,
                   coalesce(
                     nullif(trim(gp_name), ''),
                     nullif(trim(gpname), ''),
                     nullif(trim(vilname11), ''),
                     nullif(trim(b_pan_name), ''),
                     nullif(trim(pan_local), '')
                   ) AS name,
                   dt_lgd, block_name, blk_lgdcod,
                   (xmin + xmax) / 2 AS longitude, (ymin + ymax) / 2 AS latitude
            FROM read_parquet('{PARQUET["panchayats"]}')
            WHERE coalesce(
                     nullif(trim(gp_name), ''),
                     nullif(trim(gpname), ''),
                     nullif(trim(vilname11), ''),
                     nullif(trim(b_pan_name), ''),
                     nullif(trim(pan_local), '')
                   ) IS NOT NULL
        """,
    }
    for filename, query in jobs.items():
        path = ROOT / filename
        if path.exists() and path.stat().st_size > 100:
            print(f"keep {filename}", flush=True)
            continue
        con.execute(f"COPY ({query}) TO '{path.as_posix()}' (HEADER, DELIMITER ',')")
        print(f"wrote {filename}", flush=True)


def read_csv(name: str) -> list[dict]:
    with (ROOT / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def unique_code(used: set[str], prefix: str, raw: str, name: str) -> str:
    token = re.sub(r"[^A-Za-z0-9]", "", str(raw or ""))
    if not token or token == "0":
        token = re.sub(r"[^A-Za-z0-9]", "", norm(name))[:10] or "X"
    base = f"{prefix}{token}"[:16]
    code = base
    number = 2
    while code in used:
        suffix = str(number)
        code = f"{base[: 16 - len(suffix)]}{suffix}"
        number += 1
    used.add(code)
    return code


def apply(db: Session) -> dict:
    states_csv = read_csv("states.csv")
    districts_csv = read_csv("districts.csv")
    blocks_csv = read_csv("blocks.csv")

    used_codes = set(db.scalars(select(State.code)).all())
    used_codes.update(db.scalars(select(District.code)).all())
    used_codes.update(db.scalars(select(Block.code)).all())
    states = {norm(row.name): row for row in db.scalars(select(State)).all()}
    state_by_lgd: dict[int, State] = {}
    added_states = 0
    for item in states_csv:
        name = title_name(item["name"])
        row = states.get(norm(name))
        if row is None:
            row = State(name=name, code=unique_code(used_codes, "S", item["state_lgd"], name))
            db.add(row)
            db.flush()
            states[norm(name)] = row
            added_states += 1
        state_by_lgd[int(item["state_lgd"])] = row

    districts = {(row.state_id, norm(row.name)): row for row in db.scalars(select(District)).all()}
    district_by_lgd: dict[int, District] = {}
    added_districts = 0
    for item in districts_csv:
        state = state_by_lgd.get(int(item["state_lgd"]))
        if state is None:
            continue
        name = title_name(item["name"])
        key = (state.id, norm(name))
        row = districts.get(key)
        if row is None:
            row = District(state_id=state.id, name=name, code=unique_code(used_codes, "D", item["dist_lgd"], name))
            db.add(row)
            db.flush()
            districts[key] = row
            added_districts += 1
        district_by_lgd[int(item["dist_lgd"])] = row

    blocks = {(row.district_id, norm(row.name)): row for row in db.scalars(select(Block)).all()}
    block_by_lgd: dict[str, Block] = {}
    added_blocks = 0
    for item in blocks_csv:
        district = district_by_lgd.get(int(float(item["dist_lgd"])))
        if district is None:
            continue
        name = title_name(item["name"])
        key = (district.id, norm(name))
        row = blocks.get(key)
        if row is None:
            row = Block(district_id=district.id, name=name, code=unique_code(used_codes, "B", item["block_lgd"], name))
            db.add(row)
            db.flush()
            blocks[key] = row
            added_blocks += 1
        block_by_lgd[str(int(float(item["block_lgd"])))] = row
    db.commit()

    db.query(Panchayat).filter(Panchayat.code.like("G%")).delete(synchronize_session=False)
    db.commit()
    existing_codes = set(db.scalars(select(Panchayat.code)).all())
    existing_names = {(row.block_id, norm(row.name)) for row in db.scalars(select(Panchayat)).all()}
    added_panchayats = 0
    pending: list[dict] = []
    seen_codes = set(existing_codes)
    with (ROOT / "panchayats.csv").open(encoding="utf-8", newline="") as handle:
        for item in csv.DictReader(handle):
            block_code = str(item.get("blk_lgdcod") or "").strip()
            block = block_by_lgd.get(block_code.lstrip("0") or block_code)
            if block is None and block_code.isdigit():
                block = block_by_lgd.get(str(int(block_code)))
            if block is None:
                district = district_by_lgd.get(int(float(item["dt_lgd"]))) if item.get("dt_lgd") else None
                if district is not None:
                    block = blocks.get((district.id, norm(title_name(item.get("block_name") or ""))))
            if block is None:
                continue
            name = title_name(item.get("name") or "")[:160]
            if not name:
                continue
            raw_code = re.sub(r"\s+", "", str(item.get("gpcode") or ""))
            if (block.id, norm(name)) in existing_names:
                name = f"{name} ({raw_code})"[:160] if raw_code else ""
            if not name or (block.id, norm(name)) in existing_names:
                continue
            raw = raw_code
            code = f"G{raw}"[:32] or f"G{added_panchayats + len(pending)}"
            if code in seen_codes:
                code = f"G{raw}-{block.id}-{len(pending)}"[:32]
            if code in seen_codes:
                code = f"G{block.id}{len(seen_codes)}"[:32]
            pending.append(
                {
                    "block_id": block.id,
                    "name": name,
                    "code": code,
                    "latitude": float(item.get("latitude") or 0),
                    "longitude": float(item.get("longitude") or 0),
                    "area_sq_km": 0,
                    "elevation_mean": 0,
                    "slope_mean": 0,
                    "aspect_mean": 0,
                    "land_cover_type": "unknown",
                    "distance_to_water_km": 0,
                }
            )
            seen_codes.add(code)
            existing_names.add((block.id, norm(name)))
            if len(pending) >= 4000:
                db.bulk_insert_mappings(Panchayat, pending)
                db.commit()
                added_panchayats += len(pending)
                pending = []
                print(f"panchayats {added_panchayats}", flush=True)
    if pending:
        db.bulk_insert_mappings(Panchayat, pending)
        db.commit()
        added_panchayats += len(pending)
    return {
        "states": db.query(State).count(),
        "districts": db.query(District).count(),
        "blocks": db.query(Block).count(),
        "panchayats": db.query(Panchayat).count(),
        "added_states": added_states,
        "added_districts": added_districts,
        "added_blocks": added_blocks,
        "added_panchayats": added_panchayats,
    }


def main() -> None:
    export_tables()
    db = SessionLocal()
    try:
        print(apply(db), flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()
