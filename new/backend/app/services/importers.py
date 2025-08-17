from dbfread import DBF
from sqlmodel import Session, select
from app.db.session import get_session
from app.models import Company, Bill
from app.config import settings
from datetime import datetime

def import_master_dbf(path: str, session: Session):
    table = DBF(path, load=True, encoding='utf-8')
    count = 0
    for row in table:
        # using field names you specified: main_code, Code, account_n, Area, Outbal, Amount
        if row.get("main_code", "").lower() != "sdr":
            continue
        code = row.get("Code")
        if not code:
            continue
        c = session.get(Company, code)
        if not c:
            c = Company(code=code)
        c.account_n = row.get("account_n")
        c.area = row.get("Area")
        c.outbal = float(row.get("Outbal") or 0)
        c.amount = float(row.get("Amount") or 0)
        # initial credit/promise date left None until transactions imported
        session.add(c)
        count += 1
    session.commit()
    return {"imported": count}

def import_transaction_file(path: str, session: Session):
    table = DBF(path, load=True, encoding='utf-8')
    count = 0
    for row in table:
        # fields: date, bill, Code, Due_date, debit
        bill_no = row.get("bill")
        code = row.get("Code")
        if not (bill_no and code):
            continue
        date_str = row.get("date")
        due_str = row.get("Due_date")
        debit = float(row.get("debit") or 0)
        # parse dates (DBF often in YYYYMMDD or datetime)
        try:
            date = datetime.strptime(date_str, "%Y-%m-%d").date() if isinstance(date_str, str) else date_str
        except:
            date = None
        try:
            due_date = datetime.strptime(due_str, "%Y-%m-%d").date() if isinstance(due_str, str) else due_str
        except:
            due_date = None

        # upsert bill by bill number + company code
        stmt = select(Bill).where(Bill.bill == bill_no, Bill.company_code == code)
        existing = session.exec(stmt).first()
        if not existing:
            b = Bill(bill=bill_no, company_code=code, date=date, due_date=due_date, debit=debit, status="pending")
            session.add(b)
        else:
            existing.date = date
            existing.due_date = due_date
            existing.debit = debit
            session.add(existing)
        count += 1
    session.commit()
    # After transaction import, recompute per-company amounts and credit_date
    recompute_companies(session)
    return {"imported": count}

def recompute_companies(session: Session):
    from sqlalchemy import func
    companies = session.exec(select(Company)).all()
    for c in companies:
        bills = session.exec(select(Bill).where(Bill.company_code == c.code, Bill.status != "paid")).all()
        c.amount = sum([b.debit for b in bills])
        # outbal: sum of bills with due_date <= today
        from datetime import date, timedelta
        today = date.today()
        c.outbal = sum([b.debit for b in bills if b.due_date and b.due_date <= today])
        # credit_date = oldest pending bill's due_date + ADMIN_CREDIT_DAYS
        pending_due_dates = sorted([b.due_date for b in bills if b.due_date])
        if pending_due_dates:
            oldest = pending_due_dates[0]
            c.credit_date = oldest + timedelta(days=settings.ADMIN_CREDIT_DAYS)
            # if promise_date is None set it to credit_date
            if not c.promise_date:
                c.promise_date = c.credit_date
        session.add(c)
    session.commit()
