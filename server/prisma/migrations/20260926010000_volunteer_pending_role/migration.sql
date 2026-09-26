-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "pendingRoleName" TEXT,
ADD COLUMN     "pendingSportIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
