import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { CRITICS } from "../lib/critics";
import { PROVIDERS, type ProviderPreset } from "../lib/providers";

const root = process.cwd();
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const errors: string[] = [];

function fail(message: string) {
  errors.push(message);
}

function normalizeUrl(value: string): string {
  const cleaned = value.replace(/`/g, "").trim();
  if (cleaned === "—" || cleaned === "-" || cleaned === "") return "";
  return cleaned.replace(/\/+$/, "");
}

// 1. Critic files
const agentFiles = readdirSync(path.join(root, "agents")).filter((file) => file.endsWith(".md"));
const declaredCriticCount = Number(readme.match(/\*\*Critic files:\s*(\d+)\*\*/i)?.[1]);
if (!Number.isInteger(declaredCriticCount)) {
  fail("README is missing the line `**Critic files: N**`.");
} else if (declaredCriticCount !== agentFiles.length) {
  fail(`README declares ${declaredCriticCount} critic files, but agents/ contains ${agentFiles.length}.`);
}
if (agentFiles.length !== CRITICS.length) {
  fail(`agents/ contains ${agentFiles.length} markdown files, but code defines ${CRITICS.length} critics.`);
}

// 2. Few-shot files
const fewshotFiles = readdirSync(path.join(root, "agents", "fewshot")).filter((file) => file.endsWith(".json"));
if (fewshotFiles.length !== CRITICS.length) {
  fail(`agents/fewshot/ contains ${fewshotFiles.length} files, expected ${CRITICS.length}.`);
}

// 3. Providers and capabilities
const tableStart = readme.indexOf("<!-- provider-table:start -->");
const tableEnd = readme.indexOf("<!-- provider-table:end -->");
if (tableStart < 0 || tableEnd < 0) {
  fail("README is missing the provider-table markers.");
} else {
  const table = readme.slice(tableStart, tableEnd);
  const rows = table
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const header = rows[0]?.map((cell) => cell.toLowerCase());
  const body = rows.slice(2);

  const expectedHeaders = ["provider", "id", "base url", "json capability", "json default", "direct mode", "key"];
  if (!header || expectedHeaders.some((expected, index) => header[index] !== expected)) {
    fail(`Provider table headers must be: ${expectedHeaders.join(" | ")}`);
  }

  const byId = new Map<string, string[]>();
  for (const row of body) {
    const id = row[1]?.replace(/`/g, "");
    if (id) byId.set(id, row);
  }

  for (const provider of PROVIDERS) {
    const row = byId.get(provider.id);
    if (!row) {
      fail(`Provider "${provider.id}" is missing from the README table.`);
      continue;
    }
    checkProviderRow(provider, row);
  }

  const codeIds = new Set(PROVIDERS.map((provider) => provider.id));
  for (const id of byId.keys()) {
    if (!codeIds.has(id as ProviderPreset["id"])) {
      fail(`README lists unknown provider "${id}" that is not in PROVIDERS.`);
    }
  }
}

function checkProviderRow(provider: ProviderPreset, row: string[]) {
  const [, , baseUrl, capability, defaultFlag, direct, key] = row;
  const expectedUrl = normalizeUrl(provider.baseUrl);
  const actualUrl = normalizeUrl(baseUrl);
  if (expectedUrl !== actualUrl) {
    fail(`${provider.id}: README base URL "${actualUrl}" != code "${expectedUrl}".`);
  }

  const expectedCapability = provider.jsonMode;
  if (capability.toLowerCase() !== expectedCapability) {
    fail(`${provider.id}: README JSON capability "${capability}" != code "${expectedCapability}".`);
  }

  const expectedDefault = String(provider.supportsJsonMode);
  if (defaultFlag.toLowerCase() !== expectedDefault) {
    fail(`${provider.id}: README JSON default "${defaultFlag}" != code "${expectedDefault}".`);
  }

  if (direct.toLowerCase() !== provider.directMode) {
    fail(`${provider.id}: README Direct Mode "${direct}" != code "${provider.directMode}".`);
  }

  const expectedKey = provider.requiresKey ? "required" : "optional";
  if (key.toLowerCase() !== expectedKey) {
    fail(`${provider.id}: README key requirement "${key}" != code "${expectedKey}".`);
  }
}

// 4. Rubric coverage
const criticNames: Record<string, RegExp> = {
  seo: /\|\s*SEO\s*\|/,
  compliance: /\|\s*Compliance\s*\|/,
  behavioral: /\|\s*Behavioral\s*\|/,
  competitive: /\|\s*Competitive\s*\|/,
};
for (const critic of CRITICS) {
  const pattern = criticNames[critic.id];
  if (!pattern.test(readme)) fail(`README rubric table is missing critic "${critic.id}".`);
  if (!readme.includes(`agents/${critic.id}.md`)) fail(`README does not link agents/${critic.id}.md.`);
}

if (errors.length > 0) {
  console.error("README check failed:");
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log(
  `README check passed: ${agentFiles.length} critic files, ${fewshotFiles.length} few-shot files, ${PROVIDERS.length} providers, all capability columns aligned.`,
);
