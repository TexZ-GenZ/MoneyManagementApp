from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal


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
