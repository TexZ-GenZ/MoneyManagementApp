from dbf import Table, Date, READ_WRITE
from datetime import date, timedelta
from pathlib import Path

base = Path(__file__).parent

# Paths
master_path = base / "master.dbf"
transactions_path = base / "transactions.dbf"

today = date.today()


# Helper to (re)create a table
def create_table(path: Path, schema: str) -> Table:
    if path.exists():
        path.unlink()
    t = Table(str(path), schema)
    t.open(mode=READ_WRITE)
    return t


# --- master.dbf (companies snapshot) ---
# Schema: Code, account_n (name), Area, Outbal, Amount (not used by importer but kept for realism)
master = create_table(
    master_path,
    "Code C(10); account_n C(50); Area C(50); Outbal N(12,2); Amount N(12,2)",
)

# More versatile company cases
company_rows = [
    ("C001", "Acme Corp", "North", 1000.00, 2500.50),
    ("C002", "Beta Textiles", "South", 0.00, 700.00),
    ("C003", "Gamma Fabrics", "West", 350.25, 0.00),
    ("C004", "Delta Mills", "East", 120.00, 540.00),
    ("C005", "Epsilon Weaves", "North", 0.00, 99999.99),
    ("C006", "ZeroZero", "Central", 0.00, 0.00),
    ("C007", "EdgeCaseCo!@#", "Special$Area", 123.45, 678.90),
    ("C008", "OneBill", "North", 50.00, 50.00),
    ("C009", "ManyBills", "South", 500.00, 500.00),
    ("C010", "BigBiz", "West", 100000.00, 100000.00),
    ("C011", "TinyCo", "East", 1.00, 1.00),
    ("C012", "NegativeTest", "North", -100.00, -200.00),
    ("C013", "UnicodeΩ≈ç√∫˜µ≤≥÷", "UnicodeArea", 1234.56, 7890.12),
    ("C014", "LongName" + "X" * 40, "LongArea" + "Y" * 30, 999.99, 888.88),
    ("C015", "SpecialChars!@#$%^&*()", "!@#$%^&*()", 555.55, 444.44),
    ("C016", "Empty", "", 0.00, 0.00),
    ("C017", "TestCo17", "Area17", 1700.00, 1700.00),
    ("C018", "TestCo18", "Area18", 1800.00, 1800.00),
    ("C019", "TestCo19", "Area19", 1900.00, 1900.00),
    ("C020", "TestCo20", "Area20", 2000.00, 2000.00),
]
master = create_table(
    master_path,
    "Code C(10); account_n C(50); Area C(50); Outbal N(12,2); Amount N(12,2)",
)
for row in company_rows:
    master.append(row)
master.close()

# --- transactions.dbf (bills snapshot) ---
# Schema: date (bill_date), bill (bill_number), Code (company), Due_date, debit (amount)
trans = create_table(
    transactions_path,
    "date D; bill C(30); Code C(10); Due_date D; debit N(12,2)",
)


# More versatile bill cases
bill_rows = [
    # C001: overdue, future, recent; one large
    (
        Date(today - timedelta(days=50)),
        "BILL-001",
        "C001",
        Date(today - timedelta(days=30)),
        1000.00,
    ),
    (
        Date(today - timedelta(days=10)),
        "BILL-002",
        "C001",
        Date(today + timedelta(days=10)),
        1500.50,
    ),
    (Date(today), "BILL-003", "C001", Date(today + timedelta(days=30)), 200.00),
    (
        Date(today - timedelta(days=90)),
        "BILL-004",
        "C001",
        Date(today - timedelta(days=60)),
        9999.99,
    ),
    (
        Date(today + timedelta(days=365)),
        "BILL-005",
        "C001",
        Date(today + timedelta(days=400)),
        10.00,
    ),  # far future
    (
        Date(today - timedelta(days=365)),
        "BILL-006",
        "C001",
        Date(today - timedelta(days=400)),
        20.00,
    ),  # far past
    # C002: multiple medium bills
    (
        Date(today - timedelta(days=15)),
        "BILL-010",
        "C002",
        Date(today + timedelta(days=5)),
        700.00,
    ),
    (
        Date(today - timedelta(days=2)),
        "BILL-011",
        "C002",
        Date(today + timedelta(days=20)),
        350.00,
    ),
    # C003: decimals, zero, large; duplicate number for idempotency testing
    (
        Date(today - timedelta(days=60)),
        "BILL-020",
        "C003",
        Date(today - timedelta(days=10)),
        350.25,
    ),
    (
        Date(today - timedelta(days=1)),
        "BILL-021",
        "C003",
        Date(today + timedelta(days=15)),
        99.99,
    ),
    (
        Date(today - timedelta(days=5)),
        "BILL-022",
        "C003",
        Date(today + timedelta(days=20)),
        0.00,
    ),
    (
        Date(today - timedelta(days=3)),
        "BILL-023",
        "C003",
        Date(today + timedelta(days=40)),
        12345.67,
    ),
    (
        Date(today - timedelta(days=3)),
        "BILL-023",
        "C003",
        Date(today + timedelta(days=40)),
        12345.67,
    ),  # duplicate bill number
    (
        Date(today - timedelta(days=2)),
        "BILL-024",
        "C003",
        Date(today + timedelta(days=10)),
        -50.00,
    ),  # negative amount
    # C004: recent smalls
    (
        Date(today - timedelta(days=7)),
        "BILL-030",
        "C004",
        Date(today + timedelta(days=10)),
        120.00,
    ),
    (
        Date(today - timedelta(days=6)),
        "BILL-031",
        "C004",
        Date(today + timedelta(days=12)),
        420.00,
    ),
    # C005: huge invoice
    (
        Date(today - timedelta(days=1)),
        "BILL-040",
        "C005",
        Date(today + timedelta(days=45)),
        50000.00,
    ),
    # C006: zero company, edge bills
    (Date(today), "BILL-050", "C006", Date(today), 0.00),
    (
        Date(today - timedelta(days=1)),
        "BILL-051",
        "C006",
        Date(today + timedelta(days=1)),
        0.00,
    ),
    # C007: special chars
    (
        Date(today - timedelta(days=1)),
        "BILL-060!@#",
        "C007",
        Date(today + timedelta(days=1)),
        123.45,
    ),
    # C008: one bill
    (Date(today), "BILL-070", "C008", Date(today + timedelta(days=10)), 50.00),
    # C009: many bills
    *[
        (
            Date(today - timedelta(days=i)),
            f"BILL-09{i:02d}",
            "C009",
            Date(today + timedelta(days=i)),
            10.00 + i,
        )
        for i in range(1, 21)
    ],
    # C010: BigBiz, huge bills
    (
        Date(today - timedelta(days=1)),
        "BILL-100",
        "C010",
        Date(today + timedelta(days=60)),
        50000.00,
    ),
    (
        Date(today - timedelta(days=2)),
        "BILL-101",
        "C010",
        Date(today + timedelta(days=90)),
        50000.00,
    ),
    # C011: TinyCo, tiny bills
    (Date(today), "BILL-110", "C011", Date(today + timedelta(days=1)), 0.01),
    (Date(today), "BILL-111", "C011", Date(today + timedelta(days=2)), 0.02),
    # C012: NegativeTest, negative bills
    (Date(today), "BILL-120", "C012", Date(today + timedelta(days=1)), -10.00),
    (Date(today), "BILL-121", "C012", Date(today + timedelta(days=2)), -20.00),
    # C013: Unicode
    (
        Date(today),
        "BILL-130Ω≈ç√∫˜µ≤≥÷",
        "C013",
        Date(today + timedelta(days=1)),
        1234.56,
    ),
    # C014: LongName
    (Date(today), "BILL-140", "C014", Date(today + timedelta(days=1)), 999.99),
    # C015: SpecialChars
    (
        Date(today),
        "BILL-150!@#$%^&*()",
        "C015",
        Date(today + timedelta(days=1)),
        555.55,
    ),
    # C016: Empty
    (Date(today), "BILL-160", "C016", Date(today + timedelta(days=1)), 0.00),
    # C017-020: More companies
    (Date(today), "BILL-170", "C017", Date(today + timedelta(days=1)), 1700.00),
    (Date(today), "BILL-180", "C018", Date(today + timedelta(days=1)), 1800.00),
    (Date(today), "BILL-190", "C019", Date(today + timedelta(days=1)), 1900.00),
    (Date(today), "BILL-200", "C020", Date(today + timedelta(days=1)), 2000.00),
]

trans = create_table(
    transactions_path,
    "date D; bill C(30); Code C(10); Due_date D; debit N(12,2)",
)
for r in bill_rows:
    trans.append(r)
trans.close()

print("Generated master.dbf and transactions.dbf in", base)
