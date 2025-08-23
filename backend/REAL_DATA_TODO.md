# Real Data Integration TODO (MASRMN25 / BOOKSALE)
Goal: Enable backend to operate on actual MASRMN25.DBF (master) & BOOKSALE.DBF (transactions) with minimal / zero frontend changes. Frontend should keep using existing endpoints & schemas.

## Legend
- P0 = must have for correct domain behavior
- P1 = important, improves correctness / UX
- P2 = optional / nice to have
- FE Impact: (none) = no frontend change needed; (doc) = only docs/clarity

---
## Phase 1: Master Import Alignment (P0)
- [x] Filter: In `import_master` skip any row where `MAIN_CODE != 'SDR'` (only sundry debtors become companies). (FE Impact: none)
- [x] Location: Populate `Company.location` by concatenating non-empty `ADDRESS1`, `ADDRESS2`, `CITY` (trim + single spaces). (FE Impact: frontend can just display existing field; already nullable)
- [x] Area normalization: Trim AREA (basic) before storing (case preserved). (FE Impact: none)
- [x] Metrics: Add counters: `skipped_non_sdr`, `companies_with_location`, `areas_detected`. (FE Impact: none)

## Phase 2: Auto Executive Assignments (P0)
- [x] After master import, for each company with non-blank AREA, ensure an executive user exists (username rule: area lowercased, spaces -> `_`; collision => append numeric). (FE Impact: none)
- [x] Auto-create executive user if missing with random password (store hashed) & active. (FE Impact: none)
- [x] Upsert `ExecAssignment` (idempotent). (FE Impact: none)
- [x] Handle AREA change: remove obsolete assignment if company AREA changed. (FE Impact: none)
- [x] Handle AREA cleared: remove assignment (decision: remove). (FE Impact: none)
- [x] Metrics: `new_executives_created`, `assignments_added`, `assignments_removed`. (FE Impact: none)

## Phase 3: Transactions Import (P0)
- [x] Due Date detection: Accept existing field names (`DUE_DATE`, `DUEDATE`, `DUE`) case-insensitive. (FE Impact: none)
- [x] Fallback computation: If missing/null, compute `due_date = bill_date + DEFAULT_CREDIT_TERM_DAYS`. (FE Impact: none)
- [x] Config: Add `DEFAULT_CREDIT_TERM_DAYS` in settings/env (distinct from extension days). (FE Impact: none)
- [x] Bill lookup correctness: query now scoped by `(company_code, bill_number)`. (FE Impact: none)
- [x] Skip zero / null debit rows (no bill inserted if `debit == 0`). (FE Impact: none)
- [x] Credit notes: negative debit retained as negative bill amounts. (FE Impact: none)
- [x] Metrics: add `zero_debit_skipped`, `negative_debit`, `fallback_due_assigned`.

## Phase 4: Totals & Dates Consistency (P1)
- [x] After transactions import with computed due dates, run `recalc_company_totals` (already per touched code) — ensure no duplicate work. (FE Impact: none)
- [x] Optional admin endpoint `/admin/recalc-all` to recompute all companies if config changes (guard by admin). (FE Impact: none)
- [ ] Document that changing `DEFAULT_CREDIT_TERM_DAYS` does not retroactively shift existing due_dates unless recompute invoked. (FE Impact: doc)
- [x] Composite archival logic: archive bills missing per (company_code,bill_number) within touched companies only. (FE Impact: none)
- [x] Recalc semantics updated: totals/outbal exclude negative residuals; credit_date derived only from bills with positive residual.
- [x] Location verification explicitly ignored (deferred).

## Phase 5: Cleanup & Resilience (P1)
- [x] Filename flexibility: `?filename=` param added with whitelist mapping. (FE Impact: none)
- [x] Graceful missing file error: Returns 400 with detail. (FE Impact: none)
 - [x] Duplicate CODE handling: log & skip subsequent duplicates; metric `duplicate_codes`. (FE Impact: none)
- [x] Logging: Basic progress log every 5k imported rows (master & transactions). (FE Impact: none)

## Phase 6: Executive & User Safety (P1)
- [x] Prevent auto-created exec username collision with existing non-exec roles (suffix logic). (FE Impact: none)
- [x] Unusable long random password & inactive by default (admin must activate). (FE Impact: doc)
- [x] Skip creating if AREA placeholder or length <=1. (FE Impact: none)

## Phase 7: Metrics & Observability (P2)
- [ ] Extend import metrics endpoint output with new counters. (FE Impact: none)
- [ ] (Optional) Prometheus gauge export (companies, bills, pending notifications). (FE Impact: none)

## Phase 8: Tests (parallel with phases) (P0/P1)
- [ ] Master import excludes non-SDR (assert none of SCR codes present).
- [ ] Location populated when address fields exist; remains None when absent.
- [ ] Auto assignment creates executive + assignment on first import.
- [ ] Second identical master import: no new users/assignments (idempotent).
- [ ] AREA change reassign test (old assignment removed, new added).
- [ ] Transactions import: due_date taken from file when present.
- [ ] Transactions import: due_date fallback uses DEFAULT_CREDIT_TERM_DAYS.
- [ ] Zero debit row skipped; negative debit row stored as negative bill (or alternative rule test).
- [ ] Bill uniqueness: two companies with same bill number create distinct rows (no overwrite).
- [ ] Fallback due_date count metric increments.
- [ ] Company credit_date / promise_date set after first transactions import (not None).

## Phase 9: Documentation (P2)
- [ ] Update README or new `REAL_DATA.md` with: data source mapping, filters, due date rules, assignment rules.
- [ ] Document environment variable `DEFAULT_CREDIT_TERM_DAYS` and how to rebaseline.

## Optional / Deferred (List for later consideration)
- [ ] Credit note handling refinement (separate table or flag). (P3)
- [ ] Bulk exec assignment override endpoint (admin tool). (P3)
- [ ] Historical aging snapshot endpoint. (P3)

---
## Frontend Impact Summary
All planned changes keep existing API contracts. Frontend should automatically benefit:
- `Company.location` will start being populated (no prop rename).
- Executives auto-created/assigned means existing `/executives/{id}/companies` & `/me/companies` flows continue.
- No new required fields in payment submission (location verification ignored, backend keeps existing optional fields).
- No change to bills or payments response schemas.

## Sequencing Recommendation
1. Phase 1 + 2 (filter, location, auto-assign) – foundation.
2. Phase 3 (due_date fallback) – unlock accurate credit/outbal.
3. Phase 4 (recalc & optional admin recompute) – stability.
4. Phases 5–6 (hardening, safety) – robustness.
5. Tests & docs alongside each phase.

## Open Decisions (mark before implementing)
- Negative debit handling strategy (A: store as negative bill) => default if not changed.
- AREA normalization format (UPPER vs Title). Default: Title-case for display, stored raw separately? (Proposed: store as given, normalized only for username slug.)
- DEFAULT_CREDIT_TERM_DAYS value (choose e.g. 30).
- Removal policy when AREA blank (remove assignment = default).

Fill in these decisions at top of the file before coding.
