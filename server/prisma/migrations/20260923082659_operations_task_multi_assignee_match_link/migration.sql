-- AlterTable: add the new match/sport link columns first (volunteerId/volunteerName
-- stay in place until after the backfill below).
ALTER TABLE "OperationsTask" ADD COLUMN     "matchId" TEXT,
ADD COLUMN     "sportId" TEXT;

-- CreateTable
CREATE TABLE "OperationsTaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsTaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationsTaskAssignee_taskId_volunteerId_key" ON "OperationsTaskAssignee"("taskId", "volunteerId");

-- AddForeignKey
ALTER TABLE "OperationsTaskAssignee" ADD CONSTRAINT "OperationsTaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OperationsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsTaskAssignee" ADD CONSTRAINT "OperationsTaskAssignee_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: carry over each existing task's single volunteerId into the new
-- join table before the column is dropped. Guards against a stale volunteerId
-- that no longer references an existing Volunteer row.
INSERT INTO "OperationsTaskAssignee" ("id", "taskId", "volunteerId")
SELECT gen_random_uuid(), "OperationsTask"."id", "OperationsTask"."volunteerId"
FROM "OperationsTask"
WHERE "OperationsTask"."volunteerId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Volunteer" WHERE "Volunteer"."id" = "OperationsTask"."volunteerId");

-- AlterTable: now safe to drop the old single-assignee columns.
ALTER TABLE "OperationsTask" DROP COLUMN "volunteerId",
DROP COLUMN "volunteerName";

-- AddForeignKey
ALTER TABLE "OperationsTask" ADD CONSTRAINT "OperationsTask_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
