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
  await resolveBye(tx, next.id);
}

/** A published result saying "neither team turned up". */
export const isCancelledResult = (
  result: { status: string; scoreDetails: unknown } | null | undefined,
) =>
  result?.status === 'PUBLISHED' &&
  (result.scoreDetails as { kind?: string; forfeitedBy?: string } | null)
    ?.kind === 'FORFEIT' &&
  (result.scoreDetails as { forfeitedBy?: string }).forfeitedBy === 'BOTH';

/**
 * A knockout match whose only possible opponent never played (the match that
 * feeds the other slot was cancelled because neither team turned up) is a BYE:
 * the team that is there goes through, recorded as a published walkover, and is
 * moved on to the following round (which may in turn be a bye).
 *
 * Called whenever a team lands in a match and whenever a match is cancelled.
 */
export async function resolveBye(
  tx: Prisma.TransactionClient,
  matchId: string,
): Promise<void> {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: { result: true, previousMatches: { include: { result: true } } },
  });
  if (!match || match.result) return;
  if (!['SCHEDULED', 'READY', 'RESCHEDULED'].includes(match.status)) return;
  const present = [match.teamAId, match.teamBId].filter(Boolean);
  if (present.length !== 1) return;
  const emptySlot = match.teamAId ? 'B' : 'A';
  const feeders = match.previousMatches.filter(
    (m) => m.nextMatchSlot === emptySlot,
  );
  if (!feeders.length || !feeders.every((m) => isCancelledResult(m.result)))
    return;
  const winnerId = present[0]!;
  const now = new Date();
  await tx.result.create({
    data: {
      matchId,
      status: 'PUBLISHED',
      finalScoreA: 0,
      finalScoreB: 0,
      winnerTeamId: winnerId,
      scoreDetails: { kind: 'FORFEIT', forfeitedBy: 'BYE' },
      notes: 'Bye — the opposing match was cancelled (neither team played)',
      submittedAt: now,
      approvedAt: now,
      publishedAt: now,
    },
  });
  await tx.match.update({
    where: { id: matchId },
    data: {
      status: 'COMPLETED',
      winnerTeamId: winnerId,
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: { kind: 'FORFEIT', forfeitedBy: 'BYE' },
    },
  });
  if (match.nextMatchId) await advanceBracket(tx, matchId, winnerId);
}
