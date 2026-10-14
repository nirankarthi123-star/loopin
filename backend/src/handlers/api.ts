/**
 * Unified API Lambda Function URL Dispatcher — LoopIn Backend
 *
 * Implements HTTP routing and path parameter extraction for AWS Lambda Function URL:
 * - /auth* -> authHandler
 * - /items* -> itemsHandler
 * - /loans* -> loansHandler
 * - /profile*, /users* -> usersHandler
 * - /impact* -> impactHandler
 *
 * Lambda Function URLs invoke Lambda with APIGatewayProxyEventV2 format.
 * This dispatcher inspects event.rawPath, populates event.pathParameters,
 * handles CORS OPTIONS preflight requests, and delegates to the appropriate domain handler.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler as authHandler } from "./auth.js";
import { handler as itemsHandler } from "./items.js";
import { handler as loansHandler } from "./loans.js";
import { handler as usersHandler } from "./users.js";
import { handler as impactHandler } from "./impact.js";
import { badRequest, notFound } from "../lib/response.js";

const ALLOWED_ORIGIN = process.env["ALLOWED_ORIGIN"] ?? "*";

const CORS_PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method?.toUpperCase() ?? "GET";
  const rawPath = event.rawPath || "/";

  // Handle CORS preflight directly
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_PREFLIGHT_HEADERS,
      body: "",
    };
  }

  // Parse path segments: supports both `/items` and `/api/items`
  const rawSegments = rawPath.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const segments = rawSegments[0]?.toLowerCase() === "api" ? rawSegments.slice(1) : rawSegments;
  const rootSegment = segments[0]?.toLowerCase() ?? "";

  // Clone or ensure pathParameters object exists
  const pathParameters: Record<string, string | undefined> = { ...(event.pathParameters ?? {}) };

  try {
    switch (rootSegment) {
      case "auth": {
        if (segments[1]) {
          pathParameters["action"] = segments[1];
        }
        return await authHandler({ ...event, pathParameters });
      }

      case "items": {
        if (segments[1]) {
          pathParameters["id"] = segments[1];
          pathParameters["itemId"] = segments[1];
        }
        return await itemsHandler({ ...event, pathParameters });
      }

      case "loans": {
        if (segments[1] && segments[1] !== "mine") {
          pathParameters["id"] = segments[1];
          pathParameters["loanId"] = segments[1];
          if (segments[2]) {
            pathParameters["action"] = segments[2];
          }
        }
        return await loansHandler({ ...event, pathParameters });
      }

      case "profile":
      case "users": {
        if (segments[1] && segments[1] !== "me") {
          pathParameters["userId"] = segments[1];
          pathParameters["id"] = segments[1];
        }
        return await usersHandler({ ...event, pathParameters });
      }

      case "impact": {
        return await impactHandler({ ...event, pathParameters });
      }

      case "":
      case "health": {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          },
          body: JSON.stringify({
            status: "healthy",
            service: "LoopIn Backend Lambda",
            timestamp: new Date().toISOString(),
          }),
        };
      }

      default:
        return notFound(`Endpoint '${rawPath}'`);
    }
  } catch (err: unknown) {
    console.error("[ApiDispatcher] Unhandled error during request dispatch:", {
      method,
      rawPath,
      error: err instanceof Error ? err.message : String(err),
    });
    return badRequest(`Failed to process request on '${rawPath}'`);
  }
}
