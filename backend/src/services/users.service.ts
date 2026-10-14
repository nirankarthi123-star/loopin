/**
 * Users & Profile Application Service — LoopIn Backend
 *
 * Manages user profiles and derives verified TrustScore and lifetime impact.
 * Enforces privacy: student email and private fields are NEVER exposed to third parties.
 */

import type { UserProfile } from "@loopin/shared";
import type { ILoopInRepository } from "../repository/interface.js";
import type { AuthenticatedUser } from "./items.service.js";
import { deriveUserStats } from "../domain/trustScore.js";
import { NotFoundError } from "../domain/errors.js";

export interface PublicUserProfile {
  userId: string;
  displayName: string;
  campusId: string;
  avatarUrl?: string | undefined;
  bio?: string | undefined;
  campusVerified?: boolean | undefined;
  reliabilityScore: number;
  borrowCount: number;
  lendCount: number;
  createdAt: string;
}

export class UsersService {
  constructor(private readonly repo: ILoopInRepository) {}

  async getMyProfile(user: AuthenticatedUser): Promise<UserProfile> {
    let profile = await this.repo.getUserProfile(user.userId);

    const now = new Date().toISOString();
    if (!profile) {
      profile = {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName ?? user.email.split("@")[0] ?? "Student",
        campusId: user.campusId ?? "campus-vit-chennai",
        emailVerified: user.emailVerified ?? false, // Never falsely claim email is verified
        campusVerified: user.campusVerified ?? false,
        reliabilityScore: 70,
        totalSavings: 0,
        borrowCount: 0,
        lendCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Derive verified score and statistics directly from historical loan ledger
    const allUserLoans = await this.repo.listLoansForUser(user.userId);
    const updatedProfile = deriveUserStats(profile, allUserLoans);

    await this.repo.saveUserProfile(updatedProfile);
    return updatedProfile;
  }

  async getPublicProfile(targetUserId: string): Promise<PublicUserProfile> {
    const profile = await this.repo.getUserProfile(targetUserId);
    if (!profile) {
      throw new NotFoundError("user", targetUserId);
    }

    // Derive live stats from historical loan ledger
    const allUserLoans = await this.repo.listLoansForUser(targetUserId);
    const liveProfile = deriveUserStats(profile, allUserLoans);

    // Strictly redact private student information (email, phone, etc.)
    return {
      userId: liveProfile.userId,
      displayName: liveProfile.displayName,
      campusId: liveProfile.campusId,
      avatarUrl: liveProfile.avatarUrl,
      bio: liveProfile.bio,
      campusVerified: liveProfile.campusVerified,
      reliabilityScore: liveProfile.reliabilityScore,
      borrowCount: liveProfile.borrowCount,
      lendCount: liveProfile.lendCount,
      createdAt: liveProfile.createdAt,
    };
  }

  async getTrustScoreBreakdown(user: AuthenticatedUser) {
    const allUserLoans = await this.repo.listLoansForUser(user.userId);
    const borrowerLoans = allUserLoans.filter((l) => l.borrowerId === user.userId);
    const lenderLoans = allUserLoans.filter((l) => l.lenderId === user.userId);
    const { calculateDetailedReliabilityScore } = await import("../domain/trustScore.js");
    return calculateDetailedReliabilityScore(borrowerLoans, lenderLoans);
  }
}
