import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  return Buffer.from(key, "base64");
}

/**
 * Encrypt with a random IV (non-deterministic).
 * Same plaintext produces different ciphertexts each time.
 * Use for: fullName, studentNote, teacherNote, room.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Encrypt with a deterministic IV derived from the plaintext.
 * Same plaintext always produces the same ciphertext.
 * Use for: email (needed for @unique constraint and WHERE lookups).
 */
export function encryptDeterministic(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto
    .createHmac("sha256", key)
    .update(plaintext.toLowerCase())
    .digest()
    .subarray(0, IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a value encrypted with either encrypt() or encryptDeterministic().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;
  const data = Buffer.from(ciphertext, "base64");
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return ciphertext;
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

/**
 * Check if a string looks like an encrypted value (valid base64 with sufficient length).
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 30) return false;
  try {
    const buf = Buffer.from(value, "base64");
    return buf.toString("base64") === value && buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Safely decrypt — returns the original value if it doesn't appear to be encrypted.
 */
export function safeDecrypt(value: string): string {
  if (!getKey()) return value;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Returns true if encryption is enabled (ENCRYPTION_KEY is set).
 */
export function isEncryptionEnabled(): boolean {
  return !!getKey();
}
