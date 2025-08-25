from pydantic import BaseModel
from typing import Optional, List
from datetime import date
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
