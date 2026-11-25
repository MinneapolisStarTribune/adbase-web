import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3101";
test("localhost login and logout work without APP_ORIGIN", async ({ page }) => {
  await page.goto("http://localhost:3101/");
  await page
    .getByRole("button", { name: "Sales representative", exact: true })
    .click();
  await expect(page.getByText("Signed in as")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Choose a sample account")).toBeVisible();
});
const amounts = Object.fromEntries(
  [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].map((m) => [m, "0"]),
);
test("representative can page, filter, edit, cancel and sign out", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Sales representative", exact: true })
    .click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByLabel("Advertiser range").selectOption("Z");
  await page.getByLabel("Advertiser search").fill("100001");
  await page.getByRole("button", { name: "View forecasts" }).click();
  await expect(page.getByRole("button", { name: "Edit 100001" })).toBeVisible();
  await expect(page.getByTestId("annual-total")).toHaveText("20,030.975");
  await page.getByRole("button", { name: "Edit 100001" }).click();
  await expect(page.getByLabel("Jan", { exact: true })).toHaveValue("12500.25");
  await expect(
    page.getByRole("combobox", { name: "Year", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Jan", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Save forecast" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Correct the monthly amounts",
  );
  await page.getByLabel("Jan", { exact: true }).fill("12501.125");
  await page.getByRole("button", { name: "Save forecast" }).click();
  await expect(page.getByText("Forecast updated.")).toBeVisible();
  await page.getByRole("button", { name: "Edit 100001" }).click();
  await page.getByLabel("Jan", { exact: true }).fill("999");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit 100001" }).click();
  await expect(page.getByLabel("Jan", { exact: true })).toHaveValue(
    "12501.125",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download Domo CSV" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Choose a sample account")).toBeVisible();
});
test("delegate creates a forecast and sees an updated annual total", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Delegated representative" }).click();
  await page
    .getByRole("combobox", { name: "Territory", exact: true })
    .selectOption("central");
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2027");
  await page.getByRole("button", { name: "View forecasts" }).click();
  await expect(
    page.getByText("No forecasts match your selection."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add forecast" }).click();
  await page
    .getByRole("combobox", { name: "Advertiser", exact: true })
    .selectOption("100003");
  await page
    .getByRole("combobox", { name: "Product", exact: true })
    .selectOption("digital");
  await page.getByLabel("Jan", { exact: true }).fill("1,250.125");
  await page.getByRole("button", { name: "Save forecast" }).click();
  await expect(page.getByText("Forecast saved.")).toBeVisible();
  await expect(page.getByTestId("annual-total")).toHaveText("1,250.125");
});
test("administrator maintains advertiser and downloads Domo CSV", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Forecast administrator" }).click();
  await page.getByRole("button", { name: "Advertisers", exact: true }).click();
  await page.getByRole("button", { name: "Add advertiser" }).click();
  await page.getByLabel("Advertiser ID", { exact: true }).fill("880001");
  await page
    .getByLabel("Advertiser name", { exact: true })
    .fill("Browser sample");
  await page.getByRole("button", { name: "Save advertiser" }).click();
  await expect(page.getByText("Advertiser saved.")).toBeVisible();
  await page.getByRole("button", { name: "Edit advertiser 880001" }).click();
  await page
    .getByLabel("Advertiser name", { exact: true })
    .fill("Browser sample changed");
  await page.getByLabel("Assigned territory").selectOption("central");
  await page.getByRole("button", { name: "Save advertiser" }).click();
  await expect(
    page.getByRole("rowheader", { name: "Browser sample changed" }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Domo CSV" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(
    /^ForecastRevenue_\d{8}\.csv$/,
  );
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "forecast.export", exact: true }).first(),
  ).toBeVisible();
});
test("unmapped persona has no data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Unassigned employee" }).click();
  await expect(page.getByText("No territory access")).toBeVisible();
});
test("direct API calls enforce identity, territory, admin, origin, and revocation", async ({
  request,
}) => {
  expect(
    (
      await request.get("/api/workspace/forecasts?territoryId=north&year=2026")
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        data: { personaId: "mock-admin" },
        headers: { Origin: "https://untrusted.invalid" },
      })
    ).status(),
  ).toBe(403);
  const login = await request.post("/api/session", {
    data: { personaId: "mock-user" },
    headers: { Origin: origin },
  });
  expect(login.status()).toBe(200);
  expect(login.headers()["set-cookie"]).toContain("HttpOnly");
  expect(
    (
      await request.get("/api/workspace/forecasts?territoryId=south&year=2026")
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/workspace/export")).status()).toBe(403);
  expect((await request.get("/api/workspace/audit")).status()).toBe(403);
  expect(
    (
      await request.post("/api/workspace/advertisers", {
        data: { id: "880002", name: "Forbidden", territoryId: "north" },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/workspace/forecasts/sample-4", {
        data: { version: 1, amounts },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/workspace/forecasts/sample-1", {
        data: { version: 1, amounts },
        headers: { Origin: "https://untrusted.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(
        "/api/workspace/forecasts?territoryId=north&territoryId=south&year=2026",
      )
    ).status(),
  ).toBe(400);
  await request.delete("/api/session", { headers: { Origin: origin } });
  expect((await request.get("/api/workspace/export")).status()).toBe(401);
});
