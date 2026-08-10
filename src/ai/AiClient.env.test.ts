/**
 * `AiClient.test.ts` only ever exercises the abstract `AiClient` class with
 * fake, hand-rolled `AiProvider`s — it never calls `createAiClientFromEnv()`,
 * so the actual fetch calls and response-shape parsing for the real
 * providers (Groq, Hugging Face, ...) have had zero coverage. That is
 * exactly the class of bug AiClient.ts's own comment describes already
 * happening once (retired Gemini model ids going undetected for a while,
 * silently, because the chain just fell through to Groq).
 *
 * These tests exercise `createAiClientFromEnv()`'s real Groq and Hugging
 * Face provider bodies with an injected `fetchImpl` (mirroring
 * SpeechClient.ts's `fetchImpl?: typeof fetch` pattern) so real HTTP calls
 * are never made, while the actual parsing code — the part that broke
 * silently before — is.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createAiClientFromEnv } from "./AiClient.js";

// Every real-provider env var, saved and restored around each test so this
// file never leaks state into (or picks up state from) other test files.
const ENV_KEYS = ["GOOGLE_API_KEY", "GROQ_API_KEY", "HUGGINGFACE_API_KEY", "OPENROUTER_API_KEY"];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("createAiClientFromEnv - Groq provider body", () => {
  test("happy path: parses choices[0].message.content", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "hello from groq" } }] }),
        { status: 200 }
      )) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });
    const result = await client.complete("prompt");

    expect(result.text).toBe("hello from groq");
    expect(result.provider).toBe("Groq Llama 3.3 70B");
  });

  test("malformed response (empty choices array) throws a clear error, not a TypeError", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/unexpected response shape/);
  });

  test("malformed response (missing content field) throws a clear error", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/unexpected response shape/);
  });

  test("non-ok HTTP status throws with the response body's error text included", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response("rate limit exceeded, slow down", { status: 429 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/rate limit exceeded, slow down/);
  });
});

describe("createAiClientFromEnv - Hugging Face provider body", () => {
  test("happy path: parses data[0].generated_text", async () => {
    process.env.HUGGINGFACE_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response(JSON.stringify([{ generated_text: "hello from hf" }]), { status: 200 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });
    const result = await client.complete("prompt");

    expect(result.text).toBe("hello from hf");
    expect(result.provider).toBe("Hugging Face Qwen 2.5 72B");
  });

  test("malformed response (empty array) throws a clear error, not a TypeError", async () => {
    process.env.HUGGINGFACE_API_KEY = "test-key";
    const fetchImpl = (async () => new Response(JSON.stringify([]), { status: 200 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/unexpected response shape/);
  });

  test("malformed response (missing generated_text field) throws a clear error", async () => {
    process.env.HUGGINGFACE_API_KEY = "test-key";
    const fetchImpl = (async () => new Response(JSON.stringify([{}]), { status: 200 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/unexpected response shape/);
  });

  test("non-ok HTTP status throws with the response body's error text included", async () => {
    process.env.HUGGINGFACE_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response("model is currently loading", { status: 503 })) as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/model is currently loading/);
  });
});

describe("createAiClientFromEnv - per-provider timeout", () => {
  test("a hanging provider times out instead of hanging complete() forever", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.AI_PROVIDER_TIMEOUT_MS = "50";

    // Simulates a provider that never responds: fetch's own AbortSignal
    // timeout is what has to end this, since nothing else here ever settles
    // or rejects on its own.
    const fetchImpl = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return; // would hang forever if no timeout signal was wired up
        signal.addEventListener("abort", () => {
          const err = new Error("The operation timed out.");
          err.name = "TimeoutError";
          reject(err);
        });
      })) as unknown as typeof fetch;

    const client = createAiClientFromEnv({ fetchImpl });

    await expect(client.complete("prompt")).rejects.toThrow(/Groq request timed out after 50ms/);

    delete process.env.AI_PROVIDER_TIMEOUT_MS;
  });
});
