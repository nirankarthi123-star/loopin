/**
 * DynamoDB client singleton for Lambda
 *
 * Uses AWS SDK v3. Credentials are automatically injected by the Lambda
 * execution role — never hardcoded.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env["AWS_REGION"] ?? "ap-south-1";
const endpoint = process.env["DYNAMODB_ENDPOINT"];

const rawClient = new DynamoDBClient({
  region,
  ...(endpoint ? { endpoint } : {}),
});

export const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAME = (() => {
  const name = process.env["DYNAMODB_TABLE_NAME"];
  if (!name) {
    if (process.env["NODE_ENV"] === "test" || process.env["STORAGE_DRIVER"] === "memory") {
      return "loopin-test-table";
    }
    return "loopin-local";
  }
  return name;
})();
