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

    # Redis configuration for rate limiting
    REDIS_URL: str = "redis://localhost:6379/0"

    # Authentication rate limits
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_AUTH_ME: str = "60/minute"
    RATE_LIMIT_PUSH_TOKEN: str = "10/minute"

    # Payment rate limits
    RATE_LIMIT_PAYMENT_SUBMIT: str = "10/hour"
    RATE_LIMIT_PAYMENT_BULK: str = "5/hour"
    RATE_LIMIT_PAYMENT_APPROVE: str = "20/minute"
    RATE_LIMIT_PAYMENT_DECLINE: str = "20/minute"

    # Admin operation rate limits
    RATE_LIMIT_USER_CREATION: str = "10/hour"
    RATE_LIMIT_USER_DELETE: str = "2/hour"
    RATE_LIMIT_SETTINGS_UPDATE: str = "5/hour"
    RATE_LIMIT_RECONCILE: str = "1/hour"
    RATE_LIMIT_NOTIFICATION_SCAN: str = "5/hour"

    # Data retrieval rate limits
    RATE_LIMIT_HEALTH: str = "120/minute"
    RATE_LIMIT_DATA_READ: str = "60/minute"
    RATE_LIMIT_DATA_READ_HIGH: str = "120/minute"

    # File upload rate limits
    RATE_LIMIT_UPLOAD_MASTER: str = "5/hour"
    RATE_LIMIT_UPLOAD_TRANSACTIONS: str = "10/hour"

    # Company management rate limits
    RATE_LIMIT_PROMISE_UPDATE: str = "30/minute"
    RATE_LIMIT_CREDIT_UPDATE: str = "10/hour"

    # General fallback rate limits
    RATE_LIMIT_GENERAL: str = "100/minute"

    # Pydantic v2 config
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
