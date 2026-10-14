/**
 * Smart Need Matcher Service — LoopIn Backend
 *
 * Exposes deterministic natural language query matching and request saving.
 */

import { v4 as uuidv4 } from "uuid";
import type { ILoopInRepository } from "../repository/interface.js";
import type { SmartNeedQuery, SmartMatchResult, SavedNeedRequest, ItemCategory } from "@loopin/shared";
import type { AuthenticatedUser } from "./items.service.js";
import { matchItemsForNeed, parseNaturalNeedQuery } from "../domain/smartMatcher.js";

export class NeedMatcherService {
  constructor(private readonly repo: ILoopInRepository) {}

  async matchNeed(query: SmartNeedQuery, user: AuthenticatedUser): Promise<{
    results: SmartMatchResult[];
    queryAnalysis: ReturnType<typeof parseNaturalNeedQuery>;
  }> {
    const campusId = user.campusId ?? "campus-vit-chennai";
    const { items } = await this.repo.listItems({ campusId, limit: 100 });

    const results = matchItemsForNeed(items, query);
    const queryText = query.naturalQuery ?? query.itemOrCategory ?? "";
    const queryAnalysis = parseNaturalNeedQuery(queryText);

    return {
      results,
      queryAnalysis,
    };
  }

  async saveNeedRequest(
    input: { queryText: string; category?: ItemCategory; requiredDate?: string; preferredLocation?: string },
    user: AuthenticatedUser,
  ): Promise<SavedNeedRequest> {
    const campusId = user.campusId ?? "campus-vit-chennai";
    const request: SavedNeedRequest = {
      requestId: `req-${uuidv4()}`,
      userId: user.userId,
      queryText: input.queryText,
      campusId,
      createdAt: new Date().toISOString(),
      ...(input.category ? { category: input.category } : {}),
      ...(input.requiredDate ? { requiredDate: input.requiredDate } : {}),
      ...(input.preferredLocation ? { preferredLocation: input.preferredLocation } : {}),
    };

    return this.repo.saveNeedRequest(request);
  }

  async listSavedRequests(user: AuthenticatedUser): Promise<SavedNeedRequest[]> {
    return this.repo.listNeedRequests(user.userId);
  }
}
