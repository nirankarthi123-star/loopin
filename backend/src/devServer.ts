/**
 * Local Development HTTP Server — LoopIn Backend
 *
 * Runs the TypeScript AWS Lambda handlers locally on http://localhost:3001
 * with in-memory persistence or local DynamoDB for instant feedback without AWS deployment.
 */

import http from "node:http";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler as apiHandler } from "./handlers/api.js";
import { handler as remindersHandler } from "./handlers/reminders.js";
import { getRepository, setRepository } from "./repository/factory.js";

// Initialize repository based on environment configuration (DynamoDB or in-memory)
const repo = getRepository();
setRepository(repo);

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3001;

function toLambdaEvent(req: http.IncomingMessage, bodyText: string): APIGatewayProxyEventV2 {
  const urlObj = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost:3001"}`);
  const rawPath = urlObj.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  const queryStringParameters: Record<string, string> = {};
  urlObj.searchParams.forEach((val, key) => {
    queryStringParameters[key] = val;
  });

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : v;
  }

  // Extract path parameters for routing
  const pathParameters: Record<string, string> = {};
  const segments = rawPath.split("/").filter(Boolean);
  if (segments[0] === "items" && segments[1]) {
    pathParameters["id"] = segments[1];
    pathParameters["itemId"] = segments[1];
  }
  if (segments[0] === "loans" && segments[1]) {
    pathParameters["id"] = segments[1];
    pathParameters["loanId"] = segments[1];
    if (segments[2]) {
      pathParameters["action"] = segments[2];
    }
  }

  const event: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey: `${method} ${rawPath}`,
    rawPath,
    rawQueryString: urlObj.search.slice(1),
    headers,
    ...(Object.keys(queryStringParameters).length ? { queryStringParameters } : {}),
    ...(Object.keys(pathParameters).length ? { pathParameters } : {}),
    ...(bodyText ? { body: bodyText } : {}),
    requestContext: {
      accountId: "local-dev",
      apiId: "local-api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method,
        path: rawPath,
        protocol: "HTTP/1.1",
        sourceIp: req.socket.remoteAddress ?? "127.0.0.1",
        userAgent: req.headers["user-agent"] ?? "node-dev",
      },
      requestId: `local-${Date.now()}`,
      routeKey: `${method} ${rawPath}`,
      stage: "dev",
      time: new Date().toUTCString(),
      timeEpoch: Date.now(),
    } as unknown as APIGatewayProxyEventV2["requestContext"],
    isBase64Encoded: false,
  };
  return event;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-User-Id,X-User-Email");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks).toString("utf-8");
    const event = toLambdaEvent(req, rawBody);
    const path = event.rawPath;

    try {
      let result: APIGatewayProxyResultV2;

      if (path.startsWith("/reminders")) {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const reminderResult = await remindersHandler(payload);
        res.writeHead(reminderResult.statusCode ?? 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(reminderResult));
        return;
      }

      result = await apiHandler(event);

      if (typeof result === "object" && result !== null && "statusCode" in result) {
        const headers = (result.headers as Record<string, string>) ?? {};
        res.writeHead(result.statusCode ?? 200, {
          "Content-Type": "application/json",
          ...headers,
        });
        res.end(result.body ?? "");
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      }
    } catch (err: unknown) {
      console.error("[LocalServer] Request failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error", message: String(err) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 LoopIn Local Backend Server running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(` - GET/POST   /items`);
  console.log(` - GET/POST   /loans`);
  console.log(` - GET        /loans/mine`);
  console.log(` - GET        /profile/me`);
  console.log(` - GET        /impact\n`);
});
