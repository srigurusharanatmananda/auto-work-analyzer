/**
 * The cipher is the one thing standing between a stored ClickUp key and a
 * readable one, so these tests assert the properties that matter rather than
 * the encoding: a round trip, a fresh IV per encryption, no plaintext in the
 * payload, and a hard failure on a wrong key or a tampered payload.
 *
 * No real credential appears here. "pk_..." strings below are invented.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  CredentialCipher,
  generateKeyBase64,
  loadCipherFromEnv,
} from "./CredentialCipher.js";

const KEY = generateKeyBase64();
const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  else process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
});

describe("CredentialCipher", () => {
  test("round-trips a value", () => {
    const cipher = new CredentialCipher(KEY);
    const secret = "pk_12345678_ABCDEFGHIJKLMNOP";
    expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
  });

  test("ciphertext differs between encryptions of the same value", () => {
    const cipher = new CredentialCipher(KEY);
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  test("ciphertext does not contain the plaintext", () => {
    const cipher = new CredentialCipher(KEY);
    expect(cipher.encrypt("pk_secret_value")).not.toContain("pk_secret_value");
  });

  test("a different key cannot decrypt", () => {
    const payload = new CredentialCipher(KEY).encrypt("secret");
    expect(() => new CredentialCipher(generateKeyBase64()).decrypt(payload)).toThrow();
  });

  test("tampered ciphertext fails the auth tag check", () => {
    const cipher = new CredentialCipher(KEY);
    const payload = cipher.encrypt("secret");
    const parts = payload.split(":");
    const tampered = [parts[0], parts[1], "00" + parts[2]!.slice(2)].join(":");
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  test("a malformed payload throws a clear error", () => {
    expect(() => new CredentialCipher(KEY).decrypt("not-a-payload")).toThrow(/malformed/i);
  });

  test("rejects a key of the wrong length", () => {
    expect(() => new CredentialCipher(Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("loadCipherFromEnv", () => {
  test("throws with setup instructions when the key is missing", () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => loadCipherFromEnv()).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  });

  test("returns a working cipher when the key is present", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = KEY;
    const cipher = loadCipherFromEnv();
    expect(cipher.decrypt(cipher.encrypt("x"))).toBe("x");
  });
});
