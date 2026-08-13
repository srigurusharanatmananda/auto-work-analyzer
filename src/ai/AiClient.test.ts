import { describe, expect, test } from "bun:test";
import { AiClient } from "./AiClient.js";
import type { AiProvider, AiVisionProvider } from "./AiClient.js";

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

const okVision = (name: string, text: string): AiVisionProvider => ({
  name,
  generateFromImage: async () => text,
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

  describe("vision (completeWithImage)", () => {
    test("supportsVision is false when no vision provider was given", () => {
      expect(new AiClient([ok("A", "x")]).supportsVision).toBe(false);
    });

    test("supportsVision is true when a vision provider was given", () => {
      expect(new AiClient([ok("A", "x")], okVision("V", "y")).supportsVision).toBe(true);
    });

    test("completeWithImage calls the vision provider, not the text chain", async () => {
      const image = { mimeType: "image/png", data: "base64==" };
      const client = new AiClient([fails("A", "should never be called")], okVision("V", "extracted text"));
      const result = await client.completeWithImage("read this", image);
      expect(result.text).toBe("extracted text");
      expect(result.provider).toBe("V");
    });

    test("completeWithImage throws a clear setup error when no vision provider is configured", async () => {
      const client = new AiClient([ok("A", "x")]);
      await expect(client.completeWithImage("read this", { mimeType: "image/png", data: "x" })).rejects.toThrow(
        /GOOGLE_API_KEY.*Gemini/
      );
    });

    test("completeWithImage propagates the vision provider's own error", async () => {
      const failingVision: AiVisionProvider = {
        name: "V",
        generateFromImage: async () => {
          throw new Error("vision boom");
        },
      };
      const client = new AiClient([], failingVision);
      await expect(client.completeWithImage("read this", { mimeType: "image/png", data: "x" })).rejects.toThrow(
        "vision boom"
      );
    });
  });
});
