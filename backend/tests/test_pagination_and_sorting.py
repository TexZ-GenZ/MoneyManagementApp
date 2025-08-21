from app.models.models import User, Role, Company, Bill, BillStatus
from app.services.auth import hash_password
from datetime import date, timedelta
from decimal import Decimal


def seed_companies(db, n=8):
    # Create companies with varying names and areas
    for i in range(n):
        db.add(
            Company(
                code=f"C{i:03d}",
                name=f"Company {i}",
                area="A" if i % 2 == 0 else "B",
                amount=0,
                outbal=0,
                is_archived=False,
            )
        )
    db.commit()


def test_companies_filter_and_pagination(db_session, client):
    admin = User(
        username="admin_pag",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    seed_companies(db_session, 10)
    hdr = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username':'admin_pag','password':'admin'}).json()['access_token']}"
    }
    # area filter
    r_area = client.get("/companies", headers=hdr, params={"area": "A"})
    assert r_area.status_code == 200
    data_a = r_area.json()
    assert all(c["area"] == "A" for c in data_a["items"])
    # q filter (search by partial name)
    r_q = client.get("/companies", headers=hdr, params={"q": "Company 1"})
    assert r_q.status_code == 200
    assert any("Company 1" in c["name"] for c in r_q.json()["items"])
    # pagination: first 3 then next 3 disjoint
    r_p1 = client.get("/companies", headers=hdr, params={"skip": 0, "limit": 3})
    r_p2 = client.get("/companies", headers=hdr, params={"skip": 3, "limit": 3})
    codes1 = [c["code"] for c in r_p1.json()["items"]]
    codes2 = [c["code"] for c in r_p2.json()["items"]]
    assert set(codes1).isdisjoint(codes2)
    # total constant
    assert r_p1.json()["total"] == r_p2.json()["total"] == 10


def seed_bills(db, company_code="C000"):
    # Create bills with varying amounts and dates
    today = date.today()
    bills = []
    for i, amt in enumerate([100, 250, 50, 175]):
        b = Bill(
            bill_number=f"B{i}",
            company_code=company_code,
            bill_date=today - timedelta(days=i),
            due_date=today + timedelta(days=10 + i),
            amount=Decimal(str(amt)),
            amount_paid=Decimal("0"),
            status=BillStatus.pending,
            is_archived=False,
        )
        db.add(b)
        bills.append(b)
    db.commit()
    for b in bills:
        db.refresh(b)
    return bills


def test_bills_sorting_and_filters(db_session, client):
    admin = User(
        username="admin_bills",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.add(Company(code="C000", name="C000"))
    db_session.commit()
    seed_bills(db_session, "C000")
    hdr = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username':'admin_bills','password':'admin'}).json()['access_token']}"
    }
    # oldest (ascending bill_date) -> last item has earliest index largest days offset
    r_oldest = client.get(
        "/companies/C000/bills", headers=hdr, params={"sort": "oldest"}
    )
    assert r_oldest.status_code == 200
    dates = [b["bill_date"] for b in r_oldest.json()["items"]]
    assert dates == sorted(dates)  # ascending
    # amount_desc
    r_amt = client.get(
        "/companies/C000/bills", headers=hdr, params={"sort": "amount_desc"}
    )
    amts = [str(b["amount"]) for b in r_amt.json()["items"]]
    assert amts == sorted(amts, key=lambda x: Decimal(x), reverse=True)
    # recent (descending bill_date)
    r_recent = client.get(
        "/companies/C000/bills", headers=hdr, params={"sort": "recent"}
    )
    dates_recent = [b["bill_date"] for b in r_recent.json()["items"]]
    assert dates_recent == sorted(dates_recent, reverse=True)
    # status filter: mark one paid then filter
    # update first bill to paid
    first_bill_id = r_recent.json()["items"][0]["id"]
    bill_obj = db_session.get(Bill, first_bill_id)
    bill_obj.status = BillStatus.paid
    db_session.commit()
    r_paid = client.get("/companies/C000/bills", headers=hdr, params={"status": "paid"})
    assert all(b["status"] == "paid" for b in r_paid.json()["items"])
