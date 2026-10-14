# 🔁 LoopIn — *Need it? Loop it.*

> A campus-sharing platform where students lend and borrow useful items, track loans, build transparent reliability scores, and measure estimated savings from reuse.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Demo Mode)](#quick-start-demo-mode)
- [Environment Setup](#environment-setup)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Workspace Layout](#workspace-layout)

---

## Project Structure

```
loopin/
├── frontend/          # React + Vite + TypeScript SPA
├── backend/           # AWS Lambda handlers (Node.js + TypeScript)
├── shared/            # Types, constants & utilities shared across frontend/backend
├── infra/             # AWS SAM templates & IAM policies
├── tests/             # Vitest unit & integration tests
├── scripts/           # Developer helper scripts
├── .env.example       # Template – copy to .env.local, never commit secrets
├── README.md
├── PROJECT_PLAN.md
└── ARCHITECTURE.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| npm | ≥ 10 | bundled with Node |
| AWS CLI | ≥ 2 | https://aws.amazon.com/cli/ |
| AWS SAM CLI | ≥ 1.120 | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |

> **AWS resources are NOT created automatically.** You must run `sam deploy` explicitly after reviewing `infra/sam/template.yaml`. See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Quick Start (Demo Mode)

The app runs entirely in **demo mode** with local mock data — no AWS account required.

```powershell
# 1. Clone / open the project
cd C:\Users\NIRANJNA\.gemini\antigravity-ide\scratch\loopin

# 2. Set up environment
Copy-Item .env.example .env.local
# .env.local already has VITE_APP_MODE=demo — no further changes needed

# 3. Install all workspace dependencies
npm install

# 4. Start the frontend dev server
npm run dev

# Open http://localhost:5173 in your browser
```

---

## Environment Setup

```powershell
# Copy template
Copy-Item .env.example .env.local

# Edit values (real AWS mode only — not needed for demo)
notepad .env.local
```

Key variables:

| Variable | Required for demo | Required for AWS |
|---|---|---|
| `VITE_APP_MODE` | ✅ (`demo`) | ✅ (`aws`) |
| `VITE_API_BASE_URL` | ❌ | ✅ |
| `VITE_COGNITO_USER_POOL_ID` | ❌ | ✅ |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | ❌ | ✅ |

---

## Available Scripts

Run from the **project root** (`loopin/`):

```powershell
# Development
npm run dev                   # Start Vite dev server (demo mode)

# Type Checking
npm run typecheck             # Check all workspaces
npm run typecheck:frontend    # Frontend only
npm run typecheck:backend     # Backend only

# Linting
npm run lint                  # Lint all workspaces

# Testing
npm run test                  # Run all tests
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only

# Building
npm run build                 # Build all workspaces
npm run build:frontend        # Frontend bundle only
npm run build:backend         # Backend Lambda bundle only

# Infrastructure (no AWS charges without explicit deploy)
npm run infra:validate        # Validate SAM template syntax only
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS, shadcn/ui |
| State | Zustand |
| Auth (client) | AWS Amplify Auth (Cognito) |
| Backend | Node.js 20, TypeScript, AWS Lambda |
| API | Amazon API Gateway HTTP API |
| Database | Amazon DynamoDB (single-table design) |
| Auth (server) | Amazon Cognito User Pools + JWT verification |
| Scheduling | Amazon EventBridge Scheduler |
| Notifications | Amazon SNS |
| IaC | AWS SAM |
| Testing | Vitest |

---

## Return Reminders Engine (EventBridge Scheduler & SNS)

LoopIn automatically schedules reminders when a loan becomes active (pickup) and coordinates return alerts:

1. **One-Time Schedules**: On loan pickup, LoopIn calculates reminder time (24h before due date) and overdue time, registering exact one-time schedules in the `ReminderScheduleGroup` using EventBridge Scheduler.
2. **Authoritative State Re-read**: When triggered, the `RemindersFunction` Lambda re-reads the authoritative record from DynamoDB. If the loan was already returned/completed, cancelled, or rejected, the notification is skipped.
3. **Idempotency & Retry Safety**: Sent notifications are recorded in `notificationHistory` on the loan item. Retried Lambda invocations or duplicate EventBridge deliveries are detected and skipped without double-sending.
4. **Schedule Lifecycle Management**:
   - Returning or cancelling a loan immediately cancels active EventBridge schedules.
   - Adjusting a loan's due date cancels outdated schedules and registers fresh schedules for the new due date.
5. **Privacy-Preserving SNS Publishing**: Student emails and notifications are published to the `loopin-notifications-${Environment}` SNS topic. Public event messages omit sensitive personal details.
6. **Simulated Demo Mode**: Set `SIMULATION_MODE=true` to demonstrate the entire scheduling and notification workflow in memory with `[SIMULATED DEMO]` labeled outputs without incurring AWS costs or sending real emails.

---

## Deployment & Verification Instructions

> ⚠️ **NO AWS RESOURCES WILL BE CREATED** until you explicitly approve and run the commands below.

### 1. Offline Verification (No AWS Resources)
Run the automated test suite covering completed loans, cancelled loans, duplicate invocations, changed due dates, and SNS failures:
```powershell
npm test
```
All 72 tests across 8 test suites run in-memory and validate the full reminder state machine.

### 2. Validating the Infrastructure Template
Verify SAM CloudFormation template syntax without deploying:
```powershell
sam validate -t infra/sam/template.yaml
```

### 3. Deploying to AWS (When Approved)
```powershell
sam build -t infra/sam/template.yaml
sam deploy --guided
```
Parameters to provide during deployment:
- `Environment`: `dev`
- `AllowedOrigin`: Frontend domain or `http://localhost:5173`

### 4. Subscribing to SNS Email Notifications
After deployment, confirm your email address on the SNS topic created:
```powershell
aws sns subscribe \
  --topic-arn <NotificationsTopicArn-from-stack-outputs> \
  --protocol email \
  --notification-endpoint your-student-email@campus.ac.in
```
Check your inbox and click **"Confirm subscription"** in the verification email sent by AWS SNS. (Note: Amazon SNS publish requests only queue messages for confirmed subscribers).

### 5. Cleanup Instructions (Deleting All Resources)
To remove all provisioned AWS resources, EventBridge schedules, and DynamoDB data:
```powershell
sam delete --stack-name loopin-dev
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture document including:
- System diagram
- Data entities & DynamoDB single-table design
- API contracts
- Security boundaries
- Deployment approach

## Project Plan

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the phased delivery plan.
