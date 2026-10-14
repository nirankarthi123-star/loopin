/**
 * Items Application Service — LoopIn Backend
 *
 * Implements business workflows for item discovery, listing creation,
 * updates, and deletion with ownership checks.
 */

import { v4 as uuidv4 } from "uuid";
import type { Item } from "@loopin/shared";
import type { ILoopInRepository } from "../repository/interface.js";
import type { CreateItemInput, PatchItemInput, QueryItemsInput } from "../schemas/items.schema.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../domain/errors.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export type { AuthenticatedUser };

export class ItemsService {
  constructor(private readonly repo: ILoopInRepository) {}

  async listItems(query: QueryItemsInput): Promise<{ items: Item[]; nextCursor?: string }> {
    return this.repo.listItems({
      category: query.category,
      status: query.status,
      campusId: query.campusId,
      search: query.search,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  async getItem(itemId: string): Promise<Item> {
    const item = await this.repo.getItem(itemId);
    if (!item) {
      throw new NotFoundError("item", itemId);
    }
    return item;
  }

  async createItem(input: CreateItemInput, user: AuthenticatedUser): Promise<Item> {
    const now = new Date().toISOString();
    const itemId = `item-${uuidv4()}`;

    const newItem: Item = {
      itemId,
      ownerId: user.userId,
      ownerName: user.displayName ?? user.email.split("@")[0] ?? "Student",
      title: input.title,
      description: input.description,
      category: input.category,
      estimatedValue: input.estimatedValue,
      status: "available",
      condition: input.condition,
      tags: input.tags,
      campusId: user.campusId ?? "campus-vit-chennai",
      createdAt: now,
      updatedAt: now,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    };

    return this.repo.createItem(newItem);
  }

  async patchItem(itemId: string, input: PatchItemInput, user: AuthenticatedUser): Promise<Item> {
    const existing = await this.getItem(itemId);

    // Rule: Only the owner can patch their listing
    if (existing.ownerId !== user.userId) {
      throw new ForbiddenError("You are not the owner of this item");
    }

    // Rule: Cannot manually force item to available if an active loan is in progress
    if (input.status === "available" && existing.status === "on_loan") {
      const activeLoans = await this.repo.listLoansByItem(itemId);
      const hasActive = activeLoans.some((l) => l.status === "active" || l.status === "approved");
      if (hasActive) {
        throw new ConflictError("Cannot mark item available while an active loan is in progress");
      }
    }

    const updatedItem: Item = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.condition !== undefined ? { condition: input.condition } : {}),
      ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      updatedAt: new Date().toISOString(),
    };

    return this.repo.updateItem(updatedItem);
  }

  async deleteItem(itemId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getItem(itemId);

    // Rule: Only the owner can delete their listing
    if (existing.ownerId !== user.userId) {
      throw new ForbiddenError("You are not the owner of this item");
    }

    // Rule: Cannot delete an item currently on loan or with active requests
    const loans = await this.repo.listLoansByItem(itemId);
    const hasActiveLoans = loans.some(
      (l) => l.status === "pending" || l.status === "approved" || l.status === "active",
    );
    if (hasActiveLoans) {
      throw new ConflictError("Cannot delete an item that has active or pending loans");
    }

    await this.repo.deleteItem(itemId);
  }
}
