ALTER TABLE "Match" ADD COLUMN "scoringMode" TEXT NOT NULL DEFAULT 'LIVE';
ALTER TABLE "Venue" ADD COLUMN "latitude" DOUBLE PRECISION, ADD COLUMN "longitude" DOUBLE PRECISION, ADD COLUMN "simultaneousMatches" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Match" ADD CONSTRAINT "Match_scoringMode_check" CHECK ("scoringMode" IN ('LIVE', 'RESULT_ONLY'));
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_capacity_check" CHECK ("simultaneousMatches" BETWEEN 1 AND 64), ADD CONSTRAINT "Venue_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));
