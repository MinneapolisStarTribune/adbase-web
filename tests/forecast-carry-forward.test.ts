import { beforeEach, expect, it } from "vitest";
import { createForecastService } from "@/modules/forecasting/application/service";
import { forecastRows } from "@/modules/forecasting/domain/forecast-rows";
import {
  createMockRepository,
  emptyAmounts,
} from "@/modules/forecasting/infrastructure/mock-repository";

const user = { subjectId: "mock-user" };
const admin = { subjectId: "mock-admin" };
const query = { territoryId: "north", year: 2027 };
let repo: ReturnType<typeof createMockRepository>;
let service: ReturnType<typeof createForecastService>;
beforeEach(() => {
  repo = createMockRepository();
  service = createForecastService(repo, repo);
});

it("projects zero candidates with pagination without persisting or exporting them", async () => {
  const original = await repo.forecasts();
  const first = await service.query(user, query, "q");
  const second = await service.query(user, { ...query, page: 2 }, "q");
  expect(first.totalRecords).toBe(35);
  expect(first.forecasts).toHaveLength(30);
  expect(second.forecasts).toHaveLength(5);
  expect(first.annualTotal).toBe("0");
  const rows = [...first.forecasts, ...second.forecasts];
  expect(new Set(rows.map((r) => r.rowKey)).size).toBe(35);
  for (const row of rows) {
    expect(row).toMatchObject({
      kind: "carry-forward",
      sourceYear: 2026,
      year: 2027,
      territoryId: "north",
      amounts: emptyAmounts(),
    });
    for (const field of ["id", "version", "updatedAt", "updatedBy"])
      expect(row).not.toHaveProperty(field);
  }
  expect(await repo.forecasts()).toEqual(original);
  expect((await service.exportData(admin, "export")).forecasts).toEqual(
    original,
  );
  expect(
    (await service.query(user, { ...query, year: 2028 }, "q")).totalRecords,
  ).toBe(0);
});

it("filters candidates by ID, historical name and range, preserving search precedence", async () => {
  for (const search of ["100001", "outdoor"]) {
    const result = await service.query(
      user,
      { ...query, search, range: "Z" },
      "q",
    );
    expect(result.forecasts.map((r) => r.advertiserId)).toEqual(["100001"]);
  }
  expect(
    (await service.query(user, { ...query, range: "#" }, "q")).forecasts.map(
      (r) => r.advertiserId,
    ),
  ).toEqual(["100005"]);
  expect(
    (await service.query(user, { ...query, search: "no match" }, "q"))
      .totalRecords,
  ).toBe(0);
});

it("creates the target year, keeps the source intact, then updates only the saved record", async () => {
  const original = await repo.forecasts();
  const input = {
    ...query,
    advertiserId: "100001",
    productId: "digital",
    amounts: emptyAmounts({ Jan: "1.125" }),
  };
  const results = await Promise.allSettled([
    service.create(user, input, "a"),
    service.create(user, input, "b"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  const result = await service.query(user, { ...query, search: "100001" }, "q");
  expect(result.annualTotal).toBe("1.125");
  expect(result.forecasts).toHaveLength(1);
  const row = result.forecasts[0]!;
  expect(row.kind).toBe("saved");
  if (row.kind !== "saved") throw new Error("Expected a persisted row");
  await service.update(
    user,
    row.id,
    { version: row.version, amounts: emptyAmounts() },
    "update",
  );
  expect(
    (await service.query(user, { ...query, search: "100001" }, "q")).forecasts,
  ).toMatchObject([{ kind: "saved", amounts: emptyAmounts() }]);
  expect((await repo.forecasts()).filter((r) => r.year === 2026)).toEqual(
    original,
  );
});

it("enforces scope and keeps unavailable products visible but rejects creation", async () => {
  await expect(
    service.query(user, { ...query, territoryId: "central" }, "q"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const result = await service.query(
    admin,
    { ...query, territoryId: "central" },
    "q",
  );
  expect(result.forecasts).toMatchObject([
    {
      kind: "carry-forward",
      advertiserId: "100003",
      unavailableReason: expect.stringContaining("product is not available"),
    },
  ]);
  await expect(
    service.create(
      admin,
      {
        ...query,
        territoryId: "central",
        advertiserId: "100003",
        productId: "special",
        amounts: emptyAmounts(),
      },
      "save",
    ),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(
    service.create(
      user,
      {
        ...query,
        territoryId: "central",
        advertiserId: "100003",
        productId: "digital",
        amounts: emptyAmounts(),
      },
      "save",
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("deduplicates normalized keys, retains zero current rows and isolates territories and years", async () => {
  const base = (await repo.forecasts())[0]!;
  const meta = await repo.metadata(),
    advertisers = await repo.advertisers();
  const rows = forecastRows(
    [
      base,
      { ...base, id: "duplicate", productId: " DIGITAL " },
      {
        ...base,
        id: "other-territory",
        territoryId: "south",
        advertiserId: "100004",
      },
      { ...base, id: "older", year: 2025, productId: "print" },
    ],
    "north",
    2027,
    advertisers,
    meta,
  );
  expect(rows).toHaveLength(1);
  const current = {
    ...base,
    id: "current",
    year: 2027,
    productId: " DIGITAL ",
    amounts: emptyAmounts(),
  };
  expect(
    forecastRows([base, current], "north", 2027, advertisers, meta),
  ).toMatchObject([{ kind: "saved", id: "current" }]);
  expect(forecastRows([base], "north", 2028, advertisers, meta)).toEqual([]);
  expect(forecastRows([base], "north", 2027, [], meta)).toMatchObject([
    {
      unavailableReason: expect.stringContaining("advertiser is not available"),
    },
  ]);
});

it("prefers a current snapshot before filtering when an advertiser has been renamed", async () => {
  await service.saveAdvertiser(
    admin,
    {
      id: "100001",
      name: "Renamed Business",
      territoryId: "north",
      version: 1,
    },
    "rename",
    "100001",
  );
  await service.create(
    user,
    {
      ...query,
      advertiserId: "100001",
      productId: "digital",
      amounts: emptyAmounts(),
    },
    "create",
  );
  expect(
    (await service.query(user, { ...query, search: "outdoor" }, "q"))
      .totalRecords,
  ).toBe(0);
  expect(
    (await service.query(user, { ...query, search: "renamed" }, "q")).forecasts,
  ).toMatchObject([{ kind: "saved", advertiserName: "Renamed Business" }]);
});
