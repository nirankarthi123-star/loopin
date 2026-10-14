/**
 * Lambda HTTP Response & Error Helpers — LoopIn Backend
 *
 * Builds consistent API Gateway HTTP API proxy responses and maps domain/Zod errors
 * to proper HTTP status codes with safe error payloads.
 */

import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { ZodError } from "zod";
import type { ApiResponse, ApiError } from "@loopin/shared";
import { AppError } from "../domain/errors.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env["ALLOWED_ORIGIN"] ?? "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-User-Id,X-User-Email,X-User-Name",
};

export function ok<T>(data: T, meta?: ApiResponse<T>["meta"]): APIGatewayProxyResultV2 {
  const body: ApiResponse<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created<T>(data: T): APIGatewayProxyResultV2 {
  const body: ApiResponse<T> = { success: true, data };
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function error(
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): APIGatewayProxyResultV2 {
  const body: ApiError = {
    success: false,
    error: { code, message, statusCode, ...(details ? { details } : {}) },
  };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function notFound(resource: string): APIGatewayProxyResultV2 {
  return error(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found`);
}

export function forbidden(message = "Forbidden"): APIGatewayProxyResultV2 {
  return error(403, "FORBIDDEN", message);
}

export function badRequest(message: string, details?: Record<string, unknown>): APIGatewayProxyResultV2 {
  return error(400, "VALIDATION_ERROR", message, details);
}

export function internalError(message = "Internal server error"): APIGatewayProxyResultV2 {
  return error(500, "INTERNAL_ERROR", message);
}

/**
 * Global error handler converting Zod, Domain, or Unknown errors into HTTP responses.
 */
export function handleLambdaError(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof AppError) {
    return error(err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const field = issue.path.join(".");
      fieldErrors[field] = issue.message;
    }
    return error(400, "VALIDATION_ERROR", "Invalid request input", { fields: fieldErrors });
  }

  // Safe error logging server-side; safe generic message client-side
  console.error("[LoopIn] Unhandled server error:", err);
  return error(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
}
