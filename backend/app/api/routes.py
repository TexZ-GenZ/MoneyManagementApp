from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Header
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from app.db.session import get_db
from app.schemas.auth import LoginRequest, Token
from app.schemas.company import (
    CompanyBase,
    CompanyList,
    CompanyUpdateCredit,
    CompanyUpdatePromise,
    CompanyDashboard,
    CompanyAssignmentList,
    AssignmentBatchIn,
    UnassignBatchIn,
)
from app.schemas.bill import BillList, BillOut
from app.schemas.payment import (
    PaymentSubmit,
    PaymentOut,
    PaymentList,
    BillPaymentHistory,
    BillPaymentHistoryItem,
    PaymentDetailOut,
    PaymentAllocationDetail,
)
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.schemas.user import UserCreate, UserOut, UserList, PushTokenIn, SendPushIn
from app.services.auth import (
    create_access_token,
    get_user_by_username,
    get_user_by_mobile,
    verify_password,
    hash_password,
    normalize_indian_mobile,
)
from app.services.security import get_current_user, require_roles
from app.services.company import (
    recalc_company_totals,
    ensure_settings_row,
    recompute_company_amounts,
    resolve_promise_crossed_notifications,
)
from app.services.payments import create_payment_with_allocations, admin_approve_payment
from app.services.notifications import run_notification_scan
from app.core.scheduler import reschedule_jobs
from app.services.imports import (
    import_master as do_import_master,
    import_transactions as do_import_transactions,
)
from app.models.models import (
    User,
    Company,
    Bill,
    Payment,
    PaymentStatus,
    Setting,
    Role,
    PaymentAllocation,
    ExecAssignment,
    Notification,
    NotificationType,
    NotificationStatus,
    PushToken,
)

router = APIRouter()

# Simple upload size guard (bytes). Adjust if realistic data requires more.
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 5 MB


@router.post("/auth/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    # accept username or mobile in 'username' field for backward compatibility
    user = get_user_by_username(db, body.username) or get_user_by_mobile(
        db, body.username
    )
    # Uniform error to avoid user enumeration; reject inactive accounts
    if (
        not user
        or not user.is_active
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.get("/auth/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        area=user.area,
        mobile=user.mobile,
        is_active=user.is_active,
    )


@router.get("/health")
def health():
    return {"status": "ok"}


# Settings
@router.get(
    "/settings",
    response_model=SettingsOut,
    dependencies=[Depends(require_roles("admin"))],
)
def get_settings(db: Session = Depends(get_db)):
    s = ensure_settings_row(db)
    return SettingsOut(
        credit_extension_days=s.credit_extension_days,
        notif_every_hours=s.notif_every_hours,
        payment_notif_daily_hour=s.payment_notif_daily_hour,
    )


@router.patch(
    "/settings",
    response_model=SettingsOut,
    dependencies=[Depends(require_roles("admin"))],
)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    s = ensure_settings_row(db)
    if body.credit_extension_days is not None:
        s.credit_extension_days = body.credit_extension_days
    if body.notif_every_hours is not None:
        s.notif_every_hours = body.notif_every_hours
    if body.payment_notif_daily_hour is not None:
        s.payment_notif_daily_hour = body.payment_notif_daily_hour
    db.add(s)
    db.commit()
    db.refresh(s)
    # Reschedule APScheduler jobs with new settings
    try:
        reschedule_jobs()
    except Exception:
        # Swallow scheduling errors to not break API response
        pass
    return SettingsOut(
        credit_extension_days=s.credit_extension_days,
        notif_every_hours=s.notif_every_hours,
        payment_notif_daily_hour=s.payment_notif_daily_hour,
    )


# Companies
@router.get("/companies", response_model=CompanyList)
def list_companies(
    db: Session = Depends(get_db),
    area: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    query = db.query(Company).filter(Company.is_archived == False)
    if area:
        query = query.filter(Company.area == area)
    if q:
        like = f"%{q}%"
        # Search by name OR code (case-insensitive)
        query = query.filter(or_(Company.name.ilike(like), Company.code.ilike(like)))
    total = query.count()
    items = query.order_by(Company.code).offset(skip).limit(limit).all()
    return CompanyList(items=items, total=total)


@router.get("/companies/{code}", response_model=CompanyBase)
def get_company(code: str, db: Session = Depends(get_db)):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c


@router.get("/companies/{code}/dashboard", response_model=CompanyDashboard)
def company_dashboard(code: str, db: Session = Depends(get_db)):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    pending = (
        db.query(Bill)
        .filter(
            Bill.company_code == code,
            Bill.status == "pending",
            Bill.is_archived == False,
        )
        .order_by(Bill.due_date.asc())
        .limit(100)
        .all()
    )
    paid = (
        db.query(Bill)
        .filter(
            Bill.company_code == code,
            Bill.status == "paid",
            Bill.is_archived == False,
        )
        .order_by(Bill.bill_date.desc())
        .limit(100)
        .all()
    )
    return CompanyDashboard(
        code=c.code,
        name=c.name or c.code,
        area=c.area,
        credit_date=c.credit_date,
        promise_date=c.promise_date,
        outbal=c.outbal,
        amount=c.amount,
        pending_bills=pending,
        paid_bills=paid,
    )


@router.patch(
    "/companies/{code}/promise-date",
    response_model=CompanyBase,
    dependencies=[Depends(require_roles("executive", "admin"))],
)
def set_promise_date(
    code: str, body: CompanyUpdatePromise, db: Session = Depends(get_db)
):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    # Forward-only rule
    if c.promise_date and body.promise_date < c.promise_date:
        raise HTTPException(status_code=400, detail="Cannot move promise_date backward")
    # Must not be earlier than credit_date
    if c.credit_date and body.promise_date < c.credit_date:
        raise HTTPException(
            status_code=400, detail="promise_date cannot be earlier than credit_date"
        )
    c.promise_date = body.promise_date
    db.commit()
    db.refresh(c)
    recompute_company_amounts(db, c.code)
    resolve_promise_crossed_notifications(db, c)
    return c


@router.patch(
    "/companies/{code}/credit-date",
    response_model=CompanyBase,
    dependencies=[Depends(require_roles("admin"))],
)
def set_credit_date(
    code: str, body: CompanyUpdateCredit, db: Session = Depends(get_db)
):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    # promise_date must remain >= credit_date if promise_date exists
    if c.promise_date and body.credit_date and c.promise_date < body.credit_date:
        raise HTTPException(
            status_code=400,
            detail="Existing promise_date earlier than new credit_date; update promise_date first",
        )
    c.credit_date = body.credit_date
    db.commit()
    db.refresh(c)
    recompute_company_amounts(db, c.code)
    resolve_promise_crossed_notifications(db, c)
    return c


# Bills
@router.get("/companies/{code}/bills", response_model=BillList)
def list_company_bills(
    code: str,
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, pattern="^(pending|paid)$"),
    sort: Optional[str] = Query(None, pattern="^(oldest|amount_desc|recent)$"),
    skip: int = 0,
    limit: int = 100,
):
    q = db.query(Bill).filter(Bill.company_code == code, Bill.is_archived == False)
    if status:
        q = q.filter(Bill.status == status)
    if sort == "oldest":
        q = q.order_by(Bill.bill_date.asc())
    elif sort == "amount_desc":
        q = q.order_by(Bill.amount.desc())
    elif sort == "recent":
        q = q.order_by(Bill.bill_date.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return BillList(items=items, total=total)


@router.get("/bills/{bill_id}", response_model=BillOut)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    b = db.get(Bill, bill_id)
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    return b


@router.get("/bills/{bill_id}/payments", response_model=BillPaymentHistory)
def bill_payment_history(bill_id: int, db: Session = Depends(get_db)):
    allocs = (
        db.query(PaymentAllocation, Payment)
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .filter(PaymentAllocation.bill_id == bill_id)
        .all()
    )
    items = []
    for alloc, payment in allocs:
        items.append(
            BillPaymentHistoryItem(
                payment_id=payment.id,
                amount=float(alloc.amount),
                payment_status=(
                    payment.status.value
                    if hasattr(payment.status, "value")
                    else str(payment.status)
                ),
                collected_at=payment.collected_at,
                method=payment.method,
                accountant_comment=payment.accountant_comment,
                admin_comment=payment.admin_comment,
                exec_location_verified=payment.exec_location_verified,
                exec_lat=getattr(payment, "exec_lat", None),
                exec_lng=getattr(payment, "exec_lng", None),
            )
        )
    return BillPaymentHistory(items=items, total=len(items))


# Payments
@router.post(
    "/payments",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("executive", "admin"))],
)
def submit_payment(
    body: PaymentSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    # Treat blank header values as absent so they don't collide on unique index as "".
    if idempotency_key is not None and not idempotency_key.strip():
        idempotency_key = None
    # Optional policy: executive can submit only for assigned companies
    if user.role == Role.executive:
        assigned = (
            db.query(ExecAssignment)
            .filter(
                ExecAssignment.executive_id == user.id,
                ExecAssignment.company_code == body.company_code,
            )
            .first()
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Not assigned to this company")
    # Idempotency: if key provided and exists, validate request matches and return existing
    if idempotency_key:
        existing = (
            db.query(Payment).filter(Payment.idempotency_key == idempotency_key).first()
        )
        if existing:
            # minimal shape comparison to ensure same request
            same_basic = (
                existing.company_code == body.company_code
                and existing.executive_id == user.id
                and Decimal(str(existing.amount_collected))
                == Decimal(str(body.amount_collected))
                and existing.method == body.method
                and existing.collected_at == body.collected_at
            )
            if same_basic:
                # Compare allocations set
                existing_allocs = (
                    db.query(PaymentAllocation)
                    .filter(PaymentAllocation.payment_id == existing.id)
                    .all()
                )
                existing_set = sorted(
                    [(a.bill_id, Decimal(str(a.amount))) for a in existing_allocs]
                )
                req_set = sorted(
                    [(a.bill_id, Decimal(str(a.amount))) for a in body.bill_allocations]
                )
                if existing_set == req_set:
                    return existing
            raise HTTPException(
                status_code=409,
                detail="Idempotency-Key already used for a different request",
            )
    try:
        p = create_payment_with_allocations(
            db,
            company_code=body.company_code,
            executive_id=user.id,
            collected_at=body.collected_at,
            amount_collected=body.amount_collected,
            method=body.method,
            exec_lat=body.exec_lat,
            exec_lng=body.exec_lng,
            comments=body.comments,
            next_promise_date=body.next_promise_date,
            allocations=[a.model_dump() for a in body.bill_allocations],
            idempotency_key=idempotency_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # idempotency_key already persisted by service if provided
    # capture optional location verification
    if body.exec_location_verified is not None:
        p.exec_location_verified = body.exec_location_verified
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


@router.get(
    "/accountant/payments/pending",
    response_model=PaymentList,
    dependencies=[Depends(require_roles("accountant", "admin"))],
)
def accountant_pending(db: Session = Depends(get_db), skip: int = 0, limit: int = 50):
    q = db.query(Payment).filter(Payment.status == PaymentStatus.submitted)
    total = q.count()
    items = q.order_by(Payment.collected_at.desc()).offset(skip).limit(limit).all()
    # Ensure comments field is included in PaymentOut
    return PaymentList(items=items, total=total)


@router.get("/companies/{code}/payments", response_model=PaymentList)
def list_company_payments(
    code: str,
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(Payment).filter(Payment.company_code == code)
    if status:
        q = q.filter(Payment.status == status)
    if date_from:
        q = q.filter(
            Payment.collected_at >= datetime.combine(date_from, datetime.min.time())
        )
    if date_to:
        q = q.filter(
            Payment.collected_at <= datetime.combine(date_to, datetime.max.time())
        )
    total = q.count()
    items = q.order_by(Payment.collected_at.desc()).offset(skip).limit(limit).all()
    # Ensure comments field is included in PaymentOut
    return PaymentList(items=items, total=total)


@router.get("/payments/{payment_id}", response_model=PaymentDetailOut)
def get_payment_detail(payment_id: int, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    # build allocations with joined bill info
    alloc_rows = (
        db.query(PaymentAllocation, Bill)
        .join(Bill, Bill.id == PaymentAllocation.bill_id)
        .filter(PaymentAllocation.payment_id == payment_id)
        .all()
    )
    allocations = [
        PaymentAllocationDetail(
            bill_id=b.id,
            bill_number=b.bill_number,
            bill_date=b.bill_date,
            due_date=b.due_date,
            amount_allocated=Decimal(str(a.amount)),
            bill_status=b.status,
        )
        for a, b in alloc_rows
    ]
    return PaymentDetailOut(
        id=p.id,
        company_code=p.company_code,
        executive_id=p.executive_id,
        collected_at=p.collected_at,
        amount_collected=p.amount_collected,
        method=p.method,
        status=p.status,
        next_promise_date=p.next_promise_date,
        exec_location_verified=p.exec_location_verified,
        exec_lat=getattr(p, "exec_lat", None),
        exec_lng=getattr(p, "exec_lng", None),
        accountant_review_at=getattr(p, "accountant_review_at", None),
        admin_review_at=getattr(p, "admin_review_at", None),
        accountant_comment=getattr(p, "accountant_comment", None),
        admin_comment=getattr(p, "admin_comment", None),
        comments=getattr(p, "comments", None),
        allocations=allocations,
    )


@router.post(
    "/accountant/payments/{payment_id}/approve",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("accountant", "admin"))],
)
def accountant_approve(
    payment_id: int, comment: str | None = None, db: Session = Depends(get_db)
):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.status != PaymentStatus.submitted:
        raise HTTPException(
            status_code=400,
            detail="Only submitted payments can be approved by accountant",
        )
    p.status = PaymentStatus.accountant_approved
    p.accountant_review_at = datetime.utcnow()
    if comment:
        p.accountant_comment = comment
    db.commit()
    db.refresh(p)
    return p


# Admin: create user
@router.post(
    "/admin/users",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_create_user(body: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_username(db, body.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    try:
        role = Role(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")
    mobile = None
    if getattr(body, "mobile", None):
        mobile = normalize_indian_mobile(body.mobile)
        if db.query(User).filter(User.mobile == mobile).first():
            raise HTTPException(status_code=400, detail="Mobile already exists")
    user = User(
        username=body.username,
        mobile=mobile,
        password_hash=hash_password(body.password),
        role=role,
        area=body.area,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# Admin: update user mobile
@router.patch(
    "/admin/users/{user_id}/mobile",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_mobile(user_id: int, mobile: str, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    m = normalize_indian_mobile(mobile)
    if db.query(User).filter(User.mobile == m, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Mobile already in use")
    u.mobile = m
    db.commit()
    db.refresh(u)
    return u


# Admin: update user password
@router.patch(
    "/admin/users/{user_id}/password",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_password(
    user_id: int, new_password: str, db: Session = Depends(get_db)
):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(u)
    return u


# Admin: list executives
@router.get(
    "/admin/executives",
    response_model=List[UserOut],
    # Allow accountants to view executive list for payment review context (was admin-only)
    dependencies=[Depends(require_roles("admin", "accountant"))],
)
def list_executives(db: Session = Depends(get_db)):
    execs = db.query(User).filter(User.role == Role.executive).all()
    # returning list; schema is single, but Pydantic can coerce list of UserOut if we wrap
    return [UserOut.model_validate(e) for e in execs]


# Admin: assign/unassign companies to an executive
@router.post(
    "/admin/executives/{executive_id}/assign/{company_code}",
    dependencies=[Depends(require_roles("admin"))],
)
def assign_company(executive_id: int, company_code: str, db: Session = Depends(get_db)):
    if not db.get(User, executive_id):
        raise HTTPException(status_code=404, detail="Executive not found")
    if not db.get(Company, company_code):
        raise HTTPException(status_code=404, detail="Company not found")
    exists = (
        db.query(ExecAssignment)
        .filter(
            ExecAssignment.executive_id == executive_id,
            ExecAssignment.company_code == company_code,
        )
        .first()
    )
    if exists:
        return {"ok": True}
    db.add(ExecAssignment(executive_id=executive_id, company_code=company_code))
    db.commit()
    return {"ok": True}


@router.delete(
    "/admin/executives/{executive_id}/assign/{company_code}",
    dependencies=[Depends(require_roles("admin"))],
)
def unassign_company(
    executive_id: int, company_code: str, db: Session = Depends(get_db)
):
    row = (
        db.query(ExecAssignment)
        .filter(
            ExecAssignment.executive_id == executive_id,
            ExecAssignment.company_code == company_code,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


# Executive: get my companies or by id
@router.get(
    "/executives/{executive_id}/companies",
    # Allow accountants read access to executive company assignments
    dependencies=[Depends(require_roles("admin", "executive", "accountant"))],
)
def get_executive_companies(
    executive_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Enforce that executives can only view their own companies
    if user.role.value == "executive" and user.id != executive_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    codes = [
        r.company_code
        for r in db.query(ExecAssignment)
        .filter(ExecAssignment.executive_id == executive_id)
        .all()
    ]
    items = (
        db.query(Company)
        .filter(Company.code.in_(codes), Company.is_archived == False)
        .all()
    )
    return {"items": items, "total": len(items)}


@router.get("/me/companies", dependencies=[Depends(require_roles("executive"))])
def my_companies(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    codes = [
        r.company_code
        for r in db.query(ExecAssignment)
        .filter(ExecAssignment.executive_id == user.id)
        .all()
    ]
    items = (
        db.query(Company)
        .filter(Company.code.in_(codes), Company.is_archived == False)
        .all()
    )
    return {"items": items, "total": len(items)}


# Admin: list users by role
@router.get(
    "/admin/users",
    response_model=UserList,
    dependencies=[Depends(require_roles("admin"))],
)
def list_users(role: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(User)
    if role:
        try:
            r = Role(role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")
        q = q.filter(User.role == r)
    items = [
        UserOut(
            id=u.id,
            username=u.username,
            role=u.role,
            area=u.area,
            mobile=u.mobile,
            is_active=u.is_active,
        )
        for u in q.all()
    ]
    return UserList(items=items, total=len(items))


# Admin: change username
@router.patch(
    "/admin/users/{user_id}/username",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_username(user_id: int, username: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.username = username
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        username=u.username,
        role=u.role,
        area=u.area,
        mobile=u.mobile,
        is_active=u.is_active,
    )


# Admin: deactivate user
@router.patch(
    "/admin/users/{user_id}/deactivate",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_deactivate_user(
    user_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Safety: never allow an admin to deactivate themselves to avoid lockout.
    if current.id == user_id and current.role == Role.admin:
        raise HTTPException(
            status_code=400, detail="Cannot deactivate your own admin account"
        )
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_active = False
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        username=u.username,
        role=u.role,
        area=u.area,
        mobile=u.mobile,
        is_active=u.is_active,
    )


@router.patch(
    "/admin/users/{user_id}/activate",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_activate_user(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_active = True
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        username=u.username,
        role=u.role,
        area=u.area,
        mobile=u.mobile,
        is_active=u.is_active,
    )


# Admin: hard delete user (only allowed for executives without references)
@router.delete(
    "/admin/users/{user_id}/hard-delete",
    dependencies=[Depends(require_roles("admin"))],
)
def admin_hard_delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    # Do not allow deleting admin or accountant accounts
    if u.role in [Role.admin, Role.accountant]:
        raise HTTPException(
            status_code=400, detail="Cannot delete admin or accountant users"
        )
    # Ensure no references exist (assignments or payments)
    assigned = (
        db.query(ExecAssignment).filter(ExecAssignment.executive_id == user_id).first()
    )
    has_payments = db.query(Payment).filter(Payment.executive_id == user_id).first()
    if assigned or has_payments:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete user with assignments or payments; unassign and migrate first",
        )
    db.delete(u)
    db.commit()
    return {"ok": True, "deleted": user_id}


## (Removed legacy /notifications/pending endpoints; use /notifications with filters.)


## Removed /imports/* endpoints; use /uploads/* (accountant) for file ingestion directly.


# File upload variants (multipart) that save files then call import
DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@router.post("/uploads/master", dependencies=[Depends(require_roles("accountant"))])
def upload_master(file: UploadFile = File(...), db: Session = Depends(get_db)):
    dest = DATA_DIR / "master.dbf"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    content = file.file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large; max {MAX_UPLOAD_SIZE} bytes"
        )
    dest.write_bytes(content)
    metrics = do_import_master(db)
    return {"ok": True, "saved": str(dest), **metrics}


@router.post(
    "/uploads/transactions", dependencies=[Depends(require_roles("accountant"))]
)
def upload_transactions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    dest = DATA_DIR / "transactions.dbf"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    content = file.file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large; max {MAX_UPLOAD_SIZE} bytes"
        )
    dest.write_bytes(content)
    metrics = do_import_transactions(db)
    return {"ok": True, "saved": str(dest), **metrics}


@router.get("/notifications")
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    company_code: Optional[str] = Query(None),
    limit: int = 200,
):
    q = db.query(Notification)
    if user.role == Role.executive:
        # Filter to companies assigned to executive
        codes = [
            r.company_code
            for r in db.query(ExecAssignment).filter(
                ExecAssignment.executive_id == user.id
            )
        ]
        if not codes:
            return {"items": [], "total": 0}
        q = q.filter(Notification.company_code.in_(codes))
    if status:
        try:
            st = NotificationStatus(status)
            q = q.filter(Notification.status == st)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    if type:
        try:
            tp = NotificationType(type)
            q = q.filter(Notification.type == tp)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid type")
    if company_code:
        q = q.filter(Notification.company_code == company_code)
    items = q.order_by(Notification.created_at.desc()).limit(min(limit, 500)).all()
    return {"items": items, "total": len(items)}


@router.post("/notifications/{notification_id}/ack")
def acknowledge_notification(notification_id: int, db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.status != NotificationStatus.pending:
        raise HTTPException(status_code=400, detail="Notification not pending")
    n.status = NotificationStatus.sent
    db.commit()
    db.refresh(n)
    return n


@router.post(
    "/admin/notifications/scan", dependencies=[Depends(require_roles("admin"))]
)
def manual_notification_scan(db: Session = Depends(get_db)):
    run_notification_scan(db)
    return {"ok": True}


@router.get("/notifications/counts")
def notification_counts(
    db: Session = Depends(get_db), company_code: Optional[str] = Query(None)
):
    from sqlalchemy import func

    q = db.query(
        Notification.type, Notification.status, func.count(Notification.id)
    ).group_by(Notification.type, Notification.status)
    if company_code:
        q = q.filter(Notification.company_code == company_code)
    rows = q.all()
    result = {}
    for t, s, cnt in rows:
        key = f"{t.value if hasattr(t,'value') else t}:{s.value if hasattr(s,'value') else s}"
        result[key] = cnt
    return result


@router.post(
    "/accountant/payments/{payment_id}/decline",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("accountant", "admin"))],
)
def accountant_decline(
    payment_id: int, comment: str | None = None, db: Session = Depends(get_db)
):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.status != PaymentStatus.submitted:
        raise HTTPException(
            status_code=400,
            detail="Only submitted payments can be declined by accountant",
        )
    p.status = PaymentStatus.declined_by_accountant
    p.accountant_review_at = datetime.utcnow()
    if comment:
        p.accountant_comment = comment
    # Mark related notifications as stopped
    db.query(Notification).filter(
        Notification.company_code == p.company_code,
        Notification.type == NotificationType.payment_review,
        Notification.status == NotificationStatus.pending,
    ).update(
        {Notification.status: NotificationStatus.stopped}, synchronize_session=False
    )
    db.commit()
    db.refresh(p)
    return p


# Push token management - client sends FCM token on login
@router.post("/auth/push-token")
def upsert_push_token(
    body: PushTokenIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Client should POST {"token": "<fcm_token>", "platform": "android|ios"} while authenticated.
    This will insert or update the push token for the current user.
    """
    token = body.token
    platform = body.platform
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")

    existing = db.query(PushToken).filter(PushToken.user_id == user.id).first()
    if existing:
        existing.token = token
        existing.platform = platform
        existing.updated_at = datetime.utcnow()
        db.add(existing)
    else:
        db.add(PushToken(user_id=user.id, token=token, platform=platform))
    db.commit()
    return {"ok": True}


# Admin endpoint: send push to a user (simple wrapper around FCM HTTP v1 or legacy API)
@router.post("/send-push")
def send_push(payload: SendPushIn, db: Session = Depends(get_db)):
    """Send a push notification to a user by user_id with {"user_id": int, "message": str}.
    Note: This implementation uses FCM HTTP v1 or legacy API depending on FCM_SERVER_KEY env.
    For production use, prefer service-account based HTTP v1 flow.
    """
    import os
    import httpx

    user_id = payload.user_id
    message = payload.message
    token_override = payload.token
    title = payload.title or "App Notification"
    if not user_id or not message:
        raise HTTPException(status_code=400, detail="user_id and message required")

    # Resolve token: prefer explicit token, else look up user
    target_token = token_override
    if not target_token and user_id:
        pt = db.query(PushToken).filter(PushToken.user_id == user_id).first()
        if pt:
            target_token = pt.token

    if not target_token:
        # No token to send to; return success with note so callers aren't blocked
        return {"ok": False, "reason": "no_token"}

    # If token is an Expo push token we can send directly to Expo service without FCM creds.
    is_expo = isinstance(target_token, str) and target_token.startswith(
        "ExponentPushToken"
    )
    project_id = None
    access_token = None
    if not is_expo:
        # Use FCM HTTP v1 only for non-Expo raw FCM tokens. Acquire access token if configured.
        access_token = os.environ.get("FCM_ACCESS_TOKEN")
        svc_json = os.environ.get("SERVICE_ACCOUNT_JSON")
        svc_file = os.environ.get("SERVICE_ACCOUNT_FILE")
        if not access_token and (svc_json or svc_file):
            try:
                from google.oauth2 import service_account
                from google.auth.transport.requests import Request as GoogleRequest

                if svc_json:
                    info = __import__("json").loads(svc_json)
                    creds = service_account.Credentials.from_service_account_info(
                        info,
                        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
                    )
                    project_id = info.get("project_id")
                else:
                    creds = service_account.Credentials.from_service_account_file(
                        svc_file,
                        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
                    )
                    try:
                        import json

                        with open(svc_file, "r", encoding="utf-8") as f:
                            info = json.load(f)
                            project_id = info.get("project_id")
                    except Exception:
                        project_id = None
                creds.refresh(GoogleRequest())
                access_token = creds.token
                if not project_id:
                    project_id = getattr(creds, "project_id", None)
            except Exception as e:
                return {"ok": False, "reason": "service_account_error", "error": str(e)}
        if not access_token:
            return {"ok": False, "reason": "no_access_token"}
        if not project_id:
            project_id = os.environ.get("FCM_PROJECT_ID")
        if not project_id:
            return {"ok": False, "reason": "no_project_id"}

    # Expo push: send to Expo push service (no FCM keys/service account required for expo tokens)
    # Expo expects messages in the shape { to, title, body, data }
    expo_url = "https://exp.host/--/api/v2/push/send"
    expo_message = {
        "to": target_token,
        "title": title,
        "body": message,
        "data": {"message": message},
    }

    try:
        resp = httpx.post(
            expo_url,
            json=expo_message,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10,
        )
        try:
            resp_json = resp.json()
        except Exception:
            resp_json = {"status": resp.status_code, "text": resp.text}
        if resp.status_code not in (200, 201):
            return {
                "ok": False,
                "expo_status": resp.status_code,
                "expo_response": resp_json,
            }
        return {"ok": True, "expo_response": resp_json}
    except Exception as e:
        return {"ok": False, "reason": "request_failed", "error": str(e)}


@router.get(
    "/admin/payments/pending",
    response_model=PaymentList,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_pending(db: Session = Depends(get_db), skip: int = 0, limit: int = 50):
    q = db.query(Payment).filter(Payment.status == PaymentStatus.accountant_approved)
    total = q.count()
    items = q.order_by(Payment.collected_at.desc()).offset(skip).limit(limit).all()
    # Ensure comments field is included in PaymentOut
    return PaymentList(items=items, total=total)


@router.post(
    "/admin/payments/{payment_id}/approve",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_approve(
    payment_id: int, comment: str | None = None, db: Session = Depends(get_db)
):
    try:
        p_row = db.get(Payment, payment_id)
        if not p_row:
            raise ValueError
        if p_row.status != PaymentStatus.accountant_approved:
            raise HTTPException(
                status_code=400,
                detail="Only accountant-approved payments can be approved by admin",
            )
        p = admin_approve_payment(db, payment_id)
        if comment:
            p.admin_comment = comment
            db.add(p)
            db.commit()
            db.refresh(p)
        return p
    except ValueError:
        raise HTTPException(status_code=404, detail="Payment not found")


@router.post(
    "/admin/payments/{payment_id}/decline",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_decline(
    payment_id: int, comment: str | None = None, db: Session = Depends(get_db)
):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.status != PaymentStatus.accountant_approved:
        raise HTTPException(
            status_code=400,
            detail="Only accountant-approved payments can be declined by admin",
        )
    p.status = PaymentStatus.declined_by_admin
    p.admin_review_at = datetime.utcnow()
    if comment:
        p.admin_comment = comment
    # Mark related notifications as stopped
    db.query(Notification).filter(
        Notification.company_code == p.company_code,
        Notification.type == NotificationType.payment_review,
        Notification.status == NotificationStatus.pending,
    ).update(
        {Notification.status: NotificationStatus.stopped}, synchronize_session=False
    )
    db.commit()
    db.refresh(p)
    return p


# Admin: hard reset database (dangerous). Truncates all tables and reseeds admin & settings.
@router.post("/admin/reset", dependencies=[Depends(require_roles("admin"))])
def admin_reset(db: Session = Depends(get_db)):
    # Some ephemeral test environments may not include legacy 'imports' table; exclude it from truncate
    db.execute(
        text(
            "TRUNCATE TABLE notifications, payment_allocations, payments, bills, exec_assignments, companies, users, settings RESTART IDENTITY CASCADE;"
        )
    )
    db.commit()
    # Reseed admin and settings
    admin = User(
        username="admin",
        password_hash=hash_password("admin"),
        role=Role.admin,
        area=None,
        is_active=True,
    )
    db.add(admin)
    ensure_settings_row(db)
    db.commit()
    return {"ok": True}


@router.post(
    "/admin/recalc-all",
    dependencies=[Depends(require_roles("admin"))],
)
def admin_recalc_all(db: Session = Depends(get_db)):
    """Recalculate totals & credit dates for all non-archived companies (admin only)."""
    companies = db.query(Company).filter(Company.is_archived == False).all()
    count = 0
    for c in companies:
        recalc_company_totals(db, c.code)
        count += 1
    return {"recalculated": count}


# === Executive / Company assignment management (admin only) ===


@router.get(
    "/admin/assignments/companies",
    response_model=CompanyAssignmentList,
    dependencies=[Depends(require_roles("admin"))],
)
def list_company_assignments(
    db: Session = Depends(get_db), unassigned_only: bool = Query(False)
):
    assignments = {a.company_code: a for a in db.query(ExecAssignment).all()}
    # Include inactive executives so we can show placeholder instead of appearing unassigned
    exec_users = {u.id: u for u in db.query(User).filter(User.role == Role.executive)}
    q = db.query(Company).filter(Company.is_archived == False)
    items = []
    for comp in q.all():
        a = assignments.get(comp.code)
        if unassigned_only and a:
            continue
        exec_user = exec_users.get(a.executive_id) if a else None
        items.append(
            {
                "code": comp.code,
                "name": comp.name,
                # If there's an assignment row but user missing (deleted), preserve id; if user inactive mark active False
                "assigned_executive_id": (
                    exec_user.id if exec_user else (a.executive_id if a else None)
                ),
                "assigned_executive_username": (
                    exec_user.username if exec_user else None
                ),
                "assigned_executive_active": (
                    exec_user.is_active if exec_user else None
                ),
            }
        )
    return CompanyAssignmentList(items=items, total=len(items))


# Debug: raw assignment rows (admin only)
@router.get(
    "/admin/assignments/raw",
    dependencies=[Depends(require_roles("admin"))],
)
def raw_assignments(db: Session = Depends(get_db)):
    rows = db.query(ExecAssignment).all()
    return {
        "count": len(rows),
        "rows": [
            {"company_code": r.company_code, "executive_id": r.executive_id}
            for r in rows
        ],
    }


@router.post(
    "/admin/assignments/batch",
    dependencies=[Depends(require_roles("admin"))],
)
def batch_assign(payload: AssignmentBatchIn, db: Session = Depends(get_db)):
    exec_user = db.get(User, payload.executive_id)
    if not exec_user or exec_user.role != Role.executive:
        raise HTTPException(status_code=400, detail="invalid executive_id")
    updated: List[str] = []
    for code in payload.company_codes:
        comp = db.get(Company, code)
        if not comp or comp.is_archived:
            continue
        existing = (
            db.query(ExecAssignment).filter(ExecAssignment.company_code == code).first()
        )
        if existing:
            existing.executive_id = payload.executive_id
        else:
            db.add(ExecAssignment(company_code=code, executive_id=payload.executive_id))
        updated.append(code)
    db.commit()
    return {"assigned": updated, "executive_id": payload.executive_id}


@router.post(
    "/admin/assignments/unassign",
    dependencies=[Depends(require_roles("admin"))],
)
def batch_unassign(payload: UnassignBatchIn, db: Session = Depends(get_db)):
    removed: List[str] = []
    for code in payload.company_codes:
        existing = (
            db.query(ExecAssignment).filter(ExecAssignment.company_code == code).first()
        )
        if existing:
            db.delete(existing)
            removed.append(code)
    db.commit()
    return {"unassigned": removed}


# Unified payment approval/rejection history (all users, paginated)
@router.get(
    "/payments/history",
)
def payments_history(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
):
    # Payments approved or rejected by either admin or accountant
    q = db.query(Payment).filter(
        Payment.status.in_([
            PaymentStatus.admin_approved,
            PaymentStatus.declined_by_admin,
            PaymentStatus.accountant_approved,
            PaymentStatus.declined_by_accountant,
        ])
    )
    total = q.count()
    items = (
        q.order_by(
            Payment.admin_review_at.desc().nullslast(),
            Payment.accountant_review_at.desc().nullslast(),
            Payment.collected_at.desc()
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for p in items:
        result.append({
            "id": p.id,
            "company_code": p.company_code,
            "executive_id": p.executive_id,
            "collected_at": p.collected_at,
            "amount_collected": float(p.amount_collected),
            "method": p.method,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "admin_review_at": p.admin_review_at,
            "admin_comment": p.admin_comment,
            "accountant_review_at": p.accountant_review_at,
            "accountant_comment": p.accountant_comment,
            "comments": p.comments,
        })
    return {"items": result, "total": total}

# Admin: payment approval/rejection history (last 10, paginated, status included)
@router.get(
    "/admin/payments/history",
    dependencies=[Depends(require_roles("admin"))],
)
def admin_payment_history(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
):
    # Only payments approved or rejected by admin
    q = db.query(Payment).filter(
        Payment.status.in_([PaymentStatus.admin_approved, PaymentStatus.declined_by_admin])
    )
    total = q.count()
    items = (
        q.order_by(Payment.admin_review_at.desc().nullslast(), Payment.collected_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    # Response shape: like notifications, but with status
    result = []
    for p in items:
        result.append({
            "id": p.id,
            "company_code": p.company_code,
            "executive_id": p.executive_id,
            "collected_at": p.collected_at,
            "amount_collected": float(p.amount_collected),
            "method": p.method,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "admin_review_at": p.admin_review_at,
            "admin_comment": p.admin_comment,
            "comments": p.comments,
        })
    return {"items": result, "total": total}
