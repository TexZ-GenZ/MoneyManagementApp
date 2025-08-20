from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.schemas.bill import BillOut


class CompanyBase(BaseModel):
    code: str
    name: str
    area: Optional[str] = None
    location: Optional[str] = None
    credit_date: Optional[date] = None
    promise_date: Optional[date] = None
    outbal: Decimal
    amount: Decimal

    class Config:
        from_attributes = True


class CompanyUpdatePromise(BaseModel):
    promise_date: date


class CompanyUpdateCredit(BaseModel):
    credit_date: date


class CompanyList(BaseModel):
    items: List[CompanyBase]
    total: int


class CompanyDashboard(BaseModel):
    code: str
    name: str
    area: Optional[str] = None
    credit_date: Optional[date] = None
    promise_date: Optional[date] = None
    outbal: Decimal
    amount: Decimal
    pending_bills: List[BillOut]
    paid_bills: List[BillOut]

    class Config:
        from_attributes = True
