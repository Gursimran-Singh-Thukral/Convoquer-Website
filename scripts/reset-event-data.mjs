import { config } from 'dotenv';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Explicit destructive command; first creates a PostgreSQL archive outside public assets.
if (!process.argv.includes('--confirm-reset'))
  throw new Error('Pass --confirm-reset to erase event data after backup');
config({ path: 'server/.env', quiet: true });
const url = new URL(process.env.DATABASE_URL);
const directory = path.resolve('.tmp/database-backups');
await mkdir(directory, { recursive: true });
const backup = path.join(directory, `before-reset-${Date.now()}.dump`);
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
};
if (url.searchParams.has('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
const executable = process.env.PG_DUMP_PATH || 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe';
const dump = spawnSync(
  executable,
  ['--format=custom', '--file', backup, '--no-owner', '--no-acl'],
  { env, windowsHide: true, encoding: 'utf8' },
);
if (dump.status !== 0)
  throw new Error(
    `Backup failed (exit ${dump.status}); database was not changed. ${dump.error?.code || ''}`,
  );
if ((await stat(backup)).size < 100) throw new Error('Backup is empty; refusing reset');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = await pool.connect();
try {
  await db.query('BEGIN');
  const { rows } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'Role', 'Permission', 'RolePermission')`,
  );
  const tables = rows.map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`);
  const counts = {};
  for (let i = 0; i < tables.length; i++)
    counts[rows[i].tablename] = Number(
      (await db.query(`SELECT count(*) AS n FROM ${tables[i]}`)).rows[0].n,
    );
  if (tables.length) await db.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY`);
  await db.query('COMMIT');
  const report = {
    resetAt: new Date().toISOString(),
    backup,
    tablesCleared: counts,
    retained: ['Role', 'Permission', 'RolePermission', '_prisma_migrations'],
  };
  await mkdir('reports/tournament-rehearsal', { recursive: true });
  await writeFile(
    'reports/tournament-rehearsal/database-reset.json',
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Backup saved. Cleared ${tables.length} tables; retained access-control definitions and migration history.`,
  );
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  db.release();
  await pool.end();
}
