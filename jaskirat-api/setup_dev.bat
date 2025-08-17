@echo off
echo.
echo =========================================================
echo   🚀 Jaskirat Textiles API - Development Setup
echo =========================================================
echo.

echo Select development environment:
echo 1. Local Windows Development (with venv)
echo 2. Docker Development (recommended)
echo 3. Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto local_dev
if "%choice%"=="2" goto docker_dev
if "%choice%"=="3" goto exit
goto invalid_choice

:local_dev
echo.
echo 🔧 Setting up Local Windows Development...
echo.

:: Create Windows virtual environment
echo Creating Python virtual environment...
python -m venv venv_windows
if errorlevel 1 (
    echo ❌ Failed to create virtual environment. Make sure Python is installed.
    pause
    goto exit
)

:: Activate virtual environment
echo Activating virtual environment...
call venv_windows\Scripts\activate.bat

:: Create simplified requirements for local development
echo Creating simplified requirements.txt for local development...
echo # Simplified requirements for local Windows development > requirements_local.txt
echo fastapi==0.104.1 >> requirements_local.txt
echo uvicorn[standard]==0.24.0 >> requirements_local.txt
echo python-multipart==0.0.6 >> requirements_local.txt
echo sqlalchemy==2.0.23 >> requirements_local.txt
echo pydantic==2.5.0 >> requirements_local.txt
echo pydantic-settings==2.1.0 >> requirements_local.txt
echo python-dotenv==1.0.0 >> requirements_local.txt
echo python-jose[cryptography]==3.3.0 >> requirements_local.txt
echo passlib[bcrypt]==1.7.4 >> requirements_local.txt
echo email-validator==2.1.0 >> requirements_local.txt
echo pytest==7.4.3 >> requirements_local.txt
echo httpx==0.25.2 >> requirements_local.txt

:: Install dependencies
echo Installing dependencies...
pip install -r requirements_local.txt

echo.
echo ✅ Local development setup complete!
echo.
echo To start development:
echo 1. Run: venv_windows\Scripts\activate.bat
echo 2. Run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
pause
goto exit

:docker_dev
echo.
echo 🐳 Setting up Docker Development...
echo.

:: Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed or not running.
    echo Please install Docker Desktop and try again.
    pause
    goto exit
)

:: Create .env file for Docker
echo Creating .env file for Docker development...
echo # Docker Development Environment > .env
echo ENVIRONMENT=development >> .env
echo DEBUG=true >> .env
echo DATABASE_URL=postgresql+asyncpg://jaskirat:password@postgres:5432/jaskirat_db >> .env
echo SECRET_KEY=dev-secret-key-change-in-production >> .env
echo ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,exp://10.184.177.62:8081 >> .env

:: Build and start Docker containers
echo Building and starting Docker containers...
docker-compose up --build -d

:: Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 /nobreak >nul

:: Initialize database
echo Initializing database...
docker-compose exec api python init_db.py

echo.
echo ✅ Docker development setup complete!
echo.
echo Services running:
echo - API: http://localhost:8000
echo - API Docs: http://localhost:8000/docs
echo - Database: PostgreSQL on localhost:5432
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
pause
goto exit

:invalid_choice
echo ❌ Invalid choice. Please select 1, 2, or 3.
pause
goto :start

:exit
echo.
echo Thank you for using Jaskirat Textiles API setup!
echo.
