# Jaskirat Textiles API - Development Setup (PowerShell)
Write-Host "`n=========================================================" -ForegroundColor Cyan
Write-Host "   🚀 Jaskirat Textiles API - Development Setup" -ForegroundColor Cyan  
Write-Host "=========================================================" -ForegroundColor Cyan

Write-Host "`nSelect development environment:" -ForegroundColor Yellow
Write-Host "1. Local Windows Development (with venv)" -ForegroundColor Green
Write-Host "2. Docker Development (recommended)" -ForegroundColor Blue
Write-Host "3. Exit" -ForegroundColor Red

$choice = Read-Host "`nEnter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n🔧 Setting up Local Windows Development..." -ForegroundColor Green
        
        # Create Windows virtual environment
        Write-Host "Creating Python virtual environment..."
        try {
            python -m venv venv_windows
            Write-Host "✅ Virtual environment created successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to create virtual environment. Make sure Python is installed." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit
        }
        
        # Create simplified requirements for local development
        Write-Host "Creating simplified requirements for local development..."
        $localRequirements = @"
# Simplified requirements for local Windows development
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
sqlalchemy==2.0.23
pydantic==2.5.0
pydantic-settings==2.1.0
python-dotenv==1.0.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
email-validator==2.1.0
pytest==7.4.3
httpx==0.25.2
"@
        $localRequirements | Out-File -FilePath "requirements_local.txt" -Encoding UTF8
        
        # Activate virtual environment and install dependencies
        Write-Host "Activating virtual environment and installing dependencies..."
        & "venv_windows\Scripts\Activate.ps1"
        pip install -r requirements_local.txt
        
        # Create local .env file
        Write-Host "Creating .env file for local development..."
        $localEnv = @"
# Local Development Environment
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=sqlite+aiosqlite:///./jaskirat_local.db
SECRET_KEY=dev-secret-key-change-in-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,exp://10.184.177.62:8081
"@
        $localEnv | Out-File -FilePath ".env" -Encoding UTF8
        
        Write-Host "`n✅ Local development setup complete!" -ForegroundColor Green
        Write-Host "`nTo start development:" -ForegroundColor Yellow
        Write-Host "1. Run: .\venv_windows\Scripts\Activate.ps1" -ForegroundColor Cyan
        Write-Host "2. Run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
        Write-Host "3. Visit: http://localhost:8000/docs" -ForegroundColor Cyan
    }
    
    "2" {
        Write-Host "`n🐳 Setting up Docker Development..." -ForegroundColor Blue
        
        # Check if Docker is running
        try {
            docker --version | Out-Null
            Write-Host "✅ Docker is available" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Docker is not installed or not running." -ForegroundColor Red
            Write-Host "Please install Docker Desktop and try again." -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit
        }
        
        # Create .env file for Docker
        Write-Host "Creating .env file for Docker development..."
        $dockerEnv = @"
# Docker Development Environment
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://jaskirat:password@postgres:5432/jaskirat_db
SECRET_KEY=dev-secret-key-change-in-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,exp://10.184.177.62:8081
"@
        $dockerEnv | Out-File -FilePath ".env" -Encoding UTF8
        
        # Build and start Docker containers
        Write-Host "Building and starting Docker containers..."
        docker-compose up --build -d
        
        # Wait for services to be ready
        Write-Host "Waiting for services to start..."
        Start-Sleep -Seconds 15
        
        # Initialize database
        Write-Host "Initializing database..."
        docker-compose exec api python init_db.py
        
        Write-Host "`n✅ Docker development setup complete!" -ForegroundColor Green
        Write-Host "`nServices running:" -ForegroundColor Yellow
        Write-Host "- API: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "- API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
        Write-Host "- Database: PostgreSQL on localhost:5432" -ForegroundColor Cyan
        Write-Host "`nUseful commands:" -ForegroundColor Yellow
        Write-Host "- View logs: docker-compose logs -f" -ForegroundColor Cyan
        Write-Host "- Stop: docker-compose down" -ForegroundColor Cyan
        Write-Host "- Restart: docker-compose restart" -ForegroundColor Cyan
    }
    
    "3" {
        Write-Host "`nExiting..." -ForegroundColor Yellow
        exit
    }
    
    default {
        Write-Host "❌ Invalid choice. Please select 1, 2, or 3." -ForegroundColor Red
    }
}

Read-Host "`nPress Enter to continue"
