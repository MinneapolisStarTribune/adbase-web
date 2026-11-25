export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
export type Month = (typeof months)[number];
export type MonthlyAmounts = Readonly<Record<Month, string>>;
export type Actor = Readonly<{ subjectId: string }>;
export type Territory = Readonly<{ id: string; name: string }>;
export type Forecast = Readonly<{
  id: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  territoryId: string;
  year: number;
  advertiserId: string;
  advertiserName: string;
  productId: string;
  productName: string;
  amounts: MonthlyAmounts;
}>;
export type Advertiser = Readonly<{
  id: string;
  name: string;
  territoryId: string;
  version: number;
}>;
export type ForecastRow =
  | (Forecast & { kind: "saved"; rowKey: string })
  | (Omit<Forecast, "id" | "version" | "updatedAt" | "updatedBy"> & {
      kind: "carry-forward";
      rowKey: string;
      sourceYear: number;
      unavailableReason?: string;
    });
export type Product = Readonly<{
  id: string;
  name: string;
  territoryIds: readonly string[];
  years: readonly number[];
  advertiserIds?: readonly string[];
}>;
export type Persona = Readonly<{
  id: string;
  name: string;
  isAdministrator: boolean;
  territoryIds: readonly string[];
}>;
export type Metadata = Readonly<{
  years: readonly number[];
  territories: readonly Territory[];
  products: readonly Product[];
  personas: readonly Persona[];
}>;
export type AccessScope = Readonly<{
  isAdministrator: boolean;
  territoryIds: readonly string[];
}>;
export type AuditEvent = Readonly<{
  id: string;
  at: string;
  actorId: string;
  operation: string;
  outcome: "success" | "denied" | "failure";
  resourceId?: string;
  correlationId: string;
}>;
export type ErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT";
export class ForecastingError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message = code === "FORBIDDEN"
      ? "You do not have permission for this operation."
      : "Check the supplied values.",
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ForecastingError";
  }
}

// Next.js may load the process-wide mock store through separate route bundles.
// A stable brand survives that boundary; constructor identity does not.
export function isForecastingError(error: unknown): error is ForecastingError {
  return (
    error instanceof Error &&
    error.name === "ForecastingError" &&
    "code" in error &&
    [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "INVALID_INPUT",
      "NOT_FOUND",
      "CONFLICT",
    ].includes(String(error.code))
  );
}
