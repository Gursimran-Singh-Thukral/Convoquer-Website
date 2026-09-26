-- The 20260921210000 migration directly INSERTed the 'SECURITY_VOLUNTEER'
-- role via raw SQL. That role (along with 'HOSPITALITY_HEAD'/'SECURITY_HEAD',
-- never present as literal INSERTs but referenced there too) was superseded
-- this session by the merged HOSPITALITY_SECURITY_HEAD/VOLUNTEER roles now
-- created by prisma/seed.ts. Cascades clean up RolePermission/UserRole rows.
DELETE FROM "Role" WHERE "name" IN ('SECURITY_VOLUNTEER', 'SECURITY_HEAD', 'HOSPITALITY_HEAD');
