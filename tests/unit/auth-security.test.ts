import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { extractAuth, extractAuthAsync } from "@loopin/backend/middleware/auth.js";
import { UnauthorizedError, ForbiddenError, ConflictError, BadRequestError } from "@loopin/backend/domain/errors.js";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { ItemsService } from "@loopin/backend/services/items.service.js";
import { LoansService } from "@loopin/backend/services/loans.service.js";
import { UsersService } from "@loopin/backend/services/users.service.js";
import { AuthService } from "@loopin/backend/services/auth.service.js";
import { signToken, verifyToken, hashPassword, verifyPassword, createTestAuthHeader } from "@loopin/backend/lib/jwt.js";

function createMockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /test",
    rawPath: "/test",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      domainName: "test.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method: "GET",
        path: "/test",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "req-1",
      routeKey: "GET /test",
      stage: "$default",
      time: "11/Oct/2026:14:00:00 +0000",
      timeEpoch: 1728655200000,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("Security & Authentication Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["STORAGE_DRIVER"];
    delete process.env["NODE_ENV"];
    delete process.env["VITE_APP_MODE"];
    process.env["JWT_SECRET"] = "test-jwt-secret-key-32-chars-long-strictly-for-testing";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Token & Claim Extraction Security", () => {
    it("should reject unauthenticated request when no authorizer claims or headers are present", () => {
      const event = createMockEvent();
      expect(() => extractAuth(event)).toThrowError(UnauthorizedError);
    });

    it("should STRICTLY REJECT forged identity headers (x-user-id) when no valid token is provided", () => {
      const forgedEvent = createMockEvent({
        headers: {
          "x-user-id": "victim-user-123",
          "x-user-email": "victim@vit.ac.in",
          "x-user-name": "Victim Student",
        },
      });

      // Headers alone MUST NOT be trusted as proof of identity
      expect(() => extractAuth(forgedEvent)).toThrowError(UnauthorizedError);
    });

    it("should successfully extract identity from a cryptographically signed Bearer token", () => {
      const validToken = signToken({
        sub: "user-legit-001",
        email: "legit.student@vit.ac.in",
        displayName: "Legit Student",
        campusId: "campus-vit-chennai",
        emailVerified: false,
      });

      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      const user = extractAuth(event);
      expect(user.userId).toBe("user-legit-001");
      expect(user.email).toBe("legit.student@vit.ac.in");
      expect(user.displayName).toBe("Legit Student");
      expect(user.campusId).toBe("campus-vit-chennai");
      expect(user.emailVerified).toBe(false); // Explicit: email verification not falsely claimed
      expect(user.campusVerified).toBe(false); // campusVerified requires emailVerified to be true
    });

    it("should reject tampered or forged JWT tokens", () => {
      const validToken = signToken({
        sub: "user-normal",
        email: "normal@vit.ac.in",
        displayName: "Normal Student",
        campusId: "campus-vit-chennai",
        emailVerified: false,
      });

      // Tamper with the payload part
      const parts = validToken.split(".");
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: "user-admin", email: "admin@vit.ac.in", exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url");
      const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${tamperedToken}`,
        },
      });

      expect(() => extractAuth(event)).toThrowError(UnauthorizedError);
    });

    it("should reject expired tokens", () => {
      // Create a token that expired 10 seconds ago
      const expiredToken = signToken(
        {
          sub: "user-expired",
          email: "expired@vit.ac.in",
          displayName: "Expired Student",
          campusId: "campus-vit-chennai",
          emailVerified: false,
        },
        -10, // negative lifespan = expired
      );

      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(() => extractAuth(event)).toThrowError(UnauthorizedError);
    });

    it("should reject token signed with a different secret", () => {
      const foreignToken = signToken(
        {
          sub: "user-foreign",
          email: "foreign@vit.ac.in",
          displayName: "Foreign Student",
          campusId: "campus-vit-chennai",
          emailVerified: false,
        },
        3600,
        "completely-different-signing-secret-attacker-controlled",
      );

      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${foreignToken}`,
        },
      });

      expect(() => extractAuth(event)).toThrowError(UnauthorizedError);
    });

    it("should reject plain unverified user ids in Bearer header", () => {
      const event = createMockEvent({
        headers: {
          authorization: "Bearer user-alice-sub",
        },
      });

      expect(() => extractAuth(event)).toThrowError(UnauthorizedError);
    });
  });

  describe("Application-Level Authentication Service (AuthService)", () => {
    let repo: MemoryRepository;
    let authService: AuthService;

    beforeEach(() => {
      repo = new MemoryRepository(false);
      authService = new AuthService(repo);
    });

    it("should register a new user, hash password with salt, and return signed token", async () => {
      const reg = await authService.register({
        email: "priya.sharma@vit.ac.in",
        password: "StrongPassword123!",
        displayName: "Priya Sharma",
        campusId: "campus-vit-chennai",
      });

      expect(reg.token).toBeDefined();
      expect(reg.user.userId).toMatch(/^user-/);
      expect(reg.user.email).toBe("priya.sharma@vit.ac.in");
      expect(reg.user.displayName).toBe("Priya Sharma");
      expect(reg.user.emailVerified).toBe(false); // Does not falsely claim email is verified

      // Verify token can be decoded by extractAuth
      const event = createMockEvent({
        headers: { authorization: `Bearer ${reg.token}` },
      });
      const extracted = extractAuth(event);
      expect(extracted.userId).toBe(reg.user.userId);
    });

    it("should reject registration with weak/short passwords (< 8 characters)", async () => {
      await expect(
        authService.register({
          email: "weak@vit.ac.in",
          password: "short",
          displayName: "Short Pass",
        }),
      ).rejects.toThrowError(BadRequestError);
    });

    it("should prevent duplicate registration with the same email", async () => {
      await authService.register({
        email: "duplicate@vit.ac.in",
        password: "ValidPassword123!",
        displayName: "First Student",
      });

      await expect(
        authService.register({
          email: "duplicate@vit.ac.in",
          password: "AnotherPassword123!",
          displayName: "Second Student",
        }),
      ).rejects.toThrowError(ConflictError);
    });

    it("should login registered user with correct password and reject wrong password", async () => {
      await authService.register({
        email: "kavya@vit.ac.in",
        password: "CorrectSecretKey99!",
        displayName: "Kavya",
      });

      // Successful login
      const loginRes = await authService.login({
        email: "kavya@vit.ac.in",
        password: "CorrectSecretKey99!",
      });
      expect(loginRes.token).toBeDefined();
      expect(loginRes.user.displayName).toBe("Kavya");

      // Failed login: wrong password
      await expect(
        authService.login({
          email: "kavya@vit.ac.in",
          password: "WrongPassword123!",
        }),
      ).rejects.toThrowError(UnauthorizedError);

      // Failed login: non-existent email
      await expect(
        authService.login({
          email: "ghost@vit.ac.in",
          password: "AnyPassword123!",
        }),
      ).rejects.toThrowError(UnauthorizedError);
    });
  });

  describe("Student Profile Privacy & Authorization", () => {
    let repo: MemoryRepository;
    let usersService: UsersService;

    const userAlice = {
      userId: "user-alice",
      email: "alice.private@vit.ac.in",
      displayName: "Alice",
      campusId: "campus-vit-chennai",
    };

    const userBob = {
      userId: "user-bob",
      email: "bob.private@vit.ac.in",
      displayName: "Bob",
      campusId: "campus-vit-chennai",
    };

    beforeEach(async () => {
      repo = new MemoryRepository(false);
      usersService = new UsersService(repo);
      await usersService.getMyProfile(userAlice);
      await usersService.getMyProfile(userBob);
    });

    it("should allow a student to view their own full profile including email", async () => {
      const myProfile = await usersService.getMyProfile(userAlice);
      expect(myProfile.userId).toBe(userAlice.userId);
      expect(myProfile.email).toBe("alice.private@vit.ac.in");
    });

    it("should REDACT private student email when viewing another student's public profile", async () => {
      const publicProfile = await usersService.getPublicProfile(userBob.userId);
      expect(publicProfile.userId).toBe(userBob.userId);
      expect(publicProfile.displayName).toBe("Bob");
      expect(publicProfile.reliabilityScore).toBeDefined();
      // Email must NEVER be exposed in public profiles
      expect((publicProfile as any).email).toBeUndefined();
    });
  });

  describe("Ownership & Cross-User Authorization Enforcement", () => {
    let repo: MemoryRepository;
    let itemsService: ItemsService;
    let loansService: LoansService;

    const userAlice = {
      userId: "user-alice-sub",
      email: "alice@iitm.ac.in",
      displayName: "Alice",
    };

    const userBob = {
      userId: "user-bob-sub",
      email: "bob@iitm.ac.in",
      displayName: "Bob",
    };

    const attackerCharlie = {
      userId: "user-charlie-attacker",
      email: "charlie@external.com",
      displayName: "Charlie",
    };

    beforeEach(() => {
      repo = new MemoryRepository(false);
      itemsService = new ItemsService(repo);
      loansService = new LoansService(repo);
    });

    it("should prevent non-owners from editing or patching another user's item", async () => {
      const item = await itemsService.createItem(
        {
          title: "Scientific Calculator FX-991",
          description: "Calculator for semester exams.",
          category: "electronics",
          condition: "good",
          estimatedValue: 30,
          tags: ["calculator", "math"],
        },
        userAlice,
      );

      // Alice can patch her own item
      await expect(
        itemsService.patchItem(item.itemId, { condition: "like_new" }, userAlice),
      ).resolves.toBeDefined();

      // Bob or Charlie attempting to patch Alice's item must be rejected with ForbiddenError
      await expect(
        itemsService.patchItem(item.itemId, { condition: "fair" }, userBob),
      ).rejects.toThrowError(ForbiddenError);

      await expect(
        itemsService.patchItem(item.itemId, { condition: "fair" }, attackerCharlie),
      ).rejects.toThrowError(ForbiddenError);
    });

    it("should prevent non-owners from deleting another user's item", async () => {
      const item = await itemsService.createItem(
        {
          title: "Lab Coat White Large",
          description: "Chemistry lab coat.",
          category: "other",
          condition: "good",
          estimatedValue: 20,
          tags: ["chemistry", "lab"],
        },
        userAlice,
      );

      // Charlie attempting to delete Alice's item -> Forbidden
      await expect(
        itemsService.deleteItem(item.itemId, attackerCharlie),
      ).rejects.toThrowError(ForbiddenError);

      // Alice deletes her own item -> Succeeds
      await expect(itemsService.deleteItem(item.itemId, userAlice)).resolves.toBeUndefined();
    });

    it("should prevent unauthorized third party from approving or rejecting loans", async () => {
      const item = await itemsService.createItem(
        {
          title: "Robotics Kit",
          description: "Motor controller and sensors.",
          category: "electronics",
          condition: "good",
          estimatedValue: 120,
          tags: ["robotics", "arduino"],
        },
        userAlice,
      );

      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const loan = await loansService.requestLoan(
        {
          itemId: item.itemId,
          dueDate,
        },
        userBob,
      );

      // Attacker Charlie tries to approve Bob's loan request -> Forbidden
      await expect(
        loansService.approveLoan(loan.loanId, attackerCharlie),
      ).rejects.toThrowError(ForbiddenError);

      // Borrower Bob tries to approve his own loan -> Forbidden
      await expect(
        loansService.approveLoan(loan.loanId, userBob),
      ).rejects.toThrowError(ForbiddenError);

      // Lender Alice cannot cancel borrower Bob's pending loan -> Forbidden
      await expect(
        loansService.cancelLoan(loan.loanId, userAlice),
      ).rejects.toThrowError(ForbiddenError);

      // Only Lender Alice can approve
      await expect(loansService.approveLoan(loan.loanId, userAlice)).resolves.toMatchObject({
        status: "approved",
      });
    });

    it("should prevent third parties from accessing private loan details", async () => {
      const item = await itemsService.createItem(
        {
          title: "Guitar Acoustic",
          description: "6-string guitar.",
          category: "musical_instruments",
          condition: "good",
          estimatedValue: 100,
          tags: ["music"],
        },
        userAlice,
      );

      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const loan = await loansService.requestLoan(
        { itemId: item.itemId, dueDate },
        userBob,
      );

      // Alice (lender) and Bob (borrower) can view
      await expect(loansService.getLoan(loan.loanId, userAlice)).resolves.toBeDefined();
      await expect(loansService.getLoan(loan.loanId, userBob)).resolves.toBeDefined();

      // Charlie (unauthorized third party) cannot view
      await expect(loansService.getLoan(loan.loanId, attackerCharlie)).rejects.toThrowError(ForbiddenError);
    });
  });
});
