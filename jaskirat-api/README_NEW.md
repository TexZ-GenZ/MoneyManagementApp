# Jaskirat Textiles - Payment Collection API

A comprehensive FastAPI backend for the Jaskirat Textiles payment collection system with role-based access control, supporting the React Native frontend application.

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Role-based access control (Admin, Accountant, Executive)
- Secure password hashing with bcrypt
- Token refresh mechanism

### Core Functionality
- **User Management**: Create, update, and manage users with different roles
- **Company Management**: Manage textile companies and their information
- **Bill Management**: Create and track bills with due dates and status
- **Payment Collection**: Record payments with multiple payment methods
- **Notifications**: Send and manage notifications to users
- **Dashboard**: Role-specific dashboards with analytics

### API Features
- Comprehensive REST API with OpenAPI documentation
- Async/await support for high performance
- Database migrations with Alembic
- Input validation with Pydantic
- CORS support for frontend integration
- Health check endpoints

## 📁 Project Structure

```
jaskirat-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── auth_service.py      # Authentication service
│   └── api/
│       ├── __init__.py
│       ├── auth.py          # Authentication endpoints
│       ├── users.py         # User management endpoints
│       ├── companies.py     # Company management endpoints
│       ├── bills.py         # Bill management endpoints
│       ├── payments.py      # Payment collection endpoints
│       └── notifications.py # Notification endpoints
├── init_db.py               # Database initialization script
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose for local development
├── start.bat               # Windows startup script
└── AWS_DEPLOYMENT.md       # AWS deployment guide
```

## 🛠️ Quick Start

### Option 1: Local Development

#### Prerequisites
- Python 3.11+
- PostgreSQL 12+

#### Setup Steps

1. **Clone and navigate to the project**
   ```bash
   cd jaskirat-api
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Initialize database**
   ```bash
   python init_db.py
   ```

6. **Start the server**
   ```bash
   uvicorn app.main:app --reload
   ```

#### Windows Quick Start
Simply double-click `start.bat` to automatically set up and start the server.

### Option 2: Docker Development

```bash
# Start all services (API + PostgreSQL + pgAdmin)
docker-compose up -d

# Initialize database (first time only)
docker-compose exec api python init_db.py

# View logs
docker-compose logs -f api
```

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@jaskirat.com | admin123 |
| Accountant | accountant@jaskirat.com | acc123 |
| Executive | executive@jaskirat.com | exec123 |

## 📚 API Documentation

Once the server is running, visit:
- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc Documentation**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

#### User Management
- `GET /api/users` - List users (Admin only)
- `POST /api/users` - Create user (Admin only)
- `GET /api/users/{id}` - Get user details
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user (Admin only)

#### Companies
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/{id}` - Get company details
- `PUT /api/companies/{id}` - Update company
- `DELETE /api/companies/{id}` - Delete company

#### Bills
- `GET /api/bills` - List bills with filters
- `POST /api/bills` - Create bill
- `GET /api/bills/{id}` - Get bill details
- `PUT /api/bills/{id}` - Update bill
- `DELETE /api/bills/{id}` - Delete bill
- `GET /api/bills/overdue/list` - Get overdue bills

#### Payments
- `GET /api/payments` - List payments with filters
- `POST /api/payments` - Record payment
- `GET /api/payments/{id}` - Get payment details
- `PUT /api/payments/{id}` - Update payment
- `DELETE /api/payments/{id}` - Delete payment
- `GET /api/payments/today/summary` - Today's payments summary

#### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/{id}` - Mark as read/unread
- `DELETE /api/notifications/{id}` - Delete notification
- `POST /api/notifications/mark-all-read` - Mark all as read

## 🗄️ Database Schema

### Core Tables
- **users**: User accounts with roles and authentication
- **companies**: Textile companies information
- **bills**: Bill records with amounts and due dates
- **payments**: Payment transactions linked to bills
- **notifications**: User notifications system

### Relationships
- Users → Payments (one-to-many)
- Companies → Bills (one-to-many)
- Bills → Payments (one-to-many)
- Users → Notifications (one-to-many)

## 🔐 Security Features

### Authentication
- JWT tokens with configurable expiration
- Secure password hashing with bcrypt
- Refresh token rotation
- Role-based access control

### API Security
- CORS configuration for frontend domains
- Input validation and sanitization
- SQL injection prevention
- Rate limiting support (ready to implement)

### Production Security
- Environment-based configuration
- Secret key management
- Database connection encryption
- Trusted host middleware

## 🚀 Deployment

### AWS Deployment
Comprehensive AWS deployment guide available in `AWS_DEPLOYMENT.md` including:
- ECS Fargate deployment
- RDS PostgreSQL setup
- Application Load Balancer configuration
- SSL certificate setup
- Auto-scaling configuration

### Environment Configuration

#### Development
```env
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://jaskirat:password@localhost:5432/jaskirat_db
SECRET_KEY=dev-secret-key
```

#### Production
```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@prod-host:5432/jaskirat_db
SECRET_KEY=super-secure-production-key
ALLOWED_ORIGINS=["https://yourdomain.com"]
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | development |
| `DEBUG` | Enable debug mode | true |
| `DATABASE_URL` | PostgreSQL connection string | localhost |
| `SECRET_KEY` | JWT secret key | change-in-production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration | 30 |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost |

## 🧪 Testing

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
```

## 📊 Monitoring

### Health Checks
- `GET /health` - Application health status
- `GET /` - API information and status

### Logging
- Structured logging with timestamps
- SQL query logging in debug mode
- Error tracking and monitoring ready

### Metrics (Ready to implement)
- Request/response metrics
- Database performance metrics
- User activity metrics

## 🔄 Integration with Frontend

This API is designed to work seamlessly with the React Native frontend:

### Authentication Flow
1. Frontend sends login credentials to `/api/auth/login`
2. API returns JWT tokens and user information
3. Frontend stores tokens and includes in Authorization header
4. API validates tokens for protected endpoints

### Role-Based Features
- **Admin**: Full access to all endpoints and user management
- **Accountant**: Manage companies, bills, and view all payments
- **Executive**: Record payments and view assigned bills

### Real-time Updates
- RESTful API design for easy frontend integration
- Consistent response formats
- Comprehensive error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Email: support@jaskirat.com

## 🎯 Roadmap

### Planned Features
- [ ] Email notifications for overdue bills
- [ ] SMS integration for payment reminders
- [ ] Advanced reporting and analytics
- [ ] File upload for bill attachments
- [ ] Bulk payment import/export
- [ ] API rate limiting
- [ ] Redis caching layer
- [ ] Webhook notifications

### Performance Optimizations
- [ ] Database query optimization
- [ ] Response caching
- [ ] Background task processing
- [ ] Connection pooling optimization
