from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
    DECIMAL,
    Enum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    EXECUTIVE = "executive"


class BillStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    PARTIALLY_PAID = "partially_paid"  # Keeping this for backward compatibility with existing data


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.EXECUTIVE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    payments_collected = relationship(
        "Payment", foreign_keys="Payment.collected_by_id", back_populates="collected_by"
    )
    assigned_companies = relationship("Company", back_populates="assigned_executive")


class Company(Base):
    __tablename__ = "companies"

    # Business-specific fields matching the textile domain
    code = Column(
        String(50), primary_key=True, index=True
    )  # PRIMARY KEY from master.dbf
    account_n = Column(String(200), nullable=False, index=True)  # Company name
    area = Column(String(100), nullable=False)  # Executive name/area
    outbal = Column(DECIMAL(15, 2), nullable=False, default=0)  # Overdue amount
    amount = Column(
        DECIMAL(15, 2), nullable=False, default=0
    )  # Total amount to be collected
    promise_date = Column(DateTime(timezone=True), nullable=True)  # Next promise date
    credit_date = Column(DateTime(timezone=True), nullable=True)  # Credit date
    location = Column(String(200), nullable=True)  # Location/address

    # Contact details
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    # Executive assignment
    assigned_executive_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_collection_date = Column(DateTime(timezone=True), nullable=True)

    # System fields
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    bills = relationship("Bill", back_populates="company")
    assigned_executive = relationship("User", foreign_keys=[assigned_executive_id])

    @property
    def total_pending(self):
        """Calculate total pending amount from all bills"""
        try:
            if not hasattr(self, "bills") or not self.bills:
                return float(self.amount or 0.0)

            # Sum all pending and overdue bills
            pending_amount = 0.0
            for bill in self.bills:
                if bill.status in [
                    BillStatus.PENDING,
                    BillStatus.OVERDUE,
                ]:
                    pending_amount += float(bill.remaining_amount or bill.amount or 0.0)

            return pending_amount
        except Exception:
            # Fallback to the amount field from master.dbf
            return float(self.amount or 0.0)

    @property
    def total_overdue(self):
        """Calculate total overdue amount"""
        try:
            from datetime import datetime, timezone

            if not hasattr(self, "bills") or not self.bills:
                return float(self.outbal or 0.0)

            current_date = datetime.now(timezone.utc).date()  # Use date for comparison
            overdue_amount = 0.0

            for bill in self.bills:
                # Include bills with OVERDUE status or bills past due date
                is_overdue_status = bill.status == BillStatus.OVERDUE
                is_past_due = False

                if bill.status == BillStatus.PENDING:
                    # Check if bill is past due date
                    bill_due_date = bill.due_date
                    if isinstance(bill_due_date, datetime):
                        bill_due_date = bill_due_date.date()
                    elif isinstance(bill_due_date, str):
                        from datetime import datetime

                        bill_due_date = datetime.fromisoformat(bill_due_date).date()

                    is_past_due = bill_due_date < current_date

                if is_overdue_status or is_past_due:
                    # Use remaining_amount if available, otherwise use full amount
                    bill_amount = float(bill.remaining_amount or bill.amount or 0.0)
                    overdue_amount += bill_amount

            return overdue_amount
        except Exception as e:
            print(f"Error calculating overdue amount for company {self.code}: {e}")
            # Fallback to the outbal field from master.dbf
            return float(self.outbal or 0.0)

            return overdue_amount
        except Exception:
            # Fallback to outbal field from master.dbf
            return float(self.outbal or 0.0)

    @property
    def bills_count(self):
        """Count of all bills for this company"""
        try:
            if not hasattr(self, "bills") or not self.bills:
                return 0
            return len(self.bills)
        except Exception:
            return 0


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, index=True, nullable=False)
    company_code = Column(
        String(50), ForeignKey("companies.code"), nullable=False
    )  # Use company code
    amount = Column(DECIMAL(15, 2), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(BillStatus), default=BillStatus.PENDING)
    description = Column(Text, nullable=True)

    # Additional fields for textile business
    debit = Column(DECIMAL(15, 2), nullable=False)  # From transaction file
    date = Column(
        DateTime(timezone=True), nullable=False
    )  # Bill date from transaction file

    # Payment tracking
    paid_amount = Column(DECIMAL(15, 2), nullable=False, default=0)  # Total amount paid
    remaining_amount = Column(
        DECIMAL(15, 2), nullable=False, default=0
    )  # Remaining to be paid

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    company = relationship("Company", back_populates="bills")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(
        String(50), ForeignKey("companies.code"), nullable=False
    )  # Direct company reference
    bill_ids = Column(Text, nullable=False)  # JSON array of bill IDs
    amount = Column(DECIMAL(15, 2), nullable=False)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    payment_method = Column(String(50), nullable=True)  # cash, cheque, online, card
    reference_number = Column(String(100), nullable=True)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    collected_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Business-specific fields
    next_promise_date = Column(DateTime(timezone=True), nullable=True)
    location_latitude = Column(DECIMAL(10, 8), nullable=True)
    location_longitude = Column(DECIMAL(11, 8), nullable=True)
    location_address = Column(Text, nullable=True)
    location_verified = Column(Boolean, default=False)
    comments = Column(Text, nullable=True)

    # Approval workflow
    accountant_approved = Column(
        Boolean, nullable=True
    )  # null=pending, true=approved, false=declined
    accountant_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accountant_approved_at = Column(DateTime(timezone=True), nullable=True)
    accountant_comments = Column(Text, nullable=True)

    admin_approved = Column(
        Boolean, nullable=True
    )  # null=pending, true=approved, false=declined
    admin_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_approved_at = Column(DateTime(timezone=True), nullable=True)
    admin_comments = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    collected_by = relationship(
        "User", foreign_keys=[collected_by_id], back_populates="payments_collected"
    )
    accountant_approved_by = relationship(
        "User", foreign_keys=[accountant_approved_by_id]
    )
    admin_approved_by = relationship("User", foreign_keys=[admin_approved_by_id])

    @property
    def bills(self):
        """Get bills associated with this payment"""
        import json

        try:
            bill_ids = json.loads(self.bill_ids)
            # This would need to be handled differently in a real query
            return []  # Placeholder - would need proper join
        except:
            return []


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # payment_reminder, overdue_bill, etc.
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
