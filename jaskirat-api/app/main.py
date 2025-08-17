from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base
from app.api import auth, users, companies, bills, payments, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting Jaskirat Textiles API...")

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Shutdown
    print("⭐ Shutting down Jaskirat Textiles API...")


# Create FastAPI app
app = FastAPI(
    title="Jaskirat Textiles API",
    description="Payment Collection System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add CORS middleware - Updated for Expo Go compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add trusted host middleware for production
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["jaskirat-api.com", "*.jaskirat-api.com"]
    )

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(bills.router, prefix="/api/bills", tags=["Bills"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(
    notifications.router, prefix="/api/notifications", tags=["Notifications"]
)


@app.get("/")
async def root():
    return {
        "message": "Jaskirat Textiles Payment Collection API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
    }


# Add OPTIONS handler for preflight requests
@app.options("/{full_path:path}")
async def options_handler():
    return {"message": "OK"}
