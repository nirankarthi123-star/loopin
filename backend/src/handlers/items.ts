/**
 * Items Lambda Handler — LoopIn Backend
 *
 * Routes:
 * - GET /items
 * - GET /items/{id}
 * - POST /items
 * - PATCH /items/{id}
 * - DELETE /items/{id}
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, created, badRequest, handleLambdaError } from "../lib/response.js";
import { extractAuth } from "../middleware/auth.js";
import { getRepository } from "../repository/factory.js";
import { ItemsService } from "../services/items.service.js";
import {
  CreateItemSchema,
  PatchItemSchema,
  QueryItemsSchema,
} from "../schemas/items.schema.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const repo = getRepository();
  const itemsService = new ItemsService(repo);
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const itemId = event.pathParameters?.["id"] ?? event.pathParameters?.["itemId"];

    // ── GET /items ────────────────────────────────────────────────────────────
    if (method === "GET" && !itemId) {
      const queryParams = event.queryStringParameters ?? {};
      const parsedQuery = QueryItemsSchema.parse(queryParams);
      const result = await itemsService.listItems(parsedQuery);
      return ok(result.items, result.nextCursor ? { cursor: result.nextCursor } : undefined);
    }

    // ── GET /items/{id} ───────────────────────────────────────────────────────
    if (method === "GET" && itemId) {
      const item = await itemsService.getItem(itemId);
      return ok(item);
    }

    // ── POST /items ───────────────────────────────────────────────────────────
    if (method === "POST" && !itemId) {
      const user = extractAuth(event);
      if (!event.body) {
        return badRequest("Request body is required");
      }
      const rawBody = JSON.parse(event.body);
      const validatedInput = CreateItemSchema.parse(rawBody);
      const newItem = await itemsService.createItem(validatedInput, user);
      return created(newItem);
    }

    // ── PATCH /items/{id} ─────────────────────────────────────────────────────
    if ((method === "PATCH" || method === "PUT") && itemId) {
      const user = extractAuth(event);
      if (!event.body) {
        return badRequest("Request body is required");
      }
      const rawBody = JSON.parse(event.body);
      const validatedInput = PatchItemSchema.parse(rawBody);
      const updatedItem = await itemsService.patchItem(itemId, validatedInput, user);
      return ok(updatedItem);
    }

    // ── DELETE /items/{id} ───────────────────────────────────────────────────
    if (method === "DELETE" && itemId) {
      const user = extractAuth(event);
      await itemsService.deleteItem(itemId, user);
      return ok({ message: "Item deleted successfully", itemId });
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return handleLambdaError(err);
  }
}
