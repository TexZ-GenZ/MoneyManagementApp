# Project TODO (Prioritized Roadmap)

## 1. Schema & Migrations
 Master:
  - [x] First run counts inserted rows (assert exact numbers via row counter helper). (Immediate Priority P0-1)
  - [x] Second identical run: zero inserts/updates; skips counted.
  - [x] Third run with modified subset: correct updated count. (Immediate Priority P0-3)
  - [x] Removal of a record triggers archive flag (simulated via monkeypatch filtering) / detection metrics. (Immediate Priority P0-2)
 Transactions:
  - [x] Adds / updates bill balances correctly. (Immediate Priority P0-1)
  - [x] Re-run idempotent: zero inserts/updates; skips present.
  - [x] Partial update scenario (changed amount) increments updated. (Immediate Priority P0-3)
 Metrics:
  - [x] Duration field present & positive (asserted in metrics tests).
  - [x] Sum(inserted+updated+skipped+archived) >= 0 consistency asserted (exact total lines requires DBF parsing helper). (Immediate Priority P0-2)
 Error Paths:


 Assignment Management:
  - [x] Duplicate assignment idempotent (no duplicate row). (Immediate Priority P1-4)
  - [x] Unassign non-existent mapping -> 404. (Immediate Priority P1-4)

 [x] Create user success; password hashed (not plain) & login works. (Immediate Priority P1-5)
 [x] Duplicate username rejected. (Immediate Priority P1-5)
 [x] Mobile normalization: input variations (+91, spaces, leading zero) unify & unique constraint enforced. (Immediate Priority P1-5)
 [x] Update mobile to existing number (different format) -> 400. (Immediate Priority P1-5)
- [x] Notification logic for promise date crossed and payment received (done)
 [x] Unique bill per company (duplicate rejected test in integrity suite).
 [x] Unique idempotency_key: conflict & reuse scenarios covered.
  - [x] Decimal precision idempotent equality (10.5 vs 10.500) covered. (Immediate Priority P1-6)

 [x] Companies list q & area filters narrow results. (Immediate Priority P2-8)
 [x] Bills list sorts (oldest, amount_desc, recent) produce correct ordering. (Immediate Priority P2-8)
 [x] Payments list date_from/date_to inclusive boundaries.
 [x] Pagination limit/offset correctness (first page vs second page disjoint union; totals constant). (Immediate Priority P2-8)
### Notifications & Edge Cases
 [x] Synthetic master import 5k+ rows completes under N seconds (see test_imports_metrics.py) — profiling only. @pytest.mark.slow (Immediate Priority P2-9)
 [x] Payment submission throughput micro-benchmark (see test_payments_extended.py) @pytest.mark.slow (Immediate Priority P2-9)

 Decimal precision: amounts with trailing zeros vs differing representation still treated equal in idempotency compare. (Immediate Priority P1-6)
 Large list of allocations (e.g. 40–50) performance < threshold (time assert soft).
- [ ] Add/complete GET /payments endpoint if payment listing/filtering is needed
 Error Paths:
  - [ ] Corrupt DBF (simulate) -> handled gracefully (no partial commit) (Immediate Priority P2-7)
### Testing & Coverage
 [x] `conftest.py` base fixtures (SQLite & Postgres, per‑test rollback + explicit TRUNCATE for Postgres isolation) ✅
 [x] Environment variable overrides (DATABASE_URL, JWT_SECRET) isolation.
 [ ] Factory helpers: payment, assignment, settings, import job (user/company/bill done).
 [x] Utility to freeze time / monkeypatch `datetime.utcnow` for deterministic notification cadence tests.
 [x] Marker registration (slow, integration, concurrency) in `pytest.ini`.
### 6.2 Payments: Submission & Validation (P0)
  - [ ] Very large amount (boundary) accepted if within NUMERIC(14,2) range; overflow attempt handled.
  - [x] Single allocation exact sum accepted (already).
 [x] Race: admin approvals on same payment (true parallel test in concurrency suite).
 [x] Race: create payment while bill simultaneously approved (simulate with manual session) ensures consistency.
  - [x] Allocation total less than amount -> 400.
 [x] Scheduler reschedule invoked (monkeypatch `reschedule_jobs`).
  - [x] Allocation exceeds remaining (consider existing reserved) -> 400 (reserved scenario still pending explicit test – NEED separate test for pre-existing pending payment)
 Master:


 Transactions:


 [x] Login by mobile (normalized) works. (covered in auth tests)
 [x] Inactive user cannot login. (covered in auth integrity test)
  - [x] Out-of-range lat/lng rejected. (test_out_of_range_geo_rejected) 
 [x] Parallel submissions same idempotency key -> single payment (Postgres concurrency test).
 [x] Parallel admin approvals -> one success; second sees invalid state.
 [x] Parallel payments allocating same bill remainder -> one fails exceed remaining.
  (Implemented via Postgres concurrency suite.)
  - [x] Same key + different amount -> 409.
  - [x] Same key + different allocations -> 409. (test_idempotency_same_key_different_allocations_conflict)
  - [x] No key => two submits produce two distinct payments. (test_missing_idempotency_key_creates_distinct_payments)
  - [x] Reusing key after payment approved returns same (test_reuse_idempotency_key_after_admin_approval_returns_same)
  - [x] Two rapid sequential submissions with same key return single row (basic simulation; true parallel test pending).

### 6.3 Payments: Reservation & Concurrency (P1)
  - [x] Reservation conflict: existing pending reserves remaining; new payment exceeding leftover rejected (test_payments_reservation_conflict.py).
  - [x] Race: two admin approvals on same payment (one succeeds, other 400/404) (test_double_admin_approval_parallel, test_double_admin_approve_blocked)
  - [x] Race: create payment while bill simultaneously approved (state transition correctness) (test_race_payment_creation_during_approval, test_race_creation_while_bill_approval)
  - [x] submit -> accountant approve -> admin approve updates: (test_full_approval_flow_partial_then_paid)
  - [ ] Company totals strict recompute equality after partial + full flows (add new test)
    * Bill `amount_paid` increments. (done)
    * Bill status flips to paid when fully covered else partial. (done)
    * Company totals recalculated (outbal/amount) match recompute service. (done)
  - [x] Accountant cannot approve non-submitted states (test_accountant_cannot_approve_non_submitted).
  - [x] Admin cannot approve unless accountant_approved. (test_admin_cannot_approve_without_accountant_approval)
  - [x] Double accountant approve blocked. (test_double_accountant_approve_blocked)
  - [x] Double admin approve blocked. (test_double_admin_approve_blocked)
  - [x] Accountant decline sets `declined_by_accountant`; admin approve afterwards forbidden (decline + re-approve guard partially covered; add explicit re-approve test later).
  - [x] Explicit approve-after-decline forbidden (focused test)
  - [x] Double decline (accountant/admin) returns 400 focused tests
  - [x] Admin decline sets `declined_by_admin` only after accountant_approved. (test_admin_decline_after_accountant_approve)
  - [x] Cannot decline already approved or previously declined payment. (covered indirectly in flow tests; need explicit reattempt tests) 
  - [x] next_promise_date on payment propagates to company on admin approval. (test_next_promise_date_propagates_on_admin_approval)
  - [x] Accountant cannot approve after admin approval (test_accountant_cannot_approve_after_admin_approval)

### 6.5 Promise / Credit Date Rules (P0)
- [x] Promise backward -> 400.
- [x] Promise earlier than credit -> 400.
 - [x] Credit forward update allowed if promise still >= new credit. (test_credit_forward_allowed_if_promise_still_ahead)
 - [x] Promise set equal to credit allowed. (test_promise_equal_to_credit_allowed)
 - [x] Moving promise forward allowed and recomputes amounts. (test_promise_forward_updates)
 - [x] next_promise_date earlier than current promise in payment submission -> 400. (test_next_promise_date_earlier_than_current_forbidden_in_payment)
 - [x] Attempt to set credit_date making existing promise invalid -> 400. (test_credit_update_invalidates_existing_promise_error)

### 6.6 Notifications (P0)
- Payment Review:
  - [x] Created on first pending payment for company.
  - [x] Not duplicated by second pending payment. (test_notification_created_once_for_first_pending_payment)
  - [x] Cleared/stopped after admin approval / decline. (test_accountant_decline_stops_notification + test_admin_approval_stops_notification)
- Promise Crossed:
  - [x] Generated once when promise/credit dates in past (test_promise_crossed_created_once).
  - [x] Not regenerated while pending; recreated after resolution and recurrence (test_promise_crossed_recreated_after_resolution).
  - [x] Cadence resend timing verified (test_promise_crossed_resend_after_cadence).
- Cadence Fields:
  - [x] Initial send & resend update last_sent_at/next_send_at (tests cover both promise_crossed & payment_review).
  - [x] Multiple scans before next interval do not update last_sent_at.
- Filtering / Access:
  - [x] Executive only sees notifications for assigned companies (test_notifications_executive_scope_filters).
  - [x] Admin sees all (implicitly via counts / listing tests).
- Uniqueness:
  - [x] Duplicate prevention via payment submission & scan (no duplicate pending notifications observed in tests).

### 6.7 Settings (P1)
- [x] GET returns defaults if none set.
- [x] PATCH updates one field leaves others unchanged.
- [x] Invalid negative `notif_every_hours` rejected.
- [ ] Scheduler reschedule invoked (monkeypatch `reschedule_jobs`).

### 6.8 Imports (P1)
- Master:
  - [x] First run counts inserted rows (assert exact numbers via row counter helper).
  - [x] Second identical run: zero inserts/updates; skips counted.
  - [x] Third run with modified subset: correct updated count.

- Transactions:
  - [x] Adds / updates bill balances correctly.
  - [x] Re-run idempotent: zero inserts/updates; skips present.
  - [x] Partial update scenario (changed amount) increments updated.
- Metrics:

- Error Paths:


### 6.9 Security & Authorization (P0)
- Auth:
  - [x] Invalid credentials -> 401/400 covered (test_invalid_credentials_and_missing_token).
  - [x] Login by mobile (normalized) works.
  - [x] Inactive user cannot login.
- Role Enforcement:
  - [x] Executive cannot submit payment for unassigned company (403).
  - [x] Executive cannot access another executive's notifications / companies list (scoping test covers notifications; company list still open if scoping added later).
  - [x] Non-admin hitting admin endpoints -> 403 (admin approve attempt by exec test_non_admin_cannot_admin_approve).
  - [x] Missing token -> 401 on protected endpoints.
- Assignment Management:


### 6.10 User Management (P1)
- [x] Create user success; password hashed (not plain) & login works.
- [x] Duplicate username rejected.
- [x] Mobile normalization: input variations (+91, spaces, leading zero) unify & unique constraint enforced.
- [x] Update mobile to existing number (different format) -> 400.
- [x] Password change invalidates old password & new password works.
- [x] Hard delete rules: cannot delete admin/accountant; cannot delete exec with assignments/payments.
- [x] Deactivate user prevents future login.

### 6.11 Filtering / Pagination / Sorting (P2)
- [x] Companies list q & area filters narrow results.
- [x] Bills list sorts (oldest, amount_desc, recent) produce correct ordering.
- [x] Payments list date_from/date_to inclusive boundaries.
- [x] Pagination limit/offset correctness (first page vs second page disjoint union; totals constant).

### 6.12 Data Integrity & Constraints (P0)


- [x] Unique exec assignment constraint enforced.
- [x] Notification pending uniqueness indirectly verified (no duplicates across submissions / scans).

### 6.13 Edge / Boundary Cases (P1)
- Decimal precision: amounts with trailing zeros vs differing representation still treated equal in idempotency compare.
- Large list of allocations (e.g. 40–50) performance < threshold (time assert soft).
 - [x] Payment with next_promise_date exactly at credit_date boundary allowed (test_payment_next_promise_date_equal_credit_allowed).
 - [x] Payment with next_promise_date one day before credit_date denied (test_payment_next_promise_date_before_credit_denied).
- Setting extreme but valid notif_every_hours (e.g. 1 vs high value) accepted.
- Notification message length near 300 chars accepted; >300 rejected (if validation added later).

### 6.14 Concurrency / Race (Advanced, mark slow) (P2)
 - [x] Parallel submissions same idempotency key -> single payment (see test_payments_true_concurrency.py) @pytest.mark.slow
 - [x] Parallel admin approvals -> one success; second sees invalid state (see test_payments_true_concurrency.py) @pytest.mark.slow
 - [x] Parallel payments allocating same bill remainder -> one fails exceed remaining (see test_payments_true_concurrency.py) @pytest.mark.slow
   (BASIC sequential idempotency reuse simulated; true parallel tests pending Postgres harness.)

 - [x] Synthetic master import 5k+ rows completes under N seconds (see test_imports_metrics.py) — profiling only. @pytest.mark.slow
 - [x] Payment submission throughput micro-benchmark (see test_payments_extended.py) @pytest.mark.slow
- Payment submission throughput micro-benchmark (optional).
 - [x] Golden response schema snapshots for key endpoints (companies dashboard, payment detail) (see test_regression_snapshots.py)
 - [x] Migration smoke: run alembic upgrade on empty test DB (see test_imports_extended.py)
- Golden response schema snapshots for key endpoints (companies dashboard, payment detail) to detect accidental field removal (allow flexible dates/ids).
 - [x] Oversized strings (company name > allowed) -> 422 (see test_misc_coverage_and_inputs.py)
 - [x] SQL meta characters in search query `q` do not error (escape handling) & no injection (see test_misc_coverage_and_inputs.py)
 - [x] Invalid enum values in query parameters -> 422 (see test_misc_coverage_and_inputs.py)
- Oversized strings (company name > allowed) -> 422.
 - [x] Coverage threshold (e.g. statements >= 85%) gate (see pytest.ini, coverage report)
 - [ ] Mutation testing (optional later) to ensure assertions meaningful.

### 6.18 Test Quality Meta (P1)
- [x] Coverage threshold (e.g. statements >= 85%) gate.
- [ ] Mutation testing (optional later) to ensure assertions meaningful.

### Notes
- Prefer API-level tests for cross-layer validation; add a few direct service unit tests for edge numeric logic (allocation math, recompute totals) with isolated sessions.
- Use factory helpers to minimize boilerplate; target one assert focus per test.
- Concurrency tests: if flaky under SQLite, consider skipping in CI with marker until Postgres test harness added.
- Keep tests deterministic: freeze time or isolate date usage to controllable fixture.

> Goal: Fail fast on *any* rule regression; bias toward explicit, narrow tests over broad multi-assert chains.

---
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

