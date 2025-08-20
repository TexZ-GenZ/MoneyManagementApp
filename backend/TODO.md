# Project TODO (Prioritized Roadmap)

## 1. Schema & Migrations
- [x] Generate new Alembic revision for current models (avoid editing existing 0001 further). (0007 added)
- [x] Add DB indexes:
  - [x] notifications(status, type, company_code, created_at)
  - [x] payments(status, company_code)
  - [x] bills(company_code, status, due_date)
- [x] Add CHECK constraint: promise_date >= credit_date (nullable-safe).
- [x] Replace deprecated `db.query(Model).get(pk)` with `db.get(Model, pk)` everywhere.

## 2. Notifications
- [x] Replace custom thread with APScheduler:
  - [x] Interval job (every `notif_every_hours`) → run_notification_scan
  - [x] Daily job at `payment_notif_daily_hour` (HH) for payment review emphasis
- [x] Implement resend cadence using `last_sent_at` / `next_send_at` fields.
- [x] Prevent duplicate pending notifications (unique partial index or pre-insert check). (Partial index + logic)
- [x] Remove legacy endpoints: `/notifications/pending`, `/admin/notifications/pending`.
- [x] Add endpoint: `/notifications/counts?company_code=...` (aggregate by type/status).
- [x] Structured logging & error handling around scan.

## 3. Business Logic Enhancements
- [x] Enforce promise/credit date rules in PATCH endpoints (forward-only, >= credit_date).
- [x] Recalc + resolve relevant notifications when dates manually updated.
- [x] Executive scoping: executives only see their assigned companies & related notifications.

## 4. Payments
- [x] Concurrency hardening on approve/decline (row lock + affected row check). (Admin approve implemented)
- [x] Enforce allocation sum == amount_collected (not just <=) unless explicit remainder allowed.
- [x] Validate geo coordinates are within valid ranges.

## 5. Imports
- [x] Idempotent optimization: detect unchanged rows & skip updates.
- [x] Batch commits / periodic flush for large files.
- [x] Metric: import duration & record counts (inserted/updated/skipped/archived/seconds).

## 6. Testing (pytest)
- [ ] Core fixtures & config
  - [ ] `conftest.py` with temp SQLite DB, env vars, FastAPI TestClient, db session fixture.
  - [ ] Helper factory functions (create_user, create_company, create_bill, login_token).
- [ ] Payment service / API
  - [ ] Allocation sum mismatch returns 400.
  - [ ] Allocation exceeds remaining (including reserved) returns 400.
  - [ ] Successful submit creates pending payment_review notification (no duplicate on second relevant payment).
  - [ ] Idempotency: same key + identical body returns same payment; same key + different body => 409.
  - [ ] Geo validation rejects out-of-range lat/lng.
- [ ] Promise / Credit date rules
  - [ ] PATCH promise-date backward -> 400.
  - [ ] PATCH promise-date before credit-date -> 400.
  - [ ] Forward update succeeds and triggers recompute + resolves promise_crossed if now in future.
- [ ] Approval flow integration
  - [ ] submit -> accountant approve -> admin approve: bills paid/partial updated, company totals & credit_date recalculated.
  - [ ] Decline paths set correct statuses & stop notifications.
- [ ] Notifications scan
  - [ ] Overdue credit/promise creates promise_crossed notification and resend updates timestamps.
  - [ ] Payment review notifications stopped once payment admin_approved / declined.
- [ ] Imports
  - [ ] First master import: inserted > 0; second import (unchanged) -> mostly skipped.
  - [ ] Transactions import recomputes company totals; rerun mostly skipped.
  - [ ] Archived detection when a record removed between imports.
- [ ] Performance smoke (mark slow) – large synthetic import under threshold (optional, can defer).
- [ ] Security
  - [ ] Executive cannot payment-submit for unassigned company (403).
  - [ ] Role-based access blocks admin-only endpoints.
- [ ] Settings change triggers reschedule (mock scheduler to assert called) (optional defer).
- [ ] Edge
  - [ ] Idempotency key uniqueness at DB constraint (simulate second different payment with same key).
  - [ ] Notification unique pending index logic (attempt duplicate create -> single pending).
  
NOTE: Mark non-critical / slower items as `@pytest.mark.slow` and can be deferred initially.

## 7. Deployment & Ops
- [ ] Multi-stage Dockerfile (slim final image).
- [ ] Readiness endpoint (DB ping) separate from `/health`.
- [ ] Structured JSON logging + request ID middleware.
- [ ] Prometheus metrics endpoint (pending notifications, payment status counts, scan durations).
- [ ] CI pipeline: lint, tests, build, docker push.

## 8. Security
- [ ] Rate limit auth & write endpoints.
- [ ] Password policy (min length, complexity) & hash upgrade path.
- [ ] Hide inactive users in default listings; add filter.
- [ ] (Later) MFA / TOTP support.

## 9. Documentation
- [ ] README: environment variables, migration strategy, scheduler config, notification lifecycle.
- [ ] Generate OpenAPI tags & short descriptions; add example request bodies.
- [ ] Add CHANGELOG.md for versioned releases.

## 10. Cleanup / Refactor
- [ ] Decide on using or removing `last_sent_at`/`next_send_at` fields after cadence implementation.
- [ ] Centralize enum serialization & response normalization.
- [ ] Standardize pagination (limit, offset) across all list endpoints including notifications.
- [ ] Extract query helpers/repositories for companies, payments, notifications.

## 11. Future / Backlog
- [ ] Real-time updates (WebSocket / SSE) for notifications & payment status changes.
- [ ] CSV/Excel export endpoints (companies, bills, payments).
- [ ] Aging report & analytics endpoints.
- [ ] Infrastructure as Code (Terraform/CloudFormation) for AWS (VPC, RDS, ECS/Fargate, Secrets Manager).
- [ ] Background job: nightly aging recalculation / archival.

## Suggested Immediate Sequence
1. New Alembic revision + indexes + constraint.
2. APScheduler integration & notification refactor.
3. Promise/credit date enforcement on PATCH + constraint test.
4. Core unit + integration tests & CI pipeline.
5. Docker optimization & metrics.

---
Keep this file updated as tasks are completed or re-prioritized.
