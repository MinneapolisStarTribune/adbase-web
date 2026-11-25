import {
  months,
  type Advertiser,
  type Forecast,
  type ForecastRow,
  type Metadata,
  type MonthlyAmounts,
} from "./models";

export function creationUnavailableReason(
  value: Pick<Forecast, "territoryId" | "year" | "advertiserId" | "productId">,
  advertisers: readonly Advertiser[],
  meta: Metadata,
): string | undefined {
  if (
    !advertisers.some(
      (a) => a.id === value.advertiserId && a.territoryId === value.territoryId,
    )
  )
    return "This advertiser is not available in the selected territory.";
  if (
    !meta.products.some(
      (p) =>
        p.id === value.productId &&
        p.territoryIds.includes(value.territoryId) &&
        p.years.includes(value.year) &&
        (!p.advertiserIds || p.advertiserIds.includes(value.advertiserId)),
    )
  )
    return "This product is not available for the selected year, territory and advertiser.";
}

// Only persisted rows from the immediately preceding year can supply a candidate.
// Current-year records win before search, including when historical names differ.
export function forecastRows(
  records: readonly Forecast[],
  territoryId: string,
  year: number,
  advertisers: readonly Advertiser[],
  meta: Metadata,
): ForecastRow[] {
  const key = (record: Forecast) =>
    JSON.stringify([
      record.advertiserId.trim().toUpperCase(),
      record.productId.trim().toUpperCase(),
    ]);
  const current = records.filter(
    (r) => r.territoryId === territoryId && r.year === year,
  );
  const seen = new Set(current.map(key));
  const rows: ForecastRow[] = current.map((r) => ({
    ...r,
    kind: "saved",
    rowKey: `saved:${r.id}`,
  }));
  for (const previous of records) {
    if (
      previous.territoryId !== territoryId ||
      previous.year !== year - 1 ||
      seen.has(key(previous))
    )
      continue;
    seen.add(key(previous));
    const candidate = {
      territoryId,
      year,
      advertiserId: previous.advertiserId,
      advertiserName: previous.advertiserName,
      productId: previous.productId,
      productName: previous.productName,
      amounts: Object.fromEntries(
        months.map((month) => [month, "0"]),
      ) as MonthlyAmounts,
    };
    rows.push({
      ...candidate,
      kind: "carry-forward",
      sourceYear: year - 1,
      rowKey: JSON.stringify([
        "carry-forward",
        territoryId,
        year,
        key(previous),
      ]),
      unavailableReason: creationUnavailableReason(
        candidate,
        advertisers,
        meta,
      ),
    });
  }
  return rows;
}
