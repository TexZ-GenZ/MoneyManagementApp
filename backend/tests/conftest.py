import os
import sys
import pathlib
import pytest
from contextlib import contextmanager

# Ensure project root on sys.path for 'app' imports when running in ephemeral test container
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from app.db.session import Base, get_db
from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from app.main import app

# Use in-memory SQLite for fast unit tests (override DATABASE_URL env before imports that use it)
TEST_DB_URL = os.getenv("TEST_DB_URL") or "sqlite+pysqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    """Provide a database engine.

    For SQLite (in-memory) we still use metadata.create_all for speed.
    For Postgres (or any non-sqlite URL) we apply Alembic migrations so that
    tests exercise the same schema production uses and detect drift between
    models and migrations (e.g., missing columns like notifications.message).
    """
    if TEST_DB_URL.startswith("sqlite"):
        eng = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

        # Enable foreign keys in SQLite
        @event.listens_for(eng, "connect")
        def _fk_on(dbapi_connection, connection_record):  # type: ignore
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(eng)
    else:
        eng = create_engine(TEST_DB_URL)
        # Run Alembic migrations instead of create_all
        # Configure Alembic programmatically pointing to the alembic.ini in project root
        alembic_cfg = AlembicConfig(str(ROOT / "alembic.ini"))
        # Override the SQLAlchemy URL dynamically (alembic.ini might point to prod DB)
        alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
        alembic_command.upgrade(alembic_cfg, "head")
    yield eng
    eng.dispose()


@pytest.fixture(scope="function")
def db_session(engine):
    # Ensure clean slate for each test when using a real RDBMS (other helper code / concurrency tests
    # may have committed via separate connections). We truncate outside the rollback-scoped
    # transaction so changes made by the test are still rolled back afterwards.
    if not TEST_DB_URL.startswith("sqlite"):
        from sqlalchemy import text as _text

        with engine.begin() as cleanup_conn:  # autocommit context
            table_names = [t.name for t in Base.metadata.sorted_tables]
            if table_names:
                cleanup_conn.exec_driver_sql(
                    "TRUNCATE "
                    + ", ".join(f'"{n}"' for n in table_names)
                    + " RESTART IDENTITY CASCADE;"
                )
    connection = engine.connect()
    trans = connection.begin()
    TestingSessionLocal = sessionmaker(
        bind=connection, autoflush=False, autocommit=False
    )
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
    u = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def create_company(session, code="C001", credit_date=None, promise_date=None):
    c = Company(
        code=code,
        name=code,
        area="A",
        credit_date=credit_date,
        promise_date=promise_date,
        amount=0,
        outbal=0,
        is_archived=False,
    )
    session.add(c)
    session.commit()
    return c


def create_bill(
    session, company_code="C001", bill_number="B1", amount=100, days_due=10
):
    from decimal import Decimal

    today = date.today()
    b = Bill(
        bill_number=bill_number,
        company_code=company_code,
        bill_date=today,
        due_date=today + timedelta(days=days_due),
        amount=Decimal(str(amount)),
        amount_paid=0,
        status=BillStatus.pending,
        is_archived=False,
    )
    session.add(b)
    session.commit()
    session.refresh(b)
    return b


def auth_header(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# Time freeze fixture for deterministic notification cadence tests
@pytest.fixture()
def freeze_time(monkeypatch):
    from datetime import datetime, timedelta
    import app.services.notifications as notif_mod

    class FrozenDateTime(type(datetime)):
        _now = datetime.utcnow()

        @classmethod
        def utcnow(cls):
            return cls._now

        @classmethod
        def now(cls, tz=None):
            if tz:
                return cls._now.astimezone(tz)
            return cls._now

    # Patch the module-level datetime reference
    monkeypatch.setattr(notif_mod, "datetime", FrozenDateTime)

    def _advance(hours=0, minutes=0):
        FrozenDateTime._now = FrozenDateTime._now + timedelta(
            hours=hours, minutes=minutes
        )

    return _advance
