from pydantic import BaseModel
from typing import Optional


class SettingsOut(BaseModel):
    credit_extension_days: int
    notif_every_hours: int
    payment_notif_daily_hour: int


class SettingsUpdate(BaseModel):
    credit_extension_days: Optional[int] = None
    notif_every_hours: Optional[int] = None
    payment_notif_daily_hour: Optional[int] = None
