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
    PAYMENT_NOTIF_DAILY_HOUR: int = 9
    CORS_ALLOWED_ORIGINS: List[str] = ["*"]

    # Pydantic v2 config
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
