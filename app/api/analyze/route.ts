import { NextResponse, type NextRequest } from "next/server";
import { callProvider, streamProvider } from "@/lib/llm";
import { runAnalysis } from "@/lib/pipeline";
import { analyzeApiSchema, formatZodError } from "@/lib/schemas";
import type { AppSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 80;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  if (buckets.size > 2_000) {
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown server error.";
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = analyzeApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", detail: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    if (payload.action === "ping") {
      const config = payload.config!;
      const startedAt = Date.now();
      const response = await callProvider({
        providerId: config.providerId,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        supportsJsonMode: false,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        maxTokens: 1,
        temperature: 0,
        allowEmpty: true,
        timeoutMs: 20_000,
        signal: request.signal,
      });
      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startedAt,
        providerId: response.providerId,
        model: response.model,
        usage: response.usage,
      });
    }

    if (payload.action === "analyze") {
      const config = payload.config!;
      const input = payload.input!;
      const settings: AppSettings = {
        providerId: config.providerId,
        baseUrl: config.baseUrl,
        model: config.model,
        supportsJsonMode: config.supportsJsonMode,
        mode: "proxy",
        allowAnthropicDirect: false,
        budgetCeilingUsd: 0,
      };
      const report = await runAnalysis({
        input,
        settings,
        apiKey: config.apiKey,
        call: callProvider,
        signal: request.signal,
      });
      return NextResponse.json({ report });
    }

    const chat = payload.request!;
    if (chat.stream) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          streamProvider(
            {
              providerId: chat.providerId,
              baseUrl: chat.baseUrl,
              model: chat.model,
              apiKey: chat.apiKey,
              supportsJsonMode: chat.supportsJsonMode,
              messages: chat.messages,
              temperature: chat.temperature,
              maxTokens: chat.maxTokens,
              timeoutMs: 60_000,
              signal: request.signal,
            },
            {
              onDelta: (delta) => send("delta", { delta }),
              onDone: (full) => send("done", { content: full }),
            },
          )
            .catch((error: unknown) => send("error", { error: safeError(error) }))
            .finally(() => controller.close());
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const response = await callProvider({
      providerId: chat.providerId,
      baseUrl: chat.baseUrl,
      model: chat.model,
      apiKey: chat.apiKey,
      supportsJsonMode: chat.supportsJsonMode,
      messages: chat.messages,
      temperature: chat.temperature,
      maxTokens: chat.maxTokens,
      timeoutMs: 30_000,
      signal: request.signal,
    });

    return NextResponse.json({
      content: response.content,
      usage: response.usage,
      latencyMs: response.latencyMs,
      attempts: response.attempts,
      providerId: response.providerId,
      model: response.model,
      jsonMode: response.jsonMode,
      finishReason: response.finishReason,
    });
  } catch (error) {
    const message = safeError(error);
    const status = message.toLowerCase().includes("api key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export function GET() {
  return NextResponse.json(
    {
      endpoint: "/api/analyze",
      methods: ["POST"],
      actions: {
        chat: "Stateless proxy for one OpenAI-compatible chat completion.",
        ping: "One-token provider connectivity check.",
        analyze: "Full deterministic report (server-run; no cache).",
      },
      privacy:
        "The API key is accepted in the request body, used for the request, and never logged or persisted. No request body logging.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
