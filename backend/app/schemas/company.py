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
    credit_date: Optional[date] = None  # deprecated in list context
    promise_date: Optional[date] = None  # deprecated in list context
    promise_date_source: Optional[str] = None
    # Earliest actionable date from this company's pending bills
    # Computed as: min(bill.promise_date or (bill.bill_date + credit_days) or bill.due_date)
    next_due_date: Optional[date] = None
    outbal: Decimal
    amount: Decimal
    # Enriched fields (not persisted directly on companies table)
    assigned_executive_id: Optional[int] = None
    assigned_executive_username: Optional[str] = None
    assigned_executive_active: Optional[bool] = None

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
    promise_date_source: Optional[str] = None
    outbal: Decimal
    amount: Decimal
    pending_bills: List[BillOut]
    paid_bills: List[BillOut]

    class Config:
        from_attributes = True


class CompanyAssignment(BaseModel):
    code: str
    name: Optional[str] = None
    assigned_executive_id: Optional[int] = None
    assigned_executive_username: Optional[str] = None
    assigned_executive_active: Optional[bool] = None

    class Config:
        from_attributes = True


class CompanyAssignmentList(BaseModel):
    items: List[CompanyAssignment]
    total: int


class AssignmentBatchIn(BaseModel):
    company_codes: List[str]
    executive_id: int


class UnassignBatchIn(BaseModel):
    company_codes: List[str]
