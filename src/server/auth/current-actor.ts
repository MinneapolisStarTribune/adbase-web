import "server-only";
import { cookies } from "next/headers";
import { ForecastingError } from "@/modules/forecasting/domain/models";
import { getRuntime } from "../runtime";
export const sessionCookie = "forecasting_session";
export async function getCurrentActor() {
  const token = (await cookies()).get(sessionCookie)?.value;
  const actor = token ? getRuntime().sessions.resolve(token) : null;
  if (!actor)
    throw new ForecastingError(
      "UNAUTHENTICATED",
      "Your session has expired. Sign in again.",
    );
  return actor;
}
