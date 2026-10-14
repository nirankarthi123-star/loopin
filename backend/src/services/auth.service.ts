/**
 * Application Authentication Service — LoopIn Backend
 *
 * Implements:
 * 1. Student account registration with password hashing.
 * 2. Student login with timing-safe verification.
 * 3. Issuance of cryptographically signed, expiring JWT tokens.
 * 4. Institutional campus domain checking without falsely claiming email verification.
 */

import { v4 as uuidv4 } from "uuid";
import type { ILoopInRepository, UserAccount } from "../repository/interface.js";
import { hashPassword, verifyPassword, signToken } from "../lib/jwt.js";
import { BadRequestError, UnauthorizedError, ConflictError } from "../domain/errors.js";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  campusId?: string | undefined;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SafeUser {
  userId: string;
  email: string;
  displayName: string;
  campusId: string;
  emailVerified: boolean;
  campusVerified: boolean;
}

export interface AuthResponse {
  token: string;
  user: SafeUser;
}

export class AuthService {
  constructor(private readonly repo: ILoopInRepository) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new BadRequestError("A valid institutional email address is required");
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    const displayName = input.displayName?.trim() || email.split("@")[0] || "Student";
    const campusId = input.campusId?.trim() || "campus-vit-chennai";

    // Check duplicate email
    const existing = await this.repo.getAccountByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email address already exists");
    }

    const { hash, salt } = hashPassword(input.password);
    const userId = `user-${uuidv4()}`;
    const now = new Date().toISOString();

    const isCampusDomain = email.endsWith(".ac.in") || email.endsWith(".edu");

    const newAccount: UserAccount = {
      userId,
      email,
      passwordHash: hash,
      salt,
      displayName,
      campusId,
      emailVerified: false, // Explicit: do not claim verified without real verification mechanism
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.createAccount(newAccount);

    const safeUser: SafeUser = {
      userId,
      email,
      displayName,
      campusId,
      emailVerified: false,
      campusVerified: isCampusDomain,
    };

    const token = signToken({
      sub: userId,
      email,
      displayName,
      campusId,
      emailVerified: false,
      campusVerified: isCampusDomain,
    });

    return { token, user: safeUser };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) {
      throw new BadRequestError("Email and password are required");
    }

    const account = await this.repo.getAccountByEmail(email);
    if (!account) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValid = verifyPassword(input.password, account.passwordHash, account.salt);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isCampusDomain = email.endsWith(".ac.in") || email.endsWith(".edu");

    const safeUser: SafeUser = {
      userId: account.userId,
      email: account.email,
      displayName: account.displayName,
      campusId: account.campusId,
      emailVerified: account.emailVerified,
      campusVerified: isCampusDomain,
    };

    const token = signToken({
      sub: account.userId,
      email: account.email,
      displayName: account.displayName,
      campusId: account.campusId,
      emailVerified: account.emailVerified,
      campusVerified: isCampusDomain,
    });

    return { token, user: safeUser };
  }
}
