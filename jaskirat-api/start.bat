@echo off
echo.
echo =====================================================
echo   🚀 Starting Jaskirat Textiles API Server
echo =====================================================
echo.

:: Check if virtual environment exists
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
    echo.
)

:: Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

:: Install dependencies
echo 📚 Installing dependencies...
pip install -r requirements.txt

:: Initialize database
echo 🗄️  Initializing database...
python init_db.py

:: Start the server
echo.
echo ✅ Starting FastAPI server...
echo 📖 API Documentation: http://localhost:8000/docs
echo 🔗 API Base URL: http://localhost:8000
echo.
echo 📋 Demo Login Credentials:
echo    Admin:      admin@jaskirat.com / admin123
echo    Accountant: accountant@jaskirat.com / acc123  
echo    Executive:  executive@jaskirat.com / exec123
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
