import { cookies } from "next/headers";
import { z } from "zod";
import { parse } from "@/modules/forecasting/domain/validation";
import { ForecastingError } from "@/modules/forecasting/domain/models";
import { sessionCookie } from "@/server/auth/current-actor";
import { getRuntime } from "@/server/runtime";
import { handle, json, jsonInput, requireSameOrigin } from "@/server/http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return handle(async (correlationId) => {
    const runtime = getRuntime();
    const input = parse(
      z.object({ personaId: z.string() }).strict(),
      await jsonInput(request),
    );
    if (
      !(await runtime.repo.metadata()).personas.some(
        (p) => p.id === input.personaId,
      )
    )
      throw new ForecastingError("INVALID_INPUT", "Select a sample account.");
    const jar = await cookies(),
      previous = jar.get(sessionCookie)?.value;
    if (previous) runtime.sessions.revoke(previous);
    const token = runtime.sessions.create({ subjectId: input.personaId });
    jar.set(sessionCookie, token, {
      httpOnly: true,
      sameSite: "strict",
      secure:
        new URL(process.env.APP_ORIGIN || request.url).protocol === "https:",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    runtime.repo.record({
      actorId: input.personaId,
      at: new Date().toISOString(),
      operation: "session.create",
      outcome: "success",
      correlationId,
    });
    return json({ ok: true });
  });
}
export function DELETE(request: Request) {
  return handle(async (correlationId) => {
    requireSameOrigin(request);
    const runtime = getRuntime(),
      jar = await cookies(),
      token = jar.get(sessionCookie)?.value;
    if (token) {
      const actor = runtime.sessions.resolve(token);
      runtime.sessions.revoke(token);
      if (actor)
        runtime.repo.record({
          actorId: actor.subjectId,
          at: new Date().toISOString(),
          operation: "session.revoke",
          outcome: "success",
          correlationId,
        });
    }
    jar.delete(sessionCookie);
    return json({ ok: true });
  });
}
