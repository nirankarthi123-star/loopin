/**
 * Profile & Users Lambda Handler — LoopIn Backend
 *
 * Routes:
 * - GET /profile/me, GET /users/me -> Authenticated caller's full profile
 * - GET /users/{userId}, GET /profile/{userId} -> Sanitized public profile (email redacted)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, badRequest, handleLambdaError } from "../lib/response.js";
import { extractAuth } from "../middleware/auth.js";
import { getRepository } from "../repository/factory.js";
import { UsersService } from "../services/users.service.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const repo = getRepository();
  const usersService = new UsersService(repo);

  try {
    const user = extractAuth(event);
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.rawPath.toLowerCase();
    const targetUserId = event.pathParameters?.["userId"] ?? event.pathParameters?.["id"];

    // ── GET /profile/me or GET /users/me ───────────────────────────────────────
    if (method === "GET" && (rawPath.endsWith("/profile/me") || rawPath.endsWith("/users/me") || targetUserId === "me")) {
      const profile = await usersService.getMyProfile(user);
      return ok(profile);
    }

    // ── GET /users/{userId} or GET /profile/{userId} ───────────────────────────
    if (method === "GET" && targetUserId) {
      if (targetUserId === user.userId) {
        const myProfile = await usersService.getMyProfile(user);
        return ok(myProfile);
      }
      const publicProfile = await usersService.getPublicProfile(targetUserId);
      return ok(publicProfile);
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return handleLambdaError(err);
  }
}
