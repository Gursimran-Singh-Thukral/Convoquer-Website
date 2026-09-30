-- Convoquer'26 records final results only (live scoring was cancelled) and
-- Weight Lifting was cancelled.
ALTER TABLE "Sport" ALTER COLUMN "scoringMode" SET DEFAULT 'RESULT_ONLY';
ALTER TABLE "Match" ALTER COLUMN "scoringMode" SET DEFAULT 'RESULT_ONLY';
UPDATE "Sport" SET "scoringMode" = 'RESULT_ONLY';
UPDATE "Match" SET "scoringMode" = 'RESULT_ONLY'
  WHERE status IN ('SCHEDULED','READY','RESCHEDULED');
-- Cascades to the sport's teams and team memberships; participants are kept.
DELETE FROM "Sport" WHERE lower(trim("name")) IN ('weight lifting', 'weightlifting');
