# Jaskirat Textiles API (FastAPI + Postgres)

This is a minimal working backend implementing companies, bills, payments with approvals, and settings.

## Run locally (Docker)

1. Copy `.env.example` to `.env` and adjust if needed.
2. Start services:

```powershell
# Windows PowerShell
docker compose up --build
```

3. Open API docs: http://localhost:8000/docs

Default admin credentials: admin / admin

## Initial entities
- Admin user is seeded on startup.
- Settings row is created with defaults from `.env`.

## Postman
Import `Jaskirat.postman_collection.json` and run:
- Health
- Auth Login (use admin/admin)

Use the Bearer token to call secured endpoints.

## Features
- Companies & Bills imported from legacy DBF files (`master.dbf`, `transactions.dbf`).
- Automatic recalculation of company `amount`, `outbal`, and `credit_date` after imports & approved payments.
- Promise date initialization (first time) and guarded forward-only updates via payment `next_promise_date` (cannot move backward or before credit date).
- Payment workflow: submit -> accountant approve/decline -> admin approve/decline with idempotency key support.
- Bill allocation validation with reservation logic to avoid double allocation across pending payments.
- Dashboard endpoint: `/companies/{code}/dashboard` aggregates pending & paid bills with company summary.
- Notification system:
	* Automatic background scan thread (interval configurable via settings) for promise/credit date breaches.
	* Payment review notifications for payments awaiting approval.
	* Manual trigger: `POST /admin/notifications/scan`.
	* Acknowledge endpoint: `POST /notifications/{id}/ack`.
	* Filtering on `/notifications` (status, type, company_code).
- Settings management for credit extension days & notification cadence.

## Roadmap
- Replace simple background thread with APScheduler or external job runner for multi-instance deployments.
- Add tests (imports idempotency, payment allocation edge cases, notification scans).
- Add CSV export & WebSocket push for notifications.
- Harden auth (refresh tokens, rate limiting).
