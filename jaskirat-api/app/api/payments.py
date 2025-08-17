from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import json

from app.database import get_db
from app.models import Payment, Bill, Company, User, UserRole, PaymentStatus, BillStatus
from app.schemas import PaymentCreate, PaymentUpdate, PaymentResponse, ResponseModel
from app.api.auth import get_current_user, require_roles

router = APIRouter()


def payment_to_response(payment: Payment) -> PaymentResponse:
    """Convert Payment model to PaymentResponse schema"""
    payment_dict = {
        "id": payment.id,
        "bill_ids": json.loads(payment.bill_ids),  # Convert JSON string back to list
        "company_code": payment.company_code,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "reference_number": payment.reference_number,
        "payment_date": payment.payment_date,
        "status": payment.status,
        "collected_by_id": payment.collected_by_id,
        "next_promise_date": payment.next_promise_date,
        "location_latitude": payment.location_latitude,
        "location_longitude": payment.location_longitude,
        "location_address": payment.location_address,
        "location_verified": payment.location_verified,
        "comments": payment.comments,
        "notes": payment.notes,
        "accountant_approved": payment.accountant_approved,
        "accountant_approved_by_id": payment.accountant_approved_by_id,
        "accountant_approved_at": payment.accountant_approved_at,
        "accountant_comments": payment.accountant_comments,
        "admin_approved": payment.admin_approved,
        "admin_approved_by_id": payment.admin_approved_by_id,
        "admin_approved_at": payment.admin_approved_at,
        "admin_comments": payment.admin_comments,
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
    }
    return PaymentResponse(**payment_dict)


@router.get("/", response_model=List[PaymentResponse])
async def get_payments(
    bill_id: Optional[int] = Query(None),
    collected_by_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all payments with pagination and filters"""
    query = select(Payment).options(
        selectinload(Payment.company), selectinload(Payment.collected_by)
    )

    # Filter conditions
    if collected_by_id:
        query = query.where(Payment.collected_by_id == collected_by_id)

    if start_date:
        query = query.where(Payment.payment_date >= start_date)

    if end_date:
        query = query.where(Payment.payment_date <= end_date)

    # Executives can only see their own payments
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Payment.collected_by_id == current_user.id)

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Payment.payment_date.desc())

    result = await db.execute(query)
    payments = result.scalars().all()

    return [payment_to_response(payment) for payment in payments]


@router.get("/pending", response_model=List[PaymentResponse])
async def get_pending_payments(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get payments pending approval based on user role"""
    query = select(Payment).options(
        selectinload(Payment.company), selectinload(Payment.collected_by)
    )

    if current_user.role == UserRole.ACCOUNTANT:
        # Accountants see payments pending their approval
        query = query.where(Payment.accountant_approved.is_(None))
    elif current_user.role == UserRole.ADMIN:
        # Admins see payments pending their approval (already approved by accountant)
        query = query.where(
            Payment.accountant_approved == True, Payment.admin_approved.is_(None)
        )
    else:
        # Executives shouldn't access this endpoint
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view pending approvals",
        )

    query = query.order_by(Payment.payment_date.desc())
    result = await db.execute(query)
    payments = result.scalars().all()

    return [payment_to_response(payment) for payment in payments]


@router.get("/executive/{executive_id}", response_model=List[PaymentResponse])
async def get_executive_payments(
    executive_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payments by executive"""
    # Executives can only see their own payments
    if current_user.role == UserRole.EXECUTIVE and current_user.id != executive_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own payments",
        )

    query = (
        select(Payment)
        .options(selectinload(Payment.company), selectinload(Payment.collected_by))
        .where(Payment.collected_by_id == executive_id)
    )

    query = query.order_by(Payment.payment_date.desc())
    result = await db.execute(query)
    payments = result.scalars().all()

    return [payment_to_response(payment) for payment in payments]


@router.post("/", response_model=PaymentResponse)
async def create_payment(
    payment_data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create new payment (support multiple bills)"""

    print(f"🔍 DEBUG: Received payment data: {payment_data}")
    print(f"🔍 DEBUG: Bill IDs to find: {payment_data.bill_ids}")

    # Verify all bills exist and belong to the same company
    result = await db.execute(select(Bill).where(Bill.id.in_(payment_data.bill_ids)))
    bills = result.scalars().all()

    print(
        f"🔍 DEBUG: Found {len(bills)} bills out of {len(payment_data.bill_ids)} requested"
    )
    print(f"🔍 DEBUG: Found bill IDs: {[bill.id for bill in bills]}")

    if len(bills) != len(payment_data.bill_ids):
        missing_ids = set(payment_data.bill_ids) - set(bill.id for bill in bills)
        print(f"🚨 DEBUG: Missing bill IDs: {missing_ids}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bills not found: {list(missing_ids)}",
        )

    # Verify all bills belong to the same company
    company_codes = set(bill.company_code for bill in bills)
    if len(company_codes) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All bills must belong to the same company",
        )

    if payment_data.company_code not in company_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company code doesn't match bill company",
        )

    # Check if payment amount is valid
    if payment_data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than 0",
        )

    # Create payment
    payment = Payment(
        bill_ids=json.dumps(payment_data.bill_ids),
        company_code=payment_data.company_code,
        amount=payment_data.amount,
        payment_method=payment_data.payment_method,
        reference_number=payment_data.reference_number,
        next_promise_date=payment_data.next_promise_date,
        location_latitude=payment_data.location_latitude,
        location_longitude=payment_data.location_longitude,
        location_address=payment_data.location_address,
        location_verified=payment_data.location_verified,
        comments=payment_data.comments,
        notes=payment_data.notes,
        collected_by_id=current_user.id,
        status=PaymentStatus.PENDING,
    )

    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return payment_to_response(payment)


@router.put("/{payment_id}/approve", response_model=PaymentResponse)
async def approve_payment(
    payment_id: int,
    approval_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve/reject payment (accountant level)"""
    if current_user.role not in [UserRole.ACCOUNTANT, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to approve payments",
        )

    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    # Accountant approval
    if current_user.role == UserRole.ACCOUNTANT:
        payment.accountant_approved = approval_data.get("approved", False)
        payment.accountant_approved_by_id = current_user.id
        payment.accountant_approved_at = datetime.now()
        payment.accountant_comments = approval_data.get("comments")

        # If declined, update status
        if not payment.accountant_approved:
            payment.status = PaymentStatus.FAILED

    await db.commit()
    await db.refresh(payment)

    return payment_to_response(payment)


@router.put("/{payment_id}/admin-approve", response_model=PaymentResponse)
async def admin_approve_payment(
    payment_id: int,
    approval_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Final admin approval"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform final approval",
        )

    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    if payment.accountant_approved != True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment must be approved by accountant first",
        )

    # Admin approval
    payment.admin_approved = approval_data.get("approved", False)
    payment.admin_approved_by_id = current_user.id
    payment.admin_approved_at = datetime.now()
    payment.admin_comments = approval_data.get("comments")

    # Update bill status if payment is fully approved
    if payment.admin_approved:
        bill_ids = json.loads(payment.bill_ids)

        # Update bill statuses and remaining amounts
        for bill_id in bill_ids:
            result = await db.execute(select(Bill).where(Bill.id == bill_id))
            bill = result.scalar_one_or_none()
            if bill:
                # Calculate how much of this payment applies to this bill
                # For simplicity, distribute payment amount equally across bills
                bill_payment_amount = payment.amount / len(bill_ids)

                # Update bill paid amount and remaining amount
                bill.paid_amount = (bill.paid_amount or 0) + bill_payment_amount
                bill.remaining_amount = bill.amount - bill.paid_amount

                # Update bill status
                if bill.remaining_amount <= 0:
                    bill.status = BillStatus.PAID
                    bill.remaining_amount = 0
                else:
                    # For partial payments, mark as pending or overdue based on promise date
                    current_date = datetime.now()
                    
                    # Use promise date if available, otherwise use due date
                    if payment.next_promise_date:
                        check_date = payment.next_promise_date
                    else:
                        check_date = bill.due_date
                    
                    # If the promise/due date has passed, mark as overdue
                    if current_date > check_date:
                        bill.status = BillStatus.OVERDUE
                    else:
                        bill.status = BillStatus.PENDING
                    current_date = datetime.now()
                    if bill.due_date < current_date:
                        bill.status = BillStatus.OVERDUE

        # Update company information comprehensively
        company_result = await db.execute(
            select(Company).where(Company.code == payment.company_code)
        )
        company = company_result.scalar_one_or_none()
        if company:
            from datetime import timedelta

            current_time = datetime.now()

            # Update last collection date
            company.last_collection_date = current_time

            # Update promise date if provided in payment
            if payment.next_promise_date:
                company.promise_date = payment.next_promise_date

            # Calculate new credit date (30 days from promise date or current date)
            if payment.next_promise_date:
                promise_dt = payment.next_promise_date
                if isinstance(promise_dt, str):
                    promise_dt = datetime.fromisoformat(
                        promise_dt.replace("Z", "+00:00")
                    )
                company.credit_date = promise_dt + timedelta(days=30)
            else:
                # Default to 30 days from now if no promise date
                company.credit_date = current_time + timedelta(
                    days=30
                )  # Update payment status
        payment.status = PaymentStatus.COMPLETED
    else:
        # Payment rejected by admin
        payment.status = PaymentStatus.FAILED

    await db.commit()
    await db.refresh(payment)

    return payment_to_response(payment)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment by ID"""
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.company), selectinload(Payment.collected_by))
        .where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    # Executives can only see their own payments
    if (
        current_user.role == UserRole.EXECUTIVE
        and payment.collected_by_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own payments",
        )

    return payment_to_response(payment)


@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete payment (only if not approved)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete payments",
        )

    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    if payment.accountant_approved or payment.admin_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete approved payments",
        )

    await db.delete(payment)
    await db.commit()

    return ResponseModel(success=True, message="Payment deleted successfully")


@router.get("/company/{company_code}/history", response_model=List[PaymentResponse])
async def get_company_payment_history(
    company_code: str,
    status: Optional[str] = Query(None, description="Filter by payment status"),
    limit: int = Query(50, le=100, description="Maximum number of payments to return"),
    offset: int = Query(0, ge=0, description="Number of payments to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment history for a specific company"""

    # Build base query
    query = select(Payment).where(Payment.company_code == company_code)

    # Role-based access control
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Payment.collected_by_id == current_user.id)

    # Filter by status if provided
    if status:
        try:
            status_enum = PaymentStatus(status.upper())
            query = query.where(Payment.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}",
            )

    # Order by creation date (newest first) and apply pagination
    query = query.order_by(Payment.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    payments = result.scalars().all()

    return [payment_to_response(payment) for payment in payments]


@router.get("/company/{company_code}/recent", response_model=PaymentResponse)
async def get_company_recent_payment(
    company_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the most recent approved payment for a company"""

    # Build query for most recent approved payment
    query = (
        select(Payment)
        .where(
            Payment.company_code == company_code,
            Payment.admin_approved == True,
            Payment.status == PaymentStatus.COMPLETED,
        )
        .order_by(Payment.admin_approved_at.desc())
        .limit(1)
    )

    # Role-based access control
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Payment.collected_by_id == current_user.id)

    result = await db.execute(query)
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recent approved payments found for this company",
        )

    return payment_to_response(payment)
