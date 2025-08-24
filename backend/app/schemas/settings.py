from pydantic import BaseModel, Field
from typing import Optional


class SettingsOut(BaseModel):
    credit_extension_days: int
    notif_every_hours: int
    exec_window_start_hour: int
    exec_window_end_hour: int


class SettingsUpdate(BaseModel):
    credit_extension_days: Optional[int] = Field(None, ge=0, le=365)
    notif_every_hours: Optional[int] = Field(None, ge=1, le=24)
    exec_window_start_hour: Optional[int] = Field(None, ge=0, le=23)
    exec_window_end_hour: Optional[int] = Field(None, ge=1, le=24)
