import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Called inside the same transaction that publishes the official result. */
export async function advanceBracket(
  tx: Prisma.TransactionClient,
  matchId: string,
  winnerId: string | null,
) {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
  if (!match.nextMatchId) return;
  if (!winnerId)
    throw new BadRequestException(
      'A knockout match needs a winner before publication',
    );
  await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${match.nextMatchId} FOR UPDATE`;
  const next = await tx.match.findUniqueOrThrow({
    where: { id: match.nextMatchId },
  });
  if (!['SCHEDULED', 'READY', 'RESCHEDULED'].includes(next.status)) {
    throw new ConflictException('The next bracket match has already started');
  }
  const field = match.nextMatchSlot === 'A' ? 'teamAId' : 'teamBId';
  if (next[field] && next[field] !== winnerId)
    throw new ConflictException('The next bracket slot is already occupied');
  await tx.match.update({
    where: { id: next.id },
    data: { [field]: winnerId },
  });
}
