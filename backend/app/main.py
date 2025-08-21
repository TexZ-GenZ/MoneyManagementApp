from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from app.api.routes import router
from app.db.session import SessionLocal
from app.models.models import User, Role
from app.services.auth import hash_password
from app.services.company import ensure_settings_row
from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging_config import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[override]
    """Application lifespan manager replacing deprecated startup/shutdown events."""
    configure_logging()
    # Seed admin + settings
    db: Session = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            db.add(
                User(
                    username="admin",
                    password_hash=hash_password("admin"),
                    role=Role.admin,
                    area=None,
                    is_active=True,
                )
            )
        ensure_settings_row(db)
        db.commit()
    except Exception:
        # Likely a race between multiple workers creating admin/settings concurrently.
        db.rollback()
    finally:
        db.close()
    # Start background scheduler
    start_scheduler()
    try:
        yield
    finally:
        # Graceful shutdown
        shutdown_scheduler()


app = FastAPI(title="Jaskirat Textiles API", lifespan=lifespan)
app.include_router(router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
