from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.exc import NoResultFound
from sqlmodel import Session, select
from app.config import settings
from app.db.session import get_session
from app.models import User, Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    username: str
    password: str

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

@router.post("/auth/login", response_model=Token)
def login(payload: LoginIn, session: Session = Depends(get_session)):
    stmt = select(User).where(User.username == payload.username)
    user = session.exec(stmt).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return {"access_token": token}
