import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const algorithm = "aes-256-gcm";

function getSecret() {
  return process.env.EBAY_TOKEN_ENCRYPTION_SECRET || process.env.ACV_TOKEN_ENCRYPTION_SECRET || "";
}

function getKey() {
  const secret = getSecret();
  if (!secret) {
    throw new Error("Missing token encryption secret: set EBAY_TOKEN_ENCRYPTION_SECRET or ACV_TOKEN_ENCRYPTION_SECRET.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function isEbayTokenEncryptionConfigured() {
  return Boolean(getSecret());
}

export function encryptEbayToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptEbayToken(value: string) {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Encrypted eBay token is not in a supported format.");
  }
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}

