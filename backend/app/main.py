from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.routes import router
from app.db.session import Base, engine, SessionLocal
from app.models.models import User, Role
from app.services.auth import hash_password
from app.services.company import ensure_settings_row
from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging_config import configure_logging

app = FastAPI(title="Jaskirat Textiles API")
app.include_router(router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_seed():
    configure_logging()
    # Ensure admin user exists
    db: Session = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
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
    finally:
        db.close()
    start_scheduler()


@app.on_event("shutdown")
def shutdown_event():
    shutdown_scheduler()
