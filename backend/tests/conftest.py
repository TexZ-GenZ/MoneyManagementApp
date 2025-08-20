import os
import sys
import pathlib
import pytest

# Ensure project root on sys.path for 'app' imports when running in ephemeral test container
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base, get_db
from app.main import app

# Use in-memory SQLite for fast unit tests (override DATABASE_URL env before imports that use it)
TEST_DB_URL = "sqlite+pysqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()

@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    trans = connection.begin()
    TestingSessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    # Override dependency
    def _get_db_override():
        try:
            yield session
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db_override
    yield session
    session.close()
    trans.rollback()
    connection.close()

@pytest.fixture()
def client(db_session):
    return TestClient(app)

# Factory helpers
from app.models.models import User, Role, Company, Bill, BillStatus
from app.services.auth import hash_password
from datetime import date, timedelta

def create_user(session, username="exec1", role=Role.executive, password="pass"):
    u = User(username=username, password_hash=hash_password(password), role=role, is_active=True)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u

def create_company(session, code="C001", credit_date=None, promise_date=None):
    c = Company(code=code, name=code, area="A", credit_date=credit_date, promise_date=promise_date, amount=0, outbal=0, is_archived=False)
    session.add(c)
    session.commit()
    return c

def create_bill(session, company_code="C001", bill_number="B1", amount=100, days_due=10):
    from decimal import Decimal
    today = date.today()
    b = Bill(bill_number=bill_number, company_code=company_code, bill_date=today, due_date=today + timedelta(days=days_due), amount=Decimal(str(amount)), amount_paid=0, status=BillStatus.pending, is_archived=False)
    session.add(b)
    session.commit()
    session.refresh(b)
    return b

def auth_header(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
