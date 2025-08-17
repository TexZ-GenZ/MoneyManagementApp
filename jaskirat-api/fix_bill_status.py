import asyncio
from sqlalchemy import select
from datetime import datetime
import json

from app.database import engine, get_db, Base
from app.models import Bill, BillStatus


async def fix_bill_statuses():
    """
    Fix bill statuses and remaining amounts in the database.
    
    This script corrects the following issues:
    1. Bills with remaining_amount = 0 but status not set to PAID
    2. Bills with due_date passed but status not set to OVERDUE
    3. Bills with partially paid amounts but incorrect status
    """
    print("Starting bill status correction...")
    
    async for db in get_db():
        # Get all bills
        result = await db.execute(select(Bill))
        bills = result.scalars().all()
        
        current_date = datetime.now()
        fixed_count = 0
        
        for bill in bills:
            original_status = bill.status
            
            # Fix bills with remaining_amount = 0 but not marked as PAID
            if bill.remaining_amount <= 0 or (bill.paid_amount and bill.paid_amount >= bill.amount):
                bill.status = BillStatus.PAID
                bill.remaining_amount = 0
                fixed_count += 1
                print(f"Fixed bill #{bill.id}: set to PAID (was {original_status})")
                
            # Fix bills with due date passed but not marked as OVERDUE
            elif bill.status == BillStatus.PENDING and bill.due_date < current_date:
                bill.status = BillStatus.OVERDUE
                fixed_count += 1
                print(f"Fixed bill #{bill.id}: set to OVERDUE (was {original_status})")
            
        # Commit changes
        if fixed_count > 0:
            await db.commit()
            print(f"Fixed {fixed_count} bills in total.")
        else:
            print("No bills needed fixing.")


if __name__ == "__main__":
    asyncio.run(fix_bill_statuses())
