# LoopIn — Architecture Document

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STUDENT BROWSER                                 │
│                     React SPA (Vite + TypeScript)                        │
│              Tailwind CSS + shadcn/ui + Zustand + Amplify Auth           │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ HTTPS / JWT Bearer token
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               Amazon API Gateway HTTP API                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │         Cognito JWT Authorizer (validates every request)         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ Lambda proxy integration
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AWS Lambda Functions                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ items handler│  │loans handler │  │users handler │  │score/sched │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
└─────────┼────────────────┼────────────────┼──────────────────┼─────────┘
          │                │                │                  │
          ▼                ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Amazon DynamoDB                                    │
│                  (Single-table design — loopin-{env})                    │
└─────────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │   Amazon EventBridge Scheduler                                     │
   │   (daily cron → due-date reminder Lambda → Amazon SNS → email)    │
   └────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │   Amazon Cognito User Pool                                         │
   │   (sign-up, sign-in, JWT issuance, email verification)            │
   └────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Entities

### 2.1 User

Managed by Cognito; extended profile stored in DynamoDB.

| Field | Type | Notes |
|---|---|---|
| `userId` | string (UUID) | Cognito `sub` |
| `email` | string | Verified by Cognito |
| `displayName` | string | |
| `campusId` | string | University/campus identifier |
| `reliabilityScore` | number | 0–100, updated by score Lambda |
| `totalSavings` | number | USD estimate of reuse savings |
| `borrowCount` | number | Lifetime borrows |
| `lendCount` | number | Lifetime lends |
| `createdAt` | ISO 8601 string | |
| `updatedAt` | ISO 8601 string | |

### 2.2 Item

A physical item a student is willing to lend.

| Field | Type | Notes |
|---|---|---|
| `itemId` | string (UUID) | |
| `ownerId` | string | FK → User.userId |
| `title` | string | |
| `description` | string | |
| `category` | ItemCategory | enum |
| `estimatedValue` | number | USD; used for savings calc |
| `imageUrl` | string? | Optional URL |
| `status` | ItemStatus | `available` \| `on_loan` \| `unavailable` |
| `condition` | ItemCondition | `new` \| `like_new` \| `good` \| `fair` |
| `tags` | string[] | |
| `campusId` | string | Filter items by campus |
| `createdAt` | ISO 8601 string | |
| `updatedAt` | ISO 8601 string | |

### 2.3 Loan

A borrowing transaction between two users.

| Field | Type | Notes |
|---|---|---|
| `loanId` | string (UUID) | |
| `itemId` | string | FK → Item.itemId |
| `borrowerId` | string | FK → User.userId |
| `lenderId` | string | FK → User.userId |
| `status` | LoanStatus | see below |
| `requestedAt` | ISO 8601 string | |
| `approvedAt` | ISO 8601 string? | |
| `dueDate` | ISO 8601 string | |
| `returnedAt` | ISO 8601 string? | |
| `borrowerNote` | string? | |
| `lenderNote` | string? | |
| `savingsValue` | number | Item.estimatedValue at time of loan |

**LoanStatus transitions:**
```
PENDING → APPROVED → ACTIVE → RETURNED
       ↘ REJECTED   ↘ OVERDUE
                    ↘ CANCELLED
```

### 2.4 Notification (DynamoDB record only)

| Field | Type | Notes |
|---|---|---|
| `notificationId` | string | |
| `userId` | string | Recipient |
| `type` | NotificationType | `loan_approved`, `due_tomorrow`, `overdue`, etc. |
| `loanId` | string? | Related loan |
| `message` | string | Human-readable |
| `read` | boolean | |
| `createdAt` | ISO 8601 string | |

---

## 3. DynamoDB Single-Table Design

**Table name:** `loopin-{env}` (e.g., `loopin-dev`, `loopin-prod`)

**Primary Key:** `PK` (partition key), `SK` (sort key)

### Access Patterns & Key Mapping

| Access Pattern | PK | SK |
|---|---|---|
| Get user profile | `USER#<userId>` | `PROFILE` |
| List items by owner | `USER#<userId>` | `ITEM#<itemId>` |
| Get single item | `ITEM#<itemId>` | `METADATA` |
| List items by campus | GSI1: `CAMPUS#<campusId>` | `ITEM#<status>#<itemId>` |
| Get single loan | `LOAN#<loanId>` | `METADATA` |
| List loans by borrower | GSI2: `USER#<borrowerId>` | `LOAN#<status>#<loanId>` |
| List loans by lender | GSI3: `USER#<lenderId>` | `LOAN#<status>#<loanId>` |
| List notifications | `USER#<userId>` | `NOTIF#<createdAt>#<notifId>` |

### Global Secondary Indexes

| GSI | PK Attribute | SK Attribute | Purpose |
|---|---|---|---|
| `GSI1-Campus-Items` | `campusId` | `itemStatusSK` | Browse items by campus |
| `GSI2-Borrower-Loans` | `borrowerId` | `loanStatusSK` | My borrows |
| `GSI3-Lender-Loans` | `lenderId` | `loanStatusSK` | My lends |

---

## 4. API Contracts

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/prod`

All routes require `Authorization: Bearer <cognito-jwt>` unless noted.

### 4.1 Items

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/items` | ✅ | List items (query: campusId, category, status, cursor) |
| `POST` | `/items` | ✅ | Create new item listing |
| `GET` | `/items/{itemId}` | ✅ | Get item detail |
| `PUT` | `/items/{itemId}` | ✅ Owner | Update item |
| `DELETE` | `/items/{itemId}` | ✅ Owner | Remove item |

**POST /items body:**
```json
{
  "title": "Scientific Calculator",
  "description": "Texas Instruments TI-84, great condition",
  "category": "electronics",
  "estimatedValue": 120,
  "condition": "like_new",
  "tags": ["calculator", "math"],
  "imageUrl": "https://..."
}
```

### 4.2 Loans

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/loans` | ✅ | My loans (query: role=borrower\|lender, status) |
| `POST` | `/loans` | ✅ | Request to borrow an item |
| `GET` | `/loans/{loanId}` | ✅ | Get loan detail |
| `PUT` | `/loans/{loanId}/approve` | ✅ Lender | Approve loan request |
| `PUT` | `/loans/{loanId}/reject` | ✅ Lender | Reject loan request |
| `PUT` | `/loans/{loanId}/return` | ✅ Lender | Mark item returned |
| `PUT` | `/loans/{loanId}/cancel` | ✅ Borrower | Cancel pending request |

### 4.3 Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | ✅ | Current user profile |
| `PUT` | `/users/me` | ✅ | Update profile |
| `GET` | `/users/{userId}` | ✅ | Public profile + score |

### 4.4 Common Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "cursor": "...", "count": 20 }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Item with id xyz does not exist",
    "statusCode": 404
  }
}
```

---

## 5. Security Boundaries

### 5.1 Authentication
- All API routes protected by **Cognito JWT Authorizer** at API Gateway level.
- Frontend uses **AWS Amplify Auth** — no raw AWS SDK credentials in browser.
- Cognito tokens expire in 1 hour; Amplify handles silent refresh via Refresh Token.

### 5.2 Authorization
- **Ownership checks** enforced at Lambda level (not API Gateway):
  - Only item owner can `PUT /items/{id}` or `DELETE /items/{id}`.
  - Only lender can approve/reject/mark-returned.
  - Only borrower can cancel.
- `userId` is extracted from the verified JWT `sub` claim — never from request body.

### 5.3 Data Isolation
- DynamoDB access scoped by `campusId` via GSI; students only see their campus.
- No cross-tenant data leakage possible via key design.

### 5.4 Secrets Management
- No AWS credentials in frontend code — Cognito Identity Pool not used (no temp creds needed).
- Lambda environment variables injected at deploy time via SAM parameters.
- No secrets in source code or `.env` files committed to git.

### 5.5 Infrastructure
- IAM roles follow **least privilege**: each Lambda has its own role with only the DynamoDB/SNS actions it needs.
- API Gateway CORS restricted to the deployed frontend URL (not `*`) in production.
- EventBridge Scheduler has a dedicated IAM role allowing only Lambda:InvokeFunction on the scheduler Lambda.

---

## 6. AWS Deployment Approach

> ⚠️ **No AWS resources are created automatically.** Deployment requires explicit `sam deploy` command by the developer.

### 6.1 Infrastructure as Code

All AWS resources defined in `infra/sam/template.yaml` using AWS SAM.

Resources defined (not yet deployed):
- `AWS::Serverless::Function` — one per Lambda handler group
- `AWS::Serverless::HttpApi` — API Gateway HTTP API
- `AWS::DynamoDB::Table` — single table with GSIs
- `AWS::Cognito::UserPool` + `AWS::Cognito::UserPoolClient`
- `AWS::SNS::Topic` — for notifications
- `AWS::Scheduler::Schedule` — for daily due-date scan
- `AWS::IAM::Role` — per Lambda, least privilege

### 6.2 Deployment Steps (Future)

```powershell
# 1. Build backend TypeScript
npm run build:backend

# 2. Validate SAM template (no charges)
npm run infra:validate

# 3. Build SAM artifacts
sam build --template infra/sam/template.yaml

# 4. Deploy to AWS (ONLY after your approval)
sam deploy --guided --config-file infra/samconfig.toml

# 5. Get outputs (API URL, Cognito IDs) and update .env.local
sam describe-stack-outputs --stack-name loopin-dev
```

### 6.3 Environments

| Environment | Stack Name | DynamoDB Table |
|---|---|---|
| Development | `loopin-dev` | `loopin-dev` |
| Staging | `loopin-staging` | `loopin-staging` |
| Production | `loopin-prod` | `loopin-prod` |

### 6.4 Cost Estimate (AWS Free Tier)

All services used are covered by AWS Free Tier for development/demo scale:
- Lambda: 1M free invocations/month
- DynamoDB: 25 GB storage, 25 WCU/RCU free
- API Gateway: 1M HTTP API calls free (first 12 months)
- Cognito: 50,000 MAUs free
- SNS: 1M notifications free
- EventBridge Scheduler: 14M invocations free/month
