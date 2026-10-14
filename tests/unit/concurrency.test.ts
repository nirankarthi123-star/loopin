import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { ItemsService } from "@loopin/backend/services/items.service.js";
import { LoansService } from "@loopin/backend/services/loans.service.js";
import { ConflictError, ForbiddenError, BusinessRuleError } from "@loopin/backend/domain/errors.js";

describe("Concurrency-Sensitive Business Logic & Storage Operations", () => {
  let repo: MemoryRepository;
  let itemsService: ItemsService;
  let loansService: LoansService;

  const lenderUser = {
    userId: "user-lender-1",
    email: "lender@iitm.ac.in",
    displayName: "Lender One",
  };

  const borrowerUserA = {
    userId: "user-borrower-a",
    email: "borrowera@iitm.ac.in",
    displayName: "Borrower A",
  };

  const borrowerUserB = {
    userId: "user-borrower-b",
    email: "borrowerb@iitm.ac.in",
    displayName: "Borrower B",
  };

  beforeEach(() => {
    repo = new MemoryRepository(false);
    itemsService = new ItemsService(repo);
    loansService = new LoansService(repo);
  });

  it("should prevent simultaneous conflicting loan requests on the same item", async () => {
    // 1. Lender lists an item
    const item = await itemsService.createItem(
      {
        title: "Raspberry Pi 4 Model B",
        description: "4GB RAM model with micro-HDMI adapter.",
        category: "electronics",
        condition: "good",
        estimatedValue: 75,
        tags: ["rpi", "embedded"],
      },
      lenderUser,
    );

    // 2. Borrower A requests loan
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const loanA = await loansService.requestLoan(
      {
        itemId: item.itemId,
        dueDate: futureDate,
        borrowerNote: "For IOT project.",
      },
      borrowerUserA,
    );

    expect(loanA.status).toBe("pending");

    // 3. Borrower B attempts to request the same item while loan A is pending
    await expect(
      loansService.requestLoan(
        {
          itemId: item.itemId,
          dueDate: futureDate,
          borrowerNote: "I need it as well.",
        },
        borrowerUserB,
      ),
    ).rejects.toThrowError(ConflictError);
  });

  it("should atomically update item and loan state on approval", async () => {
    const item = await itemsService.createItem(
      {
        title: "Soldering Station 60W",
        description: "Temperature controlled soldering iron with stand.",
        category: "tools",
        condition: "good",
        estimatedValue: 40,
        tags: ["soldering", "hardware"],
      },
      lenderUser,
    );

    const futureDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const loan = await loansService.requestLoan(
      {
        itemId: item.itemId,
        dueDate: futureDate,
      },
      borrowerUserA,
    );

    // Approve loan
    const approvedLoan = await loansService.approveLoan(loan.loanId, lenderUser);
    expect(approvedLoan.status).toBe("approved");

    // Verify item is now marked on_loan
    const updatedItem = await itemsService.getItem(item.itemId);
    expect(updatedItem.status).toBe("on_loan");
  });

  it("should prevent duplicate approval or re-approval of non-pending loans", async () => {
    const item = await itemsService.createItem(
      {
        title: "Oscilloscope 100MHz",
        description: "2-channel digital storage oscilloscope.",
        category: "electronics",
        condition: "like_new",
        estimatedValue: 350,
        tags: ["lab"],
      },
      lenderUser,
    );

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const loan = await loansService.requestLoan(
      {
        itemId: item.itemId,
        dueDate: futureDate,
      },
      borrowerUserA,
    );

    // First approval
    await loansService.approveLoan(loan.loanId, lenderUser);

    // Second approval attempt should fail with ConflictError
    await expect(loansService.approveLoan(loan.loanId, lenderUser)).rejects.toThrowError(
      ConflictError,
    );
  });

  it("should complete the full lifecycle: request -> approve -> pickup -> return", async () => {
    const item = await itemsService.createItem(
      {
        title: "Dremel Rotary Tool 4000",
        description: "Rotary tool kit with 30 accessories.",
        category: "tools",
        condition: "good",
        estimatedValue: 90,
        tags: ["dremel", "diy"],
      },
      lenderUser,
    );

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Request
    const loan = await loansService.requestLoan(
      {
        itemId: item.itemId,
        dueDate: futureDate,
      },
      borrowerUserA,
    );
    expect(loan.status).toBe("pending");

    // 2. Approve
    const approved = await loansService.approveLoan(loan.loanId, lenderUser);
    expect(approved.status).toBe("approved");

    // 3. Pickup
    const active = await loansService.pickupLoan(loan.loanId, borrowerUserA);
    expect(active.status).toBe("borrowed");

    // 4. Return
    const returned = await loansService.returnLoan(loan.loanId, lenderUser);
    expect(returned.status).toBe("completed");

    // Verify item is restored to available
    const restoredItem = await itemsService.getItem(item.itemId);
    expect(restoredItem.status).toBe("available");
  });
});
