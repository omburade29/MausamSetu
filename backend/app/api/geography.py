import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.serialize import place_dict
from app.database import get_db, panchayat_ids_in_bbox
from app.geospatial.geometry import filter_features_by_bbox, loads_geometry
from app.models import Block, District, Panchayat, State, User
from app.utils.responses import error_body, ok

router = APIRouter(tags=["Geography"])


def _page(query, page: int, page_size: int):
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return rows, {"page": page, "page_size": page_size, "total": total}


@router.get("/states")
def states(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows, meta = _page(db.query(State).order_by(State.name), page, page_size)
    return ok([place_dict(row) for row in rows], meta=meta)


@router.get("/districts")
def districts(
    state_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(District).order_by(District.name)
    if state_id is not None:
        query = query.filter(District.state_id == state_id)
    rows, meta = _page(query, page, page_size)
    return ok([place_dict(row) for row in rows], meta=meta)


@router.get("/blocks")
def blocks(
    district_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Block).order_by(Block.name)
    if district_id is not None:
        query = query.filter(Block.district_id == district_id)
    rows, meta = _page(query, page, page_size)
    return ok([place_dict(row) for row in rows], meta=meta)


@router.get("/panchayats")
def panchayats(
    block_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Panchayat).order_by(Panchayat.name)
    if block_id is not None:
        query = query.filter(Panchayat.block_id == block_id)
    rows, meta = _page(query, page, page_size)
    return ok([place_dict(row) for row in rows], meta=meta)


@router.get("/panchayats/{panchayat_id}")
def panchayat_detail(panchayat_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(Panchayat, panchayat_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    block = db.get(Block, row.block_id)
    district = db.get(District, block.district_id) if block else None
    state = db.get(State, district.state_id) if district else None
    return ok(
        place_dict(
            row,
            {
                "block_name": block.name if block else None,
                "district_name": district.name if district else None,
                "state_name": state.name if state else None,
                "boundary_note": "Demonstration geometry. Not an official boundary.",
            },
        )
    )


def _collection(rows, id_filter: set[int] | None = None) -> dict:
    features = []
    for row in rows:
        if id_filter is not None and row.id not in id_filter:
            continue
        geometry = loads_geometry(row.geometry)
        if geometry is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {"id": row.id, "name": row.name, "code": row.code},
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/geodata/panchayats")
def panchayat_geodata(
    block_id: int | None = None,
    district_id: int | None = None,
    minx: float | None = None,
    miny: float | None = None,
    maxx: float | None = None,
    maxy: float | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Panchayat)
    if block_id is not None:
        query = query.filter(Panchayat.block_id == block_id)
    if district_id is not None:
        block_ids = [item.id for item in db.query(Block).filter(Block.district_id == district_id).all()]
        query = query.filter(Panchayat.block_id.in_(block_ids or [-1]))
    rows = query.all()
    id_filter = None
    if None not in (minx, miny, maxx, maxy):
        postgis_ids = panchayat_ids_in_bbox(db, minx, miny, maxx, maxy)
        if postgis_ids is not None:
            id_filter = set(postgis_ids)
            collection = _collection(rows, id_filter)
        else:
            collection = _collection(rows)
            collection["features"] = filter_features_by_bbox(collection["features"], minx, miny, maxx, maxy)
        return ok(collection)
    return ok(_collection(rows))


@router.get("/geodata/blocks")
def block_geodata(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ok(_collection(db.query(Block).all()))
