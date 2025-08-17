from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models import Company, User, UserRole
from app.schemas import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyStats,
    ResponseModel,
)
from app.api.auth import get_current_user, require_roles

router = APIRouter()


@router.get("/", response_model=List[CompanyResponse])
async def get_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    executive_id: Optional[int] = Query(None),  # Filter by executive
    area: Optional[str] = Query(None),  # Filter by area
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all companies with pagination and search"""
    query = select(Company).options(
        selectinload(Company.assigned_executive), selectinload(Company.bills)
    )

    # Role-based filtering
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Company.assigned_executive_id == current_user.id)

    # Filter conditions
    if active_only:
        query = query.where(Company.is_active == True)

    if executive_id:
        query = query.where(Company.assigned_executive_id == executive_id)

    if area:
        query = query.where(Company.area.ilike(f"%{area}%"))

    if search:
        query = query.where(
            Company.account_n.ilike(f"%{search}%")
            | Company.code.ilike(f"%{search}%")
            | Company.area.ilike(f"%{search}%")
            | Company.location.ilike(f"%{search}%")
        )

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    companies = result.scalars().all()

    return [CompanyResponse.model_validate(company) for company in companies]


@router.post("/", response_model=CompanyResponse)
async def create_company(
    company_data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Create new company"""
    # Check if company code already exists
    result = await db.execute(select(Company).where(Company.code == company_data.code))
    existing_company = result.scalar_one_or_none()

    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company with this code already exists",
        )

    # Create new company
    db_company = Company(**company_data.model_dump())
    db.add(db_company)
    await db.commit()
    await db.refresh(db_company)

    return CompanyResponse.model_validate(db_company)


@router.get("/{company_code}", response_model=CompanyResponse)
async def get_company(
    company_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get company by code"""
    query = (
        select(Company)
        .options(selectinload(Company.assigned_executive), selectinload(Company.bills))
        .where(Company.code == company_code)
    )

    # Role-based access control
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Company.assigned_executive_id == current_user.id)

    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or you don't have access to it",
        )

    return CompanyResponse.model_validate(company)


@router.put("/{company_code}", response_model=CompanyResponse)
async def update_company(
    company_code: str,
    company_data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Update company"""
    result = await db.execute(select(Company).where(Company.code == company_code))
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    # Update company fields
    update_data = company_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)

    return CompanyResponse.model_validate(company)


@router.delete("/{company_code}", response_model=ResponseModel)
async def delete_company(
    company_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Delete company (Admin only)"""
    result = await db.execute(select(Company).where(Company.code == company_code))
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    # Soft delete by setting is_active to False
    company.is_active = False
    await db.commit()

    return ResponseModel(success=True, message="Company deleted successfully")


@router.get("/{company_code}/stats", response_model=CompanyStats)
async def get_company_stats(
    company_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get company statistics"""
    query = (
        select(Company)
        .options(selectinload(Company.bills))
        .where(Company.code == company_code)
    )

    # Role-based access control
    if current_user.role == UserRole.EXECUTIVE:
        query = query.where(Company.assigned_executive_id == current_user.id)

    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or you don't have access to it",
        )

    # Calculate stats using model properties
    return CompanyStats(
        total_pending=company.total_pending,
        total_overdue=company.total_overdue,
        bills_count=company.bills_count,
        last_payment_date=company.last_collection_date,
    )


@router.get("/executive/{executive_id}", response_model=List[CompanyResponse])
async def get_executive_companies(
    executive_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Get all companies assigned to a specific executive"""
    query = (
        select(Company)
        .options(selectinload(Company.assigned_executive), selectinload(Company.bills))
        .where(Company.assigned_executive_id == executive_id, Company.is_active == True)
    )

    result = await db.execute(query)
    companies = result.scalars().all()

    return [CompanyResponse.model_validate(company) for company in companies]


@router.post("/assign-executive", response_model=ResponseModel)
async def assign_executive_to_companies(
    company_codes: List[str],
    executive_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Assign an executive to multiple companies"""
    # Verify executive exists and has correct role
    result = await db.execute(
        select(User).where(User.id == executive_id, User.role == UserRole.EXECUTIVE)
    )
    executive = result.scalar_one_or_none()

    if not executive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Executive not found"
        )

    # Update companies
    updated_count = 0
    for company_code in company_codes:
        result = await db.execute(select(Company).where(Company.code == company_code))
        company = result.scalar_one_or_none()

        if company:
            company.assigned_executive_id = executive_id
            updated_count += 1

    await db.commit()

    return ResponseModel(
        success=True,
        message=f"Successfully assigned {updated_count} companies to executive {executive.name}",
        data={"updated_count": updated_count, "executive_name": executive.name},
    )


@router.put("/{company_code}/promise-date", response_model=ResponseModel)
async def update_company_promise_date(
    company_code: str,
    promise_date_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Update company promise date (Admin only)"""
    from datetime import datetime, timedelta

    result = await db.execute(select(Company).where(Company.code == company_code))
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    # Parse the new promise date
    new_promise_date = promise_date_data.get("promise_date")
    if not new_promise_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Promise date is required"
        )

    try:
        if isinstance(new_promise_date, str):
            promise_dt = datetime.fromisoformat(new_promise_date.replace("Z", "+00:00"))
        else:
            promise_dt = new_promise_date

        # Update company promise date
        company.promise_date = promise_dt

        # Update credit date (30 days from promise date)
        company.credit_date = promise_dt + timedelta(days=30)

        # Add update tracking
        company.updated_at = datetime.now()

        await db.commit()
        await db.refresh(company)

        return ResponseModel(
            success=True,
            message=f"Promise date updated successfully for company {company.account_n}",
            data={
                "company_code": company_code,
                "new_promise_date": promise_dt.isoformat(),
                "new_credit_date": (
                    company.credit_date.isoformat() if company.credit_date else None
                ),
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {str(e)}",
        )
