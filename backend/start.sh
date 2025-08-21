#!/usr/bin/env sh
set -e

# Run database migrations
alembic upgrade head

# Default port if Railway (or other PaaS) does not inject one
PORT=${PORT:-8000}
# Allow override of worker count; default modest for small container
WORKERS=${WORKERS:-2}

echo "Starting API on port ${PORT} with ${WORKERS} workers"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers "$WORKERS"
