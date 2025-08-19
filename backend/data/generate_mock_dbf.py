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
for row in [
    ("C001", "Acme Corp", "North", 1000.00, 2500.50),
    ("C002", "Beta Textiles", "South", 0.00, 700.00),
    ("C003", "Gamma Fabrics", "West", 350.25, 0.00),
    ("C004", "Delta Mills", "East", 120.00, 540.00),
    ("C005", "Epsilon Weaves", "North", 0.00, 99999.99),
]:
    master.append(row)
master.close()

# --- transactions.dbf (bills snapshot) ---
# Schema: date (bill_date), bill (bill_number), Code (company), Due_date, debit (amount)
trans = create_table(
    transactions_path,
    "date D; bill C(30); Code C(10); Due_date D; debit N(12,2)",
)

rows = [
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
]

for r in rows:
    trans.append(r)
trans.close()

print("Generated master.dbf and transactions.dbf in", base)
