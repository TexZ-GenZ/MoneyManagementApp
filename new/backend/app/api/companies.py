from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from sqlmodel import Session, select
from app.db.session import get_session
from app.models import Company, Bill
from app.deps import get_current_user, require_role
from app.models import Role

router = APIRouter()

@router.get("/companies", response_model=List[Company])
def list_companies(skip: int = 0, limit: int = 100, session: Session = Depends(get_session), user = Depends(get_current_user)):
    stmt = select(Company).offset(skip).limit(limit)
    # admin sees all; executives see assigned ones; accountants see all
    if user.role == Role.executive:
        stmt = select(Company).where(Company.executive_id == user.id).offset(skip).limit(limit)
    return session.exec(stmt).all()

@router.get("/companies/{code}", response_model=Company)
def get_company(code: str, session: Session = Depends(get_session), user = Depends(get_current_user)):
    stmt = select(Company).where(Company.code == code)
    company = session.exec(stmt).first()
    if not company:
        raise HTTPException(status_code=404, detail="Not found")
    # TODO: add access control if needed
    return company

@router.put("/companies/{code}/promise_date")
def update_promise_date(code: str, next_date: str, session: Session = Depends(get_session), user = Depends(get_current_user)):
    # only executive assigned (or admin) can change the promise date
    stmt = select(Company).where(Company.code == code)
    company = session.exec(stmt).first()
    if user.role == Role.executive and company.executive_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    from datetime import datetime
    company.promise_date = datetime.fromisoformat(next_date).date()
    session.add(company)
    session.commit()
    session.refresh(company)
    return {"ok": True}
