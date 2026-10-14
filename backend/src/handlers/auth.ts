/**
 * Authentication Lambda Handler — LoopIn Backend
 *
 * Routes:
 * - POST /auth/register
 * - POST /auth/login
 * - GET /auth/me
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, created, badRequest, handleLambdaError } from "../lib/response.js";
import { extractAuth } from "../middleware/auth.js";
import { getRepository } from "../repository/factory.js";
import { AuthService } from "../services/auth.service.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const repo = getRepository();
  const authService = new AuthService(repo);

  try {
    const method = event.requestContext?.http?.method?.toUpperCase() ?? "GET";
    const rawPath = (event.rawPath || "/").toLowerCase();

    // ── POST /auth/register ──────────────────────────────────────────────────
    if (method === "POST" && rawPath.endsWith("/register")) {
      if (!event.body) {
        return badRequest("Request body is required");
      }
      const parsed = JSON.parse(event.body);
      const result = await authService.register(parsed);
      return created(result);
    }

    // ── POST /auth/login ─────────────────────────────────────────────────────
    if (method === "POST" && rawPath.endsWith("/login")) {
      if (!event.body) {
        return badRequest("Request body is required");
      }
      const parsed = JSON.parse(event.body);
      const result = await authService.login(parsed);
      return ok(result);
    }

    // ── GET /auth/me ─────────────────────────────────────────────────────────
    if (method === "GET" && rawPath.endsWith("/me")) {
      const user = extractAuth(event);
      return ok({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        campusId: user.campusId,
        emailVerified: user.emailVerified,
        campusVerified: user.campusVerified,
      });
    }

    return badRequest(`Unhandled auth route: ${method} ${event.rawPath}`);
  } catch (err) {
    return handleLambdaError(err);
  }
}
