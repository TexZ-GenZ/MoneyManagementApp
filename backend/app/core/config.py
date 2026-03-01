from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CREDIT_EXTENSION_DAYS: int = 10
    # Used when imported transaction rows lack an explicit due date; added to bill_date
    DEFAULT_CREDIT_TERM_DAYS: int = 30
    NOTIF_EVERY_HOURS: int = 2
    CORS_ALLOWED_ORIGINS: List[str] = ["*"]

    # Authentication rate limits
    RATE_LIMIT_LOGIN: str
    RATE_LIMIT_AUTH_ME: str
    RATE_LIMIT_PUSH_TOKEN: str

    # Payment rate limits
    RATE_LIMIT_PAYMENT_SUBMIT: str
    RATE_LIMIT_PAYMENT_BULK: str
    RATE_LIMIT_PAYMENT_APPROVAL: str
    RATE_LIMIT_PAYMENT_APPROVE: str
    RATE_LIMIT_PAYMENT_DECLINE: str

    # Admin operation rate limits
    RATE_LIMIT_USER_CREATION: str
    RATE_LIMIT_USER_DELETE: str
    RATE_LIMIT_SETTINGS_UPDATE: str
    RATE_LIMIT_RECONCILE: str
    RATE_LIMIT_NOTIFICATION_SCAN: str

    # Data retrieval rate limits
    RATE_LIMIT_HEALTH: str
    RATE_LIMIT_DATA_READ: str
    RATE_LIMIT_DATA_READ_HIGH: str

    # File upload rate limits
    RATE_LIMIT_UPLOAD_MASTER: str
    RATE_LIMIT_UPLOAD_TRANSACTIONS: str

    # Company management rate limits
    RATE_LIMIT_PROMISE_UPDATE: str
    RATE_LIMIT_CREDIT_UPDATE: str

    # General fallback rate limits
    RATE_LIMIT_GENERAL: str

    # Pydantic v2 config
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
