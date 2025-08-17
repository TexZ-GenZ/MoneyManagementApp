"""
Fix bill status enum type in the database.
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

async def fix_enum():
    # Connect to database
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    print("Connected! Starting transaction...")
    
    try:
        # Start transaction
        async with conn.transaction():
            # First update all partially_paid bills to pending
            # (need to do this with direct update to bypass enum check)
            print("Converting partially_paid status to pending...")
            result = await conn.execute("""
                UPDATE bills SET status = 'pending'::"billstatus"
                WHERE status::text = 'partially_paid'
            """)
            print(f"Updated {result} bills.")
            
            # Create new enum type without partially_paid
            print("Creating new enum type...")
            await conn.execute("""
                CREATE TYPE billstatus_new AS ENUM ('pending', 'paid', 'overdue');
            """)
            
            # Convert column to use the new enum type
            print("Converting column to use new enum type...")
            await conn.execute("""
                ALTER TABLE bills
                ALTER COLUMN status TYPE billstatus_new
                USING status::text::billstatus_new;
            """)
            
            # Drop old type and rename new one
            print("Dropping old enum type and renaming new one...")
            await conn.execute("""
                DROP TYPE billstatus;
                ALTER TYPE billstatus_new RENAME TO billstatus;
            """)
            
            print("Now updating bill statuses based on amounts...")
            # Fix bills with remaining_amount = 0 to be marked as PAID
            paid_count = await conn.execute("""
                UPDATE bills SET status = 'paid'::billstatus
                WHERE remaining_amount <= 0 OR paid_amount >= amount
            """)
            print(f"Updated {paid_count} bills to 'paid' status.")
            
            # Update bills with due_date passed to OVERDUE (only for PENDING bills)
            current_date = datetime.now().isoformat()
            overdue_count = await conn.execute("""
                UPDATE bills SET status = 'overdue'::billstatus
                WHERE status = 'pending'::billstatus AND due_date < $1
            """, current_date)
            print(f"Updated {overdue_count} bills to 'overdue' status.")
            
        # Get final bill counts by status
        print("\nFinal bill status counts:")
        statuses = await conn.fetch("SELECT status, COUNT(*) FROM bills GROUP BY status")
        for status in statuses:
            print(f"  {status['status']}: {status['count']} bills")
            
        # Check for any remaining inconsistencies
        inconsistent = await conn.fetch("""
            SELECT id, bill_number, company_code, amount, remaining_amount, status 
            FROM bills WHERE 
                (remaining_amount <= 0 AND status::text <> 'paid') OR
                (remaining_amount > 0 AND status::text = 'paid')
        """)
        
        if inconsistent:
            print(f"\nFound {len(inconsistent)} bills still in inconsistent state:")
            for bill in inconsistent:
                print(f"Bill #{bill['id']}: {bill['bill_number']} - Status: {bill['status']} - "
                      f"Amount: {bill['amount']} - Remaining: {bill['remaining_amount']}")
        else:
            print("\nAll bills are now in consistent state!")
        
        print("\nSchema update and data fix completed successfully!")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Close connection
        await conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(fix_enum())
