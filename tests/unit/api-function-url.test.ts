import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler as apiHandler } from "@loopin/backend/handlers/api.js";
import { setRepository } from "@loopin/backend/repository/factory.js";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { signToken } from "@loopin/backend/lib/jwt.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Item } from "@loopin/shared";

describe("Lambda Function URL API Dispatcher Suite", () => {
  let memoryRepo: MemoryRepository;

  const borrowerToken = signToken({
    sub: "user-borrower-001",
    email: "borrower@vit.ac.in",
    displayName: "Student Borrower",
    campusId: "campus-vit-chennai",
    emailVerified: false,
  });

  const lenderToken = signToken({
    sub: "user-owner-001",
    email: "owner@vit.ac.in",
    displayName: "Student Owner",
    campusId: "campus-vit-chennai",
    emailVerified: false,
  });

  const mockItem: Item = {
    itemId: "item-url-test-1",
    ownerId: "user-owner-001",
    ownerName: "Student Owner",
    title: "TI-84 Plus CE Graphing Calculator",
    description: "Calculator for exams",
    category: "electronics",
    condition: "like_new",
    estimatedValue: 120,
    status: "available",
    tags: ["math", "calculator"],
    campusId: "campus-vit-chennai",
    pickupLocation: "Hostel D Block",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    memoryRepo = new MemoryRepository(false);
    setRepository(memoryRepo);
    await memoryRepo.createItem(mockItem);
  });

  const createEvent = (
    method: string,
    rawPath: string,
    body?: any,
    headers: Record<string, string> = {},
    queryStringParameters?: Record<string, string>,
  ): APIGatewayProxyEventV2 => {
    return {
      version: "2.0",
      routeKey: "$default",
      rawPath,
      rawQueryString: "",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${borrowerToken}`,
        ...headers,
      },
      queryStringParameters,
      body: body ? JSON.stringify(body) : undefined,
      isBase64Encoded: false,
      requestContext: {
        accountId: "123456789012",
        apiId: "lambda-url",
        domainName: "abcdef123.lambda-url.us-east-1.on.aws",
        domainPrefix: "abcdef123",
        http: {
          method,
          path: rawPath,
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "vitest",
        },
        requestId: `req-${Date.now()}`,
        routeKey: "$default",
        stage: "$default",
        time: new Date().toISOString(),
        timeEpoch: Date.now(),
      },
    };
  };

  it("should handle CORS preflight OPTIONS request with 204 No Content", async () => {
    const event = createEvent("OPTIONS", "/items");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(204);
    expect(result.headers["Access-Control-Allow-Methods"]).toContain("GET,POST");
    expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("should route POST /auth/register and POST /auth/login through Function URL dispatcher", async () => {
    const regEvent = createEvent("POST", "/auth/register", {
      email: "new.user@vit.ac.in",
      password: "SecurePassword123!",
      displayName: "New User",
      campusId: "campus-vit-chennai",
    });

    const regResult = (await apiHandler(regEvent)) as any;
    expect(regResult.statusCode).toBe(201);
    const regBody = JSON.parse(regResult.body);
    expect(regBody.data.token).toBeDefined();
    expect(regBody.data.user.email).toBe("new.user@vit.ac.in");

    // Login with registered user
    const loginEvent = createEvent("POST", "/auth/login", {
      email: "new.user@vit.ac.in",
      password: "SecurePassword123!",
    });
    const loginResult = (await apiHandler(loginEvent)) as any;
    expect(loginResult.statusCode).toBe(200);
    const loginBody = JSON.parse(loginResult.body);
    expect(loginBody.data.token).toBeDefined();
  });

  it("should route GET /items and list campus items", async () => {
    const event = createEvent("GET", "/items");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((i: any) => i.title === "TI-84 Plus CE Graphing Calculator")).toBe(true);
  });

  it("should extract item id from rawPath on GET /items/{id} without API Gateway templates", async () => {
    const event = createEvent("GET", `/items/${mockItem.itemId}`);
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.itemId).toBe(mockItem.itemId);
  });

  it("should route POST /loans with verified Bearer token and create a new loan request", async () => {
    const loanPayload = {
      itemId: mockItem.itemId,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      borrowerNote: "Need for semester exam",
    };

    const event = createEvent("POST", "/loans", loanPayload);
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.itemId).toBe(mockItem.itemId);
    expect(body.data.status).toBe("pending");
    expect(body.data.borrowerId).toBe("user-borrower-001");
  });

  it("should reject POST /loans if Authorization header is missing or unverified", async () => {
    const loanPayload = {
      itemId: mockItem.itemId,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    };

    // Attempting with only forged header and no Bearer token
    const unauthEvent = createEvent(
      "POST",
      "/loans",
      loanPayload,
      { authorization: "", "x-user-id": "attacker-001" },
    );
    // Remove the default authorization header
    delete unauthEvent.headers["authorization"];

    const result = (await apiHandler(unauthEvent)) as any;
    expect(result.statusCode).toBe(401);
  });

  it("should extract action from rawPath on loan transitions (e.g. /loans/{id}/approve)", async () => {
    // 1. Create loan first
    const loan = await memoryRepo.createLoan({
      loanId: "loan-action-test-001",
      itemId: mockItem.itemId,
      itemTitle: mockItem.title,
      borrowerId: "user-borrower-001",
      borrowerName: "Student Borrower",
      lenderId: "user-owner-001",
      lenderName: "Student Owner",
      status: "pending",
      requestedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      durationDays: 1,
      rentalFee: 2,
      savingsValue: 120,
      wouldHavePurchased: true,
    });

    // 2. Approve loan by lender (with lender's verified token)
    const approveEvent = createEvent("POST", `/loans/${loan.loanId}/approve`, null, {
      authorization: `Bearer ${lenderToken}`,
    });

    const approveRes = (await apiHandler(approveEvent)) as any;
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.data.status).toBe("approved");
  });

  it("should route GET /users/me to usersHandler with authenticated profile", async () => {
    const event = createEvent("GET", "/users/me");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.userId).toBe("user-borrower-001");
    expect(body.data.email).toBe("borrower@vit.ac.in");
  });

  it("should route GET /users/:userId and return privacy-redacted profile", async () => {
    // Create lender profile in repo
    await memoryRepo.saveUserProfile({
      userId: "user-owner-001",
      email: "private.owner@vit.ac.in",
      displayName: "Student Owner",
      campusId: "campus-vit-chennai",
      reliabilityScore: 85,
      totalSavings: 500,
      borrowCount: 2,
      lendCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Borrower requests owner's profile
    const event = createEvent("GET", "/users/user-owner-001");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.userId).toBe("user-owner-001");
    expect(body.data.displayName).toBe("Student Owner");
    // Email MUST NOT be returned
    expect(body.data.email).toBeUndefined();
  });

  it("should route GET /impact to impact handler", async () => {
    const event = createEvent("GET", "/impact");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.campusName).toBe("VIT Chennai");
    expect(body.data.uniqueReusedItemsCount).toBeDefined();
  });

  it("should return 404 for unknown endpoints", async () => {
    const event = createEvent("GET", "/non-existent-route");
    const result = (await apiHandler(event)) as any;

    expect(result.statusCode).toBe(404);
  });
});
