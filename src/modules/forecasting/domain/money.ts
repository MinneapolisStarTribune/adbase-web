import Decimal from "decimal.js";
import { months, type Forecast } from "./models";

// Leave room for aggregation; business precision and rounding remain undecided.
const Amount = Decimal.clone({ precision: 50 });

export function totalForecasts(forecasts: readonly Forecast[]): string {
  return forecasts
    .reduce(
      (total, forecast) =>
        months.reduce((sum, month) => sum.plus(forecast.amounts[month]), total),
      new Amount(0),
    )
    .toFixed();
}
