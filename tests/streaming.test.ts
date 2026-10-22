import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  StructuredOutputError,
  completeJSONStream,
  type LLMCallOptions,
  type LLMResponse,
  type ProviderCaller,
  type StreamCaller,
} from "@/lib/llm";
import { partialJsonString } from "@/lib/utils";

const baseOptions = {
  providerId: "openrouter" as const,
  baseUrl: "https://openrouter.ai/api/v1",
  model: "z-ai/glm-5.3-flash",
  apiKey: "test",
  supportsJsonMode: true,
  messages: [{ role: "user" as const, content: "Return JSON." }],
  schema: z.object({ rewritten_content: z.string().min(5) }).strict(),
  correctivePrompt: () => "Return only valid JSON.",
};

function responseFor(options: LLMCallOptions, content: string): LLMResponse {
  return {
    content,
    usage: {},
    latencyMs: 1,
    attempts: 1,
    providerId: options.providerId,
    model: options.model,
    jsonMode: options.supportsJsonMode,
  };
}

describe("streaming structured output", () => {
  it("extracts a readable field from partial JSON including escapes", () => {
    expect(partialJsonString('{"summary":"Hello\\nworld', "summary")).toBe("Hello\nworld");
    expect(partialJsonString('{"rewritten_content":"Line one\\nLine two', "rewritten_content")).toBe(
      "Line one\nLine two",
    );
    expect(partialJsonString('{"other":"x"}', "summary")).toBe("");
  });

  it("streams JSON deltas and returns validated data without a corrective call", async () => {
    const stream: StreamCaller = async (_options, callbacks) => {
      callbacks.onDelta('{"rewritten_content":"A complete');
      callbacks.onDelta(' rewrite."}');
      return responseFor(_options, '{"rewritten_content":"A complete rewrite."}');
    };
    let correctiveCalls = 0;
    const call: ProviderCaller = async (options) => {
      correctiveCalls += 1;
      return responseFor(options, '{"rewritten_content":"Fallback rewrite."}');
    };
    const deltas: string[] = [];

    const result = await completeJSONStream(baseOptions, stream, call, {
      onDelta: (delta) => deltas.push(delta),
    });

    expect(result.data.rewritten_content).toBe("A complete rewrite.");
    expect(result.correctiveRetryUsed).toBe(false);
    expect(correctiveCalls).toBe(0);
    expect(deltas.join("")).toContain("complete");
  });

  it("falls back to one non-streaming corrective call after invalid streamed JSON", async () => {
    const stream: StreamCaller = async (options) => responseFor(options, "not-json");
    let correctiveCalls = 0;
    const call: ProviderCaller = async (options) => {
      correctiveCalls += 1;
      return responseFor(options, '{"rewritten_content":"Corrected rewrite."}');
    };

    const result = await completeJSONStream(baseOptions, stream, call, { onDelta: () => undefined });
    expect(correctiveCalls).toBe(1);
    expect(result.correctiveRetryUsed).toBe(true);
    expect(result.data.rewritten_content).toBe("Corrected rewrite.");
  });

  it("throws when the corrective call is also invalid", async () => {
    const stream: StreamCaller = async (options) => responseFor(options, "not-json");
    const call: ProviderCaller = async (options) => responseFor(options, "still-not-json");

    await expect(
      completeJSONStream(baseOptions, stream, call, { onDelta: () => undefined }),
    ).rejects.toBeInstanceOf(StructuredOutputError);
  });
});
