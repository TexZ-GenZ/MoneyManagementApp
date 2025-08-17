# Quick Docker Development Script for Jaskirat Textiles API
Write-Host "🐳 Jaskirat Textiles API - Docker Quick Start" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker is not installed or not running." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file for Docker development..." -ForegroundColor Yellow
    $dockerEnv = @"
# Docker Development Environment
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://jaskirat:password@postgres:5432/jaskirat_db
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,exp://10.184.177.62:8081
"@
    $dockerEnv | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env file created" -ForegroundColor Green
}

# Start Docker containers
Write-Host "Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d

# Wait for services
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if services are running
$apiHealth = try { 
    Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5
    $true 
} catch { 
    $false 
}

if ($apiHealth) {
    Write-Host "✅ API is running at http://localhost:8000" -ForegroundColor Green
    Write-Host "✅ API Documentation: http://localhost:8000/docs" -ForegroundColor Green
    
    # Try to initialize database
    Write-Host "Initializing database..." -ForegroundColor Yellow
    try {
        docker-compose exec -T api python init_db.py
        Write-Host "✅ Database initialized successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Database initialization may have failed (this is normal if already initialized)" -ForegroundColor Yellow
    }
    
    Write-Host "`n🎉 Backend is ready for development!" -ForegroundColor Green
    Write-Host "`nTest the API:" -ForegroundColor Cyan
    Write-Host "curl http://localhost:8000/health" -ForegroundColor Gray
    
} else {
    Write-Host "❌ API failed to start. Check Docker logs:" -ForegroundColor Red
    Write-Host "docker-compose logs api" -ForegroundColor Gray
}

Write-Host "`n📋 Useful Commands:" -ForegroundColor Yellow
Write-Host "- View logs: docker-compose logs -f" -ForegroundColor Cyan
Write-Host "- Stop: docker-compose down" -ForegroundColor Cyan  
Write-Host "- Restart API: docker-compose restart api" -ForegroundColor Cyan
Write-Host "- Access database: docker-compose exec postgres psql -U jaskirat -d jaskirat_db" -ForegroundColor Cyan
