ALTER TABLE "Sport" ADD COLUMN "scoringMode" TEXT NOT NULL DEFAULT 'LIVE';
ALTER TABLE "Sport" ADD CONSTRAINT "Sport_scoringMode_check" CHECK ("scoringMode" IN ('LIVE','RESULT_ONLY'));
UPDATE "Sport" SET "scoringMode" = 'RESULT_ONLY' WHERE lower(trim("name")) = 'chess';
UPDATE "Match" m SET "scoringMode" = s."scoringMode" FROM "Tournament" t JOIN "Sport" s ON s.id = t."sportId" WHERE m."tournamentId" = t.id AND s."scoringMode" = 'RESULT_ONLY' AND m.status IN ('SCHEDULED','READY','RESCHEDULED');
