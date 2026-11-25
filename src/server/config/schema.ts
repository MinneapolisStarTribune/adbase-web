import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]),
  DATA_SOURCE: z.enum(["mock", "sqlserver"]).default("mock"),
  AUTH_MODE: z.enum(["mock", "entra"]).default("mock"),
  APP_ORIGIN: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && url.origin === value;
    }, "Use an HTTP(S) origin without a path.")
    .optional(),
});

export function parseEnvironment(
  environment: Record<string, string | undefined>,
) {
  const parsed = schema.safeParse({
    APP_ENV:
      environment.APP_ENV ??
      (environment.NODE_ENV === "production" ? "production" : "development"),
    DATA_SOURCE: environment.DATA_SOURCE,
    AUTH_MODE: environment.AUTH_MODE,
    ...(environment.APP_ORIGIN ? { APP_ORIGIN: environment.APP_ORIGIN } : {}),
  });
  if (!parsed.success) {
    // Report names only, never configuration values or credentials.
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  const config = parsed.data;
  if (
    config.APP_ENV === "production" &&
    (config.AUTH_MODE === "mock" || config.DATA_SOURCE === "mock")
  ) {
    throw new Error("Mock authentication and data are disabled in production.");
  }
  if (config.AUTH_MODE !== "mock" || config.DATA_SOURCE !== "mock") {
    throw new Error(
      "Entra ID and SQL Server adapters are not implemented. No mock fallback is allowed.",
    );
  }
  return config;
}

export type AppConfig = ReturnType<typeof parseEnvironment>;
