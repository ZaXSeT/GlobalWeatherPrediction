import { test, expect } from "@playwright/test";
import { fakeWeather } from "./fixtures";

const OUT =
  "C:/Users/zacky/AppData/Local/Temp/claude/e--Personal-Projects-Tugas-GlobalWeatherPrediction/baf73e1f-b5fe-4782-a821-65672d9db3ca/scratchpad";

test.use({ colorScheme: "light" });
test.setTimeout(120_000);

test("globe can be dragged to spin", async ({ page }) => {
  await page.route("**/api/weather**", (route) => route.fulfill({ json: fakeWeather() }));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCSS("opacity", "1", { timeout: 30_000 });
  await page.waitForTimeout(2000);

  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Read a pin's horizontal position before and after the drag. If dragging spins the
  // globe, the pin must move. This asserts the interaction, it does not assume it.
  const pin = page.getByText("Sao Paulo").first();
  const before = (await pin.boundingBox())?.x ?? null;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 160, cy, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const after = (await pin.boundingBox())?.x ?? null;
  console.log(`pin x before=${before} after=${after}`);
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after as number) - (before as number))).toBeGreaterThan(30);

  await canvas.screenshot({ path: `${OUT}/globe-dragged.png` });
});
