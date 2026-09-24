-- A volunteer belongs to exactly one department now (it doubles as their
-- ground-level role scope). `department` already held the primary value for
-- every existing row, so no data needs to move before dropping the array.
ALTER TABLE "Volunteer" DROP COLUMN "departments";
