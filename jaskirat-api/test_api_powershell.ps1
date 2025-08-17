# Test script for Jaskirat Textiles API
# This script tests all major API endpoints and logs results

# Store token and user info
$authData = $null
$adminAuthData = $null
$accountantAuthData = $null
$executiveAuthData = $null
$baseUrl = "http://localhost:8000"

# Test results tracking
$totalTests = 0
$passedTests = 0
$failedTests = 0

# Create log function
function Write-Log {
    param(
        [string]$Status,
        [string]$Message
    )
    
    if ($Status -eq "PASS") {
        Write-Host "[✓] $Message" -ForegroundColor Green
        $script:passedTests++
    } elseif ($Status -eq "FAIL") {
        Write-Host "[✗] $Message" -ForegroundColor Red
        $script:failedTests++
    } elseif ($Status -eq "INFO") {
        Write-Host "[i] $Message" -ForegroundColor Cyan
    } elseif ($Status -eq "HEADER") {
        Write-Host "`n=== $Message ===" -ForegroundColor Yellow
    }
    $script:totalTests++
}

# ----- START TESTING -----
Clear-Host
Write-Log -Status "HEADER" -Message "JASKIRAT TEXTILES API TESTING"
Write-Log -Status "INFO" -Message "Testing API at $baseUrl"
Write-Log -Status "INFO" -Message "Starting at $(Get-Date)`n"

# --- Test health check endpoint ---
Write-Log -Status "HEADER" -Message "SYSTEM ENDPOINTS"

try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    if ($healthResponse.status -eq "healthy") {
        Write-Log -Status "PASS" -Message "Health check endpoint is responding correctly"
    } else {
        Write-Log -Status "FAIL" -Message "Health check endpoint returned unexpected status: $($healthResponse.status)"
    }
} catch {
    Write-Log -Status "FAIL" -Message "Health check endpoint failed: $_"
}

# --- Test root endpoint ---
try {
    $rootResponse = Invoke-RestMethod -Uri "$baseUrl/" -Method Get
    if ($rootResponse.message -like "*Jaskirat Textiles*") {
        Write-Log -Status "PASS" -Message "Root endpoint is responding correctly"
    } else {
        Write-Log -Status "FAIL" -Message "Root endpoint returned unexpected message"
    }
} catch {
    Write-Log -Status "FAIL" -Message "Root endpoint failed: $_"
}

# --- Test Authentication ---
Write-Log -Status "HEADER" -Message "AUTHENTICATION TESTS"

# Test Admin login
try {
    $adminLoginData = @{
        phone = "9876543210"
        password = "admin123"
    } | ConvertTo-Json
    
    $adminAuthData = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $adminLoginData -ContentType "application/json"
    $adminToken = $adminAuthData.access_token
    
    if ($adminToken -and $adminAuthData.user.role -eq "admin") {
        Write-Log -Status "PASS" -Message "Admin login successful: $($adminAuthData.user.name) (Admin)"
    } else {
        Write-Log -Status "FAIL" -Message "Admin login returned unexpected data"
    }
} catch {
    Write-Log -Status "FAIL" -Message "Admin login failed: $_"
}

# Test Accountant login
try {
    $accountantLoginData = @{
        phone = "9876543211"
        password = "accountant123"
    } | ConvertTo-Json
    
    $accountantAuthData = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $accountantLoginData -ContentType "application/json"
    $accountantToken = $accountantAuthData.access_token
    
    if ($accountantToken -and $accountantAuthData.user.role -eq "accountant") {
        Write-Log -Status "PASS" -Message "Accountant login successful: $($accountantAuthData.user.name) (Accountant)"
    } else {
        Write-Log -Status "FAIL" -Message "Accountant login returned unexpected data"
    }
} catch {
    Write-Log -Status "FAIL" -Message "Accountant login failed: $_"
}

# Test Executive login
try {
    $executiveLoginData = @{
        phone = "9876543212"
        password = "executive123"
    } | ConvertTo-Json
    
    $executiveAuthData = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $executiveLoginData -ContentType "application/json"
    $executiveToken = $executiveAuthData.access_token
    
    if ($executiveToken -and $executiveAuthData.user.role -eq "executive") {
        Write-Log -Status "PASS" -Message "Executive login successful: $($executiveAuthData.user.name) (Executive)"
        
        # Set current auth to executive for subsequent tests
        $authData = $executiveAuthData
    } else {
        Write-Log -Status "FAIL" -Message "Executive login returned unexpected data"
    }
} catch {
    Write-Log -Status "FAIL" -Message "Executive login failed: $_"
}

# Test getting current user details
if ($adminToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
        }
        
        $userResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method Get -Headers $headers
        
        if ($userResponse.role -eq "admin") {
            Write-Log -Status "PASS" -Message "Get current user endpoint working correctly"
        } else {
            Write-Log -Status "FAIL" -Message "Get current user returned unexpected role: $($userResponse.role)"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get current user failed: $_"
    }
}

# --- Test Company Endpoints ---
Write-Log -Status "HEADER" -Message "COMPANY TESTS"

# Test getting companies list
if ($executiveToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $companiesResponse = Invoke-RestMethod -Uri "$baseUrl/api/companies" -Method Get -Headers $headers
        
        if ($companiesResponse -is [array]) {
            Write-Log -Status "PASS" -Message "Companies list retrieved: $($companiesResponse.Count) companies found"
            
            # Store first company for later tests if any exists
            if ($companiesResponse.Count -gt 0) {
                $firstCompany = $companiesResponse[0]
                Write-Log -Status "INFO" -Message "Selected company for testing: $($firstCompany.account_n) (Code: $($firstCompany.code))"
            } else {
                Write-Log -Status "INFO" -Message "No companies found for this executive"
            }
        } else {
            Write-Log -Status "FAIL" -Message "Companies list returned unexpected data structure"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get companies failed: $_"
    }
}

# Test getting single company details if we have a company
if ($executiveToken -and $firstCompany) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $companyResponse = Invoke-RestMethod -Uri "$baseUrl/api/companies/$($firstCompany.code)" -Method Get -Headers $headers
        
        if ($companyResponse.code -eq $firstCompany.code) {
            Write-Log -Status "PASS" -Message "Company details retrieved successfully"
            Write-Log -Status "INFO" -Message "Company financial data - Total pending: $($companyResponse.total_pending), Total overdue: $($companyResponse.total_overdue)"
        } else {
            Write-Log -Status "FAIL" -Message "Company details returned unexpected data"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get company details failed: $_"
    }
}

# --- Test Bills Endpoints ---
Write-Log -Status "HEADER" -Message "BILLS TESTS"

# Test getting bills for a company
if ($executiveToken -and $firstCompany) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $billsResponse = Invoke-RestMethod -Uri "$baseUrl/api/bills?company_code=$($firstCompany.code)" -Method Get -Headers $headers
        
        if ($billsResponse -is [array]) {
            Write-Log -Status "PASS" -Message "Bills list retrieved: $($billsResponse.Count) bills found"
            
            # Store bill IDs for payment tests
            if ($billsResponse.Count -gt 0) {
                $billIds = $billsResponse | Where-Object { $_.status -in @("pending", "partially_paid", "overdue") } | Select-Object -First 2 -ExpandProperty id
                if ($billIds.Count -gt 0) {
                    Write-Log -Status "INFO" -Message "Selected bills for payment test: $($billIds -join ', ')"
                } else {
                    Write-Log -Status "INFO" -Message "No unpaid bills found for payment testing"
                }
            }
        } else {
            Write-Log -Status "FAIL" -Message "Bills list returned unexpected data structure"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get bills failed: $_"
    }
}

# --- Test Payments Endpoints ---
Write-Log -Status "HEADER" -Message "PAYMENT WORKFLOW TESTS"

$paymentId = $null

# Test creating a payment (if we have bills)
if ($executiveToken -and $firstCompany -and $billIds -and $billIds.Count -gt 0) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $paymentData = @{
            bill_ids = $billIds
            company_code = $firstCompany.code
            amount = 1000
            payment_method = "cash"
            next_promise_date = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
            location_verified = $true
            comments = "Test payment via PowerShell script"
        } | ConvertTo-Json
        
        $paymentResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments" -Method Post -Body $paymentData -ContentType "application/json" -Headers $headers
        
        if ($paymentResponse.id) {
            $paymentId = $paymentResponse.id
            Write-Log -Status "PASS" -Message "Payment created successfully with ID: $paymentId"
            Write-Log -Status "INFO" -Message "Payment amount: $($paymentResponse.amount), Status: $($paymentResponse.status)"
        } else {
            Write-Log -Status "FAIL" -Message "Payment creation returned unexpected data"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Create payment failed: $_"
    }
}

# Test getting payment details
if ($executiveToken -and $paymentId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $paymentDetailsResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId" -Method Get -Headers $headers
        
        if ($paymentDetailsResponse.id -eq $paymentId) {
            Write-Log -Status "PASS" -Message "Payment details retrieved successfully"
        } else {
            Write-Log -Status "FAIL" -Message "Payment details returned unexpected data"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get payment details failed: $_"
    }
}

# Test accountant approval
if ($accountantToken -and $paymentId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $accountantToken"
        }
        
        $approvalData = @{
            approved = $true
            comments = "Approved by accountant via test script"
        } | ConvertTo-Json
        
        $approvalResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId/approve" -Method Put -Body $approvalData -ContentType "application/json" -Headers $headers
        
        if ($approvalResponse.id -eq $paymentId -and $approvalResponse.accountant_approved -eq $true) {
            Write-Log -Status "PASS" -Message "Accountant approval successful"
        } else {
            Write-Log -Status "FAIL" -Message "Accountant approval returned unexpected data"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Accountant approval failed: $_"
    }
}

# Test admin approval
if ($adminToken -and $paymentId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
        }
        
        $adminApprovalData = @{
            approved = $true
            comments = "Final approval by admin via test script"
        } | ConvertTo-Json
        
        $adminApprovalResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/$paymentId/admin-approve" -Method Put -Body $adminApprovalData -ContentType "application/json" -Headers $headers
        
        if ($adminApprovalResponse.id -eq $paymentId -and 
            $adminApprovalResponse.admin_approved -eq $true -and 
            $adminApprovalResponse.status -eq "completed") {
            Write-Log -Status "PASS" -Message "Admin approval successful"
            Write-Log -Status "PASS" -Message "Payment workflow complete - Payment status: $($adminApprovalResponse.status)"
        } else {
            Write-Log -Status "FAIL" -Message "Admin approval returned unexpected data"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Admin approval failed: $_"
    }
}

# Verify bill status after payment
if ($executiveToken -and $billIds -and $billIds.Count -gt 0) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        foreach ($billId in $billIds) {
            $billResponse = Invoke-RestMethod -Uri "$baseUrl/api/bills/$billId" -Method Get -Headers $headers
            
            if ($billResponse.id -eq $billId) {
                if ($billResponse.status -in @("paid", "partially_paid")) {
                    Write-Log -Status "PASS" -Message "Bill $billId updated correctly to status: $($billResponse.status)"
                    Write-Log -Status "INFO" -Message "Bill $billId - Paid amount: $($billResponse.paid_amount), Remaining: $($billResponse.remaining_amount)"
                } else {
                    Write-Log -Status "FAIL" -Message "Bill $billId status not updated correctly: $($billResponse.status)"
                }
            } else {
                Write-Log -Status "FAIL" -Message "Bill details returned unexpected data"
            }
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Bill verification failed: $_"
    }
}

# --- Test Notifications Endpoints ---
Write-Log -Status "HEADER" -Message "NOTIFICATIONS TESTS"

if ($executiveToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $executiveToken"
        }
        
        $notificationsResponse = Invoke-RestMethod -Uri "$baseUrl/api/notifications" -Method Get -Headers $headers
        
        if ($notificationsResponse -is [array]) {
            Write-Log -Status "PASS" -Message "Notifications retrieved: $($notificationsResponse.Count) notifications found"
        } else {
            Write-Log -Status "FAIL" -Message "Notifications endpoint returned unexpected data structure"
        }
    } catch {
        Write-Log -Status "FAIL" -Message "Get notifications failed: $_"
    }
}

# --- Test Summary ---
Write-Log -Status "HEADER" -Message "TEST SUMMARY"
Write-Log -Status "INFO" -Message "Total tests: $($totalTests-6)"  # Subtract header count
Write-Log -Status "INFO" -Message "Passed: $passedTests"
Write-Log -Status "INFO" -Message "Failed: $failedTests"
Write-Log -Status "INFO" -Message "Success rate: $(($passedTests/($totalTests-6)).ToString("P"))"
Write-Log -Status "INFO" -Message "Testing completed at $(Get-Date)"
