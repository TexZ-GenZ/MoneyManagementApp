from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import redis
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


# Initialize Redis connection
def get_redis_client():
    """Get Redis client for rate limiting"""
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        # Test the connection
        redis_client.ping()
        return redis_client
    except redis.ConnectionError:
        logger.warning(
            "Could not connect to Redis. Rate limiting will fall back to in-memory storage."
        )
        return None
    except Exception as e:
        logger.error(f"Error initializing Redis: {e}")
        return None


# Initialize rate limiter
redis_client = get_redis_client()

# Create limiter with Redis backend if available, otherwise use in-memory
if redis_client:
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=settings.REDIS_URL,
        default_limits=[settings.RATE_LIMIT_GENERAL],
    )
    logger.info("Rate limiting initialized with Redis backend")
else:
    # Fallback to in-memory rate limiting (not recommended for production)
    limiter = Limiter(
        key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_GENERAL]
    )
    logger.warning(
        "Rate limiting initialized with in-memory backend (not suitable for production)"
    )


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
    storage_uri=settings.REDIS_URL if redis_client else None,
    default_limits=[settings.RATE_LIMIT_GENERAL],
)
