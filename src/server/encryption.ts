import crypto from "crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// Two HKDF-derived subkeys — never reuse the master key directly.
// Random-IV encryption and deterministic-IV encryption are kept on separate
// keys so an IV-reuse mistake on one mode can't compromise the other.
let randomKey: Buffer | null = null;
let deterministicKey: Buffer | null = null;
let initialized = false;

function deriveSubkey(master: Buffer, label: string): Buffer {
  // HKDF with empty salt; label binds the subkey to its purpose.
  return Buffer.from(
    crypto.hkdfSync("sha256", master, Buffer.alloc(0), label, KEY_LENGTH)
  );
}

/**
 * Initialize encryption by fetching the key from AWS Secrets Manager.
 * Falls back to ENCRYPTION_KEY env var if AWS_SECRET_NAME is not set.
 * Must be called once before any encrypt/decrypt operations (see instrumentation.ts).
 *
 * In production, refuses to complete unless a key is loaded — the app should
 * fail to boot rather than silently write plaintext.
 */
export async function initEncryption(): Promise<void> {
  if (initialized) return;

  const secretName = process.env.AWS_SECRET_NAME;
  const region = process.env.AWS_REGION;
  let masterKey: Buffer | null = null;

  if (secretName && region) {
    const client = new SecretsManagerClient({ region });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secretString = response.SecretString;
    if (!secretString) {
      throw new Error(`Secret ${secretName} has no string value`);
    }
    // The secret can be either a raw base64 key or a JSON object with an "ENCRYPTION_KEY" field
    let keyBase64: string;
    try {
      const parsed = JSON.parse(secretString);
      keyBase64 = parsed.ENCRYPTION_KEY ?? parsed.encryptionKey ?? secretString;
    } catch {
      keyBase64 = secretString;
    }
    masterKey = Buffer.from(keyBase64, "base64");
  } else if (process.env.ENCRYPTION_KEY) {
    // Fallback for local development
    masterKey = Buffer.from(process.env.ENCRYPTION_KEY, "base64");
  }

  if (masterKey) {
    if (masterKey.length < KEY_LENGTH) {
      throw new Error(
        `Encryption key too short: expected ${KEY_LENGTH} bytes, got ${masterKey.length}`
      );
    }
    randomKey = deriveSubkey(masterKey, "hmmeeting:random:v1");
    deterministicKey = deriveSubkey(masterKey, "hmmeeting:deterministic:v1");
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to start: encryption key is not configured. Set AWS_SECRET_NAME+AWS_REGION or ENCRYPTION_KEY."
    );
  }

  initialized = true;
}

// Ciphertext layout: 1-byte version tag || IV (12B) || authTag (16B) || ciphertext.
// The version tag lets us migrate algorithms without re-reading every row.
const VERSION_RANDOM = 0x01;
const VERSION_DETERMINISTIC = 0x02;

/**
 * Encrypt with a random IV (non-deterministic).
 * Same plaintext produces different ciphertexts each time.
 * Use for: fullName, studentNote, teacherNote, room.
 */
export function encrypt(plaintext: string): string {
  if (!randomKey) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, randomKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION_RANDOM]), iv, authTag, encrypted]).toString("base64");
}

/**
 * Encrypt with a deterministic IV derived from the plaintext (so unique
 * constraints and WHERE lookups still work). Use for: email.
 */
export function encryptDeterministic(plaintext: string): string {
  if (!deterministicKey) return plaintext;
  const iv = crypto
    .createHmac("sha256", deterministicKey)
    .update(plaintext.toLowerCase())
    .digest()
    .subarray(0, IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deterministicKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION_DETERMINISTIC]), iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a value encrypted with either encrypt() or encryptDeterministic().
 *
 * Backward-compatible with the legacy (pre-versioned) layout that was used
 * before HKDF subkey separation: if the leading byte isn't a known version,
 * we fall back to trying the master-derived random key. To support reading
 * data written under the old scheme, callers should run the data-encryption
 * migration script after upgrading.
 */
export function decrypt(ciphertext: string): string {
  if (!randomKey || !deterministicKey) return ciphertext;
  const data = Buffer.from(ciphertext, "base64");
  if (data.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH + 1) return ciphertext;

  const version = data[0];
  let key: Buffer;
  let payload: Buffer;
  if (version === VERSION_RANDOM) {
    key = randomKey;
    payload = data.subarray(1);
  } else if (version === VERSION_DETERMINISTIC) {
    key = deterministicKey;
    payload = data.subarray(1);
  } else {
    // Legacy / unversioned — pre-HKDF data. Try random key (covers all
    // non-email fields). Email column was deterministic; legacy reads of
    // email rows will need a one-time re-encryption to migrate.
    key = randomKey;
    payload = data;
  }

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return ciphertext;
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
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
  if (!randomKey) return value;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Returns true if encryption is enabled (subkeys have been derived).
 */
export function isEncryptionEnabled(): boolean {
  return !!randomKey && !!deterministicKey;
}
