# API Test Log - Jaskirat Textiles

This log documents the results of the API tests performed on August 10, 2025.
## Test Step 1: User Authentication (SUCCESS)

- **Admin Token:** Acquired successfully.
- **Accountant Token:** Acquired successfully.
- **Executive Token:** Acquired successfully.


## Test Step 2: Company and Bill Management (SUCCESS)

- **Admin:** Successfully fetched a list of all companies.
- **Admin:** Successfully fetched details for company ABC001.
- **Data Verification:** Company details appear correct and match the expected structure.

## Test Step 3: Payment Workflow - Partial Payment (FAILURE)

- Failed to verify the partial payment.
- Expected status: PARTIALLY_PAID, Got: pending pending overdue
- Expected paid amount: 10000.00, Got: 0.00 0.00 0.00

## Test Step 3: Payment Workflow - Partial Payment (FAILURE)

- Failed to verify the partial payment.
- Expected status: PARTIALLY_PAID, Got: pending
- Expected paid amount: 10000.00, Got: 0.00

## Test Step 4: Two-Factor Approval - Accountant (SUCCESS)

- **Accountant:** Successfully approved payment $payment_id.

## Test Step 5: Two-Factor Approval - Admin & Final Verification (FAILURE)

- Failed to verify the final bill status after admin approval.
- Expected status: PAID, Got: 
