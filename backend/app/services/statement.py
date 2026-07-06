"""
statement.py – generates an account statement PDF for a given company.

Layout mirrors the paper ledger format:
    DATE | PARTICULARS | DEBIT | CREDIT | BALANCE (Dr/Cr)

Row types (all sorted chronologically):
    1. Opening balance row  – first row, "TO BALANCE B/F."
    2. Bill rows            – DEBIT, "TO BILL NO. <bill_number>"
    3. Payment rows         – CREDIT, "BY <Method> Rec/<exec_name>" or the
                             payment comment when it has a specific one
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session

from app.models.models import (
    Bill,
    Company,
    Payment,
    PaymentStatus,
    User,
)


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

@dataclass
class _LedgerRow:
    row_date: date
    particulars: str
    debit: Decimal       # positive = debit entry; 0 means no debit on this row
    credit: Decimal      # positive = credit entry; 0 means no credit on this row
    balance: Decimal     # running balance AFTER this row
    is_dr: bool          # True  → balance is Debit (company owes us)
                         # False → balance is Credit (we owe the company)
    sort_key: tuple      # (date, type_order, secondary) for stable sort


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_METHOD_LABEL: dict[str, str] = {
    "cash":   "Cash",
    "cheque": "Cheque",
    "bank":   "Bank Transfer",
    "online": "Online",
    "neft":   "NEFT",
    "rtgs":   "RTGS",
    "upi":    "UPI",
}


def _method_label(method: str) -> str:
    return _METHOD_LABEL.get((method or "").lower().strip(), (method or "Cash").title())


def _particulars_for_payment(payment: Payment, exec_name: str | None) -> str:
    """
    Use the payment comment as the particulars when it looks like a manual
    description (not the generic import tag).  Otherwise build
    "BY Cash Rec/Ankit" style.
    """
    comment = (payment.comments or "").strip()
    generic_comments = {
        "imported from cash dbf",
        "imported from bank dbf",
        "",
    }
    if comment.lower() not in generic_comments:
        # Use the comment text directly (Rate Diff, Rebate, etc.)
        return f"BY {comment}"

    method = _method_label(payment.method)
    if exec_name:
        return f"BY {method} Rec/{exec_name}"
    return f"BY {method} Rec"


def _fmt_date(d: date | datetime | None) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%d/%m/%Y")


# ---------------------------------------------------------------------------
# Core ledger builder
# ---------------------------------------------------------------------------

def build_ledger(
    db: Session,
    company_code: str,
    from_date: date,
    to_date: date,
) -> tuple[Company, list[_LedgerRow]]:
    """
    Return (company, rows) where rows are all ledger lines in order.

    Opening balance as-of from_date is computed as:
        opening_balance
        + SUM of bill amounts where bill_date < from_date
        - SUM of admin_approved payment allocations collected before from_date

    Note: We use sum of payment allocations (not payment amounts) so partial
    allocations are handled correctly.
    """
    comp = db.get(Company, company_code)
    if not comp:
        raise ValueError(f"Company {company_code!r} not found")

    opening_balance = Decimal(str(comp.opening_balance or 0))

    # Bills before the window → add to opening
    pre_bills = (
        db.query(Bill)
        .filter(
            Bill.company_code == company_code,
            Bill.bill_date < from_date,
            Bill.is_archived == False,
        )
        .all()
    )
    pre_bill_total = sum(Decimal(str(b.amount or 0)) for b in pre_bills)

    # Active payments collected before window → subtract from opening.
    # Matches the company outstanding formula: submitted + accountant_approved + admin_approved
    _ACTIVE_STATUSES = [
        PaymentStatus.submitted,
        PaymentStatus.accountant_approved,
        PaymentStatus.admin_approved,
    ]
    pre_payments = (
        db.query(Payment)
        .filter(
            Payment.company_code == company_code,
            Payment.status.in_(_ACTIVE_STATUSES),
            Payment.collected_at < datetime.combine(from_date, datetime.min.time()),
        )
        .all()
    )
    pre_payment_total = sum(
        Decimal(str(p.amount_collected or 0)) for p in pre_payments
    )

    opening = opening_balance + pre_bill_total - pre_payment_total

    # In-window bills
    in_bills = (
        db.query(Bill)
        .filter(
            Bill.company_code == company_code,
            Bill.bill_date >= from_date,
            Bill.bill_date <= to_date,
            Bill.is_archived == False,
        )
        .order_by(Bill.bill_date.asc(), Bill.id.asc())
        .all()
    )

    # In-window active payments — join executive for name.
    # Matches the company outstanding formula: submitted + accountant_approved + admin_approved
    in_payments = (
        db.query(Payment, User.username)
        .outerjoin(User, User.id == Payment.executive_id)
        .filter(
            Payment.company_code == company_code,
            Payment.status.in_(_ACTIVE_STATUSES),
            Payment.collected_at >= datetime.combine(from_date, datetime.min.time()),
            Payment.collected_at
            <= datetime.combine(to_date, datetime.max.time().replace(microsecond=0)),
        )
        .order_by(Payment.collected_at.asc(), Payment.id.asc())
        .all()
    )

    # Build row list
    # type_order: bills=1 (debits happen first on same day), payments=2
    raw: list[tuple[tuple, _LedgerRow]] = []

    for bill in in_bills:
        d = bill.bill_date or from_date
        amount = Decimal(str(bill.amount or 0))
        key = (d, 1, bill.id)
        raw.append((
            key,
            _LedgerRow(
                row_date=d,
                particulars=f"TO BILL NO. {bill.bill_number}",
                debit=amount,
                credit=Decimal(0),
                balance=Decimal(0),   # filled in second pass
                is_dr=True,
                sort_key=key,
            ),
        ))

    for payment, exec_username in in_payments:
        d = payment.collected_at.date() if isinstance(payment.collected_at, datetime) else payment.collected_at
        amount = Decimal(str(payment.amount_collected or 0))
        particulars = _particulars_for_payment(payment, exec_username)
        key = (d, 2, payment.id)
        raw.append((
            key,
            _LedgerRow(
                row_date=d,
                particulars=particulars,
                debit=Decimal(0),
                credit=amount,
                balance=Decimal(0),
                is_dr=True,
                sort_key=key,
            ),
        ))

    # Sort chronologically
    raw.sort(key=lambda x: x[0])

    # Compute running balance
    balance = opening
    rows: list[_LedgerRow] = []

    # Opening row first
    rows.append(_LedgerRow(
        row_date=from_date,
        particulars="TO BALANCE B/F.",
        debit=opening if opening >= 0 else Decimal(0),
        credit=(-opening) if opening < 0 else Decimal(0),
        balance=abs(opening),
        is_dr=(opening >= 0),
        sort_key=(from_date, 0, 0),
    ))

    for _, row in raw:
        balance = balance + row.debit - row.credit
        row.balance = abs(balance)
        row.is_dr = balance >= 0
        rows.append(row)

    return comp, rows


# ---------------------------------------------------------------------------
# PDF renderer
# ---------------------------------------------------------------------------

def generate_statement_pdf(
    db: Session,
    company_code: str,
    from_date: date,
    to_date: date,
    business_name: str = "ACCOUNT STATEMENT",
) -> bytes:
    """
    Generate and return raw PDF bytes for the company account statement.
    """
    # Lazy import — reportlab is optional at import time (tests may not need it)
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate,
            Table,
            TableStyle,
            Paragraph,
            Spacer,
            HRFlowable,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.platypus import PageBreak
    except ImportError as exc:
        raise RuntimeError(
            "reportlab is required for PDF generation. "
            "Add `reportlab` to requirements.txt and rebuild."
        ) from exc

    comp, rows = build_ledger(db, company_code, from_date, to_date)

    buf = io.BytesIO()
    PAGE_W, PAGE_H = A4
    MARGIN = 15 * mm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    styles = getSampleStyleSheet()

    def _style(name, **kw):
        s = ParagraphStyle(name, parent=styles["Normal"], **kw)
        return s

    mono = "Courier"
    sans = "Helvetica"

    title_style = _style("Title", fontName=sans + "-Bold", fontSize=16, alignment=TA_CENTER)
    sub_style   = _style("Sub",   fontName=mono + "-Bold", fontSize=9,  alignment=TA_CENTER)
    info_style  = _style("Info",  fontName=mono,           fontSize=8,  alignment=TA_LEFT)
    hdr_style   = _style("Hdr",   fontName=mono + "-Bold", fontSize=8,  alignment=TA_LEFT)

    story = []

    # ---- Header ----
    story.append(Paragraph(business_name, title_style))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 2 * mm))

    stmt_title = (
        f"ACCOUNT STATEMENT FROM "
        f"{_fmt_date(from_date)} TO {_fmt_date(to_date)}"
    )
    story.append(Paragraph(stmt_title, sub_style))
    story.append(Spacer(1, 1 * mm))

    comp_name = (comp.name or company_code).upper()
    story.append(Paragraph(
        f"M/S. {comp_name}    CODE NO. {company_code}",
        info_style,
    ))
    if comp.location:
        story.append(Paragraph(comp.location.upper(), info_style))

    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    story.append(Spacer(1, 2 * mm))

    # ---- Table ----
    # Column widths (total ≈ A4 content width ~180mm)
    col_widths = [22 * mm, 76 * mm, 26 * mm, 26 * mm, 30 * mm]

    def _cell(txt, bold=False, align=TA_LEFT):
        fn = mono + ("-Bold" if bold else "")
        return Paragraph(
            str(txt),
            _style(f"c{id(txt)}", fontName=fn, fontSize=7.5, alignment=align),
        )

    def _amount(val: Decimal | None, bold=False) -> Paragraph:
        if val is None or val == Decimal(0):
            return _cell("", bold=bold, align=TA_RIGHT)
        s = f"{val:,.2f}"
        return _cell(s, bold=bold, align=TA_RIGHT)

    # Header row
    table_data = [[
        _cell("DATE",         bold=True),
        _cell("PARTICULARS",  bold=True),
        _cell("DEBIT",        bold=True, align=TA_RIGHT),
        _cell("CREDIT",       bold=True, align=TA_RIGHT),
        _cell("BALANCE",      bold=True, align=TA_RIGHT),
    ]]

    total_debit  = Decimal(0)
    total_credit = Decimal(0)

    for row in rows:
        dr_label = "Dr" if row.is_dr else "Cr"
        bal_text = f"{dr_label} {row.balance:,.2f}"

        d_cell = Decimal(0) if row.debit == 0 else row.debit
        c_cell = Decimal(0) if row.credit == 0 else row.credit

        total_debit  += d_cell
        total_credit += c_cell

        table_data.append([
            _cell(_fmt_date(row.row_date)),
            _cell(row.particulars),
            _amount(d_cell if d_cell else None),
            _amount(c_cell if c_cell else None),
            _cell(bal_text, align=TA_RIGHT),
        ])

    # Totals row
    final_balance = rows[-1].balance if rows else Decimal(0)
    final_dr      = "Dr" if (rows[-1].is_dr if rows else True) else "Cr"
    table_data.append([
        _cell(""),
        _cell("TOTAL :", bold=True, align=TA_RIGHT),
        _amount(total_debit,  bold=True),
        _amount(total_credit, bold=True),
        _cell(f"{final_dr} {final_balance:,.2f}", bold=True, align=TA_RIGHT),
    ])

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor("#EEEEEE")),
        ("LINEBELOW",   (0, 0), (-1, 0), 0.8, colors.black),
        # Grid
        ("GRID",        (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("LINEABOVE",   (0, -1), (-1, -1), 0.8, colors.black),  # totals top border
        # Padding
        ("TOPPADDING",  (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        # Alternating row tint
        *[
            ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F9F9F9"))
            for i in range(2, len(table_data) - 1, 2)
        ],
    ]))

    story.append(tbl)
    doc.build(story)
    return buf.getvalue()
