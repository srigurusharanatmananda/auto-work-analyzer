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
 * Builds the chain from environment variables.
 *
 * Each block is gated on its own key, exactly as ManagerSummaryAIService gated
 * it, so an install with only GROQ_API_KEY gets the same single-provider chain
 * it got before.
 */
export function createAiClientFromEnv(): AiClient {
  const providers: AiProvider[] = [];

  // Provider 1: Google Gemini (multiple models)
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== "your_google_api_key_here") {
    const gemini = (label: string, model: string): AiProvider => ({
      name: label,
      generate: async (prompt: string) => {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        const generativeModel = genAI.getGenerativeModel({ model });
        const result = await generativeModel.generateContent(prompt);
        return result.response.text();
      },
    });

    providers.push(gemini("Google Gemini 1.5 Flash Latest", "gemini-1.5-flash-latest"));
    providers.push(gemini("Google Gemini 1.5 Pro Latest", "gemini-1.5-pro-latest"));
    providers.push(gemini("Google Gemini Pro", "gemini-pro"));
  }

  // Provider 2: Groq (Free, no credit card)
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "Groq Llama 3.3 70B",
      generate: async (prompt: string) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Groq API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      },
    });
  }

  // Provider 3: Hugging Face Inference API (Free)
  if (process.env.HUGGINGFACE_API_KEY) {
    providers.push({
      name: "Hugging Face Qwen 2.5 72B",
      generate: async (prompt: string) => {
        const response = await fetch(
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
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Hugging Face API error: ${error}`);
        }

        const data = await response.json();
        return data[0].generated_text;
      },
    });
  }

  // Provider 4: OpenRouter (Free tier available)
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter (Free Models)",
      generate: async (prompt: string) => {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      },
    });
  }

  return new AiClient(providers);
}
