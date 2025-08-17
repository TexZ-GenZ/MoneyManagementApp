from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db.session import get_session
from app.models import Payment, Bill, User, Role
from app.deps import get_current_user
from datetime import datetime

router = APIRouter()

@router.post("/payments")
def submit_payment(payload: dict, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # payload expected: { "bill_ids": [1,2], "amount_collected": 1000.0, "location": {"lat":..., "lng":...}, "next_promise_date": "2025-08-20", "payment_method": "cash", "comments": "..." }
    if user.role != Role.executive:
        raise HTTPException(status_code=403, detail="Only executives can submit payments")
    bill_ids = payload.get("bill_ids", [])
    bills = session.exec(select(Bill).where(Bill.id.in_(bill_ids))).all()
    if not bills:
        raise HTTPException(status_code=400, detail="No bills selected")
    p = Payment(
        submitted_by=user.id,
        amount_collected=payload.get("amount_collected", 0),
        location_lat=payload.get("location", {}).get("lat"),
        location_lng=payload.get("location", {}).get("lng"),
        next_promise_date=payload.get("next_promise_date"),
        payment_method=payload.get("payment_method"),
        comments=payload.get("comments"),
        status="pending_for_accountant"
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    # link bills via a join table (simpler: mark bills as collected_pending_approval and set collected_by/collected_at)
    for b in bills:
        b.status = "collected_pending_approval"
        b.collected_by = user.id
        b.collected_at = datetime.utcnow()
        session.add(b)
    session.commit()
    return {"payment_id": p.id}
    
@router.post("/payments/{payment_id}/accountant_approve")
def accountant_approve(payment_id: int, approve: bool, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    if user.role != Role.accountant:
        raise HTTPException(status_code=403, detail="Only accountant can perform this")
    p = session.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    p.accountant_approved = bool(approve)
    p.status = "pending_for_admin" if approve else "declined"
    session.add(p)
    session.commit()
    # if declined -> revert bills back to pending
    if not approve:
        bills = session.exec(select(Bill).where(Bill.collected_by == p.submitted_by, Bill.collected_at != None)).all()
        for b in bills:
            if b.status == "collected_pending_approval":
                b.status = "pending"
                b.collected_by = None
                b.collected_at = None
                session.add(b)
        session.commit()
    return {"ok": True}
