// Encrypted backup tool. Reads the SQLite database, encrypts it under a key
// distinct from the field-level encryption key, and writes the ciphertext to
// disk. The two keys are intentionally separated: a compromise of the
// field-level key (which is loaded into the running Node process) shouldn't
// also unlock historical backups (which can sit on disk for months).
//
// Usage:
//   npx tsx scripts/backup-tool.ts encrypt <src.db> <dst.db.enc>
//   npx tsx scripts/backup-tool.ts decrypt <src.db.enc> <dst.db>
//
// Env (encrypt + decrypt):
//   AWS_BACKUP_SECRET_NAME + AWS_REGION   — fetch backup key from AWS SM
//   BACKUP_KEY                            — base64 32-byte fallback (dev only)
//
// On-disk layout:
//   magic(4)="HMBK" | version(1) | iv(12) | tag(16) | ciphertext

import crypto from "node:crypto";
import fs from "node:fs/promises";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const MAGIC = Buffer.from("HMBK");
const VERSION = 0x01;

async function loadKey(): Promise<Buffer> {
  const name = process.env.AWS_BACKUP_SECRET_NAME;
  const region = process.env.AWS_REGION;
  if (name && region) {
    const client = new SecretsManagerClient({ region });
    const r = await client.send(new GetSecretValueCommand({ SecretId: name }));
    if (!r.SecretString) throw new Error(`Secret ${name} has no string value`);
    let b64 = r.SecretString;
    try {
      const j = JSON.parse(r.SecretString);
      b64 = j.BACKUP_KEY ?? j.backupKey ?? r.SecretString;
    } catch {
      // raw base64 string
    }
    const k = Buffer.from(b64, "base64");
    if (k.length !== KEY_LEN) throw new Error(`backup key must be ${KEY_LEN} bytes`);
    return k;
  }
  if (process.env.BACKUP_KEY) {
    const k = Buffer.from(process.env.BACKUP_KEY, "base64");
    if (k.length !== KEY_LEN) throw new Error(`BACKUP_KEY must be ${KEY_LEN} base64-decoded bytes`);
    return k;
  }
  throw new Error(
    "no backup key configured: set AWS_BACKUP_SECRET_NAME+AWS_REGION or BACKUP_KEY"
  );
}

async function encryptCmd(src: string, dst: string) {
  const key = await loadKey();
  const plain = await fs.readFile(src);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([MAGIC, Buffer.from([VERSION]), iv, tag, ct]);
  await fs.writeFile(dst, out, { mode: 0o600 });
  console.log(`encrypted ${plain.length} bytes -> ${out.length} bytes at ${dst}`);
}

async function decryptCmd(src: string, dst: string) {
  const key = await loadKey();
  const buf = await fs.readFile(src);
  if (buf.length < MAGIC.length + 1 + IV_LEN + TAG_LEN + 1) {
    throw new Error("backup file too small / not a valid HMBK blob");
  }
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error("not a HMBK backup file (magic mismatch)");
  }
  const version = buf[4];
  if (version !== VERSION) {
    throw new Error(`unsupported backup version: ${version}`);
  }
  const iv = buf.subarray(5, 5 + IV_LEN);
  const tag = buf.subarray(5 + IV_LEN, 5 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(5 + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  await fs.writeFile(dst, plain, { mode: 0o600 });
  console.log(`decrypted ${ct.length} bytes -> ${plain.length} bytes at ${dst}`);
}

async function main() {
  const [cmd, src, dst] = process.argv.slice(2);
  if (!cmd || !src || !dst) {
    console.error("usage: backup-tool.ts <encrypt|decrypt> <src> <dst>");
    process.exit(1);
  }
  if (cmd === "encrypt") await encryptCmd(src, dst);
  else if (cmd === "decrypt") await decryptCmd(src, dst);
  else {
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("backup tool failed:", (e as Error).message);
  process.exit(1);
});
