/**
 * Cryptographic Token & Password Utilities — LoopIn Backend
 *
 * Implements:
 * 1. Password hashing with cryptographically secure salt and scrypt (Node native crypto).
 * 2. Timing-safe password verification.
 * 3. HS256 JWT signing and verification with expiration enforcement.
 * 4. Zero external dependencies.
 */

import crypto from "node:crypto";
import { UnauthorizedError } from "../domain/errors.js";

export interface AuthTokenPayload {
  sub: string; // userId
  email: string;
  displayName: string;
  campusId: string;
  emailVerified: boolean;
  campusVerified?: boolean;
  iat: number;
  exp: number;
}

const DEFAULT_DEV_SECRET = "loopin-dev-insecure-secret-key-32-chars-minimum-required";

export function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"] || process.env["AUTH_TOKEN_SECRET"];
  if (!secret) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("JWT_SECRET (or AUTH_TOKEN_SECRET) environment variable must be configured in production");
    }
    return DEFAULT_DEV_SECRET;
  }
  return secret;
}

/**
 * Hashes a plaintext password using scrypt with a unique random 16-byte salt.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Verifies a plaintext password against a stored scrypt hash and salt in constant time.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (derivedKey.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Signs an HS256 JWT token with expiration timestamp.
 */
export function signToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  expiresInSeconds = 7 * 24 * 60 * 60, // 7 days default
  secret?: string,
): string {
  const signingSecret = secret ?? getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", signingSecret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies and decodes an HS256 JWT token. Throws UnauthorizedError on invalid signature or expiration.
 */
export function verifyToken(token: string, secret?: string): AuthTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedError("Malformed authentication token format");
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !providedSignature) {
    throw new UnauthorizedError("Malformed authentication token components");
  }

  const signingSecret = secret ?? getJwtSecret();
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", signingSecret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const providedSigBuf = Buffer.from(providedSignature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (
    providedSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
  ) {
    throw new UnauthorizedError("Invalid authentication token signature");
  }

  let payload: AuthTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid authentication token payload");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new UnauthorizedError("Authentication token has expired");
  }

  if (!payload.sub || !payload.email) {
    throw new UnauthorizedError("Authentication token is missing required identity claims");
  }

  return payload;
}

/**
 * Creates a signed Authorization header value for tests and internal workflows.
 */
export function createTestAuthHeader(user: {
  userId: string;
  email?: string;
  displayName?: string;
  campusId?: string;
  emailVerified?: boolean;
}): { authorization: string } {
  const email = user.email ?? `${user.userId}@campus.ac.in`;
  const token = signToken({
    sub: user.userId,
    email,
    displayName: user.displayName ?? "Test Student",
    campusId: user.campusId ?? "campus-vit-chennai",
    emailVerified: user.emailVerified ?? false,
    campusVerified: email.endsWith(".ac.in") || email.endsWith(".edu"),
  });
  return { authorization: `Bearer ${token}` };
}
