/**
 * AES-256-GCM encryption for stored ClickUp API keys.
 *
 * Payload format: base64(iv):base64(authTag):base64(ciphertext)
 *
 * GCM rather than CBC so a tampered payload fails loudly on the auth tag
 * instead of decrypting to garbage that then gets sent to ClickUp as a key.
 * Nothing in this file logs, and callers must keep it that way: a decrypted
 * value is only ever handed to ClickUpService.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
/** GCM's full tag. Node would accept 4 or 8; a short tag is cheap to forge. */
const AUTH_TAG_BYTES = 16;

export class CredentialCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}).`
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw new Error("Stored credential is malformed and cannot be decrypted.");
    }
    const [ivPart, tagPart, dataPart] = parts as [string, string, string];

    // Node accepts GCM auth tags of 4, 8, or 12–16 bytes. A shorter tag is
    // dramatically cheaper to forge, so an attacker who could write to
    // clickup_destinations.api_key_encrypted could otherwise substitute a
    // 4-byte tag and brute-force it. We only ever emit 16, so anything else is
    // either corruption or tampering.
    const authTag = Buffer.from(tagPart, "base64");
    if (authTag.length !== AUTH_TAG_BYTES) {
      throw new Error("Stored credential is malformed and cannot be decrypted.");
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}

export function generateKeyBase64(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/**
 * Fails loudly when unconfigured. The silent alternative — storing keys in the
 * clear — is worse than refusing to start.
 */
export function loadCipherFromEnv(): CredentialCipher {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. ClickUp API keys are stored encrypted, " +
        "so this is required.\n\nGenerate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n\n" +
        "Then add it to your .env as CREDENTIAL_ENCRYPTION_KEY=<value>."
    );
  }
  return new CredentialCipher(key);
}
