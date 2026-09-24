INSERT INTO "Permission" ("id", "action", "description") VALUES
  (gen_random_uuid()::text, 'event.create', 'Create championship events'),
  (gen_random_uuid()::text, 'event.update', 'Edit and archive championship events'),
  (gen_random_uuid()::text, 'event.delete', 'Delete empty championship events')
ON CONFLICT ("action") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('CONVENER', 'CO_CONVENER')
  AND p."action" IN ('event.create', 'event.update', 'event.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
