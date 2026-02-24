# Environment Variables & Local Development Setup

## Environment Variables Template

### `.env.example` (Root)

```bash
# ============================================
# BIN TRACKING SYSTEM - ENVIRONMENT VARIABLES
# ============================================

# ----------------
# Database (Supabase)
# ----------------
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"

# ----------------
# Application
# ----------------
NODE_ENV="development"  # development | production | test
PORT="3001"             # Backend API port
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:3001"

# ----------------
# Authentication
# ----------------
JWT_SECRET="[GENERATE-A-SECURE-SECRET]"
JWT_EXPIRES_IN="7d"

# ----------------
# Cardano (Blockfrost)
# ----------------
BLOCKFROST_PROJECT_ID="[YOUR-BLOCKFROST-PROJECT-ID]"
BLOCKFROST_NETWORK="preprod"  # preprod | mainnet
CARDANO_WALLET_MNEMONIC="[YOUR-24-WORD-MNEMONIC]"

# ----------------
# Monitoring (Sentry)
# ----------------
NEXT_PUBLIC_SENTRY_DSN="[YOUR-SENTRY-DSN]"
SENTRY_AUTH_TOKEN="[YOUR-SENTRY-AUTH-TOKEN]"
SENTRY_ORG="[YOUR-SENTRY-ORG]"
SENTRY_PROJECT="[YOUR-SENTRY-PROJECT]"

# ----------------
# Logging
# ----------------
LOG_LEVEL="info"  # debug | info | warn | error

# ----------------
# Rate Limiting
# ----------------
RATE_LIMIT_MAX="100"        # Max requests per window
RATE_LIMIT_WINDOW="60000"   # Window in milliseconds (1 minute)

# ----------------
# CORS
# ----------------
ALLOWED_ORIGINS="http://localhost:3000,https://bin-tracker.yourcompany.com"

# ----------------
# Feature Flags
# ----------------
ENABLE_CARDANO_ANCHORING="false"  # true | false
ENABLE_REAL_TIME="true"           # true | false
```

---

## Local Development Setup (Docker Compose)

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL Database (for local development)
  postgres:
    image: postgres:16-alpine
    container_name: bin-tracker-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bin_tracker_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (for caching - optional for MVP)
  redis:
    image: redis:7-alpine
    container_name: bin-tracker-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Supabase Local (optional - for full local development)
  # Uncomment if you want to run Supabase locally instead of using cloud
  # supabase:
  #   image: supabase/postgres:15.1.0.117
  #   container_name: bin-tracker-supabase
  #   restart: unless-stopped
  #   environment:
  #     POSTGRES_PASSWORD: postgres
  #   ports:
  #     - "54322:5432"
  #   volumes:
  #     - supabase_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  redis_data:
  # supabase_data:
```

---

## Local Development `.env` (for Docker Compose)

### `.env.local`

```bash
# Local Development Environment
# This file is used when running with Docker Compose

# Database (Local PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bin_tracker_dev"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/bin_tracker_dev"

# Application
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:3001"

# Authentication (Local - not secure, only for dev)
JWT_SECRET="local-dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"

# Cardano (Preprod Testnet)
BLOCKFROST_PROJECT_ID="preprodYourProjectIdHere"
BLOCKFROST_NETWORK="preprod"
CARDANO_WALLET_MNEMONIC="your test wallet mnemonic here (24 words)"

# Monitoring (Disabled in local dev)
NEXT_PUBLIC_SENTRY_DSN=""
LOG_LEVEL="debug"

# Rate Limiting (Relaxed for local dev)
RATE_LIMIT_MAX="1000"
RATE_LIMIT_WINDOW="60000"

# CORS (Allow all in local dev)
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Feature Flags
ENABLE_CARDANO_ANCHORING="false"  # Disable in local dev
ENABLE_REAL_TIME="true"
```

---

## Package.json Scripts

### Root `package.json`

```json
{
  "name": "bin-tracker",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "tools/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules",
    
    "db:generate": "cd packages/db && prisma generate",
    "db:migrate": "cd packages/db && prisma migrate dev",
    "db:migrate:deploy": "cd packages/db && prisma migrate deploy",
    "db:studio": "cd packages/db && prisma studio",
    "db:seed": "cd packages/db && tsx prisma/seed.ts",
    "db:reset": "cd packages/db && prisma migrate reset",
    
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    
    "prepare": "husky install"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "prettier": "^3.2.4",
    "turbo": "^1.11.3",
    "typescript": "^5.3.3"
  }
}
```

---

## Getting Started Guide

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/yourcompany/bin-tracker.git
cd bin-tracker

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your values
nano .env.local
```

### 2. Start Local Database

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Check logs
npm run docker:logs

# Verify database is running
docker ps
```

### 3. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with test data
npm run db:seed

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### 4. Start Development Servers

```bash
# Start all apps in development mode
npm run dev

# This starts:
# - Frontend (Next.js): http://localhost:3000
# - Backend (Fastify): http://localhost:3001
```

### 5. Verify Setup

```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test
```

---

## Environment-Specific Configurations

### Development

```bash
NODE_ENV="development"
LOG_LEVEL="debug"
ENABLE_CARDANO_ANCHORING="false"  # Disable expensive operations
```

**Features:**
- Detailed logging
- Hot reload
- Source maps
- No rate limiting
- Local database

### Staging

```bash
NODE_ENV="production"
LOG_LEVEL="info"
ENABLE_CARDANO_ANCHORING="true"
BLOCKFROST_NETWORK="preprod"  # Testnet
```

**Features:**
- Production build
- Preprod Cardano network
- Real Supabase instance
- Sentry monitoring
- Rate limiting enabled

### Production

```bash
NODE_ENV="production"
LOG_LEVEL="warn"
ENABLE_CARDANO_ANCHORING="true"
BLOCKFROST_NETWORK="mainnet"  # Mainnet
```

**Features:**
- Optimized build
- Mainnet Cardano network
- Production Supabase
- Full monitoring
- Strict rate limiting
- Security headers

---

## Secrets Management

### Development (Local)

- Use `.env.local` file (gitignored)
- Commit `.env.example` as template
- Never commit actual secrets

### Production (Vercel)

```bash
# Set environment variables in Vercel dashboard
# Or use Vercel CLI:

vercel env add DATABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add JWT_SECRET production
vercel env add BLOCKFROST_PROJECT_ID production
vercel env add CARDANO_WALLET_MNEMONIC production
vercel env add SENTRY_AUTH_TOKEN production
```

### Production (Self-Hosted)

Use a secrets manager:
- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Kubernetes Secrets**

Example with AWS Secrets Manager:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({ region: 'us-east-1' })

async function getSecret(secretName: string) {
  const command = new GetSecretValueCommand({ SecretId: secretName })
  const response = await client.send(command)
  return JSON.parse(response.SecretString!)
}

const secrets = await getSecret('bin-tracker/production')
process.env.DATABASE_URL = secrets.DATABASE_URL
```

---

## Database Seeding (Development)

### `packages/db/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create facilities
  const chicago = await prisma.facility.create({
    data: {
      name: 'Chicago Processing',
      address: '123 Industrial Ave, Chicago, IL 60601',
      lat: 41.8781,
      lng: -87.6298
    }
  })

  const denver = await prisma.facility.create({
    data: {
      name: 'Denver Processing',
      address: '456 Factory Rd, Denver, CO 80202',
      lat: 39.7392,
      lng: -104.9903
    }
  })

  // Create bin types
  const heartType = await prisma.binType.create({
    data: {
      organType: 'heart',
      dkHours: 4,
      prefix: 'BIN-HEART-'
    }
  })

  const liverType = await prisma.binType.create({
    data: {
      organType: 'liver',
      dkHours: 6,
      prefix: 'BIN-LIVER-'
    }
  })

  // Create bins
  for (let i = 1; i <= 10; i++) {
    await prisma.bin.create({
      data: {
        qrCode: `BIN-HEART-${String(i).padStart(3, '0')}`,
        binTypeId: heartType.id,
        currentFacilityId: i % 2 === 0 ? chicago.id : denver.id,
        status: 'IDLE'
      }
    })
  }

  for (let i = 1; i <= 10; i++) {
    await prisma.bin.create({
      data: {
        qrCode: `BIN-LIVER-${String(i).padStart(3, '0')}`,
        binTypeId: liverType.id,
        currentFacilityId: i % 2 === 0 ? chicago.id : denver.id,
        status: 'IDLE'
      }
    })
  }

  // Create test users
  await prisma.user.create({
    data: {
      email: 'admin@bintracker.com',
      name: 'Admin User',
      role: 'ADMIN'
    }
  })

  await prisma.user.create({
    data: {
      email: 'ops@bintracker.com',
      name: 'Ops Manager',
      role: 'OPS_MANAGER'
    }
  })

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

---

## Quick Reference

### Start Development

```bash
npm run docker:up      # Start database
npm run db:migrate     # Run migrations
npm run dev            # Start all apps
```

### Reset Everything

```bash
npm run docker:down    # Stop database
npm run clean          # Clean all builds
npm run docker:up      # Start fresh
npm run db:reset       # Reset database
npm run dev            # Start again
```

### Deploy to Production

```bash
npm run typecheck      # Check types
npm run lint           # Check code quality
npm run test           # Run all tests
npm run build          # Build for production
git push origin main   # Deploy (Vercel auto-deploys)
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs bin-tracker-db

# Restart database
docker-compose restart postgres
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Prisma Client Not Generated

```bash
# Regenerate Prisma Client
npm run db:generate

# If still failing, clean and regenerate
rm -rf node_modules/.prisma
npm run db:generate
```

---

This setup provides a complete local development environment that mirrors production! 🚀
