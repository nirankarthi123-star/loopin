/**
 * Loans Lambda Handler — LoopIn Backend
 *
 * Routes:
 * - POST /loans
 * - GET /loans/mine
 * - POST /loans/{id}/approve
 * - POST /loans/{id}/reject
 * - POST /loans/{id}/pickup
 * - POST /loans/{id}/return
 * - GET /loans/{id}
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, created, badRequest, handleLambdaError } from "../lib/response.js";
import { extractAuth } from "../middleware/auth.js";
import { getRepository } from "../repository/factory.js";
import { LoansService } from "../services/loans.service.js";
import { CreateLoanSchema, QueryLoansSchema } from "../schemas/loans.schema.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const repo = getRepository();
  const loansService = new LoansService(repo);
  try {
    const user = extractAuth(event);
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.rawPath.toLowerCase();

    const loanId = event.pathParameters?.["id"] ?? event.pathParameters?.["loanId"];
    const action = event.pathParameters?.["action"];

    // ── GET /loans/mine ───────────────────────────────────────────────────────
    if (method === "GET" && (rawPath.endsWith("/loans/mine") || rawPath === "/loans/mine")) {
      const queryParams = event.queryStringParameters ?? {};
      const parsedQuery = QueryLoansSchema.parse(queryParams);
      const loans = await loansService.listMyLoans(user, parsedQuery);
      return ok(loans);
    }

    // ── POST /loans ───────────────────────────────────────────────────────────
    if (method === "POST" && !loanId && !action && rawPath.endsWith("/loans")) {
      if (!event.body) {
        return badRequest("Request body is required");
      }
      const rawBody = JSON.parse(event.body);
      const validatedInput = CreateLoanSchema.parse(rawBody);
      const newLoan = await loansService.requestLoan(validatedInput, user);
      return created(newLoan);
    }

    // ── Loan Action Routes: /loans/{id}/approve, reject, pickup, return ────────
    if (method === "POST" || method === "PUT") {
      const resolvedAction = action ?? extractActionFromPath(rawPath);

      if (loanId && resolvedAction) {
        switch (resolvedAction) {
          case "approve": {
            const approved = await loansService.approveLoan(loanId, user);
            return ok(approved);
          }
          case "reject": {
            const rejected = await loansService.rejectLoan(loanId, user);
            return ok(rejected);
          }
          case "pickup": {
            const pickedUp = await loansService.pickupLoan(loanId, user);
            return ok(pickedUp);
          }
          case "request-return":
          case "request_return": {
            const reqRet = await loansService.requestReturnLoan(loanId, user);
            return ok(reqRet);
          }
          case "confirm-return":
          case "confirm_return":
          case "return": {
            const returned = await loansService.confirmReturnLoan(loanId, user);
            return ok(returned);
          }
          case "cancel": {
            const cancelled = await loansService.cancelLoan(loanId, user);
            return ok(cancelled);
          }
          case "due-date":
          case "due_date": {
            if (!event.body) return badRequest("Request body is required");
            const body = JSON.parse(event.body);
            if (!body.dueDate) return badRequest("dueDate is required");
            const updated = await loansService.updateDueDate(loanId, body.dueDate, user);
            return ok(updated);
          }
          case "reconcile-schedules":
          case "reconcile_schedules": {
            const reconciled = await loansService.reconcileLoanSchedules(loanId, user);
            return ok(reconciled);
          }
          default:
            return badRequest(`Unsupported loan action: '${resolvedAction}'`);
        }
      }
    }

    // ── PATCH /loans/{id} ─────────────────────────────────────────────────────
    if (method === "PATCH" && loanId && !action) {
      if (!event.body) return badRequest("Request body is required");
      const body = JSON.parse(event.body);
      if (body.dueDate) {
        const updated = await loansService.updateDueDate(loanId, body.dueDate, user);
        return ok(updated);
      }
    }

    // ── GET /loans/{id} ───────────────────────────────────────────────────────
    if (method === "GET" && loanId && !action) {
      const loan = await loansService.getLoan(loanId, user);
      return ok(loan);
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return handleLambdaError(err);
  }
}

function extractActionFromPath(path: string): string | undefined {
  if (path.endsWith("/approve")) return "approve";
  if (path.endsWith("/reject")) return "reject";
  if (path.endsWith("/pickup")) return "pickup";
  if (path.endsWith("/request-return")) return "request-return";
  if (path.endsWith("/confirm-return")) return "confirm-return";
  if (path.endsWith("/return")) return "return";
  if (path.endsWith("/cancel")) return "cancel";
  if (path.endsWith("/due-date")) return "due-date";
  if (path.endsWith("/reconcile-schedules")) return "reconcile-schedules";
  return undefined;
}
