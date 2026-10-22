import { chromium } from "playwright-core";
import { mkdirSync, renameSync, existsSync } from "node:fs";

const OUT_DIR = "demo/artifacts";
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
});

const page = await context.newPage();
await page.addInitScript(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      #demo-cursor { position: fixed; z-index: 2147483647; width: 12px; height: 12px; border-radius: 50%;
        background: #F4F1EA; box-shadow: 0 0 0 1px #0A0A0A, 0 0 18px rgba(244,241,234,.55);
        transform: translate(-50%, -50%); pointer-events: none; transition: width .12s, height .12s; mix-blend-mode: difference; }
      #demo-cursor.down { width: 26px; height: 26px; background: #FF4D3D; }
      #demo-ripple { position: fixed; z-index: 2147483646; width: 10px; height: 10px; border: 1px solid #F4F1EA;
        border-radius: 50%; transform: translate(-50%,-50%); pointer-events: none; animation: demo-ripple .6s ease-out forwards; }
      @keyframes demo-ripple { to { width: 54px; height: 54px; opacity: 0; } }
    `;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    document.addEventListener("mousedown", () => cursor.classList.add("down"));
    document.addEventListener("mouseup", () => {
      cursor.classList.remove("down");
      const ripple = document.createElement("div");
      ripple.id = "demo-ripple";
      ripple.style.left = cursor.style.left;
      ripple.style.top = cursor.style.top;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });
});

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

const wait = (ms) => page.waitForTimeout(ms);

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  await wait(450);
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await wait(500);
}

async function click(locator) {
  await moveTo(locator);
  const box = await locator.boundingBox();
  if (!box) throw new Error("Missing click target");
  await page.mouse.down();
  await wait(120);
  await page.mouse.up();
  await wait(500);
}

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60_000 });
await wait(2600);
// Establish a natural cursor position.
await page.mouse.move(700, 360, { steps: 20 });

await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
await wait(1900);

await click(page.getByRole("button", { name: "Try with sample", exact: true }));
await wait(1400);
await page.evaluate(() => window.scrollBy({ top: 280, behavior: "smooth" }));
await wait(1500);

await click(page.getByRole("button", { name: /run pre-mortem/i }));
await wait(1500);
await page.evaluate(() => document.getElementById("analysis-progress")?.scrollIntoView({ behavior: "smooth", block: "center" }));
await wait(2200);
await page.screenshot({ path: `${OUT_DIR}/video-progress.png` });

await page.waitForSelector("text=Four ways this dies.", { timeout: 90_000 });
await page.evaluate(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
await wait(3500);
await page.screenshot({ path: `${OUT_DIR}/video-risk.png` });

const seoCard = page.locator("#critic-seo");
await seoCard.scrollIntoViewIfNeeded();
await wait(2800);
await page.evaluate(() => window.scrollBy({ top: 430, behavior: "smooth" }));
await wait(2500);

const conflict = page.getByRole("radio").nth(1);
await click(conflict);
await wait(1200);
await page.screenshot({ path: `${OUT_DIR}/video-conflict.png` });

await click(page.getByRole("button", { name: /generate rewrite/i }));
await wait(1600);
await page.screenshot({ path: `${OUT_DIR}/video-streaming.png` });
await page.getByText("Prioritized rewrite", { exact: true }).waitFor({ timeout: 90_000 });
await wait(1600);

await page.evaluate(() => window.scrollBy({ top: 520, behavior: "smooth" }));
await wait(2800);
await page.screenshot({ path: `${OUT_DIR}/video-diff.png` });

await page.getByRole("button", { name: /Changes/ }).click();
await wait(2600);
await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
await wait(2200);

await page.getByRole("button", { name: /Before \/ after/ }).click();
await wait(800);
await page.evaluate(() => window.scrollBy({ top: -400, behavior: "smooth" }));
await wait(2200);

await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await wait(1800);

await context.close();
const video = page.video();
const original = video ? await video.path() : null;
await browser.close();

if (original && existsSync(original)) {
  const target = `${OUT_DIR}/the-pessimist-demo.webm`;
  renameSync(original, target);
  console.log(`Wrote ${target}`);
} else {
  console.log("Video file not found.");
}
