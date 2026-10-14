/**
 * Repository Factory — LoopIn Backend
 *
 * Chooses between MemoryRepository (for local development, demo mode, and offline tests)
 * and DynamoDbRepository (for live AWS / DynamoDB Local).
 */

import type { ILoopInRepository } from "./interface.js";
import { MemoryRepository } from "./memory.repository.js";
import { DynamoDbRepository } from "./dynamodb.repository.js";

let _instance: ILoopInRepository | null = null;

export function getRepository(): ILoopInRepository {
  if (_instance) return _instance;

  const storageDriver = process.env["STORAGE_DRIVER"]?.toLowerCase();
  const hasDynamoTable = Boolean(process.env["DYNAMODB_TABLE_NAME"]);
  const isLambda = Boolean(process.env["AWS_LAMBDA_FUNCTION_NAME"]);
  const isProduction = process.env["NODE_ENV"] === "production";

  // Explicit local demo / memory mode requested
  if (storageDriver === "memory") {
    _instance = new MemoryRepository(true);
    return _instance;
  }

  // Explicit DynamoDB driver requested
  if (storageDriver === "dynamodb") {
    if (!hasDynamoTable) {
      throw new Error(
        "Missing required configuration: DYNAMODB_TABLE_NAME must be defined when STORAGE_DRIVER is 'dynamodb'.",
      );
    }
    _instance = new DynamoDbRepository();
    return _instance;
  }

  // Running inside AWS Lambda or production environment: strictly require DynamoDB
  if (isLambda || isProduction) {
    if (!hasDynamoTable) {
      throw new Error(
        "Missing required configuration: DYNAMODB_TABLE_NAME must be configured in AWS Lambda environment.",
      );
    }
    _instance = new DynamoDbRepository();
    return _instance;
  }

  // Local development without STORAGE_DRIVER set:
  // If DYNAMODB_TABLE_NAME is present, connect to DynamoDB (e.g. DynamoDB Local or AWS)
  if (hasDynamoTable) {
    _instance = new DynamoDbRepository();
    return _instance;
  }

  // Otherwise, default to in-memory demo repository for local offline development
  _instance = new MemoryRepository(true);
  return _instance;
}

/**
 * Allows overriding repository in test suites.
 */
export function setRepository(repo: ILoopInRepository | null): void {
  _instance = repo;
}
