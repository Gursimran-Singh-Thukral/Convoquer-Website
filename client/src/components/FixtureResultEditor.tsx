'use client';
import Link from 'next/link';
import type { Match } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ResultEntryForm } from '@/components/results/ResultEntryForm';
import { ResultScorecard } from '@/components/results/ResultScorecard';
import { isResultDetails } from '@/lib/resultFormat';

/**
 * Final-result entry for one fixture. Convoquer'26 has no live scoring: the
 * respective Sports Coordinator records the final scorecard once the match is
 * over, an approver publishes it, and only then do standings and brackets move.
 */
export function FixtureResultEditor({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const { hasPermission } = useAuth();
  const recorded = match.status === 'COMPLETED' && isResultDetails(match.scoreDetails);
  return (
    <section className="space-y-5">
      {recorded && (
        <div className="space-y-2">
          <h4 className="font-bold">Recorded result</h4>
          <ResultScorecard
            details={match.scoreDetails}
            teamA={match.teamA}
            teamB={match.teamB}
            scoreA={match.teamAScore}
            scoreB={match.teamBScore}
            winnerTeamId={match.winnerTeamId}
            stageName={match.stage?.name}
          />
        </div>
      )}
      {hasPermission('result.submit') &&
        !['CANCELLED', 'ABANDONED', 'BYE'].includes(match.status) && (
          <ResultEntryForm match={match} onSaved={onSaved} />
        )}
      <Link href="/results/approvals" className="underline text-[#FFD700]">
        Result approvals
      </Link>
    </section>
  );
}
