import { beforeEach, describe, expect, it } from "vitest";
import { createForecastService } from "@/modules/forecasting/application/service";
import {
  createDomoCsv,
  domoColumns,
} from "@/modules/forecasting/application/domo-export";
import {
  createMockRepository,
  emptyAmounts,
} from "@/modules/forecasting/infrastructure/mock-repository";
import { parseAmounts } from "@/modules/forecasting/domain/validation";
import { totalForecasts } from "@/modules/forecasting/domain/money";
const admin = { subjectId: "mock-admin" },
  user = { subjectId: "mock-user" },
  delegate = { subjectId: "mock-delegate" };
let repo: ReturnType<typeof createMockRepository>,
  service: ReturnType<typeof createForecastService>;
const query = { territoryId: "north", year: 2026 };
const newForecast = {
  ...query,
  year: 2027,
  advertiserId: "100001",
  productId: "digital",
  amounts: emptyAmounts({ Jan: "1,234.125", Feb: " -2.5 " }),
};
beforeEach(() => {
  repo = createMockRepository();
  service = createForecastService(repo, repo, {
    now: () => new Date("2026-11-17T00:05:00Z"),
  });
});
describe("metadata and queries", () => {
  it("has valid, unique reference data and twelve-month fixtures", async () => {
    const meta = await repo.metadata();
    expect(new Set(meta.territories.map((x) => x.id)).size).toBe(
      meta.territories.length,
    );
    expect(new Set(meta.years).size).toBe(meta.years.length);
    for (const record of await repo.forecasts()) {
      expect(meta.years).toContain(record.year);
      expect(meta.territories.some((x) => x.id === record.territoryId)).toBe(
        true,
      );
      expect(meta.products.some((x) => x.id === record.productId)).toBe(true);
      expect(Object.keys(record.amounts)).toHaveLength(12);
    }
  });
  it.each([
    ["mock-user", 1],
    ["mock-delegate", 2],
    ["mock-admin", 3],
    ["mock-unmapped", 0],
    ["unknown", 0],
  ])("scopes %s", async (subjectId, count) => {
    expect(
      (await service.bootstrap({ subjectId: subjectId as string })).territories,
    ).toHaveLength(count as number);
  });
  it("paginates at 30 and sums all records independently of filtering", async () => {
    const first = await service.query(user, query, "q"),
      second = await service.query(user, { ...query, page: 2 }, "q");
    expect(first.forecasts).toHaveLength(30);
    expect(second.forecasts).toHaveLength(5);
    expect(first.annualTotal).toBe("20030.975");
    const searched = await service.query(
      user,
      { ...query, search: "100001", range: "Z" },
      "q",
    );
    expect(searched.forecasts.map((f) => f.advertiserId)).toEqual(["100001"]);
    expect(searched.annualTotal).toBe(first.annualTotal);
  });
  it("supports range, case-insensitive name search, and empty years", async () => {
    expect(
      (await service.query(user, { ...query, range: "#" }, "q")).forecasts.map(
        (r) => r.advertiserId,
      ),
    ).toEqual(["100005"]);
    expect(
      (await service.query(user, { ...query, search: "market" }, "q"))
        .totalRecords,
    ).toBe(1);
    expect(
      (await service.query(user, { ...query, year: 2028 }, "q")).annualTotal,
    ).toBe("0");
    await expect(
      service.query(user, { ...query, year: 1999 }, "q"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("blocks forged territory reads and permits delegation", async () => {
    await expect(
      service.query(user, { ...query, territoryId: "south" }, "deny"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await service.query(delegate, { ...query, territoryId: "central" }, "q"))
        .totalRecords,
    ).toBe(1);
    expect(repo.auditEvents()).toContainEqual(
      expect.objectContaining({ outcome: "denied", correlationId: "deny" }),
    );
  });
});
describe("forecast mutations", () => {
  it("normalizes amounts, allows zero/negative samples and records attribution", async () => {
    const created = await service.create(user, newForecast, "create");
    expect(created.amounts.Jan).toBe("1234.125");
    expect(created.amounts.Feb).toBe("-2.5");
    expect(created.updatedBy).toBe(user.subjectId);
    expect(created.updatedAt).toBe("2026-11-17T00:05:00.000Z");
    expect(
      (await service.query(user, { ...query, year: 2027 }, "q")).annualTotal,
    ).toBe("1231.625");
  });
  it("rejects duplicate records atomically", async () => {
    const results = await Promise.allSettled([
      service.create(user, newForecast, "a"),
      service.create(user, newForecast, "b"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("invalid month stops the whole update", async () => {
    await expect(
      service.update(
        user,
        "sample-1",
        { version: 1, amounts: emptyAmounts({ Jan: "invalid" }) },
        "bad",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fields: { Jan: expect.any(String) },
    });
    expect(
      (await repo.forecasts()).find((f) => f.id === "sample-1")?.amounts.Jan,
    ).toBe("12500.25");
  });
  it("rejects forged dimensions and stale versions", async () => {
    await expect(
      service.update(
        user,
        "sample-1",
        { version: 1, territoryId: "south", amounts: emptyAmounts() },
        "forged",
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const changed = await service.update(
      user,
      "sample-1",
      { version: 1, amounts: emptyAmounts({ Jan: "0.1234" }) },
      "ok",
    );
    expect(changed.territoryId).toBe("north");
    expect(changed.year).toBe(2026);
    expect(changed.version).toBe(2);
    await expect(
      service.update(
        user,
        "sample-1",
        { version: 1, amounts: emptyAmounts() },
        "stale",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("checks write scope and reference data", async () => {
    await expect(
      service.update(
        user,
        "sample-4",
        { version: 1, amounts: emptyAmounts() },
        "no",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.create(user, { ...newForecast, advertiserId: "100004" }, "no"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.create(user, { ...newForecast, productId: "special" }, "no"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("handles blanks and exact decimal aggregation", async () => {
    expect(parseAmounts(emptyAmounts({ Jan: "   " })).Jan).toBe("0");
    const base = (await repo.forecasts())[0]!;
    expect(
      totalForecasts([
        { ...base, amounts: emptyAmounts({ Jan: "0.1", Feb: "0.2" }) },
      ]),
    ).toBe("0.3");
    for (const invalid of ["NaN", "Infinity", "1e4", "0.12345"])
      expect(() => parseAmounts(emptyAmounts({ Jan: invalid }))).toThrow();
  });
});
describe("advertisers and export", () => {
  it("checks admin rights on every operation", async () => {
    await expect(
      service.saveAdvertiser(
        user,
        { id: "800001", name: "Test", territoryId: "north" },
        "no",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.advertisers(user, "", "no")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(service.exportData(user, "no")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("creates, finds and changes an unlinked advertiser", async () => {
    const created = await service.saveAdvertiser(
      admin,
      { id: "800001", name: " New advertiser ", territoryId: "north" },
      "a",
    );
    expect(created.name).toBe("New advertiser");
    const changed = await service.saveAdvertiser(
      admin,
      { id: "800002", name: "Renamed", territoryId: "central", version: 1 },
      "b",
      created.id,
    );
    expect(changed.version).toBe(2);
    expect(await service.advertisers(admin, "800002", "q")).toHaveLength(1);
    await expect(
      service.saveAdvertiser(
        admin,
        { id: "100001", name: "Duplicate", territoryId: "north", version: 2 },
        "c",
        "800002",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("protects historical references and validates advertiser input", async () => {
    await expect(
      service.saveAdvertiser(
        admin,
        { id: "100001", name: "Moved", territoryId: "central", version: 1 },
        "a",
        "100001",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.saveAdvertiser(
        admin,
        { id: "12.345", name: "", territoryId: "north" },
        "a",
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("exports all mock regions, excludes 999999 and zero months, escapes text but preserves negatives", async () => {
    const exported = await service.exportData(admin, "export"),
      csv = createDomoCsv(exported.forecasts, exported.date);
    expect(csv.startsWith(domoColumns.join(",") + "\r\n")).toBe(true);
    expect(csv).not.toContain("999999");
    expect(csv).toContain("100001,,Digital,north,3,2026,0.1,2026-11-17\r\n");
    expect(csv).toContain("100002,,Print,north,2,2026,-100.125,2026-11-17\r\n");
    expect(csv).toContain('"\'=Special, ""Package""\nDigital"');
    expect(csv).toContain("100004,,Print,south,12,2026,3000");
    expect(csv).not.toContain("100005");
    expect(repo.auditEvents()).toContainEqual(
      expect.objectContaining({
        operation: "forecast.export",
        outcome: "success",
      }),
    );
  });
});
