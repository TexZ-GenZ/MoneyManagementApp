import enum
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
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"), nullable=False)
    area: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Company(Base):
    __tablename__ = "companies"
    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(150))
    area: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(200))
    amount: Mapped[Numeric] = mapped_column(Numeric(14, 2), default=0)
    outbal: Mapped[Numeric] = mapped_column(Numeric(14, 2), default=0)
    credit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    promise_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class BillStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    partial = "partial"


class Bill(Base):
    __tablename__ = "bills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bill_number: Mapped[str] = mapped_column(String(50))
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"), index=True)
    bill_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Numeric] = mapped_column(Numeric(14, 2))
    amount_paid: Mapped[Numeric] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus, name="billstatus"), default=BillStatus.pending
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        UniqueConstraint("company_code", "bill_number", name="uq_bill_company_number"),
    )


class ExecAssignment(Base):
    __tablename__ = "exec_assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    executive_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"), index=True)
    __table_args__ = (
        UniqueConstraint("executive_id", "company_code", name="uq_exec_company"),
    )


class PaymentStatus(str, enum.Enum):
    submitted = "submitted"
    accountant_approved = "accountant_approved"
    admin_approved = "admin_approved"
    declined_by_accountant = "declined_by_accountant"
    declined_by_admin = "declined_by_admin"


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_code: Mapped[str] = mapped_column(ForeignKey("companies.code"), index=True)
    executive_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime)
    amount_collected: Mapped[Numeric] = mapped_column(Numeric(14, 2))
    method: Mapped[str] = mapped_column(String(30))
    exec_lat: Mapped[Numeric | None] = mapped_column(Numeric(10, 6))
    exec_lng: Mapped[Numeric | None] = mapped_column(Numeric(10, 6))
    comments: Mapped[str | None] = mapped_column(Text)
    next_promise_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.submitted
    )
    exec_location_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    accountant_comment: Mapped[str | None] = mapped_column(Text)
    admin_comment: Mapped[str | None] = mapped_column(Text)
    accountant_review_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    admin_review_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True)


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id", ondelete="CASCADE"), index=True
    )
    bill_id: Mapped[int] = mapped_column(
        ForeignKey("bills.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Numeric] = mapped_column(Numeric(14, 2))


class NotificationType(str, enum.Enum):
    promise_crossed = "promise_crossed"
    payment_review = "payment_review"
    promise_digest = "promise_digest"  # daily executive summary


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    stopped = "stopped"


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_code: Mapped[str | None] = mapped_column(String(50))
    payment_id: Mapped[int | None] = mapped_column(Integer)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notificationtype")
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notificationstatus"),
        default=NotificationStatus.pending,
    )
    message: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime)


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    credit_extension_days: Mapped[int] = mapped_column(Integer, default=0)
    notif_every_hours: Mapped[int] = mapped_column(Integer, default=2)
    exec_window_start_hour: Mapped[int] = mapped_column(
        Integer, default=6
    )  # local (IST) start hour for exec pushes
    exec_window_end_hour: Mapped[int] = mapped_column(
        Integer, default=22
    )  # local (IST) end hour (exclusive)


class ImportType(str, enum.Enum):
    master = "master"
    transactions = "transactions"


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[ImportType] = mapped_column(Enum(ImportType, name="importtype"))
    filename: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class PushToken(Base):
    __tablename__ = "push_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(500), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
