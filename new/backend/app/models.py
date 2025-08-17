from datetime import date, datetime
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship

class Role(str, Enum):
    admin = "admin"
    accountant = "accountant"
    executive = "executive"

class BillStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    collected_pending_approval = "collected_pending_approval"
    declined = "declined"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: Role
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Company(SQLModel, table=True):
    code: str = Field(primary_key=True)
    account_n: str
    area: Optional[str] = None
    outbal: float = 0
    amount: float = 0
    credit_date: Optional[date] = None
    promise_date: Optional[date] = None
    executive_id: Optional[int] = Field(default=None, foreign_key="user.id")
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

    bills: list["Bill"] = Relationship(back_populates="company")

class Bill(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bill: str
    company_code: str = Field(foreign_key="company.code")
    date: date
    due_date: date
    debit: float
    status: BillStatus = BillStatus.pending
    collected_amount: Optional[float] = None
    collected_at: Optional[datetime] = None
    collected_by: Optional[int] = Field(default=None, foreign_key="user.id")

    company: Optional[Company] = Relationship(back_populates="bills")

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    submitted_by: int = Field(foreign_key="user.id")
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    amount_collected: float
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    next_promise_date: Optional[date] = None
    payment_method: Optional[str] = None
    comments: Optional[str] = None
    accountant_approved: Optional[bool] = None
    admin_approved: Optional[bool] = None
    status: str = "pending_for_accountant"

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    type: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False
