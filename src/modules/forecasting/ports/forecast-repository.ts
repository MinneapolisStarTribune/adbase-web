import type {
  AccessScope,
  Actor,
  Advertiser,
  AuditEvent,
  Forecast,
  Metadata,
} from "../domain/models";
export interface ForecastRepository {
  metadata(): Promise<Metadata>;
  scope(actor: Actor): Promise<AccessScope>;
  forecasts(): Promise<readonly Forecast[]>;
  advertisers(): Promise<readonly Advertiser[]>;
  insertForecast(record: Omit<Forecast, "id" | "version">): Promise<Forecast>;
  updateForecast(
    id: string,
    version: number,
    amounts: Forecast["amounts"],
    actorId: string,
    at: string,
  ): Promise<Forecast>;
  saveAdvertiser(
    value: Omit<Advertiser, "version">,
    originalId?: string,
    version?: number,
  ): Promise<Advertiser>;
}
export interface AuditSink {
  record(event: Omit<AuditEvent, "id">): void;
}
export interface Clock {
  now(): Date;
}
