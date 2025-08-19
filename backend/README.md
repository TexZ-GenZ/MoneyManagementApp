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

## Notes
- Import endpoints are stubbed for now; extend to parse DBF or CSV.
- Background notifications are not implemented in this MVP.
