from pydantic import BaseModel, Field
from typing import Optional


class SettingsOut(BaseModel):
    credit_extension_days: int
    notif_every_hours: int
    payment_notif_daily_hour: int


class SettingsUpdate(BaseModel):
    credit_extension_days: Optional[int] = Field(None, ge=0, le=365)
    notif_every_hours: Optional[int] = Field(None, ge=1, le=24)
    payment_notif_daily_hour: Optional[int] = Field(None, ge=0, le=23)
