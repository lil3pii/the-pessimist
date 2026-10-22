import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  LLMError,
  StructuredOutputError,
  callProvider,
  completeJSON,
  type LLMCallOptions,
  type LLMResponse,
  type ProviderCaller,
} from "@/lib/llm";

const baseOptions: LLMCallOptions = {
  providerId: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "z-ai/glm-5.3-flash",
  apiKey: "test-key",
  supportsJsonMode: true,
  messages: [{ role: "user", content: "Return JSON." }],
  timeoutMs: 5_000,
};

function response(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("provider-agnostic LLM wrapper", () => {
  it("sends response_format only when the capability flag is true", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fakeFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return response("{}");
    }) as unknown as typeof fetch;

    await callProvider({ ...baseOptions, fetchImpl: fakeFetch });
    await callProvider({ ...baseOptions, supportsJsonMode: false, fetchImpl: fakeFetch });

    expect(bodies[0].response_format).toEqual({ type: "json_object" });
    expect(bodies[1]).not.toHaveProperty("response_format");
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it("retries a 5xx with backoff and never changes the model", async () => {
    let calls = 0;
    const fakeFetch = vi.fn(async () => {
      calls += 1;
      if (calls < 3) return response("upstream unavailable", 503);
      return response("{}");
    }) as unknown as typeof fetch;

    const result = await callProvider({ ...baseOptions, fetchImpl: fakeFetch });
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(result.providerId).toBe("openrouter");
    expect(result.model).toBe("z-ai/glm-5.3-flash");
  });

  it("does not retry a 401", async () => {
    const fakeFetch = vi.fn(async () => response("bad key", 401)) as unknown as typeof fetch;
    await expect(callProvider({ ...baseOptions, fetchImpl: fakeFetch })).rejects.toMatchObject({
      stage: "http",
      status: 401,
      retryable: false,
    });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("runs exactly one corrective retry on invalid JSON", async () => {
    let calls = 0;
    const caller: ProviderCaller = async (options) => {
      calls += 1;
      const content = calls === 1 ? "not json at all" : JSON.stringify({ ok: true });
      return {
        content,
        usage: {},
        latencyMs: 1,
        attempts: 1,
        providerId: options.providerId,
        model: options.model,
        jsonMode: options.supportsJsonMode,
      } satisfies LLMResponse;
    };

    const result = await completeJSON(
      {
        ...baseOptions,
        messages: [{ role: "user", content: "Return JSON." }],
        schema: z.object({ ok: z.boolean() }).strict(),
        correctivePrompt: () => "Return only valid JSON.",
      },
      caller,
    );

    expect(calls).toBe(2);
    expect(result.correctiveRetryUsed).toBe(true);
    expect(result.data.ok).toBe(true);
  });

  it("rejects a second schema failure with a typed error", async () => {
    let calls = 0;
    const caller: ProviderCaller = async (options) => {
      calls += 1;
      const content = calls === 1 ? JSON.stringify({ ok: "nope" }) : JSON.stringify({ wrong: true });
      return {
        content,
        usage: {},
        latencyMs: 1,
        attempts: 1,
        providerId: options.providerId,
        model: options.model,
        jsonMode: true,
      } satisfies LLMResponse;
    };

    await expect(
      completeJSON(
        {
          ...baseOptions,
          messages: [{ role: "user", content: "Return JSON." }],
          schema: z.object({ ok: z.boolean() }).strict(),
          correctivePrompt: () => "Return only valid JSON.",
        },
        caller,
      ),
    ).rejects.toBeInstanceOf(StructuredOutputError);
    expect(calls).toBe(2);
  });

  it("refuses a local URL in server/proxy context", async () => {
    const fakeFetch = vi.fn() as unknown as typeof fetch;
    await expect(
      callProvider({ ...baseOptions, baseUrl: "http://localhost:11434/v1", fetchImpl: fakeFetch }),
    ).rejects.toBeInstanceOf(LLMError);
  });
});
