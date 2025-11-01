#!/usr/bin/env sh
set -e

# Run database migrations if alembic config present
if [ -f /app/alembic.ini ]; then
	echo "Running Alembic migrations..."

	# Wait for the database to be reachable (useful on PaaS like Railway where DB can wake slowly)
	python - <<'PY'
import os, time
from sqlalchemy import create_engine, text

url = os.environ.get("DATABASE_URL", "")
# Normalize driver for psycopg v3
# NOTE: previous indentation caused a SyntaxError in some shells; use proper left alignment
if url.startswith("postgres://"):
	url = url.replace("postgres://", "postgresql+psycopg://", 1)
elif url.startswith("postgresql://") and "+psycopg" not in url:
	url = url.replace("postgresql://", "postgresql+psycopg://", 1)

# Optionally force SSL when provider requires it (e.g., Railway)
if os.environ.get("FORCE_DB_SSL", "false").lower() == "true" and "sslmode=" not in url:
	url = f"{url}{'&' if '?' in url else '?'}sslmode=require"

# Optionally add/connect timeout if none provided
if "connect_timeout=" not in url:
	url = f"{url}{'&' if '?' in url else '?'}connect_timeout=10"

attempts = int(os.environ.get("DB_WAIT_ATTEMPTS", "30"))
delay = float(os.environ.get("DB_WAIT_DELAY", "2"))
for i in range(1, attempts + 1):
	try:
		engine = create_engine(url, pool_pre_ping=True)
		with engine.connect() as conn:
			conn.execute(text("SELECT 1"))
		print("Database connection ready")
		break
	except Exception as e:
		if i == attempts:
			print("Database not ready:", e)
			raise
		print(f"Waiting for database... ({i}/{attempts})")
		time.sleep(delay)
PY

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
