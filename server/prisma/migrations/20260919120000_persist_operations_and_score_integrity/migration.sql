-- Persist organizer content. Existing in-memory data cannot be recovered after restart.

CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'OFFICIAL_PARTNER',
    "color" TEXT NOT NULL DEFAULT 'text-[#FFD700]',
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "volunteerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactNumber" TEXT,
    "department" TEXT NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'MORNING',
    "venueId" TEXT,
    "venueName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Volunteer_volunteerCode_key" ON "Volunteer"("volunteerCode");

CREATE TABLE "OperationsTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "volunteerId" TEXT,
    "volunteerName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'STANDBY',
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationsTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targets" TEXT[] NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "aspect" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "logoUrl" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScoreEvent" ADD COLUMN "requestId" TEXT;

-- Fail on historical duplicate sequence numbers rather than silently rewriting score history.

DROP INDEX "ScoreEvent_matchId_sequenceNumber_idx";

CREATE UNIQUE INDEX "ScoreEvent_matchId_sequenceNumber_key" ON "ScoreEvent"("matchId", "sequenceNumber");

CREATE UNIQUE INDEX "ScoreEvent_matchId_requestId_key" ON "ScoreEvent"("matchId", "requestId");
