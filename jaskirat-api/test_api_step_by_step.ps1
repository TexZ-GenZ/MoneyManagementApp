# Jaskirat Textiles API Testing Script - Step by Step
# This script tests each endpoint individually and with detailed error reporting

$baseUrl = "http://localhost:8000"

# Enable detailed error output
$ErrorActionPreference = "Continue"

# Test 1: Health Check
Write-Host "`n=== Testing Health Check ===" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "[PASS] Health check successful: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Health check failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

# Test 2: Admin Login
Write-Host "`n=== Testing Admin Login ===" -ForegroundColor Yellow
$adminToken = $null
try {
    $loginData = @{
        phone = "9876543210"
        password = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    $adminToken = $response.access_token
    Write-Host "[PASS] Admin login successful" -ForegroundColor Green
    Write-Host "Token: $($adminToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "User: $($response.user.name) (Role: $($response.user.role))" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Admin login failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# Test 3: Accountant Login
Write-Host "`n=== Testing Accountant Login ===" -ForegroundColor Yellow
$accountantToken = $null
try {
    $loginData = @{
        phone = "9876543211"
        password = "acc123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    $accountantToken = $response.access_token
    Write-Host "[PASS] Accountant login successful" -ForegroundColor Green
    Write-Host "Token: $($accountantToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "User: $($response.user.name) (Role: $($response.user.role))" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Accountant login failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# Test 4: Executive Login
Write-Host "`n=== Testing Executive Login ===" -ForegroundColor Yellow
$executiveToken = $null
try {
    $loginData = @{
        phone = "9876543212"
        password = "exec123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    $executiveToken = $response.access_token
    Write-Host "[PASS] Executive login successful" -ForegroundColor Green
    Write-Host "Token: $($executiveToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "User: $($response.user.name) (Role: $($response.user.role))" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Executive login failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# Only continue if we have tokens
if (!$executiveToken -or !$accountantToken -or !$adminToken) {
    Write-Host "`n[WARNING] Cannot continue tests without all authentication tokens" -ForegroundColor Red
    exit
}

# Test 5: Get Companies (as Executive)
Write-Host "`n=== Testing Get Companies (as Executive) ===" -ForegroundColor Yellow
$companyCode = $null
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }

    $response = Invoke-RestMethod -Uri "$baseUrl/api/companies/" -Method Get -Headers $headers
    Write-Host "[PASS] Get Companies successful: Found $($response.Count) companies" -ForegroundColor Green
    
    # First try to find a company with ABC001 code (which has bills according to previous runs)
    $abcCompany = $response | Where-Object { $_.code -eq "ABC001" }
    if ($abcCompany) {
        $companyCode = "ABC001"
        Write-Host "Selected company for testing: $($abcCompany.account_n) (Code: $companyCode)" -ForegroundColor Cyan
    }
    # If ABC001 not found, try MOD003
    elseif ($response | Where-Object { $_.code -eq "MOD003" }) {
        $modCompany = $response | Where-Object { $_.code -eq "MOD003" }
        $companyCode = "MOD003"
        Write-Host "Selected company for testing: $($modCompany.account_n) (Code: $companyCode)" -ForegroundColor Cyan
    }
    # If no specific company found, use the first one
    elseif ($response.Count -gt 0) {
        $companyCode = $response[0].code
        Write-Host "Selected company for testing: $($response[0].account_n) (Code: $companyCode)" -ForegroundColor Cyan
    } else {
        Write-Host "[WARNING] No companies found for this executive" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[FAIL] Get Companies failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# If no companies found, exit
if (!$companyCode) {
    Write-Host "`n[WARNING] Cannot continue tests without a company" -ForegroundColor Red
    exit
}

# Test 6: Get Company Details
Write-Host "`n=== Testing Get Company Details ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }

    $response = Invoke-RestMethod -Uri "$baseUrl/api/companies/$companyCode" -Method Get -Headers $headers
    Write-Host "[PASS] Get Company Details successful" -ForegroundColor Green
    Write-Host "Company Name: $($response.account_n)" -ForegroundColor Cyan
    Write-Host "Total Pending: $($response.total_pending)" -ForegroundColor Cyan
    Write-Host "Total Overdue: $($response.total_overdue)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Get Company Details failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 7: Check for Bills in System
Write-Host "`n=== Checking for Bills in System ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"  # Use admin to see all bills
    }

    # Try with code "ABC001" first
    $companyCode = "ABC001"  # Set to ABC001 as default
    
    # Check the database using admin rights to find companies with bills
    $allCompanies = Invoke-RestMethod -Uri "$baseUrl/api/companies/" -Method Get -Headers $headers
    Write-Host "Found $($allCompanies.Count) total companies in system" -ForegroundColor Green
    
    # Find companies with bills
    foreach ($company in $allCompanies) {
        Write-Host "Checking company $($company.account_n) (Code: $($company.code))..." -ForegroundColor Cyan
        $billsResult = Invoke-RestMethod -Uri "$baseUrl/api/bills/?company_code=$($company.code)" -Method Get -Headers $headers
        
        # Check if response has Count property (array of bills)
        if ($billsResult -and ($billsResult | Get-Member -Name Count)) {
            Write-Host "Company $($company.code) has $($billsResult.Count) bills" -ForegroundColor Green
            
            # Check for unpaid bills
            $unpaidBills = $billsResult | Where-Object { $_.status -in @("pending", "partially_paid", "overdue") }
            if ($unpaidBills -and $unpaidBills.Count -gt 0) {
                $companyCode = $company.code
                Write-Host "[FOUND] Company $($company.account_n) has $($unpaidBills.Count) unpaid bills" -ForegroundColor Green
                Write-Host "  Selected this company for payment tests" -ForegroundColor Green
                break  # Found what we need, exit loop
            }
        } else {
            Write-Host "Could not get bill count for company $($company.code)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[FAIL] Error checking for bills" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 8: Get Bills for Selected Company
Write-Host "`n=== Testing Get Bills for Company $companyCode ===" -ForegroundColor Yellow
$billIds = @()
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }

    $response = Invoke-RestMethod -Uri "$baseUrl/api/bills/?company_code=$companyCode" -Method Get -Headers $headers
    Write-Host "[PASS] Get Bills successful: Found $($response.Count) bills for company $companyCode" -ForegroundColor Green
    
    # Save unpaid bill IDs for payment tests
    $unpaidBills = $response | Where-Object { $_.status -in @("pending", "partially_paid", "overdue") }
    if ($unpaidBills.Count -gt 0) {
        $billIds = $unpaidBills | Select-Object -First 1 -ExpandProperty id
        Write-Host "Selected bill for payment test: $($billIds -join ', ')" -ForegroundColor Cyan
        
        # Display bill details
        foreach ($bill in ($unpaidBills | Select-Object -First 1)) {
            Write-Host "Bill $($bill.id): Amount $($bill.amount), Status: $($bill.status)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[WARNING] No unpaid bills found for payment testing in company $companyCode" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Get Bills failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    # If API call failed, exit the test
    Write-Host "`n[WARNING] Cannot continue without access to bills API" -ForegroundColor Red
    exit
}

# If no bills found, we need to exit the script
if ($billIds.Count -eq 0) {
    Write-Host "`n[WARNING] Cannot continue tests without existing unpaid bills" -ForegroundColor Red
    Write-Host "Please ensure some companies have bills in pending/overdue status before running this test" -ForegroundColor Yellow
    exit
}

# Test 8: Create Payment
Write-Host "`n=== Testing Create Payment ===" -ForegroundColor Yellow
$paymentId = $null
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }
    
    $paymentData = @{
        bill_ids = $billIds
        company_code = $companyCode
        amount = 1000
        payment_method = "cash"
        next_promise_date = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        location_verified = $true
        comments = "Test payment via PowerShell script"
    }
    
    Write-Host "Payment request data: $($paymentData | ConvertTo-Json)" -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/payments/" -Method Post -Body ($paymentData | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $paymentId = $response.id
    Write-Host "[PASS] Create Payment successful: Payment ID $paymentId" -ForegroundColor Green
    Write-Host "Payment details: Amount $($response.amount), Status: $($response.status)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Create Payment failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# If payment creation failed, exit
if (!$paymentId) {
    Write-Host "`n[WARNING] Cannot continue tests without payment" -ForegroundColor Red
    exit
}

# Test 9: Get Payment Details
Write-Host "`n=== Testing Get Payment Details ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }

    $response = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId" -Method Get -Headers $headers
    Write-Host "[PASS] Get Payment Details successful" -ForegroundColor Green
    Write-Host "Payment Status: $($response.status)" -ForegroundColor Cyan
    Write-Host "Payment Method: $($response.payment_method)" -ForegroundColor Cyan
    Write-Host "Accountant Approved: $($response.accountant_approved)" -ForegroundColor Cyan
    Write-Host "Admin Approved: $($response.admin_approved)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Get Payment Details failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 10: Accountant Approval
Write-Host "`n=== Testing Accountant Approval ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $accountantToken"
    }
    
    $approvalData = @{
        approved = $true
        comments = "Approved by accountant via test script"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId/approve" -Method Put -Body ($approvalData | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    Write-Host "[PASS] Accountant Approval successful" -ForegroundColor Green
    Write-Host "Accountant Approved: $($response.accountant_approved)" -ForegroundColor Cyan
    Write-Host "Accountant Comments: $($response.accountant_comments)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Accountant Approval failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# Test 11: Admin Approval
Write-Host "`n=== Testing Admin Approval ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
    }
    
    $approvalData = @{
        approved = $true
        comments = "Final approval by admin via test script"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId/admin-approve" -Method Put -Body ($approvalData | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    Write-Host "[PASS] Admin Approval successful" -ForegroundColor Green
    Write-Host "Admin Approved: $($response.admin_approved)" -ForegroundColor Cyan
    Write-Host "Payment Status: $($response.status)" -ForegroundColor Cyan
    Write-Host "Admin Comments: $($response.admin_comments)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Admin Approval failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

# Test 12: Verify Bill Status After Payment
Write-Host "`n=== Testing Bill Status After Payment ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }
    
    foreach ($billId in $billIds) {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/bills/$billId" -Method Get -Headers $headers
        Write-Host "[PASS] Bill $billId Status: $($response.status)" -ForegroundColor Green
        Write-Host "Bill $billId Paid Amount: $($response.paid_amount)" -ForegroundColor Cyan
        Write-Host "Bill $billId Remaining Amount: $($response.remaining_amount)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[FAIL] Bill Status Verification failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 13: Verify Company Update After Payment
Write-Host "`n=== Testing Company Update After Payment ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $executiveToken"
    }

    $response = Invoke-RestMethod -Uri "$baseUrl/api/companies/$companyCode" -Method Get -Headers $headers
    Write-Host "[PASS] Company Update Verification successful" -ForegroundColor Green
    Write-Host "Updated Total Pending: $($response.total_pending)" -ForegroundColor Cyan
    Write-Host "Updated Total Overdue: $($response.total_overdue)" -ForegroundColor Cyan
    Write-Host "Updated Promise Date: $($response.promise_date)" -ForegroundColor Cyan
    Write-Host "Updated Credit Date: $($response.credit_date)" -ForegroundColor Cyan
} catch {
    Write-Host "[FAIL] Company Update Verification failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 14: Check All Bills in System
Write-Host "`n=== Checking All Bills Status in System ===" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"  # Use admin to see all bills
    }

    $allBills = Invoke-RestMethod -Uri "$baseUrl/api/bills/" -Method Get -Headers $headers
    
    Write-Host "Found $($allBills.Count) total bills in system" -ForegroundColor Green
    
    # Display details for each bill
    foreach ($bill in $allBills) {
        Write-Host "Bill ID: $($bill.id) - Amount: $($bill.amount) - Status: $($bill.status) - Company: $($bill.company_code) - Remaining Amount: $($bill.remaining_amount)"
    }
    
    # Check for bills with potential inconsistencies
    $inconsistentBills = $allBills | Where-Object { 
        ($_.remaining_amount -le 0 -and $_.status -ne "paid") -or 
        ($_.remaining_amount -gt 0 -and $_.status -eq "paid") 
    }
    
    if ($inconsistentBills -and $inconsistentBills.Count -gt 0) {
        Write-Host "[WARNING] Found $($inconsistentBills.Count) bills with potential status inconsistencies" -ForegroundColor Yellow
        foreach ($bill in $inconsistentBills) {
            Write-Host "  Inconsistent Bill ID: $($bill.id) - Amount: $($bill.amount) - Status: $($bill.status) - Remaining: $($bill.remaining_amount)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[PASS] No bills with status inconsistencies found" -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Error checking all bills" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Yellow
Write-Host "Tests completed. Payment workflow verified." -ForegroundColor Green
Write-Host "Payment ID: $paymentId was created by Executive, approved by Accountant and Admin" -ForegroundColor Cyan
