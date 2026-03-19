/**
 * One-time migration script to encrypt existing database records.
 *
 * Run ONCE before deploying the encrypted application:
 *   ENCRYPTION_KEY=<your-key> npx tsx scripts/encrypt-existing-data.ts
 *
 * This script:
 *   1. Reads all User records and encrypts email (deterministic) + fullName (random)
 *   2. Reads all Appointment records and encrypts studentNote, teacherNote, room
 *   3. Reads all Teacher records and encrypts room
 *
 * Safe to re-run: skips already-encrypted values.
 */

import { PrismaClient } from "@prisma/client";
import {
  encrypt,
  encryptDeterministic,
  isEncrypted,
  isEncryptionEnabled,
} from "../src/server/encryption";

async function main() {
  if (!isEncryptionEnabled()) {
    console.error("ENCRYPTION_KEY environment variable is not set. Aborting.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Encrypt User records
    const users = await prisma.user.findMany();
    console.log(`Encrypting ${users.length} user records...`);
    let userUpdated = 0;

    for (const user of users) {
      const updates: Record<string, string> = {};

      if (!isEncrypted(user.email)) {
        updates.email = encryptDeterministic(user.email);
      }
      if (!isEncrypted(user.fullName)) {
        updates.fullName = encrypt(user.fullName);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
        userUpdated++;
      }
    }
    console.log(`  Updated ${userUpdated} / ${users.length} users.`);

    // Encrypt Appointment records
    const appointments = await prisma.appointment.findMany();
    console.log(`Encrypting ${appointments.length} appointment records...`);
    let apptUpdated = 0;

    for (const appt of appointments) {
      const updates: Record<string, string> = {};

      if (appt.studentNote && !isEncrypted(appt.studentNote)) {
        updates.studentNote = encrypt(appt.studentNote);
      }
      if (appt.teacherNote && !isEncrypted(appt.teacherNote)) {
        updates.teacherNote = encrypt(appt.teacherNote);
      }
      if (appt.room && !isEncrypted(appt.room)) {
        updates.room = encrypt(appt.room);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: updates,
        });
        apptUpdated++;
      }
    }
    console.log(`  Updated ${apptUpdated} / ${appointments.length} appointments.`);

    // Encrypt Teacher records
    const teachers = await prisma.teacher.findMany();
    console.log(`Encrypting ${teachers.length} teacher records...`);
    let teacherUpdated = 0;

    for (const teacher of teachers) {
      if (teacher.room && !isEncrypted(teacher.room)) {
        await prisma.teacher.update({
          where: { id: teacher.id },
          data: { room: encrypt(teacher.room) },
        });
        teacherUpdated++;
      }
    }
    console.log(`  Updated ${teacherUpdated} / ${teachers.length} teachers.`);

    console.log("\nEncryption migration complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
