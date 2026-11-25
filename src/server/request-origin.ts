import { ForecastingError } from "@/modules/forecasting/domain/models";

/** Match the browser-facing Host, not Next.js's internally reconstructed URL. */
export function assertSameOrigin(request: Request, configuredOrigin?: string) {
  const reject = () => {
    throw new ForecastingError("FORBIDDEN", "Request origin is not allowed.");
  };
  let expected = configuredOrigin;
  if (!expected) {
    const url = new URL(request.url),
      host = request.headers.get("host") ?? url.host;
    // Host must be an authority, without paths, credentials or lists.
    if (!host || /[\s/\\@?#,]/.test(host)) return reject();
    try {
      expected = new URL(`${url.protocol}//${host}`).origin;
    } catch {
      return reject();
    }
  }
  // Forwarded headers are not trusted. Proxies must set the external APP_ORIGIN.
  if (request.headers.get("origin") !== expected) reject();
}
