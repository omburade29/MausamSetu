from app.models.entities import AuditLog
from app.models.entities import utcnow
from sqlalchemy.orm import Session


def write_audit(db: Session, user_id: int | None, action: str, entity: str, entity_id: str | None, detail: str) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            detail=detail,
            created_at=utcnow(),
        )
    )
