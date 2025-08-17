# AWS Deployment Guide for Jaskirat Textiles API

This guide will help you deploy the Jaskirat Textiles FastAPI application to AWS using ECS Fargate and RDS PostgreSQL.

## Prerequisites

1. AWS CLI installed and configured
2. Docker installed
3. An AWS account with appropriate permissions

## Deployment Architecture

```
Internet Gateway
    ↓
Application Load Balancer (ALB)
    ↓
ECS Fargate Service
    ↓
RDS PostgreSQL Database
```

## Step 1: Create RDS PostgreSQL Database

### 1.1 Create DB Subnet Group
```bash
aws rds create-db-subnet-group \
    --db-subnet-group-name jaskirat-db-subnet-group \
    --db-subnet-group-description "Subnet group for Jaskirat DB" \
    --subnet-ids subnet-12345678 subnet-87654321 \
    --tags Key=Name,Value=jaskirat-db-subnet-group
```

### 1.2 Create Security Group for RDS
```bash
aws ec2 create-security-group \
    --group-name jaskirat-db-sg \
    --description "Security group for Jaskirat RDS" \
    --vpc-id vpc-12345678

# Allow PostgreSQL access from ECS
aws ec2 authorize-security-group-ingress \
    --group-id sg-12345678 \
    --protocol tcp \
    --port 5432 \
    --source-group sg-87654321
```

### 1.3 Create RDS Instance
```bash
aws rds create-db-instance \
    --db-instance-identifier jaskirat-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username jaskirat \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --storage-type gp2 \
    --vpc-security-group-ids sg-12345678 \
    --db-subnet-group-name jaskirat-db-subnet-group \
    --backup-retention-period 7 \
    --storage-encrypted \
    --tags Key=Name,Value=jaskirat-db
```

## Step 2: Build and Push Docker Image

### 2.1 Create Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.2 Create ECR Repository
```bash
aws ecr create-repository --repository-name jaskirat-api
```

### 2.3 Build and Push Image
```bash
# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t jaskirat-api .

# Tag image
docker tag jaskirat-api:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/jaskirat-api:latest

# Push image
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/jaskirat-api:latest
```

## Step 3: Create ECS Cluster and Service

### 3.1 Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name jaskirat-cluster
```

### 3.2 Create Task Definition
Create `task-definition.json`:
```json
{
    "family": "jaskirat-api",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
    "containerDefinitions": [
        {
            "name": "jaskirat-api",
            "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/jaskirat-api:latest",
            "portMappings": [
                {
                    "containerPort": 8000,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {
                    "name": "ENVIRONMENT",
                    "value": "production"
                },
                {
                    "name": "DATABASE_URL",
                    "value": "postgresql+asyncpg://jaskirat:YourSecurePassword123!@jaskirat-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/jaskirat_db"
                }
            ],
            "secrets": [
                {
                    "name": "SECRET_KEY",
                    "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:jaskirat/secret-key"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/jaskirat-api",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "essential": true
        }
    ]
}
```

### 3.3 Register Task Definition
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 3.4 Create Security Group for ECS
```bash
aws ec2 create-security-group \
    --group-name jaskirat-ecs-sg \
    --description "Security group for Jaskirat ECS" \
    --vpc-id vpc-12345678

# Allow HTTP access from ALB
aws ec2 authorize-security-group-ingress \
    --group-id sg-87654321 \
    --protocol tcp \
    --port 8000 \
    --source-group sg-alb123456
```

## Step 4: Create Application Load Balancer

### 4.1 Create ALB
```bash
aws elbv2 create-load-balancer \
    --name jaskirat-alb \
    --subnets subnet-12345678 subnet-87654321 \
    --security-groups sg-alb123456 \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4
```

### 4.2 Create Target Group
```bash
aws elbv2 create-target-group \
    --name jaskirat-tg \
    --protocol HTTP \
    --port 8000 \
    --vpc-id vpc-12345678 \
    --target-type ip \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2
```

### 4.3 Create Listener
```bash
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/jaskirat-alb/1234567890123456 \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/jaskirat-tg/1234567890123456
```

## Step 5: Create ECS Service

```bash
aws ecs create-service \
    --cluster jaskirat-cluster \
    --service-name jaskirat-api-service \
    --task-definition jaskirat-api:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-12345678,subnet-87654321],securityGroups=[sg-87654321],assignPublicIp=ENABLED}" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/jaskirat-tg/1234567890123456,containerName=jaskirat-api,containerPort=8000
```

## Step 6: Set Up Secrets Manager

### 6.1 Create Secret for JWT Secret Key
```bash
aws secretsmanager create-secret \
    --name jaskirat/secret-key \
    --description "JWT Secret key for Jaskirat API" \
    --secret-string "your-super-secure-jwt-secret-key-change-this-in-production"
```

## Step 7: Set Up CloudWatch Logs

```bash
aws logs create-log-group --log-group-name /ecs/jaskirat-api
```

## Step 8: Environment Variables

Update your `.env` file for production:

```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://jaskirat:YourSecurePassword123!@jaskirat-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/jaskirat_db
SECRET_KEY=your-super-secure-jwt-secret-key-change-this-in-production
ALLOWED_ORIGINS=["https://your-domain.com","https://www.your-domain.com"]
```

## Step 9: Domain and SSL (Optional)

### 9.1 Request SSL Certificate
```bash
aws acm request-certificate \
    --domain-name api.jaskirat.com \
    --validation-method DNS \
    --subject-alternative-names *.jaskirat.com
```

### 9.2 Update ALB with HTTPS Listener
```bash
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/jaskirat-alb/1234567890123456 \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/jaskirat-tg/1234567890123456
```

## Step 10: Initialize Database

After deployment, initialize the database:

```bash
# Connect to ECS task
aws ecs execute-command \
    --cluster jaskirat-cluster \
    --task task-id \
    --container jaskirat-api \
    --interactive \
    --command "/bin/bash"

# Inside container, run
python init_db.py
```

## Monitoring and Maintenance

### CloudWatch Alarms
- CPU Utilization
- Memory Utilization  
- HTTP Error Rates
- Database Connections

### Auto Scaling
Configure ECS service auto scaling based on CPU/Memory usage.

### Backup Strategy
- RDS automated backups
- Database snapshots
- Application logs retention

## Cost Optimization

1. **Right-sizing**: Monitor and adjust ECS task resources
2. **Reserved Instances**: For predictable workloads
3. **Spot Instances**: For development environments
4. **Schedule scaling**: Scale down during off-hours

## Security Best Practices

1. **VPC**: Deploy in private subnets
2. **IAM**: Use least privilege principle
3. **Secrets**: Store sensitive data in Secrets Manager
4. **WAF**: Consider AWS WAF for additional protection
5. **Encryption**: Enable encryption at rest and in transit

## Troubleshooting

### Common Issues
1. **Task failing to start**: Check CloudWatch logs
2. **Database connection issues**: Verify security groups
3. **Health check failures**: Check health endpoint
4. **Performance issues**: Monitor CloudWatch metrics

### Useful Commands
```bash
# View service status
aws ecs describe-services --cluster jaskirat-cluster --services jaskirat-api-service

# View task logs
aws logs tail /ecs/jaskirat-api --follow

# Update service
aws ecs update-service --cluster jaskirat-cluster --service jaskirat-api-service --force-new-deployment
```

## Estimated Monthly Costs

- **ECS Fargate**: ~$15-30/month (2 tasks, 0.25 vCPU, 0.5 GB RAM)
- **RDS t3.micro**: ~$15-20/month
- **ALB**: ~$20/month  
- **Data Transfer**: ~$5-10/month
- **CloudWatch**: ~$5/month

**Total**: ~$60-85/month

Remember to replace all placeholder values (account IDs, ARNs, etc.) with your actual AWS resource identifiers.
