from datetime import datetime, timedelta
from jose import jwt
from passlib.hash import bcrypt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import User
import re


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return bcrypt.hash(plain)


def create_access_token(sub: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": sub, "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def normalize_indian_mobile(mobile: str) -> str:
    # Strip non-digits, handle +91 prefix
    digits = re.sub(r"\D", "", mobile)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        return digits  # let validation layer decide
    return digits


def get_user_by_mobile(db: Session, mobile: str) -> User | None:
    m = normalize_indian_mobile(mobile)
    return db.query(User).filter(User.mobile == m).first()
