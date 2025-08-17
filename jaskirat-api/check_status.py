#!/usr/bin/env python3

import os
import sys


def check_project_status():
    """Check the status of the Jaskirat Textiles API project"""

    print("🔍 Jaskirat Textiles API - Project Status Check")
    print("=" * 60)

    # Project structure check
    required_files = [
        "app/main.py",
        "app/config.py",
        "app/database.py",
        "app/models.py",
        "app/schemas.py",
        "app/auth_service.py",
        "app/api/auth.py",
        "app/api/users.py",
        "app/api/companies.py",
        "app/api/bills.py",
        "app/api/payments.py",
        "app/api/notifications.py",
        "init_db.py",
        "requirements.txt",
        ".env.example",
        "Dockerfile",
        "docker-compose.yml",
        "README.md",
        "AWS_DEPLOYMENT.md",
    ]

    print("\n📁 Project Structure:")
    missing_files = []
    for file in required_files:
        if os.path.exists(file):
            print(f"   ✅ {file}")
        else:
            print(f"   ❌ {file}")
            missing_files.append(file)

    # Environment check
    print("\n🔧 Environment Setup:")
    if os.path.exists(".env"):
        print("   ✅ .env file exists")
    else:
        print("   ⚠️  .env file not found (copy from .env.example)")

    if os.path.exists("venv") or os.path.exists("env"):
        print("   ✅ Virtual environment detected")
    else:
        print("   ⚠️  Virtual environment not found")

    # Dependencies check
    print("\n📦 Dependencies:")
    try:
        import fastapi

        print(f"   ✅ FastAPI {fastapi.__version__}")
    except ImportError:
        print("   ❌ FastAPI not installed")

    try:
        import sqlalchemy

        print(f"   ✅ SQLAlchemy {sqlalchemy.__version__}")
    except ImportError:
        print("   ❌ SQLAlchemy not installed")

    try:
        import asyncpg

        print("   ✅ asyncpg installed")
    except ImportError:
        print("   ❌ asyncpg not installed")

    try:
        import jose

        print("   ✅ python-jose installed")
    except ImportError:
        print("   ❌ python-jose not installed")

    # Database check
    print("\n🗄️  Database:")
    try:
        from app.database import engine

        print("   ✅ Database configuration loaded")
    except Exception as e:
        print(f"   ❌ Database configuration error: {e}")

    # API endpoints summary
    print("\n🌐 API Endpoints Summary:")
    endpoints = [
        "POST /api/auth/login - User authentication",
        "GET  /api/auth/me - Current user info",
        "GET  /api/users - User management",
        "GET  /api/companies - Company management",
        "GET  /api/bills - Bill management",
        "GET  /api/payments - Payment processing",
        "GET  /api/notifications - Notification system",
    ]

    for endpoint in endpoints:
        print(f"   📌 {endpoint}")

    # Demo credentials
    print("\n🔑 Demo Credentials:")
    credentials = [
        "Admin:      admin@jaskirat.com / admin123",
        "Accountant: accountant@jaskirat.com / acc123",
        "Executive:  executive@jaskirat.com / exec123",
    ]

    for cred in credentials:
        print(f"   👤 {cred}")

    # Quick start commands
    print("\n🚀 Quick Start Commands:")
    print("   1. Install dependencies:  pip install -r requirements.txt")
    print("   2. Initialize database:   python init_db.py")
    print("   3. Start server:          uvicorn app.main:app --reload")
    print("   4. Or use:                python start.bat (Windows)")
    print("   5. Docker:                docker-compose up -d")
    print("   6. Test API:              python test_api.py")

    # Status summary
    print("\n" + "=" * 60)
    if missing_files:
        print(f"⚠️  Project Status: INCOMPLETE - {len(missing_files)} files missing")
        print("   Missing files:", ", ".join(missing_files))
    else:
        print("✅ Project Status: COMPLETE - All files present")

    print("📖 Documentation: http://localhost:8000/docs")
    print("🔗 Frontend Repository: ../JaskiratTextiles")


if __name__ == "__main__":
    check_project_status()
