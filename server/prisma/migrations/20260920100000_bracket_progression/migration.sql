ALTER TABLE "Match" ADD COLUMN "nextMatchId" TEXT, ADD COLUMN "nextMatchSlot" TEXT;
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Match_nextMatchId_nextMatchSlot_key" ON "Match"("nextMatchId", "nextMatchSlot");
