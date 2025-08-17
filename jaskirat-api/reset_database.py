import asyncio
from app.database import engine
from app.models import Base
import init_db

async def reset_database():
    """Drops all tables and re-initializes the database"""
    print("🔥 Dropping all database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("✅ All tables dropped successfully.")

    print("\n🚀 Re-initializing database with demo data...")
    await init_db.main()

if __name__ == "__main__":
    asyncio.run(reset_database())
