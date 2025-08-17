"""
Fix bill statuses in the database directly using SQL.
This script fixes issues after removing the PARTIALLY_PAID status.
"""
import asyncio
import asyncpg
from datetime import datetime

# Database connection parameters (from docker-compose.yml)
DB_HOST = "postgres"
DB_PORT = 5432
DB_USER = "jaskirat"
DB_PASSWORD = "password"
DB_NAME = "jaskirat_db"

async def fix_bills():
    # Connect to database
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    print("Connected! Fixing bill statuses...")
    
    # Get current date for overdue check
    current_date = datetime.now().isoformat()
    
    # Update bills with PARTIALLY_PAID status to PENDING
    partially_paid_count = await conn.execute(
        "UPDATE bills SET status = 'pending' WHERE status = 'partially_paid'"
    )
    print(f"Updated partially paid bills to pending: {partially_paid_count}")
    
    # Fix bills with remaining_amount = 0 to be marked as PAID
    fixed_paid_count = await conn.execute(
        "UPDATE bills SET status = 'paid' WHERE remaining_amount <= 0 OR paid_amount >= amount"
    )
    print(f"Fixed bills with zero remaining to paid status: {fixed_paid_count}")
    
    # Update bills with due_date passed to OVERDUE (only for PENDING bills)
    fixed_overdue_count = await conn.execute(
        "UPDATE bills SET status = 'overdue' WHERE status = 'pending' AND due_date < $1",
        current_date
    )
    print(f"Updated overdue bills: {fixed_overdue_count}")
    
    # Check if we have any bills left in inconsistent state
    inconsistent = await conn.fetch(
        "SELECT id, bill_number, company_code, amount, remaining_amount, status FROM bills WHERE "
        "(remaining_amount <= 0 AND status <> 'paid') OR "
        "(remaining_amount > 0 AND status = 'paid')"
    )
    
    if inconsistent:
        print(f"\nFound {len(inconsistent)} bills still in inconsistent state:")
        for bill in inconsistent:
            print(f"Bill #{bill['id']}: {bill['bill_number']} - Status: {bill['status']} - "
                  f"Amount: {bill['amount']} - Remaining: {bill['remaining_amount']}")
    else:
        print("\nAll bills are now in consistent state!")
    
    # Close connection
    await conn.close()
    print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(fix_bills())
