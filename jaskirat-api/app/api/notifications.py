from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models import Notification, User, UserRole
from app.schemas import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    ResponseModel,
)
from app.api.auth import get_current_user, require_roles

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's notifications"""
    query = select(Notification).where(Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.offset(skip).limit(limit).order_by(Notification.created_at.desc())

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationResponse.model_validate(notification)
        for notification in notifications
    ]


@router.post("/", response_model=NotificationResponse)
async def create_notification(
    notification_data: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.ACCOUNTANT])),
):
    """Create new notification (Admin/Accountant only)"""
    # Check if target user exists
    result = await db.execute(select(User).where(User.id == notification_data.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Create new notification
    db_notification = Notification(**notification_data.model_dump())
    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)

    return NotificationResponse.model_validate(db_notification)


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification by ID"""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Users can only view their own notifications
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this notification",
        )

    return NotificationResponse.model_validate(notification)


@router.put("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    notification_data: NotificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification (mark as read/unread)"""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Users can only update their own notifications
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this notification",
        )

    # Update notification fields
    update_data = notification_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notification, field, value)

    await db.commit()
    await db.refresh(notification)

    return NotificationResponse.model_validate(notification)


@router.delete("/{notification_id}", response_model=ResponseModel)
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete notification"""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Users can only delete their own notifications, or admin can delete any
    if notification.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this notification",
        )

    await db.delete(notification)
    await db.commit()

    return ResponseModel(success=True, message="Notification deleted successfully")


@router.post("/mark-all-read", response_model=ResponseModel)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Mark all user's notifications as read"""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id, Notification.is_read == False
        )
    )
    notifications = result.scalars().all()

    for notification in notifications:
        notification.is_read = True

    await db.commit()

    return ResponseModel(
        success=True, message=f"Marked {len(notifications)} notifications as read"
    )


@router.get("/unread/count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications"""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id, Notification.is_read == False
        )
    )
    count = result.scalar()

    return {"unread_count": count}


@router.post("/broadcast", response_model=ResponseModel)
async def broadcast_notification(
    title: str,
    message: str,
    notification_type: str,
    target_roles: Optional[List[UserRole]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Broadcast notification to multiple users (Admin only)"""
    # Get target users
    query = select(User).where(User.is_active == True)

    if target_roles:
        query = query.where(User.role.in_(target_roles))

    result = await db.execute(query)
    users = result.scalars().all()

    # Create notifications for all target users
    notifications = []
    for user in users:
        notification = Notification(
            user_id=user.id, title=title, message=message, type=notification_type
        )
        notifications.append(notification)
        db.add(notification)

    await db.commit()

    return ResponseModel(
        success=True,
        message=f"Broadcast notification sent to {len(notifications)} users",
    )
