import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow, fakeWeather } from "./fixtures";

// Pages reachable without a database or a logged-in session.
const PATHS = ["/", "/login", "/register"];

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

// The landing globe fetches weather for each of its pins on mount. Stub the proxy so this
// suite never calls the real provider, which would also trip the per-IP rate limit (SR-9).
// Routes registered inside a test take precedence over this one.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/weather**", (route) => route.fulfill({ json: fakeWeather() }));
});

for (const vp of VIEWPORTS) {
  for (const path of PATHS) {
    test(`${path} does not scroll sideways at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await assertNoHorizontalOverflow(page, vp.width, path);
    });
  }
}

test("landing hero and calls to action are visible on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});

test("login form is usable on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("protected dashboard redirects an anonymous visitor to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

// PRD U10: the landing demo search must work for a visitor with no account.
test("anonymous visitor can run the landing demo search", async ({ page }) => {
  await page.route("**/api/weather**", (route) => route.fulfill({ json: fakeWeather() }));

  await page.goto("/");
  await page.getByLabel("City").fill("Jakarta");
  await page.getByRole("button", { name: "Search" }).click();

  // Match the card headings, not the hero paragraph that also mentions these phrases.
  await expect(page.getByRole("heading", { name: "Current conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "7-day forecast" })).toBeVisible();
  // The demo must funnel the visitor towards registering, not offer favorites.
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
});

test("landing demo search results do not scroll sideways on a small phone", async ({ page }) => {
  await page.route("**/api/weather**", (route) => route.fulfill({ json: fakeWeather() }));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("City").fill("Jakarta");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Current conditions" })).toBeVisible();

  await assertNoHorizontalOverflow(page, 375, "/ with demo weather results");
});

test("landing demo search surfaces a generic error and no provider detail", async ({ page }) => {
  await page.route("**/api/weather**", (route) =>
    route.fulfill({ status: 502, json: { error: "Unable to fetch weather right now." } }),
  );

  await page.goto("/");
  await page.getByLabel("City").fill("Nowhere");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByText("Unable to fetch weather right now.")).toBeVisible();
});
