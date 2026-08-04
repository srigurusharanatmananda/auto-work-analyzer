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

    // Flip a bit in the ciphertext rather than overwriting its first two base64
    // characters with "00": if the ciphertext already began "00" (~1 in 4096)
    // the payload was unchanged, decrypt succeeded, and this test failed for a
    // reason that had nothing to do with the auth tag. Mutating a byte is
    // unconditional.
    const data = Buffer.from(parts[2]!, "base64");
    data[0] = data[0]! ^ 0xff;
    const tampered = [parts[0], parts[1], data.toString("base64")].join(":");

    expect(tampered).not.toBe(payload);
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

describe("auth tag length", () => {
  /**
   * Node's setAuthTag accepts 4-, 8- and 12–16-byte GCM tags. A 4-byte tag is
   * enormously cheaper to forge than a 16-byte one, so an attacker able to write
   * to the stored column could downgrade the tag and brute-force a forgery. We
   * only ever emit 16 bytes, so anything else is corruption or tampering.
   */
  test("a truncated auth tag is rejected rather than accepted as a shorter tag", () => {
    const cipher = new CredentialCipher(generateKeyBase64());
    const [iv, tag, data] = cipher.encrypt("pk_live_example").split(":");

    const shortTag = Buffer.from(tag!, "base64").subarray(0, 4).toString("base64");
    expect(() => cipher.decrypt([iv, shortTag, data].join(":"))).toThrow();
  });

  test("a full-length tag still round-trips", () => {
    const cipher = new CredentialCipher(generateKeyBase64());
    expect(cipher.decrypt(cipher.encrypt("pk_live_example"))).toBe("pk_live_example");
  });
});
