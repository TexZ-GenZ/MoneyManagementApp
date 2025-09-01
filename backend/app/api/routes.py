from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Header,
    Request,
)
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, func, literal
from typing import Optional, List
from datetime import date, datetime, timedelta
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
from app.schemas.bill import BillList, BillOut, BillUpdatePromise
from app.schemas.payment import (
    PaymentSubmit,
    PaymentOut,
    PaymentList,
    BillPaymentHistory,
    BillPaymentHistoryItem,
    PaymentDetailOut,
    PaymentAllocationDetail,
    PaymentActivityItem,
    PaymentActivityList,
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
from app.services.payments import (
    create_payment_with_allocations,
    admin_approve_payment,
    reconcile_bill_promises,
)
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
    BillStatus,
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
    UserNotification,
)
from app.core.logging_config import get_logger
from app.services.notifications import _record_user_notification, compute_unread_badge

# Import rate limiting
from app.services.rate_limiting import limiter, user_limiter
from app.core.config import settings

log = get_logger(__name__)

router = APIRouter()

# Simple upload size guard (bytes). Adjust if realistic data requires more.
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 5 MB


@router.post("/auth/login", response_model=Token)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
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
@limiter.limit(settings.RATE_LIMIT_AUTH_ME)
def get_me(request: Request, user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        area=user.area,
        mobile=user.mobile,
        is_active=user.is_active,
    )


@router.get("/health")
@limiter.limit(settings.RATE_LIMIT_HEALTH)
def health(request: Request):
    return {"status": "ok"}


# Settings
@router.get(
    "/settings",
    response_model=SettingsOut,
    dependencies=[Depends(require_roles("admin"))],
)
@limiter.limit(settings.RATE_LIMIT_DATA_READ)
def get_settings(request: Request, db: Session = Depends(get_db)):
    s = ensure_settings_row(db)
    return SettingsOut(
        credit_extension_days=s.credit_extension_days,
        notif_every_hours=s.notif_every_hours,
        exec_window_start_hour=s.exec_window_start_hour,
        exec_window_end_hour=s.exec_window_end_hour,
    )


@router.patch(
    "/settings",
    response_model=SettingsOut,
    dependencies=[Depends(require_roles("admin"))],
)
@limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
def update_settings(
    request: Request, body: SettingsUpdate, db: Session = Depends(get_db)
):
    s = ensure_settings_row(db)
    if body.credit_extension_days is not None:
        s.credit_extension_days = body.credit_extension_days
    if body.notif_every_hours is not None:
        s.notif_every_hours = body.notif_every_hours
    if body.exec_window_start_hour is not None:
        s.exec_window_start_hour = body.exec_window_start_hour
    if body.exec_window_end_hour is not None:
        s.exec_window_end_hour = body.exec_window_end_hour
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
        exec_window_start_hour=s.exec_window_start_hour,
        exec_window_end_hour=s.exec_window_end_hour,
    )


# Companies
@router.get("/companies", response_model=CompanyList)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def list_companies(
    db: Session = Depends(get_db),
    area: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    exec_username: Optional[str] = Query(
        None,
        description="Filter by a single executive username (case-insensitive / deprecated in favor of exec_usernames)",
    ),
    exec_usernames: Optional[List[str]] = Query(
        None, description="Filter by multiple executive usernames (repeat param)"
    ),
    balance: Optional[str] = Query(
        None,
        pattern="^(positive|zero)$",
        description="positive: outbal>0, zero: outbal=0",
    ),
    sort: Optional[str] = Query(
        None,
        description="name_asc|code_asc|outbal_desc|outbal_asc|amount_desc|amount_asc|pending_desc|overdue_desc",
    ),
):
    base = db.query(Company).filter(Company.is_archived == False)
    if area:
        base = base.filter(Company.area == area)
    if q:
        like = f"%{q}%"
        base = base.filter(or_(Company.name.ilike(like), Company.code.ilike(like)))
    # Executive filters (multi or single)
    if exec_usernames and len(exec_usernames) > 0:
        lowered = [u.lower() for u in exec_usernames if u]
        if lowered:
            base = (
                base.join(ExecAssignment, ExecAssignment.company_code == Company.code)
                .join(User, User.id == ExecAssignment.executive_id)
                .filter(func.lower(User.username).in_(lowered))
            )
    elif exec_username:
        base = (
            base.join(ExecAssignment, ExecAssignment.company_code == Company.code)
            .join(User, User.id == ExecAssignment.executive_id)
            .filter(User.username.ilike(exec_username.lower()))
        )
    if balance == "positive":
        base = base.filter(Company.outbal > 0)
    elif balance == "zero":
        base = base.filter(Company.outbal == 0)

    total = base.count()

    # Sorting
    if sort in ("pending_desc", "overdue_desc"):
        # Join aggregated bill counts when sorting by counts
        settings_row = ensure_settings_row(db)
        credit_days = settings_row.credit_extension_days or 0
        eff_due = func.coalesce(
            Bill.promise_date, Bill.bill_date + literal(credit_days), Bill.due_date
        )
        agg = (
            db.query(
                Bill.company_code.label("code"),
                func.count()
                .filter((Bill.status == "pending") & (Bill.is_archived == False))
                .label("pending_count"),
                func.count()
                .filter(
                    (Bill.status == "pending")
                    & (Bill.is_archived == False)
                    & (eff_due <= func.current_date())
                )
                .label("overdue_count"),
            )
            .group_by(Bill.company_code)
            .subquery()
        )
        base = base.outerjoin(agg, agg.c.code == Company.code)
        if sort == "overdue_desc":
            base = base.order_by(
                func.coalesce(agg.c.overdue_count, 0).desc(), Company.name.asc()
            )
        else:
            base = base.order_by(
                func.coalesce(agg.c.pending_count, 0).desc(), Company.name.asc()
            )
    elif sort == "code_asc":
        base = base.order_by(Company.code.asc())
    elif sort == "outbal_desc":
        base = base.order_by(Company.outbal.desc())
    elif sort == "outbal_asc":
        base = base.order_by(Company.outbal.asc())
    elif sort == "amount_desc":
        base = base.order_by(Company.amount.desc())
    elif sort == "amount_asc":
        base = base.order_by(Company.amount.asc())
    else:
        base = base.order_by(Company.name.asc(), Company.code.asc())

    if limit != -1:
        base = base.offset(skip).limit(limit)
    else:
        base = base.offset(skip)

    rows = base.all()

    # Enrich via separate lightweight query (avoids duplicates / distinct complexity)
    code_list = [c.code for c in rows]
    if code_list:
        # Compute counts for this page
        settings_row = ensure_settings_row(db)
        credit_days = settings_row.credit_extension_days or 0
        eff_due = func.coalesce(
            Bill.promise_date, Bill.bill_date + literal(credit_days), Bill.due_date
        )
        cnt_rows = (
            db.query(
                Bill.company_code.label("code"),
                func.count()
                .filter((Bill.status == "pending") & (Bill.is_archived == False))
                .label("pending_count"),
                func.count()
                .filter(
                    (Bill.status == "pending")
                    & (Bill.is_archived == False)
                    & (eff_due <= func.current_date())
                )
                .label("overdue_count"),
            )
            .filter(Bill.company_code.in_(code_list))
            .group_by(Bill.company_code)
            .all()
        )
        counts = {
            r.code: (int(r.pending_count or 0), int(r.overdue_count or 0))
            for r in cnt_rows
        }
        # Compute next_due_date (effective earliest due) for this page
        next_due_rows = (
            db.query(
                Bill.company_code.label("code"), func.min(eff_due).label("next_due")
            )
            .filter(
                Bill.company_code.in_(code_list),
                Bill.status == "pending",
                Bill.is_archived == False,
            )
            .group_by(Bill.company_code)
            .all()
        )
        next_due_by_code = {r.code: r.next_due for r in next_due_rows}
        assignments = (
            db.query(ExecAssignment, User)
            .join(User, User.id == ExecAssignment.executive_id)
            .filter(ExecAssignment.company_code.in_(code_list))
            .all()
        )
        by_code = {a.company_code: u for a, u in assignments}
        for c in rows:
            pc, oc = counts.get(c.code, (0, 0))
            setattr(c, "pending_count", pc)
            setattr(c, "overdue_count", oc)
            # Set effective earliest due date for UI sorting
            setattr(c, "next_due_date", next_due_by_code.get(c.code))
            u = by_code.get(c.code)
            if u:
                setattr(c, "assigned_executive_id", u.id)
                setattr(c, "assigned_executive_username", u.username)
                setattr(c, "assigned_executive_active", u.is_active)
            else:
                setattr(c, "assigned_executive_id", None)
                setattr(c, "assigned_executive_username", None)
                setattr(c, "assigned_executive_active", None)

    return CompanyList(items=rows, total=total)


@router.get("/companies/{code}", response_model=CompanyBase)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def get_company(code: str, db: Session = Depends(get_db)):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c


@router.get("/companies/{code}/dashboard", response_model=CompanyDashboard)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def company_dashboard(code: str, db: Session = Depends(get_db)):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
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

    def map_bill(b: Bill):
        dynamic_due = (
            (b.bill_date + timedelta(days=credit_days)) if b.bill_date else b.due_date
        )
        return BillOut(
            id=b.id,
            bill_number=b.bill_number,
            company_code=b.company_code,
            bill_date=b.bill_date,
            due_date=dynamic_due,
            promise_date=getattr(b, "promise_date", None),
            amount=b.amount,
            amount_paid=b.amount_paid,
            status=b.status.value if hasattr(b.status, "value") else str(b.status),
        )

    pending_out = [map_bill(b) for b in pending]
    paid_out = [map_bill(b) for b in paid]
    return CompanyDashboard(
        code=c.code,
        name=c.name or c.code,
        area=c.area,
        credit_date=c.credit_date,
        promise_date=c.promise_date,
        promise_date_source=(
            c.promise_date_source.value
            if getattr(c, "promise_date_source", None)
            else None
        ),
        outbal=c.outbal,
        amount=c.amount,
        pending_bills=pending_out,
        paid_bills=paid_out,
    )


@router.patch(
    "/companies/{code}/promise-date",
    response_model=CompanyBase,
    dependencies=[Depends(require_roles("executive", "admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PROMISE_UPDATE)
def set_promise_date(
    code: str,
    body: CompanyUpdatePromise,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.get(Company, code)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    # Allow backward moves, but not before today
    from datetime import date as _date

    if body.promise_date < _date.today():
        raise HTTPException(
            status_code=400, detail="promise_date cannot be in the past"
        )
    c.promise_date = body.promise_date
    try:
        from app.models.models import Company as CompanyModel, Role as RoleEnum

        c.promise_date_source = (
            CompanyModel.PromiseSource.exec
            if user.role == RoleEnum.executive
            else CompanyModel.PromiseSource.admin
        )
    except Exception:
        pass
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
@user_limiter.limit(settings.RATE_LIMIT_CREDIT_UPDATE)
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
    old_credit = c.credit_date
    c.credit_date = body.credit_date
    db.commit()
    db.refresh(c)
    # If promise was auto-derived earlier, recompute auto promise; if exec/admin-set, do not override
    try:
        from app.models.models import Company as CompanyModel

        if (
            getattr(c, "promise_date_source", None)
            and c.promise_date_source == CompanyModel.PromiseSource.auto
        ) or c.promise_date is None:
            # Recompute credit_date via totals, which will set promise_date if empty
            recalc_company_totals(db, c.code)
        else:
            recompute_company_amounts(db, c.code)
    except Exception:
        recompute_company_amounts(db, c.code)
    resolve_promise_crossed_notifications(db, c)
    return c


# Bills
@router.get("/companies/{code}/bills", response_model=BillList)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
    raw_items = q.offset(skip).limit(limit).all()
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
    items = []
    for b in raw_items:
        dynamic_due = (
            (b.bill_date + timedelta(days=credit_days)) if b.bill_date else b.due_date
        )
        items.append(
            BillOut(
                id=b.id,
                bill_number=b.bill_number,
                company_code=b.company_code,
                bill_date=b.bill_date,
                due_date=dynamic_due,
                promise_date=getattr(b, "promise_date", None),
                amount=b.amount,
                amount_paid=b.amount_paid,
                status=b.status.value if hasattr(b.status, "value") else str(b.status),
            )
        )
    return BillList(items=items, total=total)


@router.get("/bills/{bill_id}", response_model=BillOut)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    b = db.get(Bill, bill_id)
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
    dynamic_due = (
        (b.bill_date + timedelta(days=credit_days)) if b.bill_date else b.due_date
    )
    return BillOut(
        id=b.id,
        bill_number=b.bill_number,
        company_code=b.company_code,
        bill_date=b.bill_date,
        due_date=dynamic_due,
        promise_date=getattr(b, "promise_date", None),
        amount=b.amount,
        amount_paid=b.amount_paid,
        status=b.status.value if hasattr(b.status, "value") else str(b.status),
    )


@router.get("/bills/{bill_id}/payments", response_model=BillPaymentHistory)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
                comments=getattr(payment, "comments", None),
                accountant_comment=payment.accountant_comment,
                admin_comment=payment.admin_comment,
                exec_location_verified=payment.exec_location_verified,
                exec_lat=getattr(payment, "exec_lat", None),
                exec_lng=getattr(payment, "exec_lng", None),
            )
        )
    return BillPaymentHistory(items=items, total=len(items))


# Admin: Update a bill's promise date directly
@router.patch(
    "/admin/bills/{bill_id}/promise-date",
    response_model=BillOut,
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PROMISE_UPDATE)
def admin_update_bill_promise(
    bill_id: int,
    body: BillUpdatePromise,
    db: Session = Depends(get_db),
):
    b = db.get(Bill, bill_id)
    if not b or b.is_archived:
        raise HTTPException(status_code=404, detail="Bill not found")
    # Allow backward moves, but not before today
    from datetime import date as _date

    if body.promise_date < _date.today():
        raise HTTPException(
            status_code=400, detail="promise_date cannot be in the past"
        )
    # Apply
    b.promise_date = body.promise_date
    try:
        from app.models.models import Company as CompanyModel

        b.promise_date_source = CompanyModel.PromiseSource.admin
    except Exception:
        pass
    # If bill is fully paid, keep status; otherwise ensure pending/partial remains
    if b.amount_paid >= b.amount:
        b.status = BillStatus.paid
    elif b.amount_paid > 0:
        b.status = BillStatus.partial
    else:
        b.status = BillStatus.pending
    db.add(b)
    db.commit()
    db.refresh(b)
    # Return BillOut with dynamic due consistent with get_bill
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
    dynamic_due = (
        (b.bill_date + timedelta(days=credit_days)) if b.bill_date else b.due_date
    )
    return BillOut(
        id=b.id,
        bill_number=b.bill_number,
        company_code=b.company_code,
        bill_date=b.bill_date,
        due_date=dynamic_due,
        promise_date=getattr(b, "promise_date", None),
        amount=b.amount,
        amount_paid=b.amount_paid,
        status=b.status.value if hasattr(b.status, "value") else str(b.status),
    )


# Payments
@router.post(
    "/payments",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("executive"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_SUBMIT)
def submit_payment(
    request: Request,
    body: PaymentSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    if user.role == Role.admin:
        raise HTTPException(status_code=403, detail="Admin cannot collect payment")
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def accountant_pending(db: Session = Depends(get_db), skip: int = 0, limit: int = 50):
    q = db.query(Payment).filter(Payment.status == PaymentStatus.submitted)
    total = q.count()
    items = q.order_by(Payment.collected_at.desc()).offset(skip).limit(limit).all()
    return PaymentList(items=items, total=total)


@router.get("/companies/{code}/payments", response_model=PaymentList)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
    return PaymentList(items=items, total=total)


@router.get(
    "/payments/activity",
    dependencies=[Depends(require_roles("admin", "accountant", "executive"))],
)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def payments_activity(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Base query: for execs, restrict to their companies
        q = db.query(Payment)
        if user.role == Role.executive:
            codes = [
                r.company_code
                for r in db.query(ExecAssignment)
                .filter(ExecAssignment.executive_id == user.id)
                .all()
            ]
            if codes:
                q = q.filter(Payment.company_code.in_(codes))
            else:
                return {"items": [], "total": 0}

        # Search by company code/name, executive username/name, or area
        if search:
            s = f"%{search.lower()}%"
            q = (
                q.join(Company, Company.code == Payment.company_code)
                .join(User, User.id == Payment.executive_id)
                .filter(
                    or_(
                        func.lower(Company.code).like(s),
                        func.lower(Company.name).like(s),
                        func.lower(func.coalesce(Company.area, "")).like(s),
                        func.lower(User.username).like(s),
                        func.lower(func.coalesce(User.area, "")).like(s),
                    )
                )
            )

        total = q.count()

        # Simple ordering by collected_at for now to avoid SQL issues
        rows = (
            q.order_by(Payment.collected_at.desc())
            .offset(max(0, skip))
            .limit(max(0, limit))
            .all()
        )

        # Precompute allocation counts per payment for history display
        try:
            pids = [p.id for p in rows]
            alloc_counts = {}
            first_bill_by_payment = {}
            if pids:
                ac_rows = (
                    db.query(PaymentAllocation.payment_id, func.count().label("cnt"))
                    .filter(PaymentAllocation.payment_id.in_(pids))
                    .group_by(PaymentAllocation.payment_id)
                    .all()
                )
                alloc_counts = {pid: int(cnt) for pid, cnt in ac_rows}
                # First bill number for display
                subq = (
                    db.query(
                        PaymentAllocation.payment_id.label("pid"),
                        func.min(PaymentAllocation.bill_id).label("min_bid"),
                    )
                    .filter(PaymentAllocation.payment_id.in_(pids))
                    .group_by(PaymentAllocation.payment_id)
                    .subquery()
                )
                jrows = (
                    db.query(subq.c.pid, Bill.bill_number)
                    .join(Bill, Bill.id == subq.c.min_bid)
                    .all()
                )
                first_bill_by_payment = {pid: bn for pid, bn in jrows}
        except Exception:
            alloc_counts = {}
            first_bill_by_payment = {}

        items = []
        for p in rows:
            try:
                # Determine last activity type/time/comment based on actual timestamps
                candidates = [
                    (p.collected_at, "submitted", getattr(p, "comments", None)),
                ]
                if hasattr(p, "accountant_review_at") and p.accountant_review_at:
                    candidates.append(
                        (
                            p.accountant_review_at,
                            "accountant_review",
                            getattr(p, "accountant_comment", None),
                        )
                    )
                if hasattr(p, "admin_review_at") and p.admin_review_at:
                    candidates.append(
                        (
                            p.admin_review_at,
                            "admin_review",
                            getattr(p, "admin_comment", None),
                        )
                    )

                last_time, last_type, last_comment = max(candidates, key=lambda x: x[0])

                # Lookup display fields
                company = db.get(Company, p.company_code)
                exec_user = db.get(User, p.executive_id)

                # Ensure status is string
                status_str = (
                    p.status.value if hasattr(p.status, "value") else str(p.status)
                )

                # Ensure amount is properly converted
                amount_val = p.amount_collected
                if amount_val is None:
                    amount_val = 0
                else:
                    amount_val = float(amount_val)

                item_dict = {
                    "payment_id": p.id,
                    "company_code": p.company_code,
                    "company_name": getattr(company, "name", None) if company else None,
                    "company_area": getattr(company, "area", None) if company else None,
                    "executive_id": p.executive_id,
                    "executive_username": (
                        getattr(exec_user, "username", None) if exec_user else None
                    ),
                    "executive_name": (
                        getattr(exec_user, "full_name", None)
                        if exec_user and hasattr(exec_user, "full_name")
                        else None
                    ),
                    "amount_collected": amount_val,
                    "method": str(p.method or ""),
                    "status": status_str,
                    # expose role-specific interaction times
                    "submitted_at": (
                        p.collected_at.isoformat() if p.collected_at else None
                    ),
                    "accountant_review_at": (
                        p.accountant_review_at.isoformat()
                        if getattr(p, "accountant_review_at", None)
                        else None
                    ),
                    "admin_review_at": (
                        p.admin_review_at.isoformat()
                        if getattr(p, "admin_review_at", None)
                        else None
                    ),
                    "last_activity_at": last_time.isoformat() if last_time else None,
                    "last_activity_type": last_type,
                    "last_comment": last_comment,
                    # number of bills included in this payment (bulk vs single)
                    "allocation_count": alloc_counts.get(p.id, 0),
                    "first_bill_number": first_bill_by_payment.get(p.id),
                    # convenience aliases used by app front-end (tolerant to None)
                    "created_at": (
                        p.collected_at.isoformat() if p.collected_at else None
                    ),
                    "updated_at": (
                        (
                            p.admin_review_at
                            or p.accountant_review_at
                            or p.collected_at
                        ).isoformat()
                        if (
                            p.admin_review_at
                            or p.accountant_review_at
                            or p.collected_at
                        )
                        else None
                    ),
                    "accountant_approved_at": (
                        p.accountant_review_at.isoformat()
                        if p.accountant_review_at
                        else None
                    ),
                    "admin_approved_at": (
                        p.admin_review_at.isoformat() if p.admin_review_at else None
                    ),
                }
                items.append(item_dict)
            except Exception as e:
                print(f"Error processing payment {p.id}: {e}")
                continue

        return {"items": items, "total": total}

    except Exception as e:
        print(f"Error in payments_activity: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Admin utility: reconcile per-bill promise dates from approved payments
@router.post(
    "/admin/reconcile/bill-promises",
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_RECONCILE)
def admin_reconcile_bill_promises(db: Session = Depends(get_db)):
    try:
        count = reconcile_bill_promises(db)
        return {"updated": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# (duplicate payments_activity removed; single definition exists above before /payments/{payment_id})


@router.get("/payments/{payment_id}", response_model=PaymentDetailOut)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
        comments=getattr(p, "comments", None),
        next_promise_date=p.next_promise_date,
        exec_location_verified=p.exec_location_verified,
        exec_lat=getattr(p, "exec_lat", None),
        exec_lng=getattr(p, "exec_lng", None),
        accountant_review_at=getattr(p, "accountant_review_at", None),
        admin_review_at=getattr(p, "admin_review_at", None),
        accountant_comment=getattr(p, "accountant_comment", None),
        admin_comment=getattr(p, "admin_comment", None),
        allocations=allocations,
    )


# Alias endpoint for bulk payments (same schema/logic as /payments)
@router.post(
    "/payments/bulk",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("executive", "admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_BULK)
def submit_bulk_payment(
    request: Request,
    body: PaymentSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    return submit_payment(body, user, db, idempotency_key)


@router.post(
    "/accountant/payments/{payment_id}/approve",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("accountant", "admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_APPROVAL)
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
    # Create or ensure a pending notification exists for admin stage (immediate persistence)
    try:
        existing = (
            db.query(Notification)
            .filter(
                Notification.payment_id == p.id,
                Notification.type == NotificationType.payment_review,
                Notification.status == NotificationStatus.pending,
            )
            .first()
        )
        if not existing:
            comp = db.get(Company, p.company_code)
            comp_part = p.company_code + (
                f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
            )
            try:
                amt = f"{float(p.amount_collected):,.2f}"
            except Exception:
                amt = str(p.amount_collected)
            msg = f"#{p.id} • {comp_part} • INR {amt} via {p.method} • Collected {p.collected_at.date().isoformat()} • Awaiting admin approval"
            db.add(
                Notification(
                    company_code=p.company_code,
                    payment_id=p.id,
                    type=NotificationType.payment_review,
                    status=NotificationStatus.pending,
                    message=msg,
                )
            )
            db.commit()
    except Exception:
        # Do not block on notification persistence
        pass
    # Immediate push to admins for next approval stage
    try:
        admin_users = (
            db.query(User).filter(User.role == Role.admin, User.is_active == True).all()
        )
        if admin_users:
            # Build richer body for admin stage ONCE, then reuse for recording and push
            comp = db.get(Company, p.company_code)
            comp_part = p.company_code + (
                f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
            )
            try:
                amt = f"{float(p.amount_collected):,.2f}"
            except Exception:
                amt = str(p.amount_collected)
            body = f"📝 {comp_part}\n₹{amt} via {p.method} • Collected {p.collected_at.date().isoformat()}\nTap to review payment #{p.id}"

            tokens = (
                db.query(PushToken)
                .filter(PushToken.user_id.in_([u.id for u in admin_users]))
                .all()
            )

            # Record delivered for each admin user
            for u in admin_users:
                try:
                    _record_user_notification(
                        db,
                        u.id,
                        "Needs Admin Approval",
                        body,
                        {"payment_id": p.id, "stage": "admin", "screen": "NotifyAdmin"},
                    )
                except Exception:
                    pass

            # Send pushes
            for t in tokens:
                if not isinstance(t.token, str) or not t.token.startswith(
                    "ExponentPushToken"
                ):
                    continue
                try:
                    import httpx

                    try:
                        log.info(
                            "Sending admin push payment_id=%s body=%s",
                            p.id,
                            body,
                        )
                    except Exception:
                        pass
                    httpx.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": t.token,
                            "title": "Needs Admin Approval",
                            "body": body,
                            "data": {
                                "payment_id": p.id,
                                "stage": "admin",
                                "screen": "NotifyAdmin",
                            },
                            "priority": "high",
                            "sound": "default",
                        },
                        timeout=8,
                    )
                except Exception:
                    continue
    except Exception:
        pass
    return p


# Admin: create user
@router.post(
    "/admin/users",
    response_model=UserOut,
    dependencies=[Depends(require_roles("admin"))],
)
@limiter.limit(settings.RATE_LIMIT_USER_CREATION)
def admin_create_user(
    request: Request, body: UserCreate, db: Session = Depends(get_db)
):
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def list_executives(db: Session = Depends(get_db)):
    execs = db.query(User).filter(User.role == Role.executive).all()
    # returning list; schema is single, but Pydantic can coerce list of UserOut if we wrap
    return [UserOut.model_validate(e) for e in execs]


# Admin: assign/unassign companies to an executive
@router.post(
    "/admin/executives/{executive_id}/assign/{company_code}",
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_USER_DELETE)
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
    # Compute earliest pending bill-level due/promise per company in-bulk
    if items:
        code_list = [c.code for c in items]
        settings_row = ensure_settings_row(db)
        credit_days = settings_row.credit_extension_days or 0
        # Fetch minimal fields from bills to compute next_due_date
        pending = (
            db.query(
                Bill.company_code, Bill.promise_date, Bill.bill_date, Bill.due_date
            )
            .filter(
                Bill.company_code.in_(code_list),
                Bill.status == "pending",
                Bill.is_archived == False,
            )
            .all()
        )
        from collections import defaultdict

        best: dict[str, date] = {}
        pending_counts = defaultdict(int)
        overdue_counts = defaultdict(int)
        today = date.today()
        for company_code, promise_date, bill_date, due_date in pending:
            # Effective due is bill.promise_date if set, else bill_date+credit_days, else bill.due_date
            eff_due = None
            if promise_date is not None:
                eff_due = promise_date
            elif bill_date is not None:
                try:
                    eff_due = bill_date + timedelta(days=credit_days)
                except Exception:
                    eff_due = bill_date
            else:
                eff_due = due_date
            if eff_due is None:
                continue
            pending_counts[company_code] += 1
            if eff_due <= today:
                overdue_counts[company_code] += 1
            prev = best.get(company_code)
            if prev is None or eff_due < prev:
                best[company_code] = eff_due
        for c in items:
            setattr(c, "next_due_date", best.get(c.code))
            setattr(c, "pending_count", int(pending_counts.get(c.code, 0)))
            setattr(c, "overdue_count", int(overdue_counts.get(c.code, 0)))
    return {"items": items, "total": len(items)}


@router.get("/me/companies", dependencies=[Depends(require_roles("executive"))])
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
    # Compute earliest pending bill-level due/promise per company
    if items:
        code_list = [c.code for c in items]
        settings_row = ensure_settings_row(db)
        credit_days = settings_row.credit_extension_days or 0
        pending = (
            db.query(
                Bill.company_code, Bill.promise_date, Bill.bill_date, Bill.due_date
            )
            .filter(
                Bill.company_code.in_(code_list),
                Bill.status == "pending",
                Bill.is_archived == False,
            )
            .all()
        )
        from collections import defaultdict

        best: dict[str, date] = {}
        pending_counts = defaultdict(int)
        overdue_counts = defaultdict(int)
        today = date.today()
        for company_code, promise_date, bill_date, due_date in pending:
            eff_due = None
            if promise_date is not None:
                eff_due = promise_date
            elif bill_date is not None:
                try:
                    eff_due = bill_date + timedelta(days=credit_days)
                except Exception:
                    eff_due = bill_date
            else:
                eff_due = due_date
            if eff_due is None:
                continue
            pending_counts[company_code] += 1
            if eff_due <= today:
                overdue_counts[company_code] += 1
            prev = best.get(company_code)
            if prev is None or eff_due < prev:
                best[company_code] = eff_due
        for c in items:
            setattr(c, "next_due_date", best.get(c.code))
            setattr(c, "pending_count", int(pending_counts.get(c.code, 0)))
            setattr(c, "overdue_count", int(overdue_counts.get(c.code, 0)))
    return {"items": items, "total": len(items)}


# Admin: list users by role
@router.get(
    "/admin/users",
    response_model=UserList,
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
def admin_activate_user(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_active = True
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        role=u.role,
        area=u.area,
        username=u.username,
        mobile=u.mobile,
        is_active=u.is_active,
    )


# Admin: hard delete user (only allowed for executives without references)
@router.delete(
    "/admin/users/{user_id}/hard-delete",
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_USER_DELETE)
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
@user_limiter.limit(settings.RATE_LIMIT_UPLOAD_MASTER)
def upload_master(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    # Save under original filename to support arbitrary names and formats (dbf/csv/xlsx)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    orig_name = (file.filename or "master_upload").strip()
    dest = DATA_DIR / orig_name
    content = file.file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large; max {MAX_UPLOAD_SIZE} bytes"
        )
    dest.write_bytes(content)
    # Pass the saved path directly so the import layer can detect extension
    metrics = do_import_master(db, filename=str(dest))
    return {"ok": True, "saved": str(dest), **metrics}


@router.post(
    "/uploads/transactions", dependencies=[Depends(require_roles("accountant"))]
)
@user_limiter.limit(settings.RATE_LIMIT_UPLOAD_TRANSACTIONS)
def upload_transactions(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    # Save under original filename to support arbitrary names and formats (dbf/csv/xlsx)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    orig_name = (file.filename or "transactions_upload").strip()
    dest = DATA_DIR / orig_name
    content = file.file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large; max {MAX_UPLOAD_SIZE} bytes"
        )
    dest.write_bytes(content)
    # Pass the saved path directly so the import layer can detect extension
    metrics = do_import_transactions(db, filename=str(dest))
    return {"ok": True, "saved": str(dest), **metrics}


@router.get("/notifications")
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    company_code: Optional[str] = Query(None),
    since_hours: Optional[int] = Query(24, description="Default 24h window"),
    skip: int = Query(0, ge=0),
    limit: int = 200,
    aggregate: Optional[bool] = Query(
        True,
        description="Aggregate payment_review items for admin/accountant into a single summary",
    ),
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
    elif user.role == Role.admin:
        # Admin should see only admin-relevant notifications (awaiting admin approval)
        q = q.filter(Notification.type == NotificationType.payment_review)
        q = q.join(Payment, Payment.id == Notification.payment_id)
        q = q.filter(Payment.status == PaymentStatus.accountant_approved)
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
    # Optional time-window filter (e.g., last 48 hours)
    if since_hours is not None:
        try:
            hrs = int(since_hours)
            if hrs > 0:
                cutoff = datetime.utcnow() - timedelta(hours=hrs)
                q = q.filter(Notification.created_at >= cutoff)
        except Exception:
            pass
    # Aggregate mode for approvals: return a single synthesized summary item
    try:
        wants_payment_review = (type is None) or (
            type == NotificationType.payment_review.value
        )
    except Exception:
        wants_payment_review = type is None
    if (
        aggregate
        and wants_payment_review
        and user.role in (Role.admin, Role.accountant)
    ):
        # Count based on payment status to avoid mixing declines/other stages
        if user.role == Role.admin:
            count = (
                db.query(Payment)
                .filter(Payment.status == PaymentStatus.accountant_approved)
                .count()
            )
            role_stage = "admin"
        else:
            count = (
                db.query(Payment)
                .filter(Payment.status == PaymentStatus.submitted)
                .count()
            )
            role_stage = "accountant"
        if count > 0:
            noun = "payment" if count == 1 else "payments"
            summary = {
                "id": f"agg:{role_stage}:payment_review",
                "type": NotificationType.payment_review.value,
                "status": NotificationStatus.sent.value,
                "message": f"{count} {noun} awaiting {role_stage} approval\nTap to review.",
                "created_at": datetime.utcnow().isoformat(),
            }
            return {"items": [summary], "total": 1, "next_skip": 1}

    items = (
        q.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(min(limit, 500))
        .all()
    )
    return {"items": items, "total": len(items), "next_skip": skip + len(items)}


@router.get("/notifications/unread-count")
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ_HIGH)
def notifications_unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    company_code: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    since_hours: Optional[int] = Query(24),
):
    # Delivered-only unread count (verbatim history); ignore legacy notifications table
    delivered_q = db.query(UserNotification).filter(
        UserNotification.user_id == user.id, UserNotification.acknowledged == False
    )
    if since_hours is not None:
        try:
            hrs = int(since_hours)
            if hrs > 0:
                cutoff = datetime.utcnow() - timedelta(hours=hrs)
                delivered_q = delivered_q.filter(UserNotification.created_at >= cutoff)
        except Exception:
            pass
    return {"unread": delivered_q.count()}


@router.post("/notifications/{notification_id}/ack")
@user_limiter.limit(settings.RATE_LIMIT_GENERAL)
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


# Delivered notifications (verbatim pushes)
@router.get("/notifications/delivered")
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def list_delivered_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    since_hours: int = Query(24, ge=1, le=720),
):
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=since_hours)
    q = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id)
        .filter(UserNotification.created_at >= cutoff)
        .order_by(UserNotification.created_at.desc())
    )
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "next_skip": skip + len(items)}


@router.post("/notifications/delivered/{delivered_id}/ack")
@user_limiter.limit(settings.RATE_LIMIT_GENERAL)
def ack_delivered_notification(
    delivered_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    n = db.get(UserNotification, delivered_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.acknowledged:
        return n
    n.acknowledged = True
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post(
    "/admin/notifications/scan", dependencies=[Depends(require_roles("admin"))]
)
@user_limiter.limit(settings.RATE_LIMIT_NOTIFICATION_SCAN)
def manual_notification_scan(db: Session = Depends(get_db)):
    run_notification_scan(db)
    return {"ok": True}


@router.get("/notifications/counts")
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_APPROVAL)
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
    # Persist a history notification for decline (so it shows in in-app list)
    try:
        comp = db.get(Company, p.company_code)
        comp_part = p.company_code + (
            f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
        )
        try:
            amt = f"{float(p.amount_collected):,.2f}"
        except Exception:
            amt = str(p.amount_collected)
        reason = (
            comment or getattr(p, "accountant_comment", None) or "No reason provided"
        )
        msg = (
            f"#{p.id} • {comp_part} • INR {amt} via {p.method} • Collected {p.collected_at.date().isoformat()} • "
            f"Declined by Accountant • Reason: {reason}"
        )
        db.add(
            Notification(
                company_code=p.company_code,
                payment_id=p.id,
                type=NotificationType.payment_review,
                status=NotificationStatus.pending,
                message=msg,
            )
        )
        db.commit()
    except Exception:
        pass
    # Push notification to assigned executive with detailed decline message
    try:
        # Find assigned executive for this company
        assignment = (
            db.query(ExecAssignment)
            .filter(ExecAssignment.company_code == p.company_code)
            .first()
        )
        if assignment:
            exec_user = db.get(User, assignment.executive_id)
        else:
            exec_user = None

        if exec_user and exec_user.is_active:
            tokens = db.query(PushToken).filter(PushToken.user_id == exec_user.id).all()
            if tokens:
                import httpx

                comp = db.get(Company, p.company_code)
                comp_part = p.company_code + (
                    f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
                )
                try:
                    amt = f"{float(p.amount_collected):,.2f}"
                except Exception:
                    amt = str(p.amount_collected)
                reason = (
                    comment
                    or getattr(p, "accountant_comment", None)
                    or "No reason provided"
                )
                body = (
                    f"🧾 {comp_part}\n₹{amt} via {p.method} • Collected {p.collected_at.date().isoformat()}\n"
                    f"Declined by Accountant • Reason: {reason}"
                )
                # Record delivered for the executive
                try:
                    _record_user_notification(
                        db,
                        exec_user.id,
                        "Payment Declined by Accountant",
                        body,
                        {
                            "payment_id": p.id,
                            "action": "declined",
                            "by": "accountant",
                            "screen": "PaymentDetails",
                        },
                    )
                except Exception:
                    pass
                for t in tokens:
                    # Send only to Expo push tokens (managed workflow). FCM direct requires service account; skipped here.
                    if not isinstance(t.token, str) or not t.token.startswith(
                        "ExponentPushToken"
                    ):
                        continue
                    try:
                        httpx.post(
                            "https://exp.host/--/api/v2/push/send",
                            json={
                                "to": t.token,
                                "title": "Payment Declined by Accountant",
                                "body": body,
                                "data": {
                                    "payment_id": p.id,
                                    "action": "declined",
                                    "by": "accountant",
                                    "screen": "PaymentDetails",
                                },
                                "priority": "high",
                                "sound": "default",
                            },
                            timeout=8,
                        )
                    except Exception:
                        continue
    except Exception:
        # Never block decline flow on push failures
        pass
    return p


# Push token management - client sends FCM token on login
@router.post("/auth/push-token")
@user_limiter.limit(settings.RATE_LIMIT_PUSH_TOKEN)
def upsert_push_token(
    request: Request,
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
@user_limiter.limit(settings.RATE_LIMIT_GENERAL)
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
def admin_pending(db: Session = Depends(get_db), skip: int = 0, limit: int = 50):
    q = db.query(Payment).filter(Payment.status == PaymentStatus.accountant_approved)
    total = q.count()
    items = q.order_by(Payment.collected_at.desc()).offset(skip).limit(limit).all()
    return PaymentList(items=items, total=total)


@router.post(
    "/admin/payments/{payment_id}/approve",
    response_model=PaymentOut,
    dependencies=[Depends(require_roles("admin"))],
)
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_APPROVAL)
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
@user_limiter.limit(settings.RATE_LIMIT_PAYMENT_APPROVAL)
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
    # Persist a history notification for decline (so it shows in in-app list)
    try:
        comp = db.get(Company, p.company_code)
        comp_part = p.company_code + (
            f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
        )
        try:
            amt = f"{float(p.amount_collected):,.2f}"
        except Exception:
            amt = str(p.amount_collected)
        reason = comment or getattr(p, "admin_comment", None) or "No reason provided"
        msg = (
            f"#{p.id} • {comp_part} • INR {amt} via {p.method} • Collected {p.collected_at.date().isoformat()} • "
            f"Declined by Admin • Reason: {reason}"
        )
        db.add(
            Notification(
                company_code=p.company_code,
                payment_id=p.id,
                type=NotificationType.payment_review,
                status=NotificationStatus.pending,
                message=msg,
            )
        )
        db.commit()
    except Exception:
        pass
    # Push notifications to accountant(s) and assigned executive with detailed decline message
    try:
        import httpx

        # Build common message body
        comp = db.get(Company, p.company_code)
        comp_part = p.company_code + (
            f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
        )
        try:
            amt = f"{float(p.amount_collected):,.2f}"
        except Exception:
            amt = str(p.amount_collected)
        reason = comment or getattr(p, "admin_comment", None) or "No reason provided"
        body = (
            f"🧾 {comp_part}\n₹{amt} via {p.method} • Collected {p.collected_at.date().isoformat()}\n"
            f"Declined by Admin • Reason: {reason}"
        )

        # Collect recipients: all active accountants + assigned executive (if any)
        accountant_users = (
            db.query(User)
            .filter(User.role == Role.accountant, User.is_active == True)
            .all()
        )
        exec_user = None
        assignment = (
            db.query(ExecAssignment)
            .filter(ExecAssignment.company_code == p.company_code)
            .first()
        )
        if assignment:
            eu = db.get(User, assignment.executive_id)
            if eu and eu.is_active:
                exec_user = eu

        user_ids = [u.id for u in accountant_users]
        if exec_user:
            user_ids.append(exec_user.id)
        if user_ids:
            tokens = db.query(PushToken).filter(PushToken.user_id.in_(user_ids)).all()
            # Record delivered for each recipient
            for uid in user_ids:
                try:
                    _record_user_notification(
                        db,
                        uid,
                        "Payment Declined by Admin",
                        body,
                        {
                            "payment_id": p.id,
                            "action": "declined",
                            "by": "admin",
                            "screen": "PaymentDetails",
                        },
                    )
                except Exception:
                    pass
            for t in tokens:
                if not isinstance(t.token, str) or not t.token.startswith(
                    "ExponentPushToken"
                ):
                    continue
                try:
                    httpx.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": t.token,
                            "title": "Payment Declined by Admin",
                            "body": body,
                            "data": {
                                "payment_id": p.id,
                                "action": "declined",
                                "by": "admin",
                                "screen": "PaymentDetails",
                            },
                            "priority": "high",
                            "sound": "default",
                        },
                        timeout=8,
                    )
                except Exception:
                    continue
    except Exception:
        # Silent on push errors
        pass
    return p


# Admin: hard reset database (dangerous). Truncates all tables and reseeds admin & settings.
@router.post("/admin/reset", dependencies=[Depends(require_roles("admin"))])
@user_limiter.limit(settings.RATE_LIMIT_RECONCILE)
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
@user_limiter.limit(settings.RATE_LIMIT_RECONCILE)
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
@user_limiter.limit(settings.RATE_LIMIT_DATA_READ)
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
@user_limiter.limit(settings.RATE_LIMIT_SETTINGS_UPDATE)
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
@user_limiter.limit(settings.RATE_LIMIT_USER_DELETE)
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
