/**
 * Multi-provider AI client with sequential fallback.
 *
 * Extracted from ManagerSummaryAIService so commit grouping and summary
 * generation share one chain — adding a provider now benefits both. The
 * provider bodies below are moved verbatim: same model ids, endpoints, and
 * request bodies, so the manager-summary endpoint keeps behaving as it did.
 */

export interface AiProvider {
  name: string;
  generate(prompt: string): Promise<string>;
}

export interface AiCompletion {
  text: string;
  provider: string;
}

const QUOTA_KEYWORDS = ["quota", "rate limit", "too many requests", "429", "exceeded", "overloaded"];

export function isQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return QUOTA_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export class AiClient {
  constructor(private providers: AiProvider[] = []) {}

  get isConfigured(): boolean {
    return this.providers.length > 0;
  }

  get providerNames(): string[] {
    return this.providers.map((provider) => provider.name);
  }

  async complete(prompt: string): Promise<AiCompletion> {
    if (this.providers.length === 0) {
      throw new Error(
        "No AI providers configured. Add at least one API key to your .env file:\n" +
          "- GOOGLE_API_KEY (https://aistudio.google.com/apikey)\n" +
          "- GROQ_API_KEY (https://console.groq.com/keys)\n" +
          "- HUGGINGFACE_API_KEY (https://huggingface.co/settings/tokens)\n" +
          "- OPENROUTER_API_KEY (https://openrouter.ai/keys)"
      );
    }

    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      try {
        const text = await provider.generate(prompt);
        return { text, provider: provider.name };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ provider: provider.name, error: message });
        // Quota exhaustion and a hard error are handled identically — move on to
        // the next provider either way. isQuotaError is exported for callers that
        // want to report the distinction.
        console.error(`${provider.name} failed:`, message);
        continue;
      }
    }

    throw new Error(
      `All AI providers failed.\n\nErrors:\n${errors
        .map((entry) => `${entry.provider}: ${entry.error}`)
        .join("\n")}\n\nProviders tried: ${this.providerNames.join(", ")}`
    );
  }
}

/**
 * Every provider body below hangs the *entire* fallback chain if it never
 * settles: AiClient.complete()'s fallthrough only helps once a provider's
 * promise actually rejects, and none of `fetch`/the Gemini SDK reject on
 * their own just because the other end never answers. Same convention as
 * `TTS_TIMEOUT_MS` / `WHISPER_TIMEOUT_MS` elsewhere in this repo (see
 * SpeechClient.ts / WhisperClient.ts): a sane default, overridable via env
 * for a slower provider or network. Override with AI_PROVIDER_TIMEOUT_MS.
 */
const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

function getProviderTimeoutMs(): number {
  return Number(process.env.AI_PROVIDER_TIMEOUT_MS) || DEFAULT_PROVIDER_TIMEOUT_MS;
}

/**
 * True for the error `fetch` rejects with when the `AbortSignal.timeout()`
 * passed as its own `signal` fires. Node/undici names that error
 * "TimeoutError" (verified against the runtime, not assumed) — distinct
 * from "AbortError", which is what a manually-aborted AbortController
 * produces. Both names are accepted defensively since the exact spelling is
 * runtime-dependent; anything else (ECONNREFUSED, a real 5xx after
 * `response.text()`, etc.) is a genuine failure and must pass through
 * unchanged so the caller sees the real cause.
 */
function isProviderTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * `fetchImpl` with `AbortSignal.timeout()` wired in, and a timeout converted
 * to a plain `Error` naming the provider — the exact three-step shape
 * (attach the signal, catch, rethrow-or-relabel) that Groq/Hugging
 * Face/OpenRouter each need identically. Pulled out once three near-verbatim
 * copies existed, so a future fix to timeout detection (another accepted
 * error name, say) cannot be applied to one provider and forgotten in the
 * other two.
 */
async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  providerLabel: string,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (isProviderTimeoutError(error)) {
      throw new Error(`${providerLabel} request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export interface CreateAiClientOptions {
  /**
   * Injectable so tests can intercept the real provider HTTP calls without
   * hitting real APIs — mirrors the `fetchImpl?: typeof fetch` + `??`
   * pattern already used by SpeechClient.ts / GeminiSpeechClient.ts.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Builds the chain from environment variables.
 *
 * Each block is gated on its own key, exactly as ManagerSummaryAIService gated
 * it, so an install with only GROQ_API_KEY gets the same single-provider chain
 * it got before.
 */
export function createAiClientFromEnv(options: CreateAiClientOptions = {}): AiClient {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const providers: AiProvider[] = [];

  // Provider 1: Google Gemini (multiple models)
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== "your_google_api_key_here") {
    const gemini = (label: string, model: string): AiProvider => ({
      name: label,
      generate: async (prompt: string) => {
        const { GoogleGenerativeAI, GoogleGenerativeAIAbortError } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        const generativeModel = genAI.getGenerativeModel({ model });
        const timeoutMs = getProviderTimeoutMs();

        // Unlike the three fetch()-based providers below, this genuinely
        // does support cancellation: `generateContent`'s second argument is
        // typed as `SingleRequestOptions` (checked against
        // node_modules/@google/generative-ai's own .d.ts, not assumed),
        // which accepts a `signal` (an equivalent `timeout` field also
        // exists but only wires up a second, redundant internal abort for
        // the identical deadline — `signal` alone is the same mechanism the
        // fetch-based providers already use, so this stays one timer, not
        // two). The SDK's own docs note the caveat that aborting is
        // "client-only" — Google may keep processing the request
        // server-side — but that's exactly what we need here: the *promise
        // this function returns* settles, which is all
        // AiClient.complete()'s fallthrough cares about. On timeout the SDK
        // rejects with its own `GoogleGenerativeAIAbortError`; that's
        // converted below into a plain Error with a message that says
        // "timed out" so it reads the same as the other providers' timeout
        // errors instead of a Gemini-specific class name.
        try {
          const result = await generativeModel.generateContent(prompt, {
            signal: AbortSignal.timeout(timeoutMs),
          });
          return result.response.text();
        } catch (error) {
          if (error instanceof GoogleGenerativeAIAbortError) {
            throw new Error(`${label} request timed out after ${timeoutMs}ms`);
          }
          throw error;
        }
      },
    });

    // All three previous ids (gemini-1.5-flash-latest, gemini-1.5-pro-latest,
    // gemini-pro) were retired and returned 404 "not found for API version
    // v1beta". Because the chain falls through on failure, nothing broke
    // visibly — every AI request just made three doomed round-trips to Google
    // before Groq served it. That affected commit grouping AND the
    // manager-summary endpoint, and the only symptom was latency.
    //
    // These two are floating aliases, verified present via ListModels. Aliases
    // rather than pinned versions deliberately: a pinned id is what rotted last
    // time. If an alias is ever retired too, the fall-through still keeps the
    // feature working via Groq.
    providers.push(gemini("Google Gemini Flash", "gemini-flash-latest"));
    providers.push(gemini("Google Gemini Pro", "gemini-pro-latest"));
  }

  // Provider 2: Groq (Free, no credit card)
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "Groq Llama 3.3 70B",
      generate: async (prompt: string) => {
        const response = await fetchWithTimeout(
          fetchImpl,
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 1024,
            }),
          },
          "Groq",
          getProviderTimeoutMs()
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Groq API error: ${error}`);
        }

        const data = await response.json();
        // The retired-Gemini-model incident (see the comment above) is the
        // same failure mode a response-shape change would cause here: a
        // silent 404/shape drift would otherwise surface as an opaque
        // "Cannot read properties of undefined" instead of a message that
        // names the provider and shows the actual payload.
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          throw new Error(`Groq API returned an unexpected response shape: ${JSON.stringify(data)}`);
        }
        return content;
      },
    });
  }

  // Provider 3: Hugging Face Inference API (Free)
  if (process.env.HUGGINGFACE_API_KEY) {
    providers.push({
      name: "Hugging Face Qwen 2.5 72B",
      generate: async (prompt: string) => {
        const response = await fetchWithTimeout(
          fetchImpl,
          "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                max_new_tokens: 1024,
                temperature: 0.7,
                return_full_text: false,
              },
            }),
          },
          "Hugging Face",
          getProviderTimeoutMs()
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Hugging Face API error: ${error}`);
        }

        const data = await response.json();
        const generatedText = Array.isArray(data) ? data[0]?.generated_text : undefined;
        if (typeof generatedText !== "string") {
          throw new Error(
            `Hugging Face API returned an unexpected response shape: ${JSON.stringify(data)}`
          );
        }
        return generatedText;
      },
    });
  }

  // Provider 4: OpenRouter (Free tier available)
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter (Free Models)",
      generate: async (prompt: string) => {
        const response = await fetchWithTimeout(
          fetchImpl,
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/auto-work-analyzer",
            },
            body: JSON.stringify({
              model: "meta-llama/llama-3.3-70b-instruct:free",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 1024,
            }),
          },
          "OpenRouter",
          getProviderTimeoutMs()
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter API error: ${error}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          throw new Error(`OpenRouter API returned an unexpected response shape: ${JSON.stringify(data)}`);
        }
        return content;
      },
    });
  }

  return new AiClient(providers);
}
