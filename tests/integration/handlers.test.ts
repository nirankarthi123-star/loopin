import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler as itemsHandler } from "@loopin/backend/handlers/items.js";
import { handler as loansHandler } from "@loopin/backend/handlers/loans.js";
import { handler as usersHandler } from "@loopin/backend/handlers/users.js";
import { handler as impactHandler } from "@loopin/backend/handlers/impact.js";
import { setRepository } from "@loopin/backend/repository/factory.js";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { signToken } from "@loopin/backend/lib/jwt.js";

function asStructured(result: unknown): APIGatewayProxyStructuredResultV2 {
  return result as APIGatewayProxyStructuredResultV2;
}

function createMockEvent(options: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  userId?: string;
  email?: string;
}): APIGatewayProxyEventV2 {
  const token = options.userId
    ? signToken({
        sub: options.userId,
        email: options.email ?? `${options.userId}@vit.ac.in`,
        displayName: "Student User",
        campusId: "campus-vit-chennai",
        emailVerified: false,
      })
    : undefined;

  return {
    version: "2.0",
    routeKey: `${options.method} ${options.path}`,
    rawPath: options.path,
    rawQueryString: "",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    queryStringParameters: options.queryStringParameters,
    pathParameters: options.pathParameters,
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      domainName: "test.execute-api.ap-south-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method: options.method,
        path: options.path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest-test",
      },
      requestId: "test-req-1",
      routeKey: `${options.method} ${options.path}`,
      stage: "$default",
      time: "11/Oct/2026:12:00:00 +0000",
      timeEpoch: 1728648000000,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    isBase64Encoded: false,
  };
}

describe("Backend API Handlers Integration Tests", () => {
  beforeEach(() => {
    // Reset to fresh seeded memory repository for each test
    const repo = new MemoryRepository(true);
    setRepository(repo);
  });

  describe("Items API Endpoints", () => {
    it("GET /items should return list of available items", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/items",
      });
      const result = asStructured(await itemsHandler(event));
      expect(result.statusCode).toBe(200);

      const parsed = JSON.parse(result.body as string);
      expect(parsed.success).toBe(true);
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data.length).toBeGreaterThanOrEqual(2);
    });

    it("GET /items/{id} should return single item", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/items/item-001",
        pathParameters: { id: "item-001" },
      });
      const result = asStructured(await itemsHandler(event));
      expect(result.statusCode).toBe(200);

      const parsed = JSON.parse(result.body as string);
      expect(parsed.data.itemId).toBe("item-001");
      expect(parsed.data.title).toContain("Multimeter");
    });

    it("POST /items should create item when authenticated", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/items",
        userId: "demo-user-001",
        email: "niranjna.karthikeyan@vit.ac.in",
        body: {
          title: "Lab Safety Goggles & Gloves",
          description: "Anti-fog chemical splash safety goggles with nitrile gloves.",
          category: "tools",
          condition: "new",
          estimatedValue: 20,
          tags: ["lab", "safety"],
        },
      });

      const result = asStructured(await itemsHandler(event));
      expect(result.statusCode).toBe(201);

      const parsed = JSON.parse(result.body as string);
      expect(parsed.data.itemId).toBeDefined();
      expect(parsed.data.ownerId).toBe("demo-user-001");
    });

    it("POST /items should return 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/items",
        body: {
          title: "Some Item",
          description: "Description of the item here.",
          category: "tools",
          condition: "good",
          estimatedValue: 30,
        },
      });

      const result = asStructured(await itemsHandler(event));
      expect(result.statusCode).toBe(401);
    });

    it("PATCH /items/{id} should forbid non-owners", async () => {
      const event = createMockEvent({
        method: "PATCH",
        path: "/items/item-001",
        pathParameters: { id: "item-001" },
        userId: "demo-user-001", // owner of item-001 is demo-user-002
        body: {
          title: "Hacked title",
        },
      });

      const result = asStructured(await itemsHandler(event));
      expect(result.statusCode).toBe(403);
    });
  });

  describe("Loans API Endpoints", () => {
    it("POST /loans and GET /loans/mine integration flow", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Borrower requests loan on item-001
      const requestEvent = createMockEvent({
        method: "POST",
        path: "/loans",
        userId: "demo-user-001",
        email: "niranjna.karthikeyan@vit.ac.in",
        body: {
          itemId: "item-001",
          dueDate: futureDate,
          borrowerNote: "For electrical circuit measurements.",
        },
      });

      const createRes = asStructured(await loansHandler(requestEvent));
      expect(createRes.statusCode).toBe(201);
      const createdLoan = JSON.parse(createRes.body as string).data;
      expect(createdLoan.status).toBe("pending");

      // 2. Borrower checks /loans/mine
      const mineEvent = createMockEvent({
        method: "GET",
        path: "/loans/mine",
        userId: "demo-user-001",
      });

      const mineRes = asStructured(await loansHandler(mineEvent));
      expect(mineRes.statusCode).toBe(200);
      const myLoans = JSON.parse(mineRes.body as string).data;
      expect(myLoans.some((l: { loanId: string }) => l.loanId === createdLoan.loanId)).toBe(true);

      // 3. Lender approves loan
      const approveEvent = createMockEvent({
        method: "POST",
        path: `/loans/${createdLoan.loanId}/approve`,
        pathParameters: { id: createdLoan.loanId, action: "approve" },
        userId: "demo-user-002", // owner/lender of item-001
      });

      const approveRes = asStructured(await loansHandler(approveEvent));
      expect(approveRes.statusCode).toBe(200);
      const approvedLoan = JSON.parse(approveRes.body as string).data;
      expect(approvedLoan.status).toBe("approved");

      // 4. Pickup loan
      const pickupEvent = createMockEvent({
        method: "POST",
        path: `/loans/${createdLoan.loanId}/pickup`,
        pathParameters: { id: createdLoan.loanId, action: "pickup" },
        userId: "demo-user-001",
      });

      const pickupRes = asStructured(await loansHandler(pickupEvent));
      expect(pickupRes.statusCode).toBe(200);
      const activeLoan = JSON.parse(pickupRes.body as string).data;
      expect(["borrowed", "active"]).toContain(activeLoan.status);

      // 5. Lender marks returned
      const returnEvent = createMockEvent({
        method: "POST",
        path: `/loans/${createdLoan.loanId}/return`,
        pathParameters: { id: createdLoan.loanId, action: "return" },
        userId: "demo-user-002",
      });

      const returnRes = asStructured(await loansHandler(returnEvent));
      expect(returnRes.statusCode).toBe(200);
      const returnedLoan = JSON.parse(returnRes.body as string).data;
      expect(["completed", "returned"]).toContain(returnedLoan.status);
    });
  });

  describe("Profile & Impact Endpoints", () => {
    it("GET /profile/me should return verified user profile", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/profile/me",
        userId: "demo-user-001",
        email: "niranjna.karthikeyan@vit.ac.in",
      });

      const result = asStructured(await usersHandler(event));
      expect(result.statusCode).toBe(200);

      const parsed = JSON.parse(result.body as string).data;
      expect(parsed.userId).toBe("demo-user-001");
      expect(parsed.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(parsed.reliabilityScore).toBeLessThanOrEqual(100);
    });

    it("GET /impact should return campus statistics", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/impact",
      });

      const result = asStructured(await impactHandler(event));
      expect(result.statusCode).toBe(200);

      const parsed = JSON.parse(result.body as string).data;
      expect(parsed.campusName).toBe("VIT Chennai");
      expect(parsed.completedLoansCount).toBeGreaterThanOrEqual(0);
      expect(parsed.estimatedMoneySavedUSD).toBeGreaterThanOrEqual(0);
    });
  });
});
