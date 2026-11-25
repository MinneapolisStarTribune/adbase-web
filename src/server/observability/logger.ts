import "server-only";
import { randomUUID } from "node:crypto";

// Deliberately accept no raw error, query, token or request object.
export function logFailure(event: "forecast.query.failed") {
  const correlationId = randomUUID();
  console.error(
    JSON.stringify({
      level: "error",
      event,
      correlationId,
      timestamp: new Date().toISOString(),
    }),
  );
  return correlationId;
}
