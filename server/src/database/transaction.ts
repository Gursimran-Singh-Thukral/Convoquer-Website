import type { PrismaService } from './prisma.service.js';
import type { RealtimeService } from '../modules/realtime/realtime.service.js';

/** Lock a match while mutating its event history, result and audit trail.
 * Broadcasts are delayed until COMMIT, so subscribers never see rolled-back data.
 */
export async function matchTransaction<T>(
  prisma: PrismaService,
  matchId: string,
  realtime: RealtimeService | undefined,
  work: (tx: PrismaService, deferred?: RealtimeService) => Promise<T>,
): Promise<T> {
  const events: Array<() => void> = [];
  const deferred =
    realtime &&
    new Proxy(realtime, {
      get(target, key) {
        const value = Reflect.get(target, key);
        return typeof value === 'function'
          ? (...args: unknown[]) => {
              events.push(() => value.apply(target, args));
            }
          : value;
      },
    });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
    return work(tx as unknown as PrismaService, deferred);
  });
  for (const emit of events) emit();
  return result;
}
