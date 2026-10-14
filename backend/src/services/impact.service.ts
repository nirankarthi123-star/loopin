/**
 * Impact Application Service — LoopIn Backend
 *
 * Provides campus-wide aggregate reuse and circular economy statistics.
 */

import type { ILoopInRepository } from "../repository/interface.js";
import type { CampusImpactSummary } from "@loopin/shared";

export class ImpactService {
  constructor(private readonly repo: ILoopInRepository) {}

  async getImpact(campusId?: string): Promise<CampusImpactSummary> {
    return this.repo.getImpactSummary(campusId);
  }
}
