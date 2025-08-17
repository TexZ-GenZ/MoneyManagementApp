from fastapi import FastAPI
from app.config import settings
from app.db.session import init_db
from app.api import auth, companies, bills, payments, users, notifications, settings as settings_api

def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)
    init_db()

    app.include_router(auth.router, prefix=settings.API_V1_STR)
    app.include_router(companies.router, prefix=settings.API_V1_STR)
    app.include_router(bills.router, prefix=settings.API_V1_STR)
    app.include_router(payments.router, prefix=settings.API_V1_STR)
    app.include_router(users.router, prefix=settings.API_V1_STR)
    app.include_router(notifications.router, prefix=settings.API_V1_STR)
    app.include_router(settings_api.router, prefix=settings.API_V1_STR)
    return app

app = create_app()
