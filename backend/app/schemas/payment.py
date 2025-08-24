from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class BillAllocationIn(BaseModel):
    bill_id: int
    amount: Decimal


class PaymentSubmit(BaseModel):
    company_code: str
    collected_at: datetime
    amount_collected: Decimal
    method: str
    exec_lat: Optional[float] = None
    exec_lng: Optional[float] = None
    comments: Optional[str] = None
    next_promise_date: Optional[date] = None
    bill_allocations: List[BillAllocationIn]
    exec_location_verified: Optional[bool] = None


class PaymentOut(BaseModel):
    id: int
    company_code: str
    executive_id: int
    collected_at: datetime
    amount_collected: Decimal
    method: str
    status: str
    next_promise_date: Optional[date] = None
    exec_location_verified: Optional[bool] = None
    exec_lat: Optional[float] = None
    exec_lng: Optional[float] = None
    comments: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentList(BaseModel):
    items: List[PaymentOut]
    total: int


class BillPaymentHistoryItem(BaseModel):
    payment_id: int
    amount: Decimal
    payment_status: str
    collected_at: datetime
    method: str
    accountant_comment: Optional[str] = None
    admin_comment: Optional[str] = None
    exec_location_verified: Optional[bool] = None
    exec_lat: Optional[float] = None
    exec_lng: Optional[float] = None


class BillPaymentHistory(BaseModel):
    items: List[BillPaymentHistoryItem]
    total: int


class PaymentAllocationDetail(BaseModel):
    bill_id: int
    bill_number: str
    bill_date: date
    due_date: date
    amount_allocated: Decimal
    bill_status: str


class PaymentDetailOut(BaseModel):
    id: int
    company_code: str
    executive_id: int
    collected_at: datetime
    amount_collected: Decimal
    method: str
    status: str
    next_promise_date: Optional[date] = None
    exec_location_verified: Optional[bool] = None
    exec_lat: Optional[float] = None
    exec_lng: Optional[float] = None
    accountant_review_at: Optional[datetime] = None
    admin_review_at: Optional[datetime] = None
    accountant_comment: Optional[str] = None
    admin_comment: Optional[str] = None
    comments: Optional[str] = None  # executive's comment
    allocations: List[PaymentAllocationDetail]

    class Config:
        from_attributes = True
