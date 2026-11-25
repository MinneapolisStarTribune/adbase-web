import Decimal from "decimal.js";
import { z } from "zod";
import { ForecastingError, months, type MonthlyAmounts } from "./models";
export const querySchema = z
  .object({
    territoryId: z.string().min(1),
    year: z.coerce.number().int(),
    search: z.string().trim().max(500).default(""),
    range: z
      .string()
      .regex(/^(ALL|#|[A-Z])$/)
      .default("ALL"),
    page: z.coerce.number().int().positive().default(1),
  })
  .strict();
export const advertiserSchema = z
  .object({
    id: z.string().regex(/^\d{6}$/, "Use a six-digit advertiser ID."),
    name: z.string().trim().min(1).max(500),
    territoryId: z.string().min(1),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ForecastingError(
      "INVALID_INPUT",
      "Check the supplied values.",
      Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ),
    );
  return result.data;
}
export function parseAmounts(value: unknown): MonthlyAmounts {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ForecastingError(
      "INVALID_INPUT",
      "Provide twelve monthly amounts.",
    );
  const input = value as Record<string, unknown>,
    errors: Record<string, string> = {},
    output = {} as Record<(typeof months)[number], string>;
  for (const month of months) {
    const raw = input[month],
      normalized =
        typeof raw === "string"
          ? raw.replaceAll(",", "").trim() || "0"
          : "invalid";
    // Mock limit only; financial precision still needs business confirmation.
    if (!/^[+-]?\d{1,14}(\.\d{1,4})?$/.test(normalized))
      errors[month] =
        `${month}: enter a decimal amount (up to 4 decimal places).`;
    else output[month] = new Decimal(normalized).toFixed();
  }
  if (
    Object.keys(input).some(
      (key) => !(months as readonly string[]).includes(key),
    )
  )
    errors.amounts = "Unexpected month.";
  if (Object.keys(errors).length)
    throw new ForecastingError(
      "INVALID_INPUT",
      "Correct the monthly amounts before saving.",
      errors,
    );
  return output;
}
export function matchesAdvertiser(
  id: string,
  name: string,
  search: string,
  range: string,
) {
  if (search)
    return /^\d+$/.test(search)
      ? id === search
      : name.toLowerCase().includes(search.toLowerCase());
  if (range === "ALL") return true;
  if (range === "#") return !/^[A-Z]/i.test(name);
  return name.toUpperCase().startsWith(range);
}
