import { NextRequest } from "next/server";
import { ForecastingError } from "@/modules/forecasting/domain/models";
import { createDomoCsv } from "@/modules/forecasting/application/domo-export";
import { getCurrentActor } from "@/server/auth/current-actor";
import { getRuntime } from "@/server/runtime";
import { handle, json, jsonInput, queryInput } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export function GET(request: NextRequest, context: Context) {
  return handle(async (cid) => {
    const actor = await getCurrentActor(),
      { service, repo } = getRuntime(),
      path = (await context.params).path.join("/");
    if (path === "forecasts")
      return json(await service.query(actor, queryInput(request), cid));
    if (path === "choices")
      return json(await service.choices(actor, queryInput(request)));
    if (path === "advertisers")
      return json(
        await service.advertisers(
          actor,
          request.nextUrl.searchParams.get("search") ?? "",
          cid,
        ),
      );
    if (path === "audit") {
      if (!(await repo.scope(actor)).isAdministrator)
        throw new ForecastingError("FORBIDDEN");
      return json(repo.auditEvents().slice(-100).reverse());
    }
    if (path === "export") {
      const result = await service.exportData(actor, cid);
      return new Response(createDomoCsv(result.forecasts, result.date), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ForecastRevenue_${result.date.replaceAll("-", "")}.csv"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    throw new ForecastingError("NOT_FOUND", "Resource not found.");
  });
}
export function POST(request: NextRequest, context: Context) {
  return handle(async (cid) => {
    const actor = await getCurrentActor(),
      input = await jsonInput(request),
      path = (await context.params).path.join("/"),
      { service } = getRuntime();
    if (path === "forecasts")
      return json(await service.create(actor, input, cid), 201);
    if (path === "advertisers")
      return json(await service.saveAdvertiser(actor, input, cid), 201);
    throw new ForecastingError("NOT_FOUND", "Resource not found.");
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return handle(async (cid) => {
    const actor = await getCurrentActor(),
      input = await jsonInput(request),
      path = (await context.params).path,
      { service } = getRuntime();
    if (path.length === 2 && path[1]) {
      if (path[0] === "forecasts")
        return json(await service.update(actor, path[1], input, cid));
      if (path[0] === "advertisers")
        return json(await service.saveAdvertiser(actor, input, cid, path[1]));
    }
    throw new ForecastingError("NOT_FOUND", "Resource not found.");
  });
}
