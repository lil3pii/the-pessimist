/**
 * Local OpenAI-compatible mock for UI/E2E checks and demo recordings.
 * It is NOT used by the app at runtime and never ships in a build.
 *
 *   node scripts/mock-provider.mjs
 *
 * Then choose Custom + Direct Mode with:
 *   base URL: http://localhost:8787/v1
 *   model:    mock
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
let flakySeoFailures = 2;

const CRITICS = {
  "The SEO Critic": {
    quote: "Northstar is the AI operations platform every growing team needs.",
    scenario:
      "The page competes for the broad head term without owning the specific RevOps query. It will earn impressions from teams looking for an integration or a project tracker, then lose the click to a page that names the exact job.",
    fix: "Add the exact keyword phrase \"AI operations platform for RevOps teams\" to the title and add one section that answers the integration query.",
    scores: { intent_alignment: 8, title_body_coherence: 7, topic_coverage: 7 },
  },
  "The Compliance Critic": {
    quote: "Northstar is SOC 2 compliant and uses enterprise-grade security.",
    scenario:
      "The page asserts SOC 2 compliance and that the product eliminates busywork entirely without qualification or evidence. In a regulated buyer's vendor review, this becomes a trust problem and then a procurement blocker.",
    fix: "Remove the absolute busywork claim and replace the SOC 2 sentence with the report date, audit scope, and a link to the trust page.",
    scores: { claim_substantiation: 9, jurisdictional_risk: 8, disclosure_adequacy: 7 },
  },
  "The Behavioral Critic": {
    quote: "Start your free trial today.",
    scenario:
      "The CTA appears before a single concrete outcome has been shown. A time-poor executive reaches the trial ask after three paragraphs of category language and leaves with no reason to trade an email address.",
    fix: "Cut the opening category paragraph and put one measured customer outcome above the trial CTA.",
    scores: { cta_timing: 7, length_patience: 7, cognitive_load: 6 },
  },
  "The Competitive Critic": {
    quote: "best-in-class solution helps you collaborate better, move faster, and unlock productivity",
    scenario:
      "Every differentiator is a category adjective. A buyer comparing the product with an incumbent cannot identify one mechanism that would change their choice, so the safe option wins by default.",
    fix: "Replace the adjective stack with one named mechanism, one benchmark, and one explicit tradeoff.",
    scores: { differentiation: 8, specificity: 8, evidence_uniqueness: 7 },
  },
};

function weighted(scores) {
  return Number((Object.values(scores).reduce((sum, value) => sum + value, 0) / 30).toFixed(2));
}

function json(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function firstSentence(content) {
  const trimmed = content.trim();
  const match = trimmed.match(/^[\s\S]{10,220}?[.!?](?:\s|$)/);
  return (match?.[0] ?? trimmed.slice(0, 160)).trim();
}

function criticPayload(system, content) {
  const entry = Object.entries(CRITICS).find(([name]) => system.includes(name));
  if (!entry) return null;
  const [, data] = entry;
  const quote = content.includes(data.quote) ? data.quote : firstSentence(content);
  return {
    failure_scenario: data.scenario,
    evidence_quote: quote,
    sub_scores: data.scores,
    probability: weighted(data.scores),
    suggested_fix: data.fix,
  };
}

function summaryPayload() {
  return {
    summary:
      "The page is legible but not credible. It asks for a trial before showing a mechanism or proof point, while absolute claims about busywork and compliance create avoidable trust risk. Fix the evidence gap first: the generic positioning and early CTA are symptoms of the same missing specificity.",
    top_failures: [
      {
        critic: "compliance",
        scenario: "An unqualified SOC 2 claim and an absolute busywork claim sit in the trust-critical path.",
        why_it_matters: "Enterprise buyers treat this as a vendor-risk signal before evaluating the product.",
      },
      {
        critic: "competitive",
        scenario: "The product is described entirely in interchangeable category adjectives.",
        why_it_matters: "Without a unique mechanism, the incumbent or doing nothing wins by default.",
      },
    ],
  };
}

function rewritePayload(content) {
  const rewritten = content
    .replace(
      "Northstar is the AI operations platform every growing team needs.",
      "Northstar is the AI operations platform for RevOps teams that need one source of truth.",
    )
    .replace(
      "Trusted by leading companies, our best-in-class solution helps you collaborate better, move faster, and unlock productivity. Unlike other tools, Northstar eliminates busywork entirely.",
      "Northstar checkpoints every 500 rows, so a failed import resumes instead of restarting. In a 40-person pilot, weekly status reconciliation fell from 90 minutes to 12. The tradeoff: the first row appears 300ms later.",
    )
    .replace(
      "Northstar is SOC 2 compliant and uses enterprise-grade security. Customers see dramatic improvements in alignment and efficiency.",
      "Northstar's SOC 2 Type II report covers the period ending March 2026; the audit scope and trust page are linked below. Customer outcome data is reported with sample size and observation window.",
    );

  return {
    rewritten_content: rewritten,
    changes: [
      {
        critic: "seo",
        before: "AI operations platform every growing team needs",
        after: "AI operations platform for RevOps teams that need one source of truth",
        rationale: "Names the specific query and buyer intent in the title and first sentence.",
      },
      {
        critic: "compliance",
        before: "SOC 2 compliant and uses enterprise-grade security",
        after: "SOC 2 Type II report covers the period ending March 2026",
        rationale: "Replaces an unqualified claim with auditable scope and a trust link.",
      },
      {
        critic: "competitive",
        before: "best-in-class solution helps you collaborate better",
        after: "checkpoints every 500 rows ... weekly reconciliation fell from 90 minutes to 12",
        rationale: "Adds a named mechanism, a measured outcome, and a stated tradeoff.",
      },
    ],
    notes: "The pilot data in this mock rewrite is illustrative and must be verified before publication.",
  };
}

function contentFromMessages(messages) {
  const user = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const start = user.indexOf("<<<CONTENT_START>>>");
  const end = user.indexOf("<<<CONTENT_END>>>");
  if (start >= 0 && end > start) {
    return user.slice(start + "<<<CONTENT_START>>>".length, end).trim();
  }
  return user;
}

function buildResponse(body) {
  const messages = body.messages ?? [];
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const content = contentFromMessages(messages);

  if (body.model === "mock-flaky-seo" && system.includes("The SEO Critic") && flakySeoFailures > 0) {
    flakySeoFailures -= 1;
    return "THIS IS NOT VALID JSON";
  }
  if (system.includes("lead analyst writing the executive readout")) {
    return JSON.stringify(summaryPayload());
  }
  if (system.includes("senior editor executing a prioritized pre-mortem rewrite")) {
    return JSON.stringify(rewritePayload(content));
  }
  const critic = criticPayload(system, content);
  if (critic) return JSON.stringify(critic);
  return JSON.stringify({ ok: true });
}

function streamContent(res, content) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  const chunks = content.match(/[\s\S]{1,14}/g) ?? [];
  let index = 0;
  const timer = setInterval(() => {
    if (index >= chunks.length) {
      clearInterval(timer);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    res.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: chunks[index] }, finish_reason: null }] })}\n\n`,
    );
    index += 1;
  }, 18);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, model: "mock" });
    return;
  }

  if (req.method !== "POST" || !(req.url ?? "").endsWith("/chat/completions")) {
    json(res, 404, { error: { message: "Not found" } });
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      json(res, 400, { error: { message: "Invalid JSON" } });
      return;
    }
    const content = buildResponse(body);
    if (body.stream) {
      streamContent(res, content);
      return;
    }
    json(res, 200, {
      id: "mock-completion",
      object: "chat.completion",
      model: body.model ?? "mock",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock OpenAI-compatible provider listening on http://127.0.0.1:${PORT}/v1`);
});

