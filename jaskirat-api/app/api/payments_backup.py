from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from app.database import get_db
from app.models import Payment, Bill, User, UserRole, PaymentStatus, BillStatus
from app.schemas import PaymentCreate, PaymentUpdate, PaymentResponse, ResponseModel
from app.api.auth import get_current_user, require_roles

router = APIRouter()


@router.get("/pending-approval", response_model=List[PaymentResponse])
async def get_pending_approval_payments(
    approval_level: str = Query("accountant", regex="^(accountant|admin)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payments pending approval"""
    query = select(Payment).options(
        selectinload(Payment.bill).selectinload(Bill.company),
        selectinload(Payment.collected_by)
    )
    
    if approval_level == "accountant":
        # Only accountants and admins can see accountant pending
        if current_user.role not in [UserRole.ACCOUNTANT, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view pending approvals"
            )
        query = query.where(Payment.accountant_approved.is_(None))
    else:  # admin
        # Only admins can see admin pending
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view admin pending approvals"
            )
        query = query.where(
            Payment.accountant_approved == True,
            Payment.admin_approved.is_(None)
        )
    
    query = query.offset(skip).limit(limit).order_by(Payment.payment_date.desc())
    
    result = await db.execute(query)
    payments = result.scalars().all()
    
    return [PaymentResponse.model_validate(payment) for payment in payments]


@router.get("/today/summary")
async def get_today_payments_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get today's payments summary"""
    today = datetime.utcnow().date()
    
    query = select(
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    ).where(
        func.date(Payment.payment_date) == today,
        Payment.status == PaymentStatus.COMPLETED
    )
    
    # Executives can only see their own payments
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Payment.collected_by_id == current_user.id)
    
    result = await db.execute(query)
    summary = result.first()
    
    return {
        "date": today,
        "total_payments": summary.count or 0,
        "total_amount": float(summary.total or 0)
    }


@router.get("/", response_model=List[PaymentResponse])
async def get_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    bill_id: Optional[int] = Query(None),
    collected_by_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments with pagination and filters"""
    query = select(Payment).options(
        selectinload(Payment.bill).selectinload(Bill.company),
        selectinload(Payment.collected_by)
    )
    
    # Filter conditions
    if bill_id:
        query = query.where(Payment.bill_id == bill_id)
    
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
    
    return [PaymentResponse.model_validate(payment) for payment in payments]


@router.post("/", response_model=PaymentResponse)
async def create_payment(
    payment_data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new payment (support multiple bills)"""
    import json
    
    # Verify all bills exist and belong to the same company
    result = await db.execute(
        select(Bill).where(Bill.id.in_(payment_data.bill_ids))
    )
    bills = result.scalars().all()
    
    if len(bills) != len(payment_data.bill_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more bills not found"
        )
    
    # Verify all bills belong to the same company
    company_codes = set(bill.company_code for bill in bills)
    if len(company_codes) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All bills must belong to the same company"
        )
    
    if payment_data.company_code not in company_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company code doesn't match bill company"
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
        status=PaymentStatus.PENDING
    )
    
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    
    return PaymentResponse.model_validate(payment)
    
    # Check if payment amount is valid
    if payment_data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than 0"
        )
    
    # Check if payment amount doesn't exceed remaining amount
    if payment_data.amount > bill.remaining_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount cannot exceed remaining bill amount of {bill.remaining_amount}"
        )
    
    # Create new payment
    db_payment = Payment(
        **payment_data.model_dump(),
        collected_by_id=current_user.id,
        status=PaymentStatus.PENDING  # Start in pending status for approval workflow
    )
    
    db.add(db_payment)
    
    # Note: Bill status will be updated only when payment is fully approved
    # This maintains the approval workflow integrity
    
    await db.commit()
    await db.refresh(db_payment)
    
    # Load relationships
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == db_payment.id)
    )
    payment_with_relations = result.scalar_one()
    
    return PaymentResponse.model_validate(payment_with_relations)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment by ID"""
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Executives can only view their own payments
    if current_user.role == UserRole.EXECUTIVE and payment.collected_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment"
        )
    
    return PaymentResponse.model_validate(payment)


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Update payment (Admin/Accountant only)"""
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Update payment fields
    update_data = payment_data.model_dump(exclude_unset=True)
    
    # If amount is being changed, validate it
    if "amount" in update_data:
        new_amount = update_data["amount"]
        if new_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount must be greater than 0"
            )
        
        # Check if new amount doesn't exceed bill amount
        bill = payment.bill
        other_payments_total = sum(
            p.amount for p in bill.payments 
            if p.id != payment_id and p.status == PaymentStatus.COMPLETED
        )
        
        if new_amount + other_payments_total > bill.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total payments cannot exceed bill amount of {bill.amount}"
            )
    
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    # Recalculate bill status if amount changed
    if "amount" in update_data or "status" in update_data:
        bill = payment.bill
        total_paid = sum(
            p.amount for p in bill.payments 
            if p.status == PaymentStatus.COMPLETED
        )
        
        if total_paid >= bill.amount:
            bill.status = BillStatus.PAID
        elif total_paid > 0:
            bill.status = BillStatus.PARTIALLY_PAID
        else:
            bill.status = BillStatus.PENDING
    
    await db.commit()
    await db.refresh(payment)
    
    return PaymentResponse.model_validate(payment)


@router.delete("/{payment_id}", response_model=ResponseModel)
async def delete_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    """Delete payment (Admin only)"""
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Get bill to update status after deletion
    result = await db.execute(select(Bill).where(Bill.id == payment.bill_id))
    bill = result.scalar_one()
    
    await db.delete(payment)
    
    # Recalculate bill status
    result = await db.execute(
        select(func.sum(Payment.amount)).where(
            Payment.bill_id == bill.id,
            Payment.status == PaymentStatus.COMPLETED
        )
    )
    total_paid = result.scalar() or Decimal('0')
    
    if total_paid >= bill.amount:
        bill.status = BillStatus.PAID
    elif total_paid > 0:
        bill.status = BillStatus.PARTIALLY_PAID
    else:
        bill.status = BillStatus.PENDING
    
    await db.commit()
    
    return ResponseModel(
        success=True,
        message="Payment deleted successfully"
    )


@router.get("/user/{user_id}/summary")
async def get_user_payments_summary(
    user_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's payments summary"""
    # Executives can only view their own summary
    if current_user.role == UserRole.EXECUTIVE and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's summary"
        )
    
    query = select(
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    ).where(
        Payment.collected_by_id == user_id,
        Payment.status == PaymentStatus.COMPLETED
    )
    
    if start_date:
        query = query.where(func.date(Payment.payment_date) >= start_date)
    
    if end_date:
        query = query.where(func.date(Payment.payment_date) <= end_date)
    
    result = await db.execute(query)
    summary = result.first()
    
    return {
        "user_id": user_id,
        "start_date": start_date,
        "end_date": end_date,
        "total_payments": summary.count or 0,
        "total_amount": float(summary.total or 0)
    }


@router.post("/{payment_id}/accountant-approve", response_model=PaymentResponse)
async def accountant_approve_payment(
    payment_id: int,
    approval_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ACCOUNTANT, UserRole.ADMIN]))
):
    """Approve or decline payment (Accountant)"""
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    approved = approval_data.get("approved", True)
    comments = approval_data.get("comments", "")
    
    payment.accountant_approved = approved
    payment.accountant_approved_by_id = current_user.id
    payment.accountant_approved_at = datetime.utcnow()
    payment.accountant_comments = comments
    
    # If declined, update status
    if not approved:
        payment.status = PaymentStatus.FAILED
    
    await db.commit()
    await db.refresh(payment)
    
    return PaymentResponse.model_validate(payment)


@router.post("/{payment_id}/admin-approve", response_model=PaymentResponse)
async def admin_approve_payment(
    payment_id: int,
    approval_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    """Final approve or decline payment (Admin only)"""
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check if accountant has approved first
    if payment.accountant_approved is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment must be reviewed by accountant first"
        )
    
    if not payment.accountant_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve payment that was declined by accountant"
        )
    
    approved = approval_data.get("approved", True)
    comments = approval_data.get("comments", "")
    
    payment.admin_approved = approved
    payment.admin_approved_by_id = current_user.id
    payment.admin_approved_at = datetime.utcnow()
    payment.admin_comments = comments
    
    # Update final status
    if approved:
        payment.status = PaymentStatus.COMPLETED
        # Update bill status as well
        bill = payment.bill
        
        # Query all completed payments for this bill to calculate total
        stmt = select(func.sum(Payment.amount)).where(
            Payment.bill_id == bill.id,
            Payment.status == PaymentStatus.COMPLETED
        )
        result = await db.execute(stmt)
        total_paid = result.scalar() or 0
        
        if total_paid >= bill.amount:
            bill.status = BillStatus.PAID
        elif total_paid > 0:
            bill.status = BillStatus.PARTIALLY_PAID
    else:
        payment.status = PaymentStatus.FAILED
    
    await db.commit()
    
    # Refetch payment with all relationships loaded
    result = await db.execute(
        select(Payment).options(
            selectinload(Payment.bill).selectinload(Bill.company),
            selectinload(Payment.collected_by)
        ).where(Payment.id == payment_id)
    )
    payment = result.scalar_one()
    
    return PaymentResponse.model_validate(payment)
