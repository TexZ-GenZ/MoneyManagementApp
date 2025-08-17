import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_factory, engine
from app.models import Base, User, Company, Bill, UserRole, BillStatus
from app.auth_service import AuthService
from datetime import datetime, timedelta
from decimal import Decimal


async def create_tables():
    """Create all database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully")


async def create_initial_users():
    """Create initial users with demo credentials"""
    async with async_session_factory() as session:
        # Check if users already exist
        from sqlalchemy import select

        result = await session.execute(select(User))
        existing_users = result.scalars().all()

        if existing_users:
            print("ℹ️  Users already exist, skipping user creation")
            return

        # Create demo users
        users_data = [
            {
                "name": "Admin User",
                "phone": "9876543210",
                "password": "admin123",
                "role": UserRole.ADMIN,
            },
            {
                "name": "Accountant User",
                "phone": "9876543211",
                "password": "acc123",
                "role": UserRole.ACCOUNTANT,
            },
            {
                "name": "Executive User",
                "phone": "9876543212",
                "password": "exec123",
                "role": UserRole.EXECUTIVE,
            },
            {
                "name": "Ravi Kumar",
                "phone": "9876543213",
                "password": "ravi123",
                "role": UserRole.EXECUTIVE,
            },
            {
                "name": "Sunita Sharma",
                "phone": "9876543214",
                "password": "sunita123",
                "role": UserRole.EXECUTIVE,
            },
        ]

        for user_data in users_data:
            hashed_password = AuthService.get_password_hash(user_data["password"])
            user = User(
                name=user_data["name"],
                phone=user_data["phone"],
                hashed_password=hashed_password,
                role=user_data["role"],
            )
            session.add(user)

        await session.commit()
        print("✅ Demo users created successfully")


async def create_demo_companies():
    """Create demo companies using the new business model"""
    async with async_session_factory() as session:
        # Check if companies already exist
        from sqlalchemy import select

        result = await session.execute(select(Company))
        existing_companies = result.scalars().all()

        if existing_companies:
            print("ℹ️  Companies already exist, skipping company creation")
            return

        # Get an executive user for assignment
        result = await session.execute(
            select(User).where(User.role == UserRole.EXECUTIVE)
        )
        executives = result.scalars().all()

        if not executives:
            print("❌ No executive users found, cannot assign companies.")
            return

        # Create demo companies using the textile business model
        companies_data = [
            {
                "code": "ABC001",
                "account_n": "ABC Textiles Ltd",
                "area": "Ludhiana North",
                "outbal": Decimal("15000.00"),
                "amount": Decimal("45000.00"),
                "promise_date": datetime.now() + timedelta(days=7),
                "credit_date": datetime.now() + timedelta(days=30),
                "location": "Industrial Area, Phase 1, Ludhiana, Punjab",
                "phone": "+91-9876543213",
                "address": "123 Industrial Area, Phase 1, Ludhiana, Punjab",
            },
            {
                "code": "XYZ002",
                "account_n": "XYZ Garments Pvt Ltd",
                "area": "Ludhiana South",
                "outbal": Decimal("8000.00"),
                "amount": Decimal("25000.00"),
                "promise_date": datetime.now() + timedelta(days=5),
                "credit_date": datetime.now() + timedelta(days=25),
                "location": "Market Street, Sector 2, Ludhiana, Punjab",
                "phone": "+91-9876543214",
                "address": "456 Market Street, Sector 2, Ludhiana, Punjab",
            },
            {
                "code": "MOD003",
                "account_n": "Modern Fabrics Inc",
                "area": "Ludhiana East",
                "outbal": Decimal("22000.00"),
                "amount": Decimal("67000.00"),
                "promise_date": datetime.now() + timedelta(days=10),
                "credit_date": datetime.now() + timedelta(days=35),
                "location": "Textile Hub, Block C, Ludhiana, Punjab",
                "phone": "+91-9876543215",
                "address": "789 Textile Hub, Block C, Ludhiana, Punjab",
            },
            {
                "code": "STAR004",
                "account_n": "Star Exports",
                "area": "Ludhiana West",
                "outbal": Decimal("30000.00"),
                "amount": Decimal("90000.00"),
                "promise_date": datetime.now() + timedelta(days=12),
                "credit_date": datetime.now() + timedelta(days=40),
                "location": "Export Park, Phase 3, Ludhiana, Punjab",
                "phone": "+91-9876543216",
                "address": "101 Export Park, Phase 3, Ludhiana, Punjab",
            },
            {
                "code": "ROYAL005",
                "account_n": "Royal Knitwears",
                "area": "Ludhiana Central",
                "outbal": Decimal("12000.00"),
                "amount": Decimal("35000.00"),
                "promise_date": datetime.now() + timedelta(days=8),
                "credit_date": datetime.now() + timedelta(days=28),
                "location": "Fashion Street, Miller Ganj, Ludhiana, Punjab",
                "phone": "+91-9876543217",
                "address": "202 Fashion Street, Miller Ganj, Ludhiana, Punjab",
            },
            {
                "code": "PRM006",
                "account_n": "Premium Threads",
                "area": "Ludhiana North",
                "outbal": Decimal("50000.00"),
                "amount": Decimal("150000.00"),
                "promise_date": datetime.now() + timedelta(days=15),
                "credit_date": datetime.now() + timedelta(days=50),
                "location": "Garment Complex, Focal Point, Ludhiana, Punjab",
                "phone": "+91-9876543218",
                "address": "303 Garment Complex, Focal Point, Ludhiana, Punjab",
            },
        ]

        for i, company_data in enumerate(companies_data):
            executive = executives[i % len(executives)]
            company_data["assigned_executive_id"] = executive.id
            company = Company(**company_data)
            session.add(company)

        await session.commit()
        print("✅ Demo companies created successfully")


async def create_demo_bills():
    """Create demo bills using the new business model"""
    async with async_session_factory() as session:
        # Check if bills already exist
        from sqlalchemy import select

        result = await session.execute(select(Bill))
        existing_bills = result.scalars().all()

        if existing_bills:
            print("ℹ️  Bills already exist, skipping bill creation")
            return

        # Get companies
        result = await session.execute(select(Company))
        companies = result.scalars().all()

        if not companies:
            print("❌ No companies found, cannot create demo bills")
            return

        # Create demo bills using company codes
        bills_data = [
            {
                "bill_number": "JT-2024-001",
                "company_code": "ABC001",
                "amount": Decimal("50000.00"),
                "debit": Decimal("50000.00"),
                "date": datetime.now() - timedelta(days=15),
                "due_date": datetime.now() + timedelta(days=30),
                "description": "Cotton fabric supply - January 2024",
                "status": BillStatus.PENDING,
            },
            {
                "bill_number": "JT-2024-002",
                "company_code": "XYZ002",
                "amount": Decimal("75000.00"),
                "debit": Decimal("75000.00"),
                "date": datetime.now() - timedelta(days=10),
                "due_date": datetime.now() + timedelta(days=15),
                "description": "Polyester blend fabric - February 2024",
                "status": BillStatus.PENDING,
            },
            {
                "bill_number": "JT-2024-003",
                "company_code": "MOD003",
                "amount": Decimal("25000.00"),
                "debit": Decimal("25000.00"),
                "date": datetime.now() - timedelta(days=40),
                "due_date": datetime.now() - timedelta(days=5),  # Overdue
                "description": "Silk fabric order - December 2023",
                "status": BillStatus.OVERDUE,
            },
        ]

        for bill_data in bills_data:
            bill = Bill(**bill_data)
            session.add(bill)

        await session.commit()
        print("✅ Demo bills created successfully")


async def main():
    """Main initialization function"""
    print("🚀 Starting database initialization...")

    try:
        await create_tables()
        await create_initial_users()
        await create_demo_companies()
        await create_demo_bills()

        print("\n✅ Database initialization completed successfully!")
        print("\n📋 Demo Login Credentials:")
        print("   Admin:      admin@jaskirat.com / admin123")
        print("   Accountant: accountant@jaskirat.com / acc123")
        print("   Executive:  executive@jaskirat.com / exec123")
        print("   Executive:  ravi.k@jaskirat.com / ravi123")
        print("   Executive:  sunita.s@jaskirat.com / sunita123")
        print("\n🌐 API Documentation: http://localhost:8000/docs")

    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
