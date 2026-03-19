// src/server/db.ts
// Prisma client with transparent field-level encryption.
// When ENCRYPTION_KEY is set, sensitive fields are encrypted at rest
// and decrypted transparently on read.

import { PrismaClient } from "@prisma/client";
import {
  encrypt,
  encryptDeterministic,
  safeDecrypt,
  isEncrypted,
  isEncryptionEnabled,
} from "./encryption";

// Fields encrypted per model and their encryption mode
const USER_FIELDS: Record<string, "deterministic" | "random"> = {
  email: "deterministic",
  fullName: "random",
};

const APPOINTMENT_FIELDS: Record<string, "deterministic" | "random"> = {
  studentNote: "random",
  teacherNote: "random",
  room: "random",
};

const TEACHER_FIELDS: Record<string, "deterministic" | "random"> = {
  room: "random",
};

const FIELDS_BY_MODEL: Record<string, Record<string, "deterministic" | "random">> = {
  User: USER_FIELDS,
  Appointment: APPOINTMENT_FIELDS,
  Teacher: TEACHER_FIELDS,
};

// All field names that should be decrypted when found in results
const ALL_DECRYPTABLE_FIELDS = new Set([
  ...Object.keys(USER_FIELDS),
  ...Object.keys(APPOINTMENT_FIELDS),
  ...Object.keys(TEACHER_FIELDS),
]);

function encryptField(value: unknown, mode: "deterministic" | "random"): unknown {
  if (typeof value !== "string" || !value) return value;
  if (isEncrypted(value)) return value;
  return mode === "deterministic" ? encryptDeterministic(value) : encrypt(value);
}

function encryptDataFields(data: Record<string, unknown>, model: string) {
  const fields = FIELDS_BY_MODEL[model];
  if (!fields || !data) return;
  for (const [field, mode] of Object.entries(fields)) {
    if (field in data && typeof data[field] === "string" && data[field]) {
      data[field] = encryptField(data[field], mode);
    }
  }
}

function encryptWhereFields(where: Record<string, unknown>, model: string) {
  const fields = FIELDS_BY_MODEL[model];
  if (!fields || !where) return;
  for (const [field, mode] of Object.entries(fields)) {
    if (mode === "deterministic" && field in where && typeof where[field] === "string") {
      where[field] = encryptField(where[field], mode);
    }
  }
}

function decryptDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(decryptDeep);
  if (typeof obj !== "object") return obj;

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.map(decryptDeep);
    } else if (value && typeof value === "object") {
      result[key] = decryptDeep(value);
    } else if (typeof value === "string" && ALL_DECRYPTABLE_FIELDS.has(key)) {
      result[key] = safeDecrypt(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function encryptArgs(model: string, args: Record<string, unknown>) {
  if (!(model in FIELDS_BY_MODEL)) return;

  if (args.data) {
    encryptDataFields(args.data as Record<string, unknown>, model);
  }
  if (args.create) {
    encryptDataFields(args.create as Record<string, unknown>, model);
  }
  if (args.update) {
    encryptDataFields(args.update as Record<string, unknown>, model);
  }
  if (args.where) {
    encryptWhereFields(args.where as Record<string, unknown>, model);
  }
}

function createPrismaClient() {
  const baseClient = new PrismaClient({ log: ["error", "warn"] });

  if (!isEncryptionEnabled()) {
    return baseClient;
  }

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          encryptArgs(model, args);
          const result = await query(args);
          if (result && typeof result === "object") {
            return decryptDeep(result);
          }
          return result;
        },
      },
    },
  });
}

type PrismaClientType = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClientType | undefined;
}

export const prisma: PrismaClientType =
  global.__prismaClient || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prismaClient = prisma;
}
