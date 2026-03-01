from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Use in-memory rate limiting only.
limiter = Limiter(
    key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_GENERAL]
)
logger.info("Rate limiting initialized with in-memory backend")


# Custom rate limit exceeded handler
async def rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded responses"""
    logger.warning(
        f"Rate limit exceeded for {get_remote_address(request)}: {exc.detail}"
    )

    # Extract retry_after from the exception detail if available
    retry_after = 60  # Default retry after 60 seconds
    try:
        # Try to parse retry_after from exception detail if it's formatted properly
        if hasattr(exc, "retry_after"):
            retry_after = exc.retry_after
        elif "Retry after" in str(exc.detail):
            # Try to extract from detail string
            import re

            match = re.search(r"Retry after (\d+)", str(exc.detail))
            if match:
                retry_after = int(match.group(1))
    except (AttributeError, ValueError):
        pass

    from fastapi import HTTPException
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": f"Too many requests. Retry after {retry_after} seconds.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


# Helper function to get client identifier for rate limiting
def get_client_identifier(request):
    """Get client identifier for rate limiting (IP address or user ID if authenticated)"""
    # Try to get user ID from JWT token in Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from jose import jwt
            from app.core.config import settings

            token = auth_header.split(" ")[1]
            payload = jwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            # If token is invalid or expired, fall back to IP
            pass

    # Fall back to IP address
    return get_remote_address(request)


# Create a custom limiter for user-based rate limiting
user_limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=[settings.RATE_LIMIT_GENERAL],
)
