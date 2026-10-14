/**
 * Authentication Middleware & Token Verification — LoopIn Backend
 *
 * SECURITY INVARIANTS:
 * 1. User identity is derived strictly from cryptographically verified token claims (sub claim).
 * 2. Client-provided identity headers (x-user-id, x-user-email, x-user-name) are NEVER trusted.
 * 3. Unsigned or forged tokens are strictly rejected with UnauthorizedError.
 * 4. Email verification is only marked true if verified by an authoritative mechanism.
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UnauthorizedError } from "../domain/errors.js";
import { verifyToken } from "../lib/jwt.js";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  displayName?: string | undefined;
  campusId?: string | undefined;
  emailVerified?: boolean | undefined;
  campusVerified?: boolean | undefined;
}

/**
 * Extracts and strictly validates user identity from the API Gateway / Function URL event.
 */
export function extractAuth(event: APIGatewayProxyEventV2): AuthenticatedUser {
  // 1. First-class API Gateway claims (if invoked behind a trusted authorizer)
  const requestContext = event.requestContext as unknown as Record<string, unknown> | undefined;
  const authorizer = requestContext?.["authorizer"] as Record<string, unknown> | undefined;
  const jwt = authorizer?.["jwt"] as Record<string, unknown> | undefined;
  const claims = (jwt?.["claims"] ?? authorizer?.["claims"]) as Record<string, unknown> | undefined;

  if (claims) {
    const userId = (claims["sub"] ?? claims["username"]) as string | undefined;
    const email = claims["email"] as string | undefined;
    const displayName = (claims["name"] ?? claims["displayName"]) as string | undefined;
    const campusId = (claims["custom:campusId"] ?? claims["campusId"]) as string | undefined;
    const emailVerified = claims["email_verified"] === "true" || claims["email_verified"] === true;
    const campusVerified = Boolean(
      emailVerified && email && (email.endsWith(".ac.in") || email.endsWith(".edu")),
    );

    if (userId && email) {
      return {
        userId,
        email,
        emailVerified,
        campusVerified,
        ...(displayName !== undefined ? { displayName } : {}),
        ...(campusId !== undefined ? { campusId } : {}),
      };
    }
  }

  // 2. Cryptographically verified Bearer token
  const headers = event.headers || {};
  const authHeader = headers["authorization"] || headers["Authorization"];

  if (!authHeader) {
    throw new UnauthorizedError("Authentication token is missing. Please provide Authorization: Bearer <token>");
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    throw new UnauthorizedError("Malformed Authorization header. Format must be: Bearer <token>");
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    const email = payload.email;
    const isCampusDomain = email.endsWith(".ac.in") || email.endsWith(".edu");

    return {
      userId: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      campusId: payload.campusId,
      emailVerified: Boolean(payload.emailVerified),
      campusVerified: Boolean(payload.emailVerified && isCampusDomain),
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError(
      `Invalid authentication token: ${err instanceof Error ? err.message : "verification failed"}`,
    );
  }
}

/**
 * Async wrapper for extractAuth for compatibility.
 */
export async function extractAuthAsync(event: APIGatewayProxyEventV2): Promise<AuthenticatedUser> {
  return extractAuth(event);
}
