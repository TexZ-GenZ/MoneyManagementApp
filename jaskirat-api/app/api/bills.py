from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models import Bill, Company, User, UserRole, BillStatus
from app.schemas import BillCreate, BillUpdate, BillResponse, ResponseModel
from app.api.auth import get_current_user, require_roles

router = APIRouter()


async def update_bill_statuses(db: AsyncSession):
    """Update bill statuses based on due dates"""
    # Get current date
    current_date = datetime.now()
    
    # Get all pending bills
    result = await db.execute(
        select(Bill).where(Bill.status == BillStatus.PENDING)
    )
    pending_bills = result.scalars().all()
    
    # Update status for overdue bills
    for bill in pending_bills:
        if bill.due_date < current_date:
            bill.status = BillStatus.OVERDUE
    
    # Commit changes if any bills were updated
    if pending_bills:
        await db.commit()


@router.get("/", response_model=List[BillResponse])
async def get_bills(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    company_code: Optional[str] = Query(None),
    status: Optional[BillStatus] = Query(None),
    overdue_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Update bill statuses before returning results
    await update_bill_statuses(db)
    """Get all bills with pagination and filters"""
    query = select(Bill).options(
        selectinload(Bill.company).selectinload(Company.assigned_executive)
    )

    # Filter conditions
    if company_code:
        query = query.where(Bill.company_code == company_code)

    if status:
        query = query.where(Bill.status == status)

    if overdue_only:
        query = query.where(
            Bill.due_date < datetime.now(timezone.utc),
            Bill.status == BillStatus.PENDING,
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Bill.created_at.desc())

    result = await db.execute(query)
    bills = result.scalars().all()

    return [BillResponse.model_validate(bill) for bill in bills]


@router.post("/", response_model=BillResponse)
async def create_bill(
    bill_data: BillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Create new bill"""
    # Check if company exists
    result = await db.execute(
        select(Company).where(Company.code == bill_data.company_code)
    )
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    # Check if bill number is unique
    result = await db.execute(
        select(Bill).where(Bill.bill_number == bill_data.bill_number)
    )
    existing_bill = result.scalar_one_or_none()

    if existing_bill:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill with this number already exists",
        )

    # Create new bill
    db_bill = Bill(**bill_data.model_dump())

    # Set status based on due date
    if bill_data.due_date < datetime.now(timezone.utc):
        db_bill.status = BillStatus.OVERDUE

    db.add(db_bill)
    await db.commit()
    await db.refresh(db_bill)

    # Load company relationship
    result = await db.execute(
        select(Bill).options(selectinload(Bill.company)).where(Bill.id == db_bill.id)
    )
    bill_with_company = result.scalar_one()

    return BillResponse.model_validate(bill_with_company)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get bill by ID"""
    result = await db.execute(
        select(Bill).options(selectinload(Bill.company)).where(Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found"
        )

    return BillResponse.model_validate(bill)


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    bill_data: BillUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Update bill"""
    result = await db.execute(
        select(Bill).options(selectinload(Bill.company)).where(Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found"
        )

    # Update bill fields
    update_data = bill_data.model_dump(exclude_unset=True)

    # Check if bill number is being changed and if it's unique
    if "bill_number" in update_data and update_data["bill_number"] != bill.bill_number:
        result = await db.execute(
            select(Bill).where(Bill.bill_number == update_data["bill_number"])
        )
        existing_bill = result.scalar_one_or_none()
        if existing_bill:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bill with this number already exists",
            )

    # Check if company exists if company_code is being changed
    if "company_code" in update_data:
        result = await db.execute(
            select(Company).where(Company.code == update_data["company_code"])
        )
        company = result.scalar_one_or_none()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
            )

    for field, value in update_data.items():
        setattr(bill, field, value)

    await db.commit()
    await db.refresh(bill)

    return BillResponse.model_validate(bill)


@router.delete("/{bill_id}", response_model=ResponseModel)
async def delete_bill(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Delete bill (Admin only)"""
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found"
        )

    await db.delete(bill)
    await db.commit()

    return ResponseModel(success=True, message="Bill deleted successfully")


@router.get("/overdue/list", response_model=List[BillResponse])
async def get_overdue_bills(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all overdue bills"""
    query = (
        select(Bill)
        .options(selectinload(Bill.company))
        .where(
            Bill.due_date < datetime.now(timezone.utc),
            Bill.status.in_([BillStatus.PENDING, BillStatus.PARTIALLY_PAID]),
        )
        .order_by(Bill.due_date.asc())
    )

    result = await db.execute(query)
    bills = result.scalars().all()

    return [BillResponse.model_validate(bill) for bill in bills]


@router.post("/{bill_id}/mark-overdue", response_model=ResponseModel)
async def mark_bill_overdue(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Mark bill as overdue"""
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found"
        )

    bill.status = BillStatus.OVERDUE
    await db.commit()

    return ResponseModel(success=True, message="Bill marked as overdue")


@router.get("/{bill_id}/payment-history")
async def get_bill_payment_history(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment history for a specific bill"""
    from app.models import Payment
    import json

    # First verify the bill exists
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found"
        )

    # Get all payments that include this bill
    payments_query = select(Payment).where(
        Payment.admin_approved == True, Payment.status == "COMPLETED"
    )

    result = await db.execute(payments_query)
    all_payments = result.scalars().all()

    # Filter payments that include this bill ID
    related_payments = []
    for payment in all_payments:
        try:
            bill_ids = json.loads(payment.bill_ids)
            if bill_id in bill_ids:
                related_payments.append(
                    {
                        "payment_id": payment.id,
                        "amount": float(payment.amount),
                        "payment_date": (
                            payment.payment_date.isoformat()
                            if payment.payment_date
                            else None
                        ),
                        "payment_method": payment.payment_method,
                        "collected_by_id": payment.collected_by_id,
                        "admin_approved_at": (
                            payment.admin_approved_at.isoformat()
                            if payment.admin_approved_at
                            else None
                        ),
                        "company_code": payment.company_code,
                    }
                )
        except (json.JSONDecodeError, TypeError):
            continue

    return {
        "bill_id": bill_id,
        "bill_number": bill.bill_number,
        "bill_amount": float(bill.amount),
        "remaining_amount": float(bill.remaining_amount or bill.amount),
        "paid_amount": float(bill.paid_amount or 0),
        "status": bill.status,
        "payment_history": related_payments,
    }
