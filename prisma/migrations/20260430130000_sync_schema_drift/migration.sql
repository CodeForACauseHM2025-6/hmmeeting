-- Sync prod schema with prisma/schema.prisma. Three columns + one index
-- were added to the schema in earlier commits but never had a migration
-- generated (likely added via `prisma db push` locally), so prod was
-- missing them. Without `Teacher.room`, every `findUnique` that includes
-- the teacher relation throws P2022, which is what was breaking the
-- schedule editor (front-end fell back to "all breaks" on the failed GET).

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "emailToken" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "room" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FREE',
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Availability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Availability" ("day", "id", "period", "recurring", "teacherId") SELECT "day", "id", "period", "recurring", "teacherId" FROM "Availability";
DROP TABLE "Availability";
ALTER TABLE "new_Availability" RENAME TO "Availability";
CREATE INDEX "Availability_teacherId_day_idx" ON "Availability"("teacherId", "day");
CREATE UNIQUE INDEX "Availability_teacherId_day_period_key" ON "Availability"("teacherId", "day", "period");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_emailToken_key" ON "Appointment"("emailToken");
