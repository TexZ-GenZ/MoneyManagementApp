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
    digits = re.sub(r"\D", "", mobile or "")
    # Remove leading country code +91 if provided (common 12-digit form)
    if len(digits) >= 12 and digits.startswith("91"):
        # If exact 12 (91 + 10 digits) trim; if longer we still try to trim once
        digits = digits[2:]
    # Remove a single leading 0 sometimes used before 10-digit numbers (now 11 length)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    # After canonicalization, only accept 10-digit mobiles; otherwise return original digits for further validation/ rejection upstream
    if len(digits) == 10:
        return digits
    return digits


def get_user_by_mobile(db: Session, mobile: str) -> User | None:
    m = normalize_indian_mobile(mobile)
    return db.query(User).filter(User.mobile == m).first()
