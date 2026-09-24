ALTER TABLE "Volunteer" ADD COLUMN "userId" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "departments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Volunteer" SET "departments" = ARRAY["department"] WHERE cardinality("departments") = 0;
CREATE UNIQUE INDEX "Volunteer_userId_key" ON "Volunteer"("userId");
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Participant" ADD COLUMN "currentVenueId" TEXT;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_currentVenueId_fkey" FOREIGN KEY ("currentVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GateMovement" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "venueId" TEXT,
  "direction" TEXT NOT NULL,
  "recordedBy" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GateMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GateMovement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GateMovement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GateMovement_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GateMovement_direction_check" CHECK ("direction" IN ('ENTRY', 'EXIT'))
);
CREATE INDEX "GateMovement_participantId_recordedAt_idx" ON "GateMovement"("participantId", "recordedAt");
CREATE INDEX "GateMovement_venueId_recordedAt_idx" ON "GateMovement"("venueId", "recordedAt");

INSERT INTO "Permission" ("id", "action", "description", "createdAt") VALUES
  (gen_random_uuid()::text, 'task.view', 'View operations tasks within assigned departments', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'task.create', 'Assign operations tasks within assigned departments', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'task.update', 'Update assigned operations tasks', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'security.access', 'Use security entry and exit controls', CURRENT_TIMESTAMP)
ON CONFLICT ("action") DO NOTHING;

INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'SECURITY_VOLUNTEER', 'Security volunteer with gate entry and exit access', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r CROSS JOIN "Permission" p
WHERE (r."name" IN ('CONVENER', 'CO_CONVENER') AND p."action" IN ('task.view', 'task.create', 'task.update'))
   OR (r."name" IN ('OVERALL_SPORTS_COORDINATOR', 'SPORTS_COORDINATOR', 'MEDIA_HEAD', 'HOSPITALITY_HEAD', 'SECURITY_HEAD', 'WEB_DEV_HEAD') AND p."action" IN ('task.view', 'task.create', 'task.update'))
   OR (r."name" IN ('VOLUNTEER', 'SECURITY_VOLUNTEER') AND p."action" IN ('task.view', 'task.update'))
   OR (r."name" IN ('SECURITY_HEAD', 'SECURITY_VOLUNTEER') AND p."action" = 'security.access')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" = 'SECURITY_VOLUNTEER' AND p."action" IN ('participant.view', 'participant.update', 'venue.view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
