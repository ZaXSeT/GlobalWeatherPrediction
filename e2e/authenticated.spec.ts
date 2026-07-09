import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";
import { assertNoHorizontalOverflow, fakeWeather } from "./fixtures";

// The (app) layout guard only verifies the JWT signature (no database round trip), so a
// correctly signed session cookie is enough to render the authenticated pages here. The
// API responses those pages call are mocked below, which keeps this suite DB-free.

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

const PROTECTED_PATHS = ["/dashboard", "/favorites", "/history", "/profile"];

async function signSessionCookie(context: BrowserContext) {
  const secretValue = process.env.JWT_SECRET;
  if (!secretValue) throw new Error("JWT_SECRET missing: cannot sign a test session cookie.");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("e2e-test-user")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secretValue));

  await context.addCookies([
    { name: "session", value: token, domain: "localhost", path: "/" },
    { name: "csrf", value: "e2e-csrf-token", domain: "localhost", path: "/" },
  ]);
}

/** Stub every data endpoint the authenticated pages hit, so no DB or provider is needed. */
async function mockApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: {
          id: "e2e-test-user",
          email: "tester@example.com",
          createdAt: "2026-01-01T00:00:00Z",
        },
      },
    }),
  );
  await page.route("**/api/favorites", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: {} });
    return route.fulfill({
      json: {
        favorites: [
          {
            id: "1",
            city: "Jakarta",
            latitude: -6.21,
            longitude: 106.85,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "2",
            city: "Kuala Lumpur",
            latitude: 3.14,
            longitude: 101.69,
            createdAt: "2026-01-02T00:00:00Z",
          },
        ],
      },
    });
  });
  await page.route("**/api/history", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: {} });
    return route.fulfill({
      json: {
        history: [
          {
            id: "1",
            city: "Singapore",
            latitude: 1.29,
            longitude: 103.85,
            createdAt: "2026-01-03T10:00:00Z",
          },
          {
            id: "2",
            city: "Bandung",
            latitude: -6.91,
            longitude: 107.6,
            createdAt: "2026-01-03T09:00:00Z",
          },
        ],
      },
    });
  });
}

test.beforeEach(async ({ context, page }) => {
  await signSessionCookie(context);
  await mockApi(page);
});

for (const vp of VIEWPORTS) {
  for (const path of PROTECTED_PATHS) {
    test(`${path} does not scroll sideways at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await assertNoHorizontalOverflow(page, vp.width, path);
    });
  }
}

test("weather results render without sideways scroll on a small phone", async ({ page }) => {
  await page.route("**/api/weather**", (route) => route.fulfill({ json: fakeWeather() }));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await page.getByPlaceholder("Search a city").fill("Jakarta");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("heading", { name: "Current conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "7-day forecast" })).toBeVisible();
  await assertNoHorizontalOverflow(page, 375, "/dashboard with weather results");
});
