import { z } from "zod";
import { ForecastingError, type Actor, type Forecast } from "../domain/models";
import { totalForecasts } from "../domain/money";
import {
  advertiserSchema,
  matchesAdvertiser,
  parse,
  parseAmounts,
  querySchema,
} from "../domain/validation";
import type {
  AuditSink,
  Clock,
  ForecastRepository,
} from "../ports/forecast-repository";
const createSchema = z
  .object({
    territoryId: z.string().min(1),
    year: z.number().int(),
    advertiserId: z.string().regex(/^\d{6}$/),
    productId: z.string().min(1),
    amounts: z.unknown(),
  })
  .strict();
const updateSchema = z
  .object({ version: z.number().int().positive(), amounts: z.unknown() })
  .strict();
const advertiserUpdateSchema = advertiserSchema.extend({
  version: z.number().int().positive(),
});

export function createForecastService(
  repo: ForecastRepository,
  audit: AuditSink,
  clock: Clock = { now: () => new Date() },
) {
  async function run<T>(
    actor: Actor,
    operation: string,
    correlationId: string,
    task: () => Promise<T>,
    resourceId?: string,
  ): Promise<T> {
    try {
      const result = await task();
      audit.record({
        at: clock.now().toISOString(),
        actorId: actor.subjectId,
        operation,
        outcome: "success",
        correlationId,
        resourceId,
      });
      return result;
    } catch (error) {
      audit.record({
        at: clock.now().toISOString(),
        actorId: actor.subjectId,
        operation,
        outcome:
          error instanceof ForecastingError && error.code === "FORBIDDEN"
            ? "denied"
            : "failure",
        correlationId,
        resourceId,
      });
      throw error;
    }
  }
  async function authorize(
    actor: Actor,
    territoryId?: string,
    adminOnly = false,
  ) {
    const scope = await repo.scope(actor);
    if (
      (adminOnly && !scope.isAdministrator) ||
      (!scope.isAdministrator &&
        (!scope.territoryIds.length ||
          (territoryId && !scope.territoryIds.includes(territoryId))))
    )
      throw new ForecastingError("FORBIDDEN");
    return scope;
  }
  async function context(actor: Actor, territoryId: string, year: number) {
    await authorize(actor, territoryId);
    const meta = await repo.metadata();
    if (
      !meta.territories.some((t) => t.id === territoryId) ||
      !meta.years.includes(year)
    )
      throw new ForecastingError(
        "INVALID_INPUT",
        "Select a configured territory and year.",
      );
    return meta;
  }
  return {
    async bootstrap(actor: Actor) {
      const scope = await repo.scope(actor),
        meta = await repo.metadata();
      return {
        years: meta.years,
        territories: meta.territories.filter(
          (t) => scope.isAdministrator || scope.territoryIds.includes(t.id),
        ),
        isAdministrator: scope.isAdministrator,
        displayName:
          meta.personas.find((p) => p.id === actor.subjectId)?.name ??
          "Employee",
      };
    },
    query(actor: Actor, input: unknown, correlationId: string) {
      return run(actor, "forecast.query", correlationId, async () => {
        const q = parse(querySchema, input);
        await context(actor, q.territoryId, q.year);
        const all = (await repo.forecasts()).filter(
          (r) => r.territoryId === q.territoryId && r.year === q.year,
        );
        const filtered = all
          .filter((r) =>
            matchesAdvertiser(
              r.advertiserId,
              r.advertiserName,
              q.search,
              q.range,
            ),
          )
          .sort(
            (a, b) =>
              a.advertiserName.localeCompare(b.advertiserName) ||
              a.id.localeCompare(b.id),
          );
        const pageSize = 30,
          pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
          page = Math.min(q.page, pages);
        return {
          forecasts: filtered.slice((page - 1) * pageSize, page * pageSize),
          totalRecords: filtered.length,
          page,
          pages,
          pageSize,
          annualTotal: totalForecasts(all),
        };
      });
    },
    async choices(actor: Actor, input: unknown) {
      const q = parse(querySchema, input),
        meta = await context(actor, q.territoryId, q.year);
      return {
        advertisers: (await repo.advertisers()).filter(
          (a) =>
            a.territoryId === q.territoryId &&
            matchesAdvertiser(a.id, a.name, q.search, q.range),
        ),
        products: meta.products.filter(
          (p) =>
            p.territoryIds.includes(q.territoryId) && p.years.includes(q.year),
        ),
      };
    },
    create(actor: Actor, input: unknown, correlationId: string) {
      return run(actor, "forecast.create", correlationId, async () => {
        const value = parse(createSchema, input),
          meta = await context(actor, value.territoryId, value.year),
          amounts = parseAmounts(value.amounts);
        const advertiser = (await repo.advertisers()).find(
          (a) =>
            a.id === value.advertiserId && a.territoryId === value.territoryId,
        );
        const product = meta.products.find(
          (p) =>
            p.id === value.productId &&
            p.territoryIds.includes(value.territoryId) &&
            p.years.includes(value.year) &&
            (!p.advertiserIds || p.advertiserIds.includes(value.advertiserId)),
        );
        if (!advertiser || !product)
          throw new ForecastingError(
            "INVALID_INPUT",
            "Select an advertiser and product available for this territory and year.",
          );
        return repo.insertForecast({
          ...value,
          amounts,
          advertiserName: advertiser.name,
          productName: product.name,
          updatedAt: clock.now().toISOString(),
          updatedBy: actor.subjectId,
        });
      });
    },
    update(actor: Actor, id: string, input: unknown, correlationId: string) {
      return run(
        actor,
        "forecast.update",
        correlationId,
        async () => {
          const value = parse(updateSchema, input),
            record = (await repo.forecasts()).find((r) => r.id === id);
          if (!record)
            throw new ForecastingError("NOT_FOUND", "Forecast not found.");
          await context(actor, record.territoryId, record.year);
          return repo.updateForecast(
            id,
            value.version,
            parseAmounts(value.amounts),
            actor.subjectId,
            clock.now().toISOString(),
          );
        },
        id,
      );
    },
    advertisers(actor: Actor, search: string, correlationId: string) {
      return run(actor, "advertiser.query", correlationId, async () => {
        await authorize(actor, undefined, true);
        const text = parse(z.string().trim().max(500), search);
        return (await repo.advertisers())
          .filter((a) => matchesAdvertiser(a.id, a.name, text, "ALL"))
          .sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    saveAdvertiser(
      actor: Actor,
      input: unknown,
      correlationId: string,
      originalId?: string,
    ) {
      return run(
        actor,
        originalId ? "advertiser.update" : "advertiser.create",
        correlationId,
        async () => {
          await authorize(actor, undefined, true);
          const value = originalId
            ? parse(advertiserUpdateSchema, input)
            : parse(advertiserSchema, input);
          if (
            !(await repo.metadata()).territories.some(
              (t) => t.id === value.territoryId,
            )
          )
            throw new ForecastingError(
              "INVALID_INPUT",
              "Select a configured territory.",
            );
          return repo.saveAdvertiser(
            { id: value.id, name: value.name, territoryId: value.territoryId },
            originalId,
            "version" in value ? (value.version as number) : undefined,
          );
        },
        originalId,
      );
    },
    exportData(
      actor: Actor,
      correlationId: string,
    ): Promise<{ forecasts: readonly Forecast[]; date: string }> {
      return run(actor, "forecast.export", correlationId, async () => {
        await authorize(actor, undefined, true);
        return {
          forecasts: await repo.forecasts(),
          date: clock.now().toISOString().slice(0, 10),
        };
      });
    },
  };
}
export type ForecastService = ReturnType<typeof createForecastService>;
export type Bootstrap = Awaited<ReturnType<ForecastService["bootstrap"]>>;
export type QueryResult = Awaited<ReturnType<ForecastService["query"]>>;
export type Choices = Awaited<ReturnType<ForecastService["choices"]>>;
