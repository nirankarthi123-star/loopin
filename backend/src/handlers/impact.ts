/**
 * Impact Lambda Handler — LoopIn Backend
 *
 * Routes:
 * - GET /impact
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, badRequest, handleLambdaError } from "../lib/response.js";
import { getRepository } from "../repository/factory.js";
import { ImpactService } from "../services/impact.service.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const repo = getRepository();
  const impactService = new ImpactService(repo);
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.rawPath.toLowerCase();

    // ── GET /impact ───────────────────────────────────────────────────────────
    if (method === "GET" && (rawPath.endsWith("/impact") || rawPath === "/impact")) {
      const campusId = event.queryStringParameters?.["campusId"];
      const summary = await impactService.getImpact(campusId);
      return ok(summary);
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return handleLambdaError(err);
  }
}
