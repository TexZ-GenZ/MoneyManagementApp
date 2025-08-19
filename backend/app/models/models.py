from sqlalchemy import (
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    UniqueConstraint,
    Enum,
    Boolean,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
import enum
from app.db.session import Base


class Role(str, enum.Enum):
    admin = "admin"
    accountant = "accountant"
    executive = "executive"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    mobile: Mapped[str | None] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    area: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Company(Base):
    __tablename__ = "companies"
    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    area: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(200))
    credit_date: Mapped[date | None] = mapped_column(Date)
    promise_date: Mapped[date | None] = mapped_column(Date)
    outbal: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class BillStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


class Bill(Base):
    __tablename__ = "bills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bill_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"), index=True)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus), default=BillStatus.pending
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class ExecAssignment(Base):
    __tablename__ = "exec_assignments"
    __table_args__ = (
        UniqueConstraint("executive_id", "company_code", name="uq_exec_company"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    executive_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"))


class PaymentStatus(str, enum.Enum):
    submitted = "submitted"
    accountant_approved = "accountant_approved"
    admin_approved = "admin_approved"
    declined_by_accountant = "declined_by_accountant"
    declined_by_admin = "declined_by_admin"


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"))
    executive_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    amount_collected: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(50))
    exec_lat: Mapped[float | None] = mapped_column()
    exec_lng: Mapped[float | None] = mapped_column()
    comments: Mapped[str | None] = mapped_column(Text)
    next_promise_date: Mapped[date | None] = mapped_column(Date)
    # Idempotency: unique key provided by client to de-duplicate POST /payments
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.submitted
    )
    accountant_review_at: Mapped[datetime | None] = mapped_column(DateTime)
    admin_review_at: Mapped[datetime | None] = mapped_column(DateTime)
    exec_location_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    accountant_comment: Mapped[str | None] = mapped_column(Text)
    admin_comment: Mapped[str | None] = mapped_column(Text)


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"
    __table_args__ = (
        UniqueConstraint("payment_id", "bill_id", name="uq_payment_bill"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"))
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id"))
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)


class NotificationType(str, enum.Enum):
    promise_crossed = "promise_crossed"
    payment_review = "payment_review"


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    stopped = "stopped"


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"))
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus), default=NotificationStatus.pending
    )
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime)
    stop_reason: Mapped[str | None] = mapped_column(String(200))


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    credit_extension_days: Mapped[int] = mapped_column(Integer, default=10)
    notif_every_hours: Mapped[int] = mapped_column(Integer, default=2)
    payment_notif_daily_hour: Mapped[int] = mapped_column(Integer, default=9)


class ImportType(str, enum.Enum):
    master = "master"
    transactions = "transactions"


class ImportJob(Base):
    __tablename__ = "imports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[ImportType] = mapped_column(Enum(ImportType))
    source_name: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    stats: Mapped[str | None] = mapped_column(Text)
