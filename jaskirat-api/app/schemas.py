from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from app.models import UserRole, BillStatus, PaymentStatus


# User Schemas
class UserBase(BaseModel):
    name: str
    phone: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


# Auth Schemas
class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    refresh_token: str


# Company Schemas
class CompanyBase(BaseModel):
    code: str  # PRIMARY KEY
    account_n: str  # Company name
    area: str  # Executive name/area
    outbal: Decimal = 0  # Overdue amount
    amount: Decimal = 0  # Total amount to be collected
    promise_date: Optional[datetime] = None
    credit_date: Optional[datetime] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    assigned_executive_id: Optional[int] = None
    last_collection_date: Optional[datetime] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    account_n: Optional[str] = None
    area: Optional[str] = None
    outbal: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    promise_date: Optional[datetime] = None
    credit_date: Optional[datetime] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    assigned_executive_id: Optional[int] = None
    last_collection_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class CompanyResponse(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    assigned_executive: Optional[UserResponse] = None
    total_pending: Decimal
    total_overdue: Decimal
    bills_count: int


class CompanyStats(BaseModel):
    total_pending: Decimal
    total_overdue: Decimal
    bills_count: int
    last_payment_date: Optional[datetime] = None


# Bill Schemas
class BillBase(BaseModel):
    bill_number: str
    company_code: str  # Use company code instead of ID
    amount: Decimal
    due_date: datetime
    description: Optional[str] = None
    debit: Decimal  # From transaction file
    date: datetime  # Bill date from transaction file


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    bill_number: Optional[str] = None
    company_code: Optional[str] = None
    amount: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    status: Optional[BillStatus] = None
    description: Optional[str] = None
    debit: Optional[Decimal] = None
    date: Optional[datetime] = None


class BillResponse(BillBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: BillStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    company: CompanyResponse
    paid_amount: Decimal
    remaining_amount: Decimal


# Payment Schemas
class PaymentBase(BaseModel):
    company_code: str
    amount: Decimal
    payment_method: Optional[str] = None  # cash, cheque, online, card
    reference_number: Optional[str] = None
    next_promise_date: Optional[datetime] = None
    location_latitude: Optional[Decimal] = None
    location_longitude: Optional[Decimal] = None
    location_address: Optional[str] = None
    location_verified: bool = False
    comments: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    bill_ids: List[int]  # Multiple bills in one payment
    company_code: str
    amount: Decimal
    payment_method: Optional[str] = None  # cash, cheque, online, card
    reference_number: Optional[str] = None
    next_promise_date: Optional[datetime] = None
    location_latitude: Optional[Decimal] = None
    location_longitude: Optional[Decimal] = None
    location_address: Optional[str] = None
    location_verified: bool = False
    comments: Optional[str] = None
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    status: Optional[PaymentStatus] = None
    next_promise_date: Optional[datetime] = None
    location_latitude: Optional[Decimal] = None
    location_longitude: Optional[Decimal] = None
    location_address: Optional[str] = None
    location_verified: Optional[bool] = None
    comments: Optional[str] = None
    notes: Optional[str] = None
    # Approval fields
    accountant_approved: Optional[bool] = None
    accountant_comments: Optional[str] = None
    admin_approved: Optional[bool] = None
    admin_comments: Optional[str] = None


class PaymentResponse(PaymentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bill_ids: List[int]  # This will be converted from JSON string
    payment_date: datetime
    status: PaymentStatus
    collected_by_id: int
    # Approval fields
    accountant_approved: Optional[bool] = None
    accountant_approved_by_id: Optional[int] = None
    accountant_approved_at: Optional[datetime] = None
    accountant_comments: Optional[str] = None
    admin_approved: Optional[bool] = None
    admin_approved_by_id: Optional[int] = None
    admin_approved_at: Optional[datetime] = None
    admin_comments: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Remove bill and company relationships for now - handle separately
    # bills: Optional[List[BillResponse]] = None
    # company: Optional[CompanyResponse] = None
    # collected_by: Optional[UserResponse] = None


# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    type: str


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class NotificationResponse(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_read: bool
    created_at: datetime


# Dashboard Schemas
class DashboardStats(BaseModel):
    total_bills: int
    pending_bills: int
    overdue_bills: int
    total_amount_pending: Decimal
    payments_today: int
    amount_collected_today: Decimal


class RecentActivity(BaseModel):
    payments: List[PaymentResponse]
    bills: List[BillResponse]


# Response wrapper
class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
