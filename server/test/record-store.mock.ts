import { vi } from 'vitest';

/** Minimal repository double; production services must receive a database. */
export function recordStore(fixtures: Record<string, any>[]) {
  let rows = structuredClone(fixtures);
  const find = (where: any) =>
    rows.find((row) =>
      where.OR
        ? where.OR.some((part: any) =>
            Object.entries(part).every(([key, value]) => row[key] === value),
          )
        : Object.entries(where).every(([key, value]) => row[key] === value),
    );
  return {
    findMany: vi.fn(async () => rows),
    findUnique: vi.fn(async ({ where }) => find(where) ?? null),
    findFirst: vi.fn(async ({ where }) => find(where) ?? null),
    count: vi.fn(async () => rows.length),
    create: vi.fn(async ({ data }) => {
      rows.push(data);
      return data;
    }),
    update: vi.fn(async ({ where, data }) => {
      const item = find(where);
      Object.assign(item, data);
      return item;
    }),
    delete: vi.fn(async ({ where }) => {
      const item = find(where);
      rows = rows.filter((row) => row !== item);
      return item;
    }),
  };
}
