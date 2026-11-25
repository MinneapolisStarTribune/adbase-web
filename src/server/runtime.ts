import "server-only";
import { createMockRepository } from "@/modules/forecasting/infrastructure/mock-repository";
import { createForecastService } from "@/modules/forecasting/application/service";
import { createMemorySessionStore } from "./auth/session-store";
import { getConfig } from "./config/env";
function createRuntime() {
  const repo = createMockRepository(),
    sessions = createMemorySessionStore();
  return {
    repo,
    sessions,
    service: createForecastService(repo, {
      record(event) {
        repo.record(event);
        console.info(
          JSON.stringify({ level: "info", event: "audit", ...event }),
        );
      },
    }),
  };
}
const processState = globalThis as typeof globalThis & {
  forecastingRuntime?: ReturnType<typeof createRuntime>;
};
export function getRuntime() {
  getConfig();
  return (processState.forecastingRuntime ??= createRuntime());
}
