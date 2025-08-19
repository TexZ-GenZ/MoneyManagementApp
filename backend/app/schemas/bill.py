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
    amount: Decimal
    amount_paid: Decimal
    status: str

    class Config:
        from_attributes = True


class BillList(BaseModel):
    items: List[BillOut]
    total: int
