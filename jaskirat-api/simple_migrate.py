#!/usr/bin/env python3
"""
Simple migration script to run directly
"""

import psycopg2
import sys


def migrate_database():
    """Run the database migration"""
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            database="jaskirat_db",
            user="jaskirat",
            password="password",
        )

        cur = conn.cursor()

        print("🔄 Starting company schema migration...")

        # Step 1: Add new columns
        print("1️⃣ Adding new columns...")
        cur.execute(
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

        # Step 2: Populate new columns with default data
        print("2️⃣ Populating new columns...")
        cur.execute(
            """
            UPDATE companies 
            SET 
                code = 'C' || LPAD(id::text, 4, '0'),
                account_n = name,
                area = 'Default Area',
                outbal = 0.00,
                amount = 0.00
            WHERE code IS NULL;
        """
        )

        # Step 3: Make code NOT NULL and add unique constraint
        print("3️⃣ Adding constraints...")
        cur.execute("ALTER TABLE companies ALTER COLUMN code SET NOT NULL;")

        try:
            cur.execute(
                "ALTER TABLE companies ADD CONSTRAINT companies_code_unique UNIQUE (code);"
            )
        except:
            print("Code constraint already exists")

        # Step 4: Update bills table
        print("4️⃣ Updating bills table...")
        cur.execute(
            "ALTER TABLE bills ADD COLUMN IF NOT EXISTS company_code VARCHAR(20);"
        )

        cur.execute(
            """
            UPDATE bills 
            SET company_code = companies.code
            FROM companies 
            WHERE bills.company_id = companies.id
            AND bills.company_code IS NULL;
        """
        )

        # Step 5: Add foreign key constraints
        print("5️⃣ Adding foreign key constraints...")
        try:
            cur.execute(
                """
                ALTER TABLE bills 
                ADD CONSTRAINT bills_company_code_fkey 
                FOREIGN KEY (company_code) REFERENCES companies(code);
            """
            )
        except:
            print("Bills FK constraint already exists")

        try:
            cur.execute(
                """
                ALTER TABLE companies 
                ADD CONSTRAINT companies_assigned_executive_fkey 
                FOREIGN KEY (assigned_executive_id) REFERENCES users(id);
            """
            )
        except:
            print("Executive FK constraint already exists")

        conn.commit()
        print("✅ Migration completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    migrate_database()
