# LoopIn — Project Plan

> **Tagline:** Need it? Loop it.

## Overview

LoopIn is a campus-sharing platform built on AWS Serverless. Students can list items they own, borrow items from peers, track active loans with due-date reminders, build a reliability score based on return history, and view an aggregate estimate of cost savings from reuse.

---

## Phases

### ✅ Phase 1 — Project Foundation & Architecture (Completed)

**Goal:** Establish the project skeleton, strict TypeScript tooling, workspace architecture, documentation, and testing framework.

- [x] Vite + React + TypeScript frontend scaffold in `frontend/`
- [x] Monorepo workspace structure (`frontend`, `backend`, `shared`, `tests`, `infra`)
- [x] Shared TypeScript types and constants package (`@loopin/shared`)
- [x] `README.md`, `PROJECT_PLAN.md`, `ARCHITECTURE.md`, `.env.example`
- [x] Root package.json with unified cross-workspace developer scripts
- [x] Strict TypeScript configuration enabled across all packages
- [x] Demo mode configuration (`VITE_APP_MODE=demo`) with local mock data layer
- [x] AWS SAM infrastructure template scaffold in `infra/sam/template.yaml` (no cloud resources created)
- [x] Vitest testing suite configured and passing (`tests/`)
- [x] Oxlint linting configured with zero errors
- [x] `.gitignore` protecting credentials, artifacts, and local environments
- [x] Logical separation of concerns without duplicate or nested applications

---

### ✅ Phase 2 — Core UI & Interactive Demo Mode (Completed)

**Goal:** Deliver a navigable, visually rich frontend in demo mode.

- [x] Complete UI design system: soft neutral backgrounds, dark text, violet accents, electric-lime highlights
- [x] Navigation shell (Desktop Sidebar, TopBar with notifications, responsive mobile drawer)
- [x] Landing Page: headline "Your campus has what you need.", tagline "Need it? Loop it.", Explore & List CTAs
- [x] Dashboard Page: active loans summary, upcoming returns, quick stats, campus activity snapshot
- [x] Explore Page: multi-category filters, condition, availability, search, and sorting
- [x] Item Detail Page: item status, loan duration picker, borrower notes, pending confirmation state
- [x] List Item Page: full listing creation form with accessible validation and preset sample photos
- [x] My Loop Page: 4-tab loan management (Borrowed, Lent, Incoming Requests, History) with approval/return actions
- [x] My Items Page: inventory management, view/delete listing flow
- [x] Community Impact Page: campus metrics, carbon/e-waste savings, TrustScore champions leaderboard
- [x] Profile Page: TrustScore circular gauge, tier breakdown, stats, edit profile modal, sign-out
- [x] Auth Screens: Sign In & Sign Up pages with one-click demo login button
- [x] Typed service & in-memory mock repository layer (`services/index.ts`, `services/mockRepository.ts`)
- [x] Verified builds, strict typechecks, and tests passing across monorepo workspaces

---

### ✅ Phase 3 — Backend Lambda Handlers & DynamoDB (Completed)

**Goal:** Implement the serverless API behind Amazon API Gateway HTTP API.

- [x] Lambda: `GET /items` & `GET /items/{id}` — Query campus discovery, single item lookup
- [x] Lambda: `POST /items` — Create listing with server-side validation & authenticated ownership
- [x] Lambda: `PATCH /items/{id}` — Update listing with owner permission checks
- [x] Lambda: `DELETE /items/{id}` — Remove listing with active loan conflict protection
- [x] Lambda: `POST /loans` — Request loan with future date constraints & conflict checks
- [x] Lambda: `GET /loans/mine` — Borrower & lender query via GSIs
- [x] Lambda: `POST /loans/{id}/approve` — Concurrency-safe atomic approval
- [x] Lambda: `POST /loans/{id}/reject` — Owner decline flow
- [x] Lambda: `POST /loans/{id}/pickup` — Handover pickup transition (`approved` → `active`)
- [x] Lambda: `POST /loans/{id}/return` — Atomic return & TrustScore recalculation
- [x] Lambda: `GET /profile/me` — Verified profile & dynamically calculated TrustScore
- [x] Lambda: `GET /impact` — Campus circular economy & savings aggregation
- [x] DynamoDB single-table design (`backend/DATABASE.md`) with 3 GSIs avoiding table scans
- [x] Clean architecture: Zod validation schemas, pure domain rules, repository abstraction
- [x] In-memory local repository with demo seed data alongside live DynamoDB SDK v3 driver
- [x] 38 Vitest unit & integration tests passing across loan lifecycle, concurrency, and API handlers
- [x] AWS SAM template (`infra/sam/template.yaml`) updated with HTTP API routes and IAM roles

---

### ✅ Phase 4 — Authentication (Amazon Cognito) (Completed)

**Goal:** Wire Cognito Auth into frontend and backend.

- [x] Cognito User Pool + App Client deployed via SAM (`UserPool`, `UserPoolClient` resources, JWT Authorizer on HTTP API)
- [x] Frontend: Sign In page with demo one-click button + Cognito email/password form
- [x] Frontend: Sign Up + Email Verification (confirmation code) page
- [x] Frontend: `amazon-cognito-identity-js` integration, dual demo/real mode — zero embedded AWS credentials
- [x] Backend: JWT verification middleware — `extractAuth` (sync) + `extractAuthAsync` (Bearer token via `aws-jwt-verify`)
- [x] Protected routes in frontend (`ProtectedRoute` wrapping all authenticated paths)
- [x] Auth state management (`AuthProvider` context, session restore on mount, `useAuth` hook)
- [x] Authenticated API requests (auto-injected `Authorization: Bearer <idToken>` in `apiClient.ts`)
- [x] `campusVerified` derived from verified `.ac.in`/`.edu` domain — never trusted from client
- [x] Cognito env vars (`COGNITO_USER_POOL_ID`, `COGNITO_USER_POOL_CLIENT_ID`) wired into all Lambda globals
- [x] 7 auth security tests passing (claim extraction, cross-user ownership enforcement)

---

### 🔲 Phase 5 — Scheduling & Reminders (EventBridge + SNS)

**Goal:** Automated due-date reminders and overdue escalations.

- [ ] EventBridge Scheduler: daily due-date scan Lambda
- [ ] SNS topic for reminder dispatch
- [ ] Email notifications: loan approved, loan due tomorrow, loan overdue
- [ ] Notification preferences stored in user profile
- [ ] In-app notification center

---

### 🔲 Phase 6 — Reliability Score (TrustScore) & Impact Tracking

**Goal:** Gamification, reputation, and reuse savings metrics.

- [ ] Reliability score algorithm (timely returns, disputes, cancellations)
- [ ] Automated score recalculation upon loan completion
- [ ] Savings calculation: estimated replacement value × reuse cycles
- [ ] Campus-wide aggregate savings counters
- [ ] User score history and badge tiers

---

### 🔲 Phase 7 — AWS Deployment & Production Hardening

**Goal:** Deploy to AWS with security, observability, and cost controls.

- [ ] Full SAM deployment validation (`sam deploy --guided`)
- [ ] Least-privilege IAM policies per Lambda function
- [ ] API Gateway rate limiting, throttling, and production CORS
- [ ] CloudWatch alarms for errors, latency, and budget
- [ ] AWS X-Ray distributed tracing
- [ ] DynamoDB point-in-time recovery (PITR)
- [ ] CI/CD pipeline automation

---

## Non-Goals (Out of Scope)

- Mobile native apps (iOS / Android)
- Real-time peer-to-peer chat
- Payment processing or monetary deposits
- Image upload hosting in early phases (URLs used initially)
