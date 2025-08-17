#!/usr/bin/env python3
"""
Company Schema Migration Script
Migrates the company table from the old schema to the new textile business schema
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import settings


async def migrate_company_schema():
    """Migrate company table to new textile business schema"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            print("🔄 Starting company schema migration...")

            # Step 1: Drop foreign key constraints
            print("1️⃣ Dropping foreign key constraints...")
            await session.execute(
                text(
                    """
                ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_company_id_fkey;
            """
                )
            )

            # Step 2: Add new columns first
            print("2️⃣ Adding new columns...")
            try:
                await session.execute(
                    text(
                        """
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS code VARCHAR(20),
                    ADD COLUMN IF NOT EXISTS account_n VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS area VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS outbal DECIMAL(15,2),
                    ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2),
                    ADD COLUMN IF NOT EXISTS promise_date DATE,
                    ADD COLUMN IF NOT EXISTS credit_date DATE,
                    ADD COLUMN IF NOT EXISTS location VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS assigned_executive_id INTEGER,
                    ADD COLUMN IF NOT EXISTS last_collection_date DATE;
                """
                    )
                )
                print("✅ New columns added successfully")
            except Exception as e:
                print(f"⚠️ Column addition warning (might already exist): {e}")

            # Step 3: Migrate existing data to new format
            print("3️⃣ Migrating existing data...")
            await session.execute(
                text(
                    """
                UPDATE companies 
                SET 
                    code = COALESCE(code, 'C' || LPAD(id::text, 4, '0')),
                    account_n = COALESCE(account_n, name),
                    area = COALESCE(area, 'Unknown'),
                    outbal = COALESCE(outbal, 0.00),
                    amount = COALESCE(amount, 0.00)
                WHERE code IS NULL OR account_n IS NULL;
            """
                )
            )

            # Step 4: Make code column NOT NULL and unique
            print("4️⃣ Setting up code constraints...")
            await session.execute(
                text(
                    """
                ALTER TABLE companies 
                ALTER COLUMN code SET NOT NULL;
            """
                )
            )

            try:
                await session.execute(
                    text(
                        """
                    ALTER TABLE companies 
                    ADD CONSTRAINT companies_code_unique UNIQUE (code);
                """
                    )
                )
            except Exception as e:
                print(f"⚠️ Constraint warning (might already exist): {e}")

            # Step 5: Update bills table to use company_code instead of company_id
            print("5️⃣ Updating bills table...")
            try:
                await session.execute(
                    text(
                        """
                    ALTER TABLE bills 
                    ADD COLUMN IF NOT EXISTS company_code VARCHAR(20);
                """
                    )
                )

                # Populate company_code from existing company_id relationships
                await session.execute(
                    text(
                        """
                    UPDATE bills 
                    SET company_code = companies.code
                    FROM companies 
                    WHERE bills.company_id = companies.id
                    AND bills.company_code IS NULL;
                """
                    )
                )

            except Exception as e:
                print(f"⚠️ Bills update warning: {e}")

            # Step 6: Add foreign key constraint for new relationship
            print("6️⃣ Adding new foreign key constraints...")
            try:
                await session.execute(
                    text(
                        """
                    ALTER TABLE bills 
                    ADD CONSTRAINT bills_company_code_fkey 
                    FOREIGN KEY (company_code) REFERENCES companies(code);
                """
                    )
                )
            except Exception as e:
                print(f"⚠️ Foreign key warning (might already exist): {e}")

            # Step 7: Add foreign key for executive assignment
            try:
                await session.execute(
                    text(
                        """
                    ALTER TABLE companies 
                    ADD CONSTRAINT companies_assigned_executive_fkey 
                    FOREIGN KEY (assigned_executive_id) REFERENCES users(id);
                """
                    )
                )
            except Exception as e:
                print(f"⚠️ Executive FK warning (might already exist): {e}")

            await session.commit()
            print("✅ Company schema migration completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await engine.dispose()


async def main():
    """Main migration function"""
    try:
        await migrate_company_schema()
        print("🎉 Migration completed successfully!")
    except Exception as e:
        print(f"💥 Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
