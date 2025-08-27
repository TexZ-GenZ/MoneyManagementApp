# Import Semantics (Minimal Production Rules)

Lean documentation of how master & transactions file uploads behave. Focus only on what is absolutely needed for a real-world deployment without extra complexity.

## 1. Snapshot Model
Each upload (master / transactions) is treated as the new authoritative snapshot for that dataset. Uploads may be .dbf, .csv, or .xlsx with arbitrary filenames from the frontend; the backend detects the format by extension.

| File Type | Entities Affected | Identity Key | Archive Rule |
|-----------|------------------|--------------|--------------|
| Master    | Companies (+ exec assignments) | company.code | Companies missing in new snapshot are soft archived (`is_archived = True`). |
| Transactions | Bills (and company totals) | (company_code, bill_number) | Bills absent in new snapshot are soft archived. |

Soft archive only; no hard deletes. Historic relations (payments, approvals, notifications) remain valid.

## 2. Preservation Guarantees
We never reset or erase:
* `amount_paid`, `status` of existing bills.
* Payment, notification, or approval records.
* `promise_date` when recomputing totals (only `credit_date` recalculated).

## 3. Recalculation Semantics
After transactions import (or explicitly via `/admin/recalc-all`):
* `amount`: Sum of positive residuals (`max(amount - amount_paid, 0)`) over active, pending bills.
* `outbal`: Subset of that sum where `due_date <= today` (overdue only; same-day counts as overdue).
* `credit_date`: Oldest due date among positive residual bills + `CREDIT_EXTENSION_DAYS`.
* Negative / credit-note bills (negative amount) reduce neither `amount` nor `outbal`.

## 4. Executive Auto-Creation
From master import: for each non-placeholder `area`, create (if missing) an inactive executive user and link assignment; assignments for companies losing an area are removed. Placeholder tokens (`"", -, --, N/A, NULL, NONE`) ignored.

## 5. Metrics (Returned per Import)
Master (example keys):
```
inserted, updated, skipped, archived,
skipped_non_sdr, companies_with_location,
areas_detected, duplicate_codes,
placeholder_area_skipped,
new_executives_created, assignments_added, assignments_removed
```
Transactions:
```
inserted, updated, skipped, archived,
zero_debit_skipped, negative_debit, fallback_due_assigned
```

These counts are also persisted in `ImportJob` (recommended extension) for audit.

## 6. Minimal Validation (Recommended)
Fail fast before mutating DB if:
* Required columns missing (`CODE`, `ACCOUNT_N` (or equivalent), `BILL`, `DATE`, `DEBIT`).
* > X% rows (e.g. 2%) contain unparseable numeric/date fields.
Return: `{ "error": "reason", "row_errors": n }` without committing.

Skip invalid individual rows below threshold; count them (future metric: `row_errors`).

## 7. Idempotency Shortcut
Compute file hash (MD5 / SHA256). If identical to last successful import of the same type, short‑circuit: return previous metrics + `{ "idempotent": true }`.

## 8. Concurrency Guard
Allow only one import of a given type at a time:
1. Insert an `ImportJob` row with `started_at` + status `in_progress` (or lock flag).
2. Reject subsequent upload with HTTP 409 until previous finishes.
3. On success, mark `finished_at` and store metrics. On failure, rollback and mark `failed`.

## 9. Transaction Boundaries
Wrap the entire import in a DB transaction. Only commit if the loop completes without fatal error. (Per-row flushes are fine; still inside outer transaction.)

## 10. Soft Archival Logic
After reading snapshot:
```
Archive companies/bills where primary key not present in this import.
Set is_archived = True (do not delete).
```
Never alter `amount_paid` or payment rows; recalculation naturally drops archived bills from totals.

## 11. Security
* `/uploads/*` restricted to `accountant` role.
* JWT short expiry (env set). *No* public import endpoints.
* Optional: rate limit (e.g., max 5 imports/hour) – can be postponed.

## 12. Logging (Essential Fields)
Log a single structured line on completion:
```
{"event":"import_complete","type":"master|transactions","filename":"...","hash":"...","metrics":{...},"duration_ms":1234}
```
On failure:
```
{"event":"import_failed","type":"...","error":"...","row_errors":n}
```

## 13. Configuration (Environment)
| Variable | Purpose | Default |
|----------|---------|---------|
| DEFAULT_CREDIT_TERM_DAYS | Fallback due date offset when due date missing | 30 |
| CREDIT_EXTENSION_DAYS | Added to oldest due for credit_date | 10 |
| CHUNK_SIZE | Flush interval during import | 500 |
| MAX_IMPORT_FILE_MB (optional) | Reject oversize uploads | 20 |
| MAX_ROW_ERROR_PERCENT (optional) | Abort threshold | 2 |

## 14. Extension Hooks (Future, Not Required Now)
| Idea | When to add |
|------|-------------|
| Row-level error table | Only if operators need drill-down diagnostics |
| Async queue / background job | When file size or latency increases drastically |
| Detailed diff history | When audit/regulatory demands need historical snapshots |

## 15. Quick Operator FAQ
**Q: Does a disappearing bill delete its payments?** No. Bill becomes archived; payments remain linked. Totals ignore archived bills.

**Q: Why amount == outbal sometimes?** All positive residual bills are already overdue; outbal is the overdue subset.

**Q: Why is a negative bill present?** Negative debit rows are credit notes: they do not reduce `amount/outbal` directly (excluded in positive residual aggregation) but remain for reference.

**Q: How do executives get created?** First master import sees an AREA; if no exec user exists for that area, it creates an inactive one and assigns companies with that area.

---
This document intentionally omits non-essential complexity. Keep imports deterministic, auditable, and safe; add features only when a concrete need arises.
