-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false;
