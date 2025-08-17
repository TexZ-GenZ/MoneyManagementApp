"""
Direct SQL update script to fix bills status based on remaining amount.
"""
import asyncio
import asyncpg

# Database connection parameters (from docker-compose.yml)
DB_HOST = "postgres"
DB_PORT = 5432
DB_USER = "jaskirat"
DB_PASSWORD = "password"
DB_NAME = "jaskirat_db"

async def update_bills():
    # Connect to database
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    print("Connected! Starting updates...")
    
    try:
        # First check current status
        print("\nCurrent bill statuses:")
        bills = await conn.fetch("""
            SELECT id, bill_number, status::text, amount, paid_amount, remaining_amount
            FROM bills
            ORDER BY id
        """)
        
        for bill in bills:
            print(f"Bill ID: {bill['id']} - Amount: {bill['amount']} - Status: {bill['status']} - "
                  f"Paid: {bill['paid_amount']} - Remaining: {bill['remaining_amount']}")
        
        # Update bill statuses directly with SQL
        print("\nUpdating bill statuses...")
        
        # 1. First update bills with zero remaining to PAID
        paid_count = await conn.execute("""
            UPDATE bills 
            SET status = 'paid'
            WHERE remaining_amount <= 0 OR paid_amount >= amount
        """)
        print(f"Updated {paid_count} bills to PAID status")
        
        # 2. Check for partially_paid status and update to pending
        partially_count = await conn.execute("""
            UPDATE bills
            SET status = 'pending'
            WHERE status::text = 'partially_paid'
        """)
        print(f"Updated {partially_count} bills from PARTIALLY_PAID to PENDING")
        
        # Get final bill statuses
        print("\nUpdated bill statuses:")
        updated_bills = await conn.fetch("""
            SELECT id, bill_number, status::text, amount, paid_amount, remaining_amount
            FROM bills
            ORDER BY id
        """)
        
        for bill in updated_bills:
            print(f"Bill ID: {bill['id']} - Amount: {bill['amount']} - Status: {bill['status']} - "
                  f"Paid: {bill['paid_amount']} - Remaining: {bill['remaining_amount']}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Close connection
        await conn.close()
        print("\nDatabase connection closed.")

if __name__ == "__main__":
    asyncio.run(update_bills())
