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
	* Automatic background scan thread (interval configurable via settings) for promise/credit date breaches.
	* Payment review notifications for payments awaiting approval.
	* Manual trigger: `POST /admin/notifications/scan`.
	* Acknowledge endpoint: `POST /notifications/{id}/ack`.
	* Filtering on `/notifications` (status, type, company_code).

## Roadmap

## API Endpoints & Error Codes

### Auth
- `POST /auth/login` — Login, returns JWT token. Errors: 401 for invalid credentials or inactive user.

### Companies
- `GET /companies` — List companies. Supports filtering, pagination.
- `GET /companies/{code}/dashboard` — Company dashboard with pending/paid bills, summary.
- `PATCH /companies/{code}/promise` — Update promise date (forward-only, >= credit date). Errors: 400 for invalid date.
- `PATCH /companies/{code}/credit` — Update credit date. Errors: 400 for invalid date.

### Bills
- `GET /bills` — List bills. Supports filtering, sorting, pagination.

### Payments
- `POST /payments` — Submit payment with bill allocations. Errors: 400 for invalid allocation, negative/zero amount, duplicate bills, out-of-range geo, etc. 409 for idempotency key conflict.
- `POST /accountant/payments/{id}/approve|decline` — Accountant approval/decline. Errors: 400 for invalid state.
- `POST /admin/payments/{id}/approve|decline` — Admin approval/decline. Errors: 400 for invalid state.

### Notifications
- `GET /notifications` — List notifications. Supports filtering by status, type, company_code.
- `POST /admin/notifications/scan` — Manual notification scan trigger.
- `POST /notifications/{id}/ack` — Acknowledge notification.

### Settings
- `GET /settings` — Get current settings.
- `PATCH /settings` — Update settings. Errors: 400 for invalid values.

## Error Codes
- 400 Bad Request: Invalid input, business rule violation.
- 401 Unauthorized: Missing/invalid token, inactive user.
- 403 Forbidden: Insufficient role/privileges.
- 404 Not Found: Resource does not exist.
- 409 Conflict: Idempotency key or allocation conflict.

## Business Logic Highlights
- Promise date can only move forward and must be >= credit date.
- Payment allocations must match amount collected and not exceed bill remaining.
- Notifications are auto-generated for promise/credit date breaches and pending payment reviews, and are suppressed/resolved when business rules are satisfied.
- Role-based access for payment approval and settings management.

## Roadmap
...existing code...
