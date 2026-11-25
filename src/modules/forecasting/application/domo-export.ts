import Decimal from "decimal.js";
import { stringify } from "csv-stringify/sync";
import { months, type Forecast } from "../domain/models";
export const domoColumns = [
  "ADVERTISER_ID",
  "LEGACY_ADVERTISER_ID",
  "CRM_FORECAST_PRODUCT",
  "ADJ_PORTFOLIO_REP_ID",
  "CALENDAR_MONTH",
  "CALENDAR_YEAR",
  "FORECAST_REVENUE",
  "FORECAST_DATE",
];
const safeText = (text: string) =>
  /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
export function createDomoCsv(forecasts: readonly Forecast[], date: string) {
  const rows: string[][] = [];
  for (const forecast of forecasts) {
    if (forecast.advertiserId === "999999") continue;
    months.forEach((month, index) => {
      const amount = new Decimal(forecast.amounts[month]);
      if (amount.isZero()) return;
      // Escape text only: validated negative numeric revenue must remain numeric.
      rows.push([
        safeText(forecast.advertiserId),
        "",
        safeText(forecast.productName),
        safeText(forecast.territoryId),
        String(index + 1),
        String(forecast.year),
        amount.toFixed(),
        date,
      ]);
    });
  }
  return stringify(rows, {
    header: true,
    columns: domoColumns,
    record_delimiter: "\r\n",
  });
}
