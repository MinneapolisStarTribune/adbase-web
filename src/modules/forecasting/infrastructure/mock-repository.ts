import metadata from "./metadata.json";
import {
  ForecastingError,
  months,
  type Advertiser,
  type AuditEvent,
  type Forecast,
  type Metadata,
  type MonthlyAmounts,
} from "../domain/models";
import type {
  AuditSink,
  ForecastRepository,
} from "../ports/forecast-repository";
export function emptyAmounts(
  overrides: Partial<MonthlyAmounts> = {},
): MonthlyAmounts {
  return {
    ...Object.fromEntries(months.map((month) => [month, "0"])),
    ...overrides,
  } as MonthlyAmounts;
}
export function createMockRepository(): ForecastRepository &
  AuditSink & { auditEvents(): readonly AuditEvent[] } {
  let advertisers: Advertiser[] = [
    {
      id: "100001",
      name: "Sample Outdoor Co.",
      territoryId: "north",
      version: 1,
    },
    { id: "100002", name: "Sample Market", territoryId: "north", version: 1 },
    { id: "100003", name: "Sample Travel", territoryId: "central", version: 1 },
    { id: "100004", name: "Sample Studio", territoryId: "south", version: 1 },
    {
      id: "999999",
      name: "Excluded sample advertiser",
      territoryId: "north",
      version: 1,
    },
    { id: "100005", name: "#1 Sample Shop", territoryId: "north", version: 1 },
    ...Array.from({ length: 31 }, (_, i) => ({
      id: String(200000 + i),
      name: `Sample Account ${String(i + 1).padStart(2, "0")}`,
      territoryId: "north",
      version: 1,
    })),
  ];
  const make = (
    id: string,
    advertiserId: string,
    productId: string,
    amounts: MonthlyAmounts,
  ): Forecast => {
    const advertiser = advertisers.find((item) => item.id === advertiserId)!,
      product = metadata.products.find((item) => item.id === productId)!;
    return {
      id,
      advertiserId,
      advertiserName: advertiser.name,
      territoryId: advertiser.territoryId,
      productId,
      productName: product.name,
      year: 2026,
      amounts,
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedBy: "fixture",
    };
  };
  const forecasts: Forecast[] = [
    make(
      "sample-1",
      "100001",
      "digital",
      emptyAmounts({ Jan: "12500.25", Mar: "0.1" }),
    ),
    make(
      "sample-2",
      "100002",
      "print",
      emptyAmounts({ Jan: "7500.75", Feb: "-100.125" }),
    ),
    make("sample-3", "100003", "special", emptyAmounts({ Jan: "4200.1" })),
    make("sample-4", "100004", "print", emptyAmounts({ Dec: "3000" })),
    make("excluded", "999999", "digital", emptyAmounts({ Jan: "99" })),
    make("numeric-name", "100005", "print", emptyAmounts()),
    ...Array.from({ length: 31 }, (_, i) =>
      make(
        `pagination-${i}`,
        String(200000 + i),
        "digital",
        emptyAmounts({ Jan: "1" }),
      ),
    ),
  ];
  const audits: AuditEvent[] = [];
  let sequence = 0;
  const clone = <T>(value: T): T => structuredClone(value);
  return {
    async metadata() {
      return clone(metadata as Metadata);
    },
    async scope(actor) {
      const p = metadata.personas.find((item) => item.id === actor.subjectId);
      return p
        ? {
            isAdministrator: p.isAdministrator,
            territoryIds: [...p.territoryIds],
          }
        : { isAdministrator: false, territoryIds: [] };
    },
    async forecasts() {
      return clone(forecasts);
    },
    async advertisers() {
      return clone(advertisers);
    },
    async insertForecast(value) {
      if (
        forecasts.some(
          (r) =>
            r.advertiserId === value.advertiserId &&
            r.territoryId === value.territoryId &&
            r.productId === value.productId &&
            r.year === value.year,
        )
      )
        throw new ForecastingError(
          "CONFLICT",
          "This forecast already exists. Edit the existing record.",
        );
      const record = {
        ...clone(value),
        id: `forecast-${++sequence}`,
        version: 1,
      };
      forecasts.push(record);
      return clone(record);
    },
    async updateForecast(id, version, amounts, actorId, at) {
      const index = forecasts.findIndex((r) => r.id === id),
        original = forecasts[index];
      if (!original)
        throw new ForecastingError("NOT_FOUND", "Forecast not found.");
      if (original.version !== version)
        throw new ForecastingError(
          "CONFLICT",
          "This forecast has changed. Reload before editing.",
        );
      const record = {
        ...original,
        amounts: clone(amounts),
        version: version + 1,
        updatedAt: at,
        updatedBy: actorId,
      };
      forecasts[index] = record;
      return clone(record);
    },
    async saveAdvertiser(value, originalId, version) {
      const original = advertisers.find((item) => item.id === originalId);
      if (originalId && !original)
        throw new ForecastingError("NOT_FOUND", "Advertiser not found.");
      if (original && original.version !== version)
        throw new ForecastingError(
          "CONFLICT",
          "This advertiser has changed. Reload before editing.",
        );
      if (
        advertisers.some(
          (item) => item.id === value.id && item.id !== originalId,
        )
      )
        throw new ForecastingError("CONFLICT", "Advertiser ID already exists.");
      if (
        original &&
        forecasts.some((r) => r.advertiserId === originalId) &&
        (original.id !== value.id || original.territoryId !== value.territoryId)
      )
        throw new ForecastingError(
          "CONFLICT",
          "Changing the ID or territory of an advertiser with forecasts requires an agreed history policy.",
        );
      const record = { ...value, version: (original?.version ?? 0) + 1 };
      advertisers = [
        ...advertisers.filter((item) => item.id !== originalId),
        record,
      ];
      return clone(record);
    },
    record(event) {
      audits.push({ ...clone(event), id: `audit-${audits.length + 1}` });
    },
    auditEvents() {
      return clone(audits);
    },
  };
}
