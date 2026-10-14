# LoopIn — DynamoDB Database Architecture & Access Patterns

This document details the single-table DynamoDB design supporting item discovery, listing ownership, loan tracking, TrustScore auditing, and community impact.

---

## 1. Table Schema

- **Table Name:** `loopin-${Environment}` (e.g. `loopin-dev`, `loopin-prod`)
- **Billing Mode:** `PAY_PER_REQUEST` (on-demand)
- **Primary Key:**
  - **Partition Key (PK):** `String`
  - **Sort Key (SK):** `String`

### Global Secondary Indexes (GSIs)

| Index Name | Partition Key (HASH) | Sort Key (RANGE) | Projection | Purpose |
|---|---|---|---|---|
| **`GSI1-Campus-Items`** | `campusId` (S) | `itemStatusSK` (S) | `ALL` | Campus-scoped item discovery filtered by status (e.g. `STATUS#available#CREATED#...`) |
| **`GSI2-Borrower-Loans`** | `borrowerId` (S) | `loanStatusSK` (S) | `ALL` | Fast query of all loans where user is the borrower |
| **`GSI3-Lender-Loans`** | `lenderId` (S) | `loanStatusSK` (S) | `ALL` | Fast query of all loans where user is the lender |

---

## 2. Entity Storage Layout

### Item Metadata
- **`PK`:** `ITEM#{itemId}`
- **`SK`:** `METADATA`
- **Attributes:** `itemId`, `ownerId`, `ownerName`, `title`, `description`, `category`, `condition`, `estimatedValue`, `status`, `campusId`, `tags`, `imageUrl`, `createdAt`, `updatedAt`
- **GSI1 attributes:** `campusId = {campusId}`, `itemStatusSK = STATUS#{status}#CREATED#{createdAt}`

### Item Ownership Index
- **`PK`:** `USER#{ownerId}`
- **`SK`:** `ITEM#{itemId}`
- **Attributes:** `itemId`, `title`, `status`, `createdAt`
- **Purpose:** Fast lookup of all items listed by a specific student without querying the whole campus.

### Loan Agreement
- **`PK`:** `LOAN#{loanId}`
- **`SK`:** `METADATA`
- **Attributes:** `loanId`, `itemId`, `itemTitle`, `borrowerId`, `borrowerName`, `lenderId`, `lenderName`, `status`, `requestedAt`, `dueDate`, `savingsValue`, `borrowerNote`, `approvedAt`, `returnedAt`
- **GSI2 attributes:** `borrowerId = {borrowerId}`, `loanStatusSK = STATUS#{status}#REQUESTED#{requestedAt}`
- **GSI3 attributes:** `lenderId = {lenderId}`, `loanStatusSK = STATUS#{status}#REQUESTED#{requestedAt}`

### Student Profile
- **`PK`:** `USER#{userId}`
- **`SK`:** `PROFILE`
- **Attributes:** `userId`, `email`, `displayName`, `campusId`, `bio`, `reliabilityScore`, `totalSavings`, `borrowCount`, `lendCount`, `createdAt`, `updatedAt`

---

## 3. Core Access Patterns (No Table Scans)

| # | Access Pattern | Target / Operation | Key Condition Expression |
|---|---|---|---|
| 1 | **Discover available campus items** | `GSI1-Campus-Items` (Query) | `campusId = :c AND begins_with(itemStatusSK, "STATUS#available")` |
| 2 | **Discover items on loan / all** | `GSI1-Campus-Items` (Query) | `campusId = :c AND begins_with(itemStatusSK, "STATUS#")` |
| 3 | **Fetch item by ID** | Base Table (GetItem) | `PK = ITEM#{itemId} AND SK = METADATA` |
| 4 | **Fetch items listed by user** | Base Table (Query) | `PK = USER#{userId} AND begins_with(SK, "ITEM#")` |
| 5 | **Fetch loans where I am borrower** | `GSI2-Borrower-Loans` (Query) | `borrowerId = :userId AND begins_with(loanStatusSK, "STATUS#")` |
| 6 | **Fetch loans where I am lender** | `GSI3-Lender-Loans` (Query) | `lenderId = :userId AND begins_with(loanStatusSK, "STATUS#")` |
| 7 | **Fetch single loan agreement** | Base Table (GetItem) | `PK = LOAN#{loanId} AND SK = METADATA` |
| 8 | **Fetch student profile** | Base Table (GetItem) | `PK = USER#{userId} AND SK = PROFILE` |

---

## 4. Concurrency Protection & Atomic Operations

To prevent duplicate requests, race conditions, and double-booking:

### Atomic Loan Approval (`TransactWriteItems`)
When a lender calls `POST /loans/{id}/approve`:
1. **ConditionCheck & Update on Loan:**
   ```
   Key: PK = LOAN#{loanId}, SK = METADATA
   ConditionExpression: attribute_exists(PK) AND #status = :pending
   UpdateExpression: SET #status = :approved, loanStatusSK = :newSK, approvedAt = :now
   ```
2. **ConditionCheck & Update on Item:**
   ```
   Key: PK = ITEM#{itemId}, SK = METADATA
   ConditionExpression: attribute_exists(PK) AND #status = :available
   UpdateExpression: SET #status = :on_loan, itemStatusSK = :newSK, updatedAt = :now
   ```
If the item is no longer available or the loan has already been approved/cancelled, the transaction is rejected with `TransactionCanceledException`, mapped to HTTP 409 Conflict.

### Atomic Loan Return (`TransactWriteItems`)
When a lender calls `POST /loans/{id}/return`:
1. **ConditionCheck & Update on Loan:**
   ```
   Key: PK = LOAN#{loanId}, SK = METADATA
   ConditionExpression: attribute_exists(PK) AND #status = :active
   UpdateExpression: SET #status = :returned, loanStatusSK = :newSK, returnedAt = :now
   ```
2. **Update on Item:**
   ```
   Key: PK = ITEM#{itemId}, SK = METADATA
   UpdateExpression: SET #status = :available, itemStatusSK = :newSK, updatedAt = :now
   ```

---

## 5. Local Development & DynamoDB Local

### Option A: In-Memory Repository (Default for Dev & Tests)
When running locally or executing test suites, the backend uses the in-memory repository driver:
```bash
STORAGE_DRIVER=memory
```
This requires zero cloud infrastructure, no Docker, and comes pre-seeded with realistic VIT Chennai student items and profile records.

### Option B: Running with DynamoDB Local
To run against real DynamoDB semantics locally:

1. Start DynamoDB Local via Docker:
   ```powershell
   docker run -p 8000:8000 amazon/dynamodb-local
   ```
2. Set environment variables:
   ```powershell
   $env:DYNAMODB_ENDPOINT="http://localhost:8000"
   $env:DYNAMODB_TABLE_NAME="loopin-local"
   $env:STORAGE_DRIVER="dynamodb"
   $env:AWS_REGION="ap-south-1"
   $env:AWS_ACCESS_KEY_ID="local"
   $env:AWS_SECRET_ACCESS_KEY="local"
   ```
3. Initialize the table schema using AWS CLI:
   ```powershell
   aws dynamodb create-table `
     --table-name loopin-local `
     --attribute-definitions `
       AttributeName=PK,AttributeType=S `
       AttributeName=SK,AttributeType=S `
       AttributeName=campusId,AttributeType=S `
       AttributeName=itemStatusSK,AttributeType=S `
       AttributeName=borrowerId,AttributeType=S `
       AttributeName=loanStatusSK,AttributeType=S `
       AttributeName=lenderId,AttributeType=S `
     --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE `
     --global-secondary-indexes `
       "[{\"IndexName\":\"GSI1-Campus-Items\",\"KeySchema\":[{\"AttributeName\":\"campusId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"itemStatusSK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}},{\"IndexName\":\"GSI2-Borrower-Loans\",\"KeySchema\":[{\"AttributeName\":\"borrowerId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"loanStatusSK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}},{\"IndexName\":\"GSI3-Lender-Loans\",\"KeySchema\":[{\"AttributeName\":\"lenderId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"loanStatusSK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" `
     --billing-mode PAY_PER_REQUEST `
     --endpoint-url http://localhost:8000
   ```
