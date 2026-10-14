/**
 * Environment helpers — LoopIn Frontend
 *
 * Centralises all environment variable access:
 * 1. Missing required variables fail loudly in development.
 * 2. Frontend code never accidentally imports AWS credentials or secrets.
 * 3. Deployed architecture targets Lambda Function URL via VITE_API_BASE_URL.
 */

/** The runtime mode: "demo" | "aws" */
export const APP_MODE = (import.meta.env["VITE_APP_MODE"] as string | undefined) ?? "demo";

export const IS_DEMO = APP_MODE === "demo";
export const IS_AWS = APP_MODE === "aws";

/** Backend API base URL (e.g. deployed Lambda Function URL or http://localhost:3001) */
export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] as string | undefined;

// Optional legacy variables for backward compatibility
export const COGNITO_REGION = import.meta.env["VITE_COGNITO_REGION"] as string | undefined;
export const COGNITO_USER_POOL_ID = import.meta.env["VITE_COGNITO_USER_POOL_ID"] as string | undefined;
export const COGNITO_USER_POOL_CLIENT_ID = import.meta.env["VITE_COGNITO_USER_POOL_CLIENT_ID"] as string | undefined;

if (IS_AWS && !API_BASE_URL) {
  console.warn(
    `[LoopIn] "VITE_API_BASE_URL" is not set in AWS mode. Ensure your Lambda Function URL is configured in Netlify environment variables.`,
  );
}
