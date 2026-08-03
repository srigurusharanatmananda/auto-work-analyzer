import { describe, expect, test } from "bun:test";
import { AiClient } from "./AiClient.js";
import type { AiProvider } from "./AiClient.js";

const ok = (name: string, text: string): AiProvider => ({
  name,
  generate: async () => text,
});

const fails = (name: string, message: string): AiProvider => ({
  name,
  generate: async () => {
    throw new Error(message);
  },
});

describe("AiClient", () => {
  test("returns the first provider's result", async () => {
    const result = await new AiClient([ok("A", "hello"), ok("B", "unused")]).complete("p");
    expect(result.text).toBe("hello");
    expect(result.provider).toBe("A");
  });

  test("falls through to the next provider on failure", async () => {
    const result = await new AiClient([fails("A", "boom"), ok("B", "second")]).complete("p");
    expect(result.text).toBe("second");
    expect(result.provider).toBe("B");
  });

  test("falls through on a quota error", async () => {
    const result = await new AiClient([
      fails("A", "429 rate limit exceeded"),
      ok("B", "second"),
    ]).complete("p");
    expect(result.provider).toBe("B");
  });

  test("throws listing every provider error when all fail", async () => {
    const client = new AiClient([fails("A", "boom-a"), fails("B", "boom-b")]);
    await expect(client.complete("p")).rejects.toThrow(/boom-a[\s\S]*boom-b/);
  });

  test("throws a setup message when no providers are configured", async () => {
    await expect(new AiClient([]).complete("p")).rejects.toThrow(/No AI providers configured/);
  });

  test("isConfigured reflects whether any provider exists", () => {
    expect(new AiClient([]).isConfigured).toBe(false);
    expect(new AiClient([ok("A", "x")]).isConfigured).toBe(true);
  });

  test("providerNames lists the chain in order", () => {
    expect(new AiClient([ok("A", "x"), ok("B", "y")]).providerNames).toEqual(["A", "B"]);
  });

  test("tries every provider in order, stopping at the first success", async () => {
    const tried: string[] = [];
    const record = (name: string, result: "ok" | "fail"): AiProvider => ({
      name,
      generate: async () => {
        tried.push(name);
        if (result === "fail") throw new Error(`${name} down`);
        return "text";
      },
    });

    await new AiClient([
      record("A", "fail"),
      record("B", "fail"),
      record("C", "ok"),
      record("D", "ok"),
    ]).complete("p");

    expect(tried).toEqual(["A", "B", "C"]);
  });
});
