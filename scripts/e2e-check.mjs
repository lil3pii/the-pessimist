/**
 * Browser smoke test. Requires two running processes:
 *   node scripts/mock-provider.mjs
 *   npm run dev
 *
 *   npm run test:e2e
 *
 * The test configures a Custom + Direct Mode provider pointed at the mock,
 * runs four critics, verifies the deterministic score/conflict/rewrite flow,
 * then reruns to verify the 24h cache badges.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : { channel: "chrome" }),
});

const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

await page.addInitScript(() => {
  localStorage.setItem(
    "the-pessimist/settings/v1",
    JSON.stringify({
      providerId: "custom",
      baseUrl: "http://127.0.0.1:8787/v1",
      model: "mock",
      supportsJsonMode: false,
      mode: "direct",
      allowAnthropicDirect: true,
      budgetCeilingUsd: 1,
    }),
  );
});

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4_000);
assert.equal(await page.getByRole("button", { name: "Try with sample", exact: true }).count(), 1);

// Dev hydration can lag the static shell; retry the click until the controlled
// textarea actually receives the sample value.
for (let attempt = 0; attempt < 3; attempt += 1) {
  await page.getByRole("button", { name: "Try with sample", exact: true }).click();
  await page.waitForTimeout(600);
  const length = await page.locator("#content-input").evaluate((element) => element.value.length);
  if (length > 40) break;
}
assert.ok(
  (await page.locator("#content-input").evaluate((element) => element.value.length)) > 40,
  "Sample content did not load",
);
await page.getByRole("button", { name: /run pre-mortem/i }).click();
await page.waitForSelector("text=Four ways this dies.", { timeout: 90_000 });
await page.waitForTimeout(600);

const reportText = await page.locator("#report").innerText();
assert.match(reportText, /0\.76/);
assert.equal(await page.locator("article.panel").count(), 4);
assert.match(reportText, /Conflicting direction on claims and positioning/);

await page.getByRole("radio").nth(1).click();
await page.getByRole("button", { name: /generate rewrite/i }).click();
await page.getByText("Prioritized rewrite", { exact: true }).waitFor({ timeout: 90_000 });
assert.equal(
  (await page.getByText("SOC 2 Type II report covers the period ending March 2026").count()) > 0,
  true,
);

await page.getByRole("button", { name: /run pre-mortem/i }).click();
await page.waitForSelector("text=Four ways this dies.", { timeout: 90_000 });
await page.waitForTimeout(700);
assert.equal(await page.getByText("cached 24h").count(), 4);

mkdirSync("qa", { recursive: true });
await page.screenshot({ path: "qa/e2e-report.png", fullPage: true });
assert.deepEqual(errors, []);

console.log("E2E passed: analysis, deterministic score, conflict, rewrite, and cache badges.");
await browser.close();
