import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/server/config/schema";

describe("environment boundaries", () => {
  it("defaults to mock data for local development", () => {
    expect(parseEnvironment({})).toEqual({
      APP_ENV: "development",
      DATA_SOURCE: "mock",
      AUTH_MODE: "mock",
    });
  });
  it("permits optimized local builds with an explicitly non-production application environment", () => {
    expect(
      parseEnvironment({ NODE_ENV: "production", APP_ENV: "test" }).APP_ENV,
    ).toBe("test");
  });
  it("does not default optimized deployments to mock authentication", () => {
    expect(() => parseEnvironment({ NODE_ENV: "production" })).toThrow(
      "disabled in production",
    );
  });
  it("rejects mock data or identity in production", () => {
    for (const config of [
      { APP_ENV: "production" },
      { APP_ENV: "production", DATA_SOURCE: "sqlserver", AUTH_MODE: "mock" },
      { APP_ENV: "production", DATA_SOURCE: "mock", AUTH_MODE: "entra" },
    ])
      expect(() => parseEnvironment(config)).toThrow("disabled in production");
  });
  it("fails closed for real adapters instead of silently using mocks", () => {
    expect(() =>
      parseEnvironment({
        APP_ENV: "production",
        DATA_SOURCE: "sqlserver",
        AUTH_MODE: "entra",
      }),
    ).toThrow("not implemented");
    expect(() => parseEnvironment({ DATA_SOURCE: "sqlserver" })).toThrow(
      "not implemented",
    );
  });
  it("does not echo an invalid configuration value", () => {
    expect(() =>
      parseEnvironment({ AUTH_MODE: "sensitive-placeholder" }),
    ).toThrow("Invalid configuration: AUTH_MODE");
  });
});
