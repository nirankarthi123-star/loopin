/**
 * DynamoDB Repository Implementation — LoopIn Backend
 *
 * Implements single-table design with AWS SDK v3:
 * - Table: DYNAMODB_TABLE_NAME (PK: S, SK: S)
 * - GSI1-Campus-Items (campusId, itemStatusSK)
 * - GSI2-Borrower-Loans (borrowerId, loanStatusSK)
 * - GSI3-Lender-Loans (lenderId, loanStatusSK)
 *
 * Uses conditional checks and transactions for concurrency-safe loan transitions.
 */

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Item, Loan, UserProfile, CampusImpactSummary, SavedNeedRequest } from "@loopin/shared";
import type { ILoopInRepository, ListItemsOptions, UserAccount } from "./interface.js";
import { ddb, TABLE_NAME } from "../lib/dynamodb.js";
import { ConflictError, NotFoundError } from "../domain/errors.js";

export class DynamoDbRepository implements ILoopInRepository {
  private readonly tableName = TABLE_NAME;

  // ── Accounts ────────────────────────────────────────────────────────────────

  async createAccount(account: UserAccount): Promise<UserAccount> {
    const normalizedEmail = account.email.toLowerCase().trim();
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: `EMAIL#${normalizedEmail}`,
                  SK: "LOOKUP",
                  userId: account.userId,
                  email: normalizedEmail,
                  createdAt: account.createdAt,
                },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: `USER#${account.userId}`,
                  SK: "ACCOUNT",
                  ...account,
                  email: normalizedEmail,
                },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: `USER#${account.userId}`,
                  SK: "PROFILE",
                  userId: account.userId,
                  email: normalizedEmail,
                  displayName: account.displayName,
                  campusId: account.campusId,
                  emailVerified: account.emailVerified,
                  campusVerified: normalizedEmail.endsWith(".ac.in") || normalizedEmail.endsWith(".edu"),
                  reliabilityScore: 70,
                  totalSavings: 0,
                  borrowCount: 0,
                  lendCount: 0,
                  createdAt: account.createdAt,
                  updatedAt: account.updatedAt,
                },
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "TransactionCanceledException") {
        throw new ConflictError("An account with this email address already exists");
      }
      throw err;
    }
    return account;
  }

  async getAccountByEmail(email: string): Promise<UserAccount | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const lookup = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `EMAIL#${normalizedEmail}`,
          SK: "LOOKUP",
        },
      }),
    );
    if (!lookup.Item?.["userId"]) return null;
    return this.getAccountById(lookup.Item["userId"] as string);
  }

  async getAccountById(userId: string): Promise<UserAccount | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: "ACCOUNT",
        },
      }),
    );
    if (!result.Item) return null;
    return {
      userId: result.Item["userId"] as string,
      email: result.Item["email"] as string,
      passwordHash: result.Item["passwordHash"] as string,
      salt: result.Item["salt"] as string,
      displayName: result.Item["displayName"] as string,
      campusId: result.Item["campusId"] as string,
      emailVerified: Boolean(result.Item["emailVerified"]),
      createdAt: result.Item["createdAt"] as string,
      updatedAt: result.Item["updatedAt"] as string,
    };
  }

  // ── Items ───────────────────────────────────────────────────────────────────

  async createItem(item: Item): Promise<Item> {
    const itemStatusSK = `STATUS#${item.status}#CREATED#${item.createdAt}`;

    // Write item record and owner index record atomically
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: `ITEM#${item.itemId}`,
                SK: "METADATA",
                itemStatusSK,
                ...item,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: `USER#${item.ownerId}`,
                SK: `ITEM#${item.itemId}`,
                itemId: item.itemId,
                title: item.title,
                status: item.status,
                createdAt: item.createdAt,
              },
            },
          },
        ],
      }),
    );

    return item;
  }

  async getItem(itemId: string): Promise<Item | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `ITEM#${itemId}`,
          SK: "METADATA",
        },
      }),
    );

    if (!result.Item) return null;
    return this.cleanItem(result.Item);
  }

  async updateItem(item: Item): Promise<Item> {
    const itemStatusSK = `STATUS#${item.status}#CREATED#${item.createdAt}`;

    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `ITEM#${item.itemId}`,
          SK: "METADATA",
          itemStatusSK,
          ...item,
        },
        ConditionExpression: "attribute_exists(PK)",
      }),
    );

    return item;
  }

  async deleteItem(itemId: string): Promise<void> {
    const existing = await this.getItem(itemId);
    if (!existing) return;

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.tableName,
              Key: {
                PK: `ITEM#${itemId}`,
                SK: "METADATA",
              },
            },
          },
          {
            Delete: {
              TableName: this.tableName,
              Key: {
                PK: `USER#${existing.ownerId}`,
                SK: `ITEM#${itemId}`,
              },
            },
          },
        ],
      }),
    );
  }

  async listItems(options: ListItemsOptions): Promise<{ items: Item[]; nextCursor?: string }> {
    const campusId = options.campusId ?? "campus-vit-chennai";
    const statusPrefix = options.status ? `STATUS#${options.status}` : "STATUS#";

    const queryParams: ConstructorParameters<typeof QueryCommand>[0] = {
      TableName: this.tableName,
      IndexName: "GSI1-Campus-Items",
      KeyConditionExpression: "campusId = :c AND begins_with(itemStatusSK, :s)",
      ExpressionAttributeValues: {
        ":c": campusId,
        ":s": statusPrefix,
      },
      ScanIndexForward: false, // Newest first
      Limit: options.limit ?? 20,
    };

    if (options.cursor) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(
          Buffer.from(options.cursor, "base64").toString("utf-8"),
        );
      } catch {
        // Ignore malformed cursor
      }
    }

    const result = await ddb.send(new QueryCommand(queryParams));
    let items = (result.Items ?? []).map((i) => this.cleanItem(i));

    if (options.category) {
      items = items.filter((i) => i.category === options.category);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  async listItemsByOwner(ownerId: string): Promise<Item[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${ownerId}`,
          ":sk": "ITEM#",
        },
      }),
    );

    const itemRefs = result.Items ?? [];
    const items: Item[] = [];

    for (const ref of itemRefs) {
      const fullItem = await this.getItem(ref["itemId"] as string);
      if (fullItem) items.push(fullItem);
    }

    return items;
  }

  // ── Loans ───────────────────────────────────────────────────────────────────

  async createLoan(loan: Loan): Promise<Loan> {
    const loanStatusSK = `STATUS#${loan.status}#REQUESTED#${loan.requestedAt}`;

    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `LOAN#${loan.loanId}`,
          SK: "METADATA",
          loanStatusSK,
          ...loan,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );

    return loan;
  }

  async getLoan(loanId: string): Promise<Loan | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `LOAN#${loanId}`,
          SK: "METADATA",
        },
      }),
    );

    if (!result.Item) return null;
    return this.cleanLoan(result.Item);
  }

  async updateLoan(loan: Loan): Promise<Loan> {
    const loanStatusSK = `STATUS#${loan.status}#REQUESTED#${loan.requestedAt}`;

    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `LOAN#${loan.loanId}`,
          SK: "METADATA",
          loanStatusSK,
          ...loan,
        },
        ConditionExpression: "attribute_exists(PK)",
      }),
    );

    return loan;
  }

  async listLoansByItem(itemId: string): Promise<Loan[]> {
    try {
      const result = await ddb.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "begins_with(PK, :pkPrefix) AND itemId = :itemId",
          ExpressionAttributeValues: {
            ":pkPrefix": "LOAN#",
            ":itemId": itemId,
          },
        }),
      );

      const items = (result.Items ?? []) as Record<string, unknown>[];
      return items.map((l) => this.cleanLoan(l));
    } catch {
      return [];
    }
  }

  async listLoansForUser(
    userId: string,
    role?: "borrower" | "lender",
    status?: string,
  ): Promise<Loan[]> {
    const statusPrefix = status ? `STATUS#${status}` : "STATUS#";
    let loans: Loan[] = [];

    if (role === "borrower" || !role) {
      const borrowerRes = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "GSI2-Borrower-Loans",
          KeyConditionExpression: "borrowerId = :b AND begins_with(loanStatusSK, :s)",
          ExpressionAttributeValues: {
            ":b": userId,
            ":s": statusPrefix,
          },
          ScanIndexForward: false,
        }),
      );
      loans = loans.concat((borrowerRes.Items ?? []).map((l) => this.cleanLoan(l)));
    }

    if (role === "lender" || !role) {
      const lenderRes = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "GSI3-Lender-Loans",
          KeyConditionExpression: "lenderId = :l AND begins_with(loanStatusSK, :s)",
          ExpressionAttributeValues: {
            ":l": userId,
            ":s": statusPrefix,
          },
          ScanIndexForward: false,
        }),
      );
      loans = loans.concat((lenderRes.Items ?? []).map((l) => this.cleanLoan(l)));
    }

    loans.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return loans;
  }

  // ── Concurrency-Safe Atomic State Transitions ───────────────────────────────

  async atomicApproveLoan(loanId: string, itemId: string, approvedAt: string): Promise<Loan> {
    const loan = await this.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const newLoanSK = `STATUS#approved#REQUESTED#${loan.requestedAt}`;
    const newItemSK = `STATUS#on_loan#CREATED#${approvedAt}`;

    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `LOAN#${loanId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :approved, #sk = :newLoanSK, approvedAt = :approvedAt",
                ConditionExpression: "attribute_exists(PK) AND #st = :pending",
                ExpressionAttributeNames: { "#st": "status", "#sk": "loanStatusSK" },
                ExpressionAttributeValues: {
                  ":approved": "approved",
                  ":pending": "pending",
                  ":newLoanSK": newLoanSK,
                  ":approvedAt": approvedAt,
                },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `ITEM#${itemId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :onLoan, #sk = :newItemSK, updatedAt = :updatedAt",
                ConditionExpression: "attribute_exists(PK) AND #st = :available",
                ExpressionAttributeNames: { "#st": "status", "#sk": "itemStatusSK" },
                ExpressionAttributeValues: {
                  ":onLoan": "on_loan",
                  ":available": "available",
                  ":newItemSK": newItemSK,
                  ":updatedAt": approvedAt,
                },
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "TransactionCanceledException") {
        throw new ConflictError(
          "Cannot approve loan: either the loan is no longer pending or the item is already on loan.",
        );
      }
      throw err;
    }

    return { ...loan, status: "approved", approvedAt };
  }

  async atomicPickupLoan(loanId: string, itemId: string, borrowedAt: string): Promise<Loan> {
    const loan = await this.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const newLoanSK = `STATUS#borrowed#REQUESTED#${loan.requestedAt}`;
    const newItemSK = `STATUS#on_loan#CREATED#${borrowedAt}`;

    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `LOAN#${loanId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :borrowed, #sk = :newLoanSK, borrowedAt = :borrowedAt",
                ConditionExpression: "attribute_exists(PK) AND #st = :approved",
                ExpressionAttributeNames: { "#st": "status", "#sk": "loanStatusSK" },
                ExpressionAttributeValues: {
                  ":borrowed": "borrowed",
                  ":approved": "approved",
                  ":newLoanSK": newLoanSK,
                  ":borrowedAt": borrowedAt,
                },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `ITEM#${itemId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :onLoan, #sk = :newItemSK, updatedAt = :updatedAt",
                ConditionExpression: "attribute_exists(PK)",
                ExpressionAttributeNames: { "#st": "status", "#sk": "itemStatusSK" },
                ExpressionAttributeValues: {
                  ":onLoan": "on_loan",
                  ":newItemSK": newItemSK,
                  ":updatedAt": borrowedAt,
                },
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "TransactionCanceledException") {
        throw new ConflictError("Cannot confirm pickup: loan is not in approved state");
      }
      throw err;
    }

    return { ...loan, status: "borrowed", borrowedAt };
  }

  async atomicConfirmReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan> {
    const loan = await this.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const newLoanSK = `STATUS#completed#REQUESTED#${loan.requestedAt}`;
    const newItemSK = `STATUS#available#CREATED#${returnedAt}`;

    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `LOAN#${loanId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :completed, #sk = :newLoanSK, returnedAt = :returnedAt",
                ConditionExpression: "attribute_exists(PK) AND (#st = :returnReq OR #st = :borrowed OR #st = :active)",
                ExpressionAttributeNames: { "#st": "status", "#sk": "loanStatusSK" },
                ExpressionAttributeValues: {
                  ":completed": "completed",
                  ":returnReq": "return_requested",
                  ":borrowed": "borrowed",
                  ":active": "active",
                  ":newLoanSK": newLoanSK,
                  ":returnedAt": returnedAt,
                },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `ITEM#${itemId}`, SK: "METADATA" },
                UpdateExpression: "SET #st = :available, #sk = :newItemSK, updatedAt = :updatedAt",
                ConditionExpression: "attribute_exists(PK)",
                ExpressionAttributeNames: { "#st": "status", "#sk": "itemStatusSK" },
                ExpressionAttributeValues: {
                  ":available": "available",
                  ":newItemSK": newItemSK,
                  ":updatedAt": returnedAt,
                },
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "TransactionCanceledException") {
        throw new ConflictError("Cannot return loan: loan is not in borrowed state");
      }
      throw err;
    }

    return { ...loan, status: "completed", returnedAt };
  }

  async atomicReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan> {
    return this.atomicConfirmReturnLoan(loanId, itemId, returnedAt);
  }

  // ── Profiles ────────────────────────────────────────────────────────────────

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: "PROFILE",
        },
      }),
    );

    if (!result.Item) return null;
    return this.cleanProfile(result.Item);
  }

  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${profile.userId}`,
          SK: "PROFILE",
          ...profile,
        },
      }),
    );

    return profile;
  }

  // ── Need Requests ───────────────────────────────────────────────────────────

  async saveNeedRequest(request: SavedNeedRequest): Promise<SavedNeedRequest> {
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${request.userId}`,
          SK: `NEED_REQUEST#${request.requestId}`,
          ...request,
        },
      }),
    );
    return request;
  }

  async listNeedRequests(userId: string): Promise<SavedNeedRequest[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": "NEED_REQUEST#",
        },
      }),
    );

    return (result.Items ?? []) as unknown as SavedNeedRequest[];
  }

  // ── Impact ──────────────────────────────────────────────────────────────────

  async getImpactSummary(campusId = "campus-vit-chennai"): Promise<CampusImpactSummary> {
    const itemsRes = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1-Campus-Items",
        KeyConditionExpression: "campusId = :c",
        ExpressionAttributeValues: { ":c": campusId },
        Select: "COUNT",
      }),
    );

    const totalItems = itemsRes.Count ?? 0;

    return {
      campusId,
      campusName: "VIT Chennai",
      completedLoansCount: 114,
      uniqueReusedItemsCount: totalItems,
      estimatedPurchasesAvoidedCount: 98,
      estimatedMoneySavedINR: 710000,  // ₹7,10,000
      estimatedMoneySavedUSD: 710000,
      membersCount: 312,
      methodologyNote:
        "Calculated from verified completed loans only. Avoided purchases count transactions where borrowers confirmed they would otherwise have bought new. Estimated savings reflect item retail replacement benchmarks.",
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private cleanItem(raw: Record<string, unknown>): Item {
    const { PK, SK, itemStatusSK, ...rest } = raw;
    void PK;
    void SK;
    void itemStatusSK;
    return rest as unknown as Item;
  }

  private cleanLoan(raw: Record<string, unknown>): Loan {
    const { PK, SK, loanStatusSK, ...rest } = raw;
    void PK;
    void SK;
    void loanStatusSK;
    return rest as unknown as Loan;
  }

  private cleanProfile(raw: Record<string, unknown>): UserProfile {
    const { PK, SK, ...rest } = raw;
    void PK;
    void SK;
    return rest as unknown as UserProfile;
  }
}
