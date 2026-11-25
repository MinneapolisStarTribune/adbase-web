import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getConfig } from "./config/env";
import { assertSameOrigin } from "./request-origin";
import {
  ForecastingError,
  isForecastingError,
} from "@/modules/forecasting/domain/models";
export function queryInput(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length > 1))
    throw new ForecastingError(
      "INVALID_INPUT",
      "Duplicate query parameters are not allowed.",
    );
  return Object.fromEntries(params);
}
export function requireSameOrigin(request: Request) {
  assertSameOrigin(request, getConfig().APP_ORIGIN);
}
export async function jsonInput(request: Request) {
  requireSameOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ForecastingError("INVALID_INPUT", "Expected JSON.");
  const text = await request.text();
  if (text.length > 32_000)
    throw new ForecastingError("INVALID_INPUT", "Request is too large.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ForecastingError("INVALID_INPUT", "Invalid JSON.");
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function handle(
  task: (correlationId: string) => Promise<Response>,
) {
  const correlationId = randomUUID();
  try {
    const response = await task(correlationId);
    response.headers.set("X-Correlation-ID", correlationId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = isForecastingError(error)
      ? {
          UNAUTHENTICATED: 401,
          FORBIDDEN: 403,
          INVALID_INPUT: 400,
          NOT_FOUND: 404,
          CONFLICT: 409,
        }[error.code]
      : 503;
    console.error(
      JSON.stringify({
        level: "error",
        event: "request.failed",
        correlationId,
        status,
      }),
    );
    return Response.json(
      {
        error: isForecastingError(error)
          ? error.message
          : "Service unavailable.",
        fields: isForecastingError(error) ? error.fields : undefined,
        correlationId,
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Correlation-ID": correlationId,
        },
      },
    );
  }
}
