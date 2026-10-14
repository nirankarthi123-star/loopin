/**
 * Authenticated API Client — LoopIn Frontend
 *
 * Automatically injects the verified Bearer token into request headers:
 *   Authorization: Bearer <token>
 *
 * Handles HTTP error mapping, JSON parsing, and unauthorized session revocation.
 * Strictly avoids transmitting mock identity headers (x-user-id, x-user-email, x-user-name).
 */

import { API_BASE_URL } from "./env.ts";
import { authService } from "./cognito.ts";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(
    statusCode: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = await authService.getSession();
  const token = session?.idToken || session?.accessToken;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = API_BASE_URL?.replace(/\/$/, "") || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If the token is rejected by the server, sign out to trigger re-auth
    await authService.signOut();
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `HTTP error ${response.status}`;
    const errorCode = data?.error?.code || "HTTP_ERROR";
    throw new ApiError(response.status, errorCode, errorMsg);
  }

  return (data?.data ?? data) as T;
}
