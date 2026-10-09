import { LlmError, type LlmAdapter } from "./types";
import { openAiCompatible, type JsonMode } from "./adapters/openai-compatible";
import { bedrockAdapter } from "./adapters/bedrock";

type Env = Record<string, string | undefined>;
type Factory = (env: Env) => LlmAdapter;

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const factories = new Map<string, Factory>();
const overrides = new Map<string, LlmAdapter>();

/** Register a provider by name. A non-OpenAI-compatible provider is one adapter file plus one call to this. */
export function registerAdapter(name: string, factory: Factory): void {
  factories.set(name, factory);
}
/** Tests: pin an adapter instance under a name (takes precedence over factories). */
export function setAdapterForTest(name: string, adapter: LlmAdapter | null): void {
  if (adapter) overrides.set(name, adapter);
  else overrides.delete(name);
}

registerAdapter("groq", (env) => {
  if (!env.GROQ_API_KEY) throw new LlmError("config", "GROQ_API_KEY is not set");
  return openAiCompatible({
    name: "groq", baseUrl: env.GROQ_BASE_URL || GROQ_BASE_URL, apiKey: env.GROQ_API_KEY, jsonMode: "json_object",
    // gpt-oss models spend output tokens on hidden reasoning; "low" keeps room for the JSON itself (override with GROQ_REASONING_EFFORT)
    extraBody: (model) => (/gpt-oss/i.test(model) ? { reasoning_effort: env.GROQ_REASONING_EFFORT || "low" } : {}),
  });
});
registerAdapter("openai-compatible", (env) => {
  if (!env.OPENAI_COMPAT_BASE_URL || !env.OPENAI_COMPAT_API_KEY) throw new LlmError("config", "OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_API_KEY are required");
  const mode = (env.OPENAI_COMPAT_JSON_MODE || "json_object") as JsonMode;
  return openAiCompatible({ name: "openai-compatible", baseUrl: env.OPENAI_COMPAT_BASE_URL, apiKey: env.OPENAI_COMPAT_API_KEY, jsonMode: mode });
});
registerAdapter("bedrock", () => bedrockAdapter);

export function adapterFor(name: string, env: Env = process.env): LlmAdapter {
  const pinned = overrides.get(name);
  if (pinned) return pinned;
  const f = factories.get(name);
  if (!f) throw new LlmError("config", `Unknown LLM provider "${name}". Registered: ${[...factories.keys()].join(", ")}`);
  return f(env);
}
