import { EvalResultCard } from './EvalResultCard';
import type { LiveResult } from '../../hooks/useEvalRunStream';

interface LiveResultsSectionProps {
  results: LiveResult[];
  running: boolean;
  recentlyCompleted: Set<string>;
}

export function LiveResultsSection({ results, running, recentlyCompleted }: LiveResultsSectionProps) {
  if (results.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-gray-400 uppercase tracking-wide">
        Current run
        {running && (
          <span className="flex items-center gap-1.5 text-xs normal-case font-normal text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Running
          </span>
        )}
      </h2>
      {results.map((r) => (
        <EvalResultCard
          key={r.caseId}
          caseId={r.caseId}
          caseName={r.caseName}
          status={r.status}
          score={r.score}
          reasoning={r.reasoning}
          rawResponse={r.rawResponse}
          latencyMs={r.latencyMs}
          pipelineTrace={r.pipelineTrace}
          failureStep={r.failureStep}
          errorDetail={r.errorDetail}
          isNew={recentlyCompleted.has(r.caseId)}
          agentModel={r.agentModel}
          agentProviderName={r.agentProviderName}
          agentEndpointUrl={r.agentEndpointUrl}
          judgeModel={r.judgeModel}
          judgeProviderName={r.judgeProviderName}
          currentStep={r.currentStep}
        />
      ))}
    </section>
  );
}
