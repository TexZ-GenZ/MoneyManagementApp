# Jaskirat Textiles - Money Management System

A comprehensive, secure payment management system built for textile industry operations with role-based access control, automated workflows, and real-time notifications.

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        RN[React Native/Expo Mobile App]
        WV[WebView Components]
    end
    
    subgraph "API Gateway"
        RL[Rate Limiter<br/>Redis + SlowAPI]
        AUTH[JWT Authentication]
        CORS[CORS Middleware]
    end
    
    subgraph "Backend Services"
        API[FastAPI REST API]
        SCHED[APScheduler<br/>Background Tasks]
        ETL[ETL Pipeline<br/>DBF Processing]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary Database)]
        REDIS[(Redis<br/>Rate Limiting & Cache)]
        DBF[Legacy .DBF Files]
    end
    
    subgraph "External Services"
        FCM[Firebase Cloud<br/>Messaging]
        RAILWAY[Railway<br/>Cloud Platform]
        EXPO[Expo Push<br/>Notifications]
    end
    
    subgraph "Infrastructure"
        DOCKER[Docker Containers]
        NGINX[Load Balancer]
        SSL[SSL/TLS]
    end
    
    RN --> RL
    RL --> AUTH
    AUTH --> CORS
    CORS --> API
    API --> PG
    API --> REDIS
    API --> SCHED
    SCHED --> FCM
    ETL --> DBF
    ETL --> PG
    API --> FCM
    FCM --> EXPO
    EXPO --> RN
    
    DOCKER --> RAILWAY
    SSL --> DOCKER
    NGINX --> SSL
```

## 🔐 Security Architecture

```mermaid
graph TD
    subgraph "Authentication Flow"
        LOGIN[Login Request]
        VALIDATE[Credential Validation]
        JWT[JWT Token Generation]
        STORE[Secure Token Storage]
    end
    
    subgraph "Authorization Matrix"
        ADMIN[Admin Role]
        ACCOUNT[Accountant Role]
        EXEC[Executive Role]
    end
    
    subgraph "Rate Limiting Strategy"
        IP_LIMIT[IP-based Limits<br/>@limiter.limit]
        USER_LIMIT[User-based Limits<br/>@user_limiter.limit]
        REDIS_STORE[Redis Storage]
    end
    
    subgraph "Data Protection"
        HASH[Password Hashing<br/>bcrypt]
        ENCRYPT[Token Encryption<br/>expo-secure-store]
        VALIDATE_INPUT[Input Validation<br/>Pydantic Schemas]
    end
    
    LOGIN --> VALIDATE
    VALIDATE --> HASH
    VALIDATE --> JWT
    JWT --> STORE
    STORE --> ENCRYPT
    
    ADMIN --> USER_LIMIT
    ACCOUNT --> USER_LIMIT
    EXEC --> USER_LIMIT
    
    USER_LIMIT --> REDIS_STORE
    IP_LIMIT --> REDIS_STORE
    
    JWT --> VALIDATE_INPUT
```

## 📊 Data Flow Architecture

```mermaid
sequenceDiagram
    participant Mobile as Mobile App
    participant API as FastAPI Backend
    participant Redis as Redis Cache
    participant DB as PostgreSQL
    participant FCM as Firebase CM
    participant Scheduler as APScheduler
    
    Note over Mobile,Scheduler: Payment Submission Flow
    
    Mobile->>API: POST /payments (with JWT)
    API->>Redis: Check rate limits
    Redis-->>API: Allow/Deny
    API->>DB: Validate business rules
    API->>DB: Create payment record
    API->>DB: Update bill allocations
    DB-->>API: Transaction committed
    API-->>Mobile: Payment created
    
    Note over Mobile,Scheduler: Background Processing
    
    Scheduler->>DB: Scan overdue bills
    Scheduler->>DB: Check promise dates
    Scheduler->>FCM: Send notifications
    FCM->>Mobile: Push notifications
    
    Note over Mobile,Scheduler: Legacy Data Import
    
    API->>DB: Import .DBF files
    API->>DB: Recalculate balances
    API->>DB: Update company status
    API->>Scheduler: Trigger notifications
```

## 🏢 Business Logic Flow

```mermaid
stateDiagram-v2
    [*] --> Pending: Payment Submitted
    
    state "Payment States" as PaymentFlow {
        Pending --> Accountant_Approved: Accountant Approval
        Pending --> Declined: Rejected
        Accountant_Approved --> Admin_Approved: Admin Approval
        Accountant_Approved --> Declined: Admin Rejection
        Admin_Approved --> [*]: Final Approval
        Declined --> [*]: Process Ends
    }
    
    state "Bill Management" as BillFlow {
        [*] --> Active: Bill Created
        Active --> Partially_Paid: Payment Applied
        Partially_Paid --> Paid: Full Payment
        Active --> Overdue: Past Due Date
        Overdue --> Paid: Late Payment
        Paid --> [*]: Archived
    }
    
    state "Notification System" as NotifFlow {
        [*] --> Scan: Scheduled Check
        Scan --> Generate: Rules Violated
        Generate --> Delivered: Push Sent
        Delivered --> Acknowledged: User Action
        Acknowledged --> [*]: Process Complete
    }
```

## 🔧 Technical Stack

### Backend Core
- **FastAPI** - High-performance Python web framework
- **PostgreSQL** - Primary relational database
- **SQLAlchemy** - ORM with Alembic migrations
- **Redis** - Rate limiting and caching
- **SlowAPI** - Advanced rate limiting with Redis backend

### Authentication & Security
- **JWT** - Stateless authentication tokens
- **bcrypt** - Password hashing
- **Role-based Access Control** - Admin/Accountant/Executive roles
- **Pydantic** - Input validation and serialization

### Background Processing
- **APScheduler** - Cron-based notification scheduling
- **Firebase Cloud Messaging** - Push notifications
- **Custom ETL Pipeline** - Legacy .DBF file processing

### Mobile Frontend
- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and services
- **Redux Toolkit** - State management
- **expo-secure-store** - Encrypted local storage

### Infrastructure
- **Docker** - Containerization
- **Railway** - Cloud deployment platform
- **docker-compose** - Local development orchestration

## 📱 Mobile Application Features

### Role-Based Dashboards
```mermaid
graph LR
    subgraph "Admin Dashboard"
        A1[User Management]
        A2[Payment Approvals]
        A3[System Settings]
        A4[Data Import/Export]
        A5[Company Assignments]
    end
    
    subgraph "Accountant Dashboard"
        B1[Payment Review]
        B2[Bill Management]
        B3[Financial Reports]
        B4[Approval Queue]
    end
    
    subgraph "Executive Dashboard"
        C1[Company List]
        C2[Payment Submission]
        C3[Bill Tracking]
        C4[Payment History]
    end
```

### Key Mobile Screens
- **Authentication** - Secure login with biometric support
- **Payment Submission** - Multi-bill payment allocation with GPS tracking
- **Approval Workflows** - Two-stage approval process
- **Real-time Notifications** - Payment alerts and overdue reminders
- **Company Management** - Promise/credit date updates
- **File Upload** - Legacy data import capabilities

## 🔄 API Endpoints

### Authentication
```
POST /auth/login          # User authentication
GET  /auth/me             # Current user profile
POST /auth/push-token     # Register push notifications
```

### Payment Management
```
POST /payments                           # Submit new payment
GET  /payments/{id}                     # Payment details
POST /accountant/payments/{id}/approve  # Accountant approval
POST /admin/payments/{id}/approve       # Admin approval
GET  /payments/activity                 # Payment history
```

### Company Operations
```
GET    /companies                       # List companies
GET    /companies/{code}/dashboard      # Company overview
PATCH  /companies/{code}/promise        # Update promise date
PATCH  /companies/{code}/credit         # Update credit date
GET    /companies/{code}/bills          # Company bills
```

### Administration
```
GET    /admin/users                     # User management
POST   /admin/users                     # Create user
PATCH  /admin/users/{id}/activate       # User activation
DELETE /admin/users/{id}                # User deletion
POST   /admin/notifications/scan        # Manual notification trigger
```

## 🚀 Deployment Architecture

```mermaid
graph TB
    subgraph "Railway Cloud Platform"
        subgraph "Production Environment"
            APP[FastAPI Application]
            PG_PROD[(PostgreSQL Database)]
            REDIS_PROD[(Redis Cache)]
        end
        
        subgraph "Environment Variables"
            DB_URL[DATABASE_URL]
            JWT_SEC[JWT_SECRET]
            REDIS_URL[REDIS_URL]
            FCM_KEY[Firebase Credentials]
            RATE_LIMITS[Rate Limit Configs]
        end
    end
    
    subgraph "Docker Container"
        DOCKERFILE[Multi-stage Build]
        DEPS[Python Dependencies]
        APP_CODE[Application Code]
        MIGRATIONS[Database Migrations]
    end
    
    subgraph "CI/CD Pipeline"
        GIT[Git Repository]
        BUILD[Docker Build]
        DEPLOY[Railway Deploy]
        HEALTH[Health Checks]
    end
    
    GIT --> BUILD
    BUILD --> DOCKERFILE
    DOCKERFILE --> DEPLOY
    DEPLOY --> APP
    APP --> PG_PROD
    APP --> REDIS_PROD
    DEPLOY --> HEALTH
```

## 🧪 Testing Strategy

### Test Coverage
- **56+ Test Files** - Comprehensive test suite
- **Unit Tests** - Individual component testing
- **Integration Tests** - API endpoint validation
- **Concurrency Tests** - Race condition handling
- **Security Tests** - Authentication/authorization validation

### Test Categories
```mermaid
mindmap
  root((Testing Strategy))
    Authentication
      JWT Validation
      Role Permissions
      Session Management
    Business Logic
      Payment Workflows
      Bill Calculations
      Date Validations
    API Endpoints
      Request/Response
      Error Handling
      Rate Limiting
    Data Integrity
      Transaction Safety
      Concurrent Operations
      Audit Trails
    Security
      Input Validation
      SQL Injection Prevention
      Rate Limit Enforcement
```

## 📋 Installation & Setup

### Prerequisites
- **Docker & Docker Compose**
- **Node.js 18+** (for mobile development)
- **Expo CLI** (for mobile builds)
- **PostgreSQL** (for local development)
- **Redis** (for rate limiting)

### Local Development Setup

1. **Clone Repository**
```bash
git clone <repository-url>
cd MoneyManagementApp
```

2. **Backend Setup**
```bash
cd backend
cp .env.example .env
# Configure environment variables
docker-compose up --build
```

3. **Mobile App Setup**
```bash
cd payments
npm install
npx expo start
```

### Environment Configuration

```bash
# Database Configuration
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/app
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Rate Limiting
RATE_LIMIT_LOGIN=10/minute
RATE_LIMIT_PAYMENT_SUBMIT=10/hour
RATE_LIMIT_DATA_READ=60/minute

# Firebase Configuration
SERVICE_ACCOUNT_FILE=path/to/firebase-credentials.json
PROJECT_ID=your-firebase-project-id
```

## 📈 Performance Metrics

- **Response Time** - < 200ms average API response
- **Concurrent Users** - Supports 100+ simultaneous users
- **Database Queries** - Optimized with proper indexing
- **Rate Limiting** - Configurable per-endpoint limits
- **Caching Strategy** - Redis-based caching for frequent queries

## 🔮 Future Enhancements

- **Microservices Architecture** - Service decomposition
- **Advanced Analytics** - Business intelligence dashboard  
- **Multi-tenant Support** - Multiple organization support
- **Audit Logging** - Comprehensive activity tracking
- **API Versioning** - Backward compatibility strategy
- **Performance Monitoring** - APM integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## 📄 License

This project is proprietary software developed for Jaskirat Textiles.

---

**Built with ❤️ for the textile industry** | **Powered by FastAPI + React Native**
