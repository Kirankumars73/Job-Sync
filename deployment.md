# JobSync — Deployment Guide

---

## Environment Strategy

| Environment | Purpose | Infrastructure |
|---|---|---|
| **development** | Local development | Docker Compose (all services local) |
| **staging** | QA + integration testing | AWS ECS (low-cost, same config as prod) |
| **production** | Live traffic | AWS ECS Fargate + RDS + ElastiCache |

---

## Docker Setup

### Directory Structure

```
docker/
├── nginx/
│   ├── nginx.conf
│   └── ssl/
├── api/
│   └── Dockerfile
├── web/
│   └── Dockerfile
├── docker-compose.yml          ← Development
└── docker-compose.prod.yml     ← Production-ready
```

### API Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production runtime
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

### Web Dockerfile

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
```

### docker-compose.yml (Development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: jobsync_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localpass
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning

  api:
    build:
      context: ./apps/api
      target: deps          # dev target: hot reload
    volumes:
      - ./apps/api/src:/app/src
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:localpass@postgres:5432/jobsync_dev
      REDIS_URL: redis://redis:6379
    env_file:
      - ./apps/api/.env
    depends_on:
      - postgres
      - redis
    command: pnpm dev

  web:
    build:
      context: ./apps/web
      target: deps
    volumes:
      - ./apps/web/src:/app/src
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    command: pnpm dev

volumes:
  pg_data:
```

### docker-compose.prod.yml (Production)

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - web

  api:
    image: ${AWS_ECR_REGISTRY}/jobsync-api:${IMAGE_TAG}
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
    environment:
      NODE_ENV: production
    secrets:
      - db_url
      - redis_url
      - jwt_private_key

  web:
    image: ${AWS_ECR_REGISTRY}/jobsync-web:${IMAGE_TAG}
    deploy:
      replicas: 2

secrets:
  db_url:
    external: true
  redis_url:
    external: true
  jwt_private_key:
    external: true
```

---

## Nginx Configuration

```nginx
# docker/nginx/nginx.conf

worker_processes auto;

events {
  worker_connections 1024;
}

http {
  # Rate limiting zones
  limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
  limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

  # Gzip
  gzip on;
  gzip_types text/plain application/json application/javascript text/css;

  upstream api_servers {
    server api:4000;
    # Add more: server api2:4000;
  }

  upstream web_servers {
    server web:3000;
  }

  # Redirect HTTP → HTTPS
  server {
    listen 80;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl http2;
    server_name jobsync.app www.jobsync.app;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    server_tokens off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Connection limit
    limit_conn conn_limit 20;

    # API proxy
    location /api/ {
      limit_req zone=api_limit burst=20 nodelay;

      proxy_pass http://api_servers;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;

      # Body size limit
      client_max_body_size 100k;
    }

    # Auth routes get stricter rate limiting
    location /api/auth/ {
      limit_req zone=auth_limit burst=5 nodelay;
      proxy_pass http://api_servers;
    }

    # WebSocket
    location /socket.io/ {
      proxy_pass http://api_servers;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
    }

    # Frontend
    location / {
      proxy_pass http://web_servers;
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }
  }
}
```

---

## CI/CD Pipeline (GitHub Actions)

### Pipeline Overview

```
Push to feature branch
  → Lint + Type Check
  → Unit Tests
  → Integration Tests (Docker Compose)
  → Security Scan (npm audit + Trivy)

Merge to main
  → All above checks
  → Build Docker images
  → Push to AWS ECR
  → Deploy to Staging (ECS)
  → Run smoke tests
  → Await manual approval for Production

Tag v*.*.* release
  → Deploy to Production (ECS blue/green)
  → Run health checks
  → Notify team on Slack
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: jobsync_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpass
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://postgres:testpass@localhost:5432/jobsync_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma migrate deploy
      - run: pnpm test

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'HIGH,CRITICAL'
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push API
        run: |
          docker build -t $ECR_REGISTRY/jobsync-api:$GITHUB_SHA ./apps/api
          docker push $ECR_REGISTRY/jobsync-api:$GITHUB_SHA

      - name: Build and push Web
        run: |
          docker build -t $ECR_REGISTRY/jobsync-web:$GITHUB_SHA ./apps/web
          docker push $ECR_REGISTRY/jobsync-web:$GITHUB_SHA

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Update ECS service (staging)
        run: |
          aws ecs update-service \
            --cluster jobsync-staging \
            --service jobsync-api \
            --force-new-deployment

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # requires manual approval in GitHub
    steps:
      - name: Update ECS service (production)
        run: |
          aws ecs update-service \
            --cluster jobsync-prod \
            --service jobsync-api \
            --force-new-deployment
```

---

## AWS Production Architecture

```
Route 53 (DNS)
    │
    ▼
CloudFront (CDN + WAF)
    │
    ▼
Application Load Balancer
    │
    ├── Target Group: API (ECS Fargate tasks × 2+)
    └── Target Group: Web (ECS Fargate tasks × 2+)

ECS Fargate:
  Cluster: jobsync-prod
  Services:
    - jobsync-api (2 tasks min, autoscale to 10)
    - jobsync-web (2 tasks min, autoscale to 5)
    - jobsync-worker (1 task min, autoscale to 5)

RDS:
  PostgreSQL 16 (db.t4g.medium)
  Multi-AZ enabled
  Automated backups: 7 days retention
  Read replica: 1 (ap-south-1b)

ElastiCache:
  Redis 7 (cache.t4g.small)
  Cluster mode: disabled (single node for MVP)
  Enable cluster mode at 50K+ users

S3:
  Bucket: jobsync-assets (future: avatars, exports)
  Versioning: enabled
  Lifecycle: archive to Glacier after 90 days

VPC:
  Private subnets: RDS, ElastiCache, ECS tasks
  Public subnets: ALB only
  NAT Gateway for outbound traffic
```

---

## Monitoring & Observability

### Health Check Endpoints

```
GET /health          → { status: 'ok', uptime: 12345, version: '1.0.0' }
GET /health/db       → PostgreSQL connectivity check
GET /health/redis    → Redis connectivity check
```

### Metrics (AWS CloudWatch + custom)

| Metric | Alert Threshold |
|---|---|
| API p95 response time | > 500ms |
| API error rate (5xx) | > 1% of requests |
| CPU utilization (ECS) | > 80% for 5 min → scale out |
| Memory utilization | > 85% |
| Queue depth (BullMQ) | > 1000 jobs → alert |
| DB connections | > 80% of max |
| Redis memory | > 75% |

### Logging Stack

```
ECS Tasks → CloudWatch Logs
         → Log Insights queries for debugging
         → (Future) OpenSearch for structured search
```

Application uses **Winston** with JSON format. Log levels: `error`, `warn`, `info`, `debug`.

---

## Database Backups

### Automated Backups

- **RDS Automated Backups**: Daily snapshot, 7-day retention, point-in-time recovery enabled
- **Manual Snapshots**: Before every major deployment

### Backup Restore Procedure

```bash
# Restore to a point in time (RDS Console or CLI)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier jobsync-prod \
  --target-db-instance-identifier jobsync-prod-restore \
  --restore-time 2025-01-20T10:00:00Z

# Verify restore
psql $RESTORE_URL -c "SELECT COUNT(*) FROM users;"

# Update application connection string
# → Run migrations if needed
# → Switch traffic
```

### Backup Testing

- Monthly restore drill to verify backups are valid
- Automated backup integrity check via Lambda function

---

## Disaster Recovery

### RTO / RPO Targets

| Scenario | RTO (Recovery Time) | RPO (Data Loss) |
|---|---|---|
| Single AZ failure | < 5 minutes | 0 (Multi-AZ RDS auto-failover) |
| Full region failure | < 1 hour | < 15 minutes |
| Accidental data deletion | < 30 minutes | < 24 hours |
| Ransomware / compromise | < 4 hours | < 24 hours |

### Runbooks

**Database failover**:
1. RDS Multi-AZ auto-promotes standby (< 60 seconds)
2. Application reconnects via DNS (Aurora endpoint handles this)
3. Verify via CloudWatch alerts clearing

**Full region failure**:
1. Promote RDS read replica in secondary region
2. Update Route 53 to secondary region ALB
3. Redeploy ECS services in secondary region (images in ECR are multi-region)
4. Verify health checks pass
5. Update DNS TTL to 60s for faster future failover

**Rollback deployment**:
```bash
# Roll back to previous ECS task definition
aws ecs update-service \
  --cluster jobsync-prod \
  --service jobsync-api \
  --task-definition jobsync-api:${PREVIOUS_REVISION}
```

---

## Migration Strategy

All database changes use **Prisma Migrate** with the following rules:
- Migrations are **additive only** in production (no destructive changes in a single deploy)
- Column drops use a 3-step process: deprecate → deploy → remove
- Every migration reviewed by 2 engineers before merging
- Staging migration must succeed before production deploy

```bash
# Development
pnpm prisma migrate dev --name add_application_notes

# Production (CI/CD runs this before deploying new API version)
pnpm prisma migrate deploy
```
