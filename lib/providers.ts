export type JsonModeCapability = "supported" | "unsupported" | "model-dependent";
export type DirectModeCapability = "supported" | "opt-in" | "unsupported";
export type ProviderId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "zhipu"
  | "github"
  | "ollama"
  | "custom";

export type AuthStyle = "bearer" | "anthropic" | "none";

export interface ModelPreset {
  id: string;
  label: string;
  /** USD per 1M input tokens. Rough public list-price estimate, not billing truth. */
  inputPricePerMTok: number;
  /** USD per 1M output tokens. Rough public list-price estimate, not billing truth. */
  outputPricePerMTok: number;
}

export interface ProviderPreset {
  id: ProviderId;
  name: string;
  shortName: string;
  baseUrl: string;
  models: ModelPreset[];
  defaultModel: string;
  jsonMode: JsonModeCapability;
  /** Default for the JSON-mode toggle. Users can override for model-dependent providers. */
  supportsJsonMode: boolean;
  directMode: DirectModeCapability;
  requiresKey: boolean;
  authStyle: AuthStyle;
  docsUrl: string;
  note: string;
}

export const PROVIDERS: readonly ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPricePerMTok: 0.15, outputPricePerMTok: 0.6 },
      { id: "gpt-4o", label: "GPT-4o", inputPricePerMTok: 2.5, outputPricePerMTok: 10 },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", inputPricePerMTok: 0.4, outputPricePerMTok: 1.6 },
    ],
    defaultModel: "gpt-4o-mini",
    jsonMode: "supported",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    note: "JSON mode supported. Browser requests are blocked by CORS; use the proxy.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    shortName: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1/",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", inputPricePerMTok: 3, outputPricePerMTok: 15 },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPricePerMTok: 1, outputPricePerMTok: 5 },
    ],
    defaultModel: "claude-sonnet-4-5",
    jsonMode: "unsupported",
    supportsJsonMode: false,
    directMode: "opt-in",
    requiresKey: true,
    authStyle: "anthropic",
    docsUrl: "https://docs.anthropic.com/en/api/openai-sdk",
    note: "OpenAI-compatible surface. No response_format; the app relies on prompt-level JSON plus validation.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat", inputPricePerMTok: 0.27, outputPricePerMTok: 1.1 },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner", inputPricePerMTok: 0.55, outputPricePerMTok: 2.19 },
    ],
    defaultModel: "deepseek-chat",
    jsonMode: "supported",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://api-docs.deepseek.com/",
    note: "Recommended default alternative to GLM 5.3 Flash. JSON mode supported.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash", inputPricePerMTok: 0.6, outputPricePerMTok: 2.2 },
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", inputPricePerMTok: 0.27, outputPricePerMTok: 1.1 },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", inputPricePerMTok: 3, outputPricePerMTok: 15 },
    ],
    defaultModel: "z-ai/glm-5.3-flash",
    jsonMode: "model-dependent",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://openrouter.ai/docs",
    note: "Primary route to GLM 5.3 Flash. JSON mode depends on the routed model.",
  },
  {
    id: "groq",
    name: "Groq",
    shortName: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", inputPricePerMTok: 0.59, outputPricePerMTok: 0.79 },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", inputPricePerMTok: 0.15, outputPricePerMTok: 0.6 },
    ],
    defaultModel: "llama-3.3-70b-versatile",
    jsonMode: "supported",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://console.groq.com/docs",
    note: "Very low latency. JSON mode supported.",
  },
  {
    id: "zhipu",
    name: "Zhipu (Z.ai)",
    shortName: "Zhipu",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-5.3-flash", label: "GLM 5.3 Flash", inputPricePerMTok: 0.6, outputPricePerMTok: 2.2 },
      { id: "glm-4.5", label: "GLM 4.5", inputPricePerMTok: 0.6, outputPricePerMTok: 2.2 },
    ],
    defaultModel: "glm-5.3-flash",
    jsonMode: "supported",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://docs.z.ai/",
    note: "Direct route to GLM 5.3 Flash. JSON mode supported.",
  },
  {
    id: "github",
    name: "GitHub Models",
    shortName: "GitHub",
    baseUrl: "https://models.github.ai/inference",
    models: [
      { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", inputPricePerMTok: 0.4, outputPricePerMTok: 1.6 },
      { id: "openai/gpt-4o", label: "GPT-4o", inputPricePerMTok: 2.5, outputPricePerMTok: 10 },
    ],
    defaultModel: "openai/gpt-4.1-mini",
    jsonMode: "model-dependent",
    supportsJsonMode: true,
    directMode: "unsupported",
    requiresKey: true,
    authStyle: "bearer",
    docsUrl: "https://docs.github.com/en/github-models",
    note: "Verified OpenAI-compatible endpoint. Capability varies by model.",
  },
  {
    id: "ollama",
    name: "Ollama",
    shortName: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    models: [
      { id: "llama3.2", label: "Llama 3.2", inputPricePerMTok: 0, outputPricePerMTok: 0 },
      { id: "qwen2.5:14b", label: "Qwen 2.5 14B", inputPricePerMTok: 0, outputPricePerMTok: 0 },
      { id: "mistral", label: "Mistral", inputPricePerMTok: 0, outputPricePerMTok: 0 },
    ],
    defaultModel: "llama3.2",
    jsonMode: "model-dependent",
    supportsJsonMode: true,
    directMode: "supported",
    requiresKey: false,
    authStyle: "none",
    docsUrl: "https://github.com/ollama/ollama/blob/main/docs/openai.md",
    note: "Direct Mode only. Runs on your machine; JSON mode depends on the model.",
  },
  {
    id: "custom",
    name: "Custom",
    shortName: "Custom",
    baseUrl: "",
    models: [],
    defaultModel: "",
    jsonMode: "model-dependent",
    supportsJsonMode: false,
    directMode: "opt-in",
    requiresKey: false,
    authStyle: "bearer",
    docsUrl: "",
    note: "Any OpenAI-compatible endpoint. You control the base URL, key, and JSON-mode toggle. Useful for LM Studio.",
  },
] as const;

export function getProvider(id: string): ProviderPreset {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
}

export function capabilityLabel(capability: JsonModeCapability): string {
  switch (capability) {
    case "supported":
      return "JSON mode: supported";
    case "unsupported":
      return "JSON mode: unsupported";
    default:
      return "JSON mode: depends on model";
  }
}

export function directModeLabel(capability: DirectModeCapability): string {
  switch (capability) {
    case "supported":
      return "Direct: supported";
    case "opt-in":
      return "Direct: advanced opt-in";
    default:
      return "Direct: unsupported (CORS)";
  }
}

export function findModel(provider: ProviderPreset, modelId: string): ModelPreset | undefined {
  return provider.models.find((model) => model.id === modelId);
}

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}
