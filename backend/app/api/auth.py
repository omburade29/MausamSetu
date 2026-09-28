from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.serialize import user_dict
from app.database import get_db
from app.models import User
from app.services.security import create_access_token, hash_password, verify_password
from app.utils.responses import error_body, ok

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    state: str | None = None
    district: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=409, detail=error_body("conflict", "An account with this email already exists"))
    user = User(
        name=body.name.strip(),
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role="farmer",
        state=body.state,
        district=body.district,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role)
    return ok({"access_token": token, "token_type": "bearer", "user": user_dict(user)})


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail=error_body("unauthorized", "Email or password is incorrect"))
    token = create_access_token(user.id, user.role)
    return ok({"access_token": token, "token_type": "bearer", "user": user_dict(user)})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(user_dict(user))
