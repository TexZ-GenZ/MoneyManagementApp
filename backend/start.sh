#!/usr/bin/env sh
set -e

# Run database migrations if alembic config present
if [ -f /app/alembic.ini ]; then
	echo "Running Alembic migrations..."
	alembic -c /app/alembic.ini upgrade head || {
		echo "Alembic migration failed" >&2
		exit 1
	}
else
	echo "WARNING: /app/alembic.ini not found; skipping migrations" >&2
fi

# Default port if Railway (or other PaaS) does not inject one
PORT=${PORT:-8000}
# Allow override of worker count; default modest for small container
WORKERS=${WORKERS:-2}

echo "Starting API on port ${PORT} with ${WORKERS} workers"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers "$WORKERS"
