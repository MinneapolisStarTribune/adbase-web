import { getConfig } from "@/server/config/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    getConfig();
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
