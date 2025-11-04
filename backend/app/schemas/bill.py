from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, datetime
from decimal import Decimal


class BillOut(BaseModel):
    id: int
    bill_number: str
    company_code: str
    bill_date: date
    due_date: date
    promise_date: Optional[date] = None
    amount: Decimal
    amount_paid: Decimal
    status: str

    class Config:
        from_attributes = True


class BillList(BaseModel):
    items: List[BillOut]
    total: int


class BillUpdatePromise(BaseModel):
    promise_date: date


class UpcomingPromiseBill(BaseModel):
    bill_id: int
    bill_number: str
    company_code: str
    company_name: Optional[str] = None
    executive_id: Optional[int] = None
    executive_name: Optional[str] = None
    promise_date: date
    outstanding_amount: Decimal


class UpcomingPromiseBuckets(BaseModel):
    buckets: Dict[str, List[UpcomingPromiseBill]]
    generated_at: datetime
