import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/server/request-origin";
const request = (
  origin: string | null,
  host = "localhost:3000",
  extra: Record<string, string> = {},
) =>
  new Request("http://127.0.0.1:3000/api/session", {
    method: "POST",
    headers: { host, ...(origin === null ? {} : { origin }), ...extra },
  });
describe("browser-facing origin validation", () => {
  it("accepts localhost when Next.js uses a loopback IP internally", () => {
    expect(() =>
      assertSameOrigin(request("http://localhost:3000")),
    ).not.toThrow();
  });
  it("accepts the IP when the browser actually uses that IP", () => {
    expect(() =>
      assertSameOrigin(request("http://127.0.0.1:3000", "127.0.0.1:3000")),
    ).not.toThrow();
  });
  it.each([
    null,
    "null",
    "https://untrusted.invalid",
    "http://localhost:3001",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
  ])("rejects missing or different origin %s", (origin) => {
    expect(() => assertSameOrigin(request(origin))).toThrow(
      "Request origin is not allowed.",
    );
  });
  it("uses an explicit external origin as the authority", () => {
    expect(() =>
      assertSameOrigin(
        request("https://forecast.example"),
        "https://forecast.example",
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000"),
        "https://forecast.example",
      ),
    ).toThrow();
  });
  it("ignores forged proxy headers", () => {
    expect(() =>
      assertSameOrigin(
        request("https://untrusted.invalid", "localhost:3000", {
          "x-forwarded-host": "untrusted.invalid",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toThrow();
  });
  it.each([
    "localhost:3000/path",
    "localhost:3000@untrusted.invalid",
    "localhost:3000,untrusted.invalid",
  ])("rejects malformed Host %s", (host) => {
    expect(() =>
      assertSameOrigin(request("http://untrusted.invalid", host)),
    ).toThrow();
  });
});
