from pathlib import Path
from decimal import Decimal
from sqlalchemy.orm import Session
from dbfread import DBF
from app.models.models import Company, Bill, BillStatus
from app.services.company import recalc_company_totals

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def import_master(db: Session, filename: str = "master.dbf") -> int:
    path = DATA_DIR / filename
    count = 0
    seen_codes: set[str] = set()
    for row in DBF(str(path), load=True, char_decode_errors="ignore"):
        # Normalize keys to be case-insensitive (DBF headers are often uppercased)
        r = {str(k).lower(): v for k, v in row.items()}
        code = str(r.get("code") or "").strip()
        if not code:
            continue
        seen_codes.add(code)
        name = str(r.get("account_n") or r.get("name") or code).strip()
        area = str(r.get("area") or "").strip()
        comp = db.get(Company, code)
        if not comp:
            comp = Company(code=code, name=name, area=area)
            db.add(comp)
            count += 1
        else:
            comp.name = name
            comp.area = area
        comp.is_archived = False
    # archive companies missing in snapshot
    if seen_codes:
        db.query(Company).filter(~Company.code.in_(seen_codes)).update(
            {Company.is_archived: True}, synchronize_session=False
        )
    db.commit()
    return count


def import_transactions(db: Session, filename: str = "transactions.dbf") -> int:
    path = DATA_DIR / filename
    count = 0
    seen_numbers: set[str] = set()
    touched_codes: set[str] = set()
    for row in DBF(str(path), load=True, char_decode_errors="ignore"):
        r = {str(k).lower(): v for k, v in row.items()}
        bill_no = str(r.get("bill") or r.get("bill_number") or "").strip()
        code = str(r.get("code") or "").strip()
        if not bill_no or not code:
            continue
        seen_numbers.add(bill_no)
        touched_codes.add(code)
        bill_date = r.get("date")
        due_date = r.get("due_date") or r.get("duedate")
        debit = r.get("debit") or r.get("amount")
        if not db.get(Company, code):
            # create a placeholder company if master not yet imported
            db.add(Company(code=code, name=code, area=None))
        # upsert bill by bill_number
        bill = db.query(Bill).filter(Bill.bill_number == bill_no).one_or_none()
        if not bill:
            bill = Bill(
                bill_number=bill_no,
                company_code=code,
                bill_date=bill_date,
                due_date=due_date,
                amount=Decimal(debit or 0),
                amount_paid=Decimal(0),
                status=BillStatus.pending,
                is_archived=False,
            )
            db.add(bill)
            count += 1
        else:
            bill.company_code = code
            bill.bill_date = bill_date
            bill.due_date = due_date
            bill.amount = Decimal(debit or 0)
            bill.is_archived = False
    # archive bills missing in snapshot
    if seen_numbers:
        db.query(Bill).filter(~Bill.bill_number.in_(seen_numbers)).update(
            {Bill.is_archived: True}, synchronize_session=False
        )
    db.commit()
    # recalc per company impacted
    for code in touched_codes:
        recalc_company_totals(db, code)
    return count
