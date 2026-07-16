import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { ScaffoldStreamEvent, ToolDefinition } from '@proveit/shared';
import { ScaffoldProgress, type StepStatus } from '../components/poc/ScaffoldProgress';
import { TriviaCard } from '../components/poc/TriviaCard';
import { api } from '../services/api';

interface ScaffoldLocationState {
  description: string;
  endpointUrl?: string;
  apiKey?: string;
  model?: string;
  globalProviderId?: string;
}

const INITIAL_STEPS: StepStatus[] = [
  { id: 'system-prompt', label: 'Generating system prompt', state: 'in-progress' },
  { id: 'tools', label: 'Generating tools', state: 'waiting' },
  { id: 'eval-cases', label: 'Generating eval cases', state: 'waiting' },
  { id: 'saving', label: 'Saving configuration', state: 'waiting' },
];

export function ScaffoldingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const rawState = location.state as ScaffoldLocationState | null;
  const locationState: ScaffoldLocationState | null = rawState ?? (() => {
    const saved = jobId ? sessionStorage.getItem(`scaffold_${jobId}`) : null;
    return saved ? JSON.parse(saved) as ScaffoldLocationState : null;
  })();

  const [steps, setSteps] = useState<StepStatus[]>(INITIAL_STEPS.map(s => ({ ...s })));
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewSystemPrompt, setPreviewSystemPrompt] = useState<string | null>(null);
  const [previewTools, setPreviewTools] = useState<ToolDefinition[] | null>(null);
  const [previewEvalCases, setPreviewEvalCases] = useState<Array<{ name: string; judgeCriteria: string }> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readyPocId, setReadyPocId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);

  function openStream(id: string) {
    if (esRef.current) esRef.current.close();
    doneRef.current = false;
    const es = new EventSource(`/api/pocs/scaffold/stream/${id}`);
    esRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as ScaffoldStreamEvent;

      if (event.type === 'step-start') {
        // no-op: step-complete already marks the next step in-progress optimistically
      } else if (event.type === 'step-complete') {
        setSteps(prev => {
          const idx = prev.findIndex(s => s.id === event.step);
          return prev.map((s, i) => {
            if (s.id === event.step) return { ...s, state: 'complete' };
            if (i === idx + 1 && s.state === 'waiting') return { ...s, state: 'in-progress' };
            return s;
          });
        });
        if (event.content?.type === 'system-prompt') {
          if (event.content.name) setPreviewName(event.content.name);
          if (event.content.systemPrompt) setPreviewSystemPrompt(event.content.systemPrompt);
        } else if (event.content?.type === 'tools' && event.content.tools) {
          setPreviewTools(event.content.tools);
        } else if (event.content?.type === 'eval-cases' && event.content.evalCases) {
          setPreviewEvalCases(event.content.evalCases.map(c => ({ name: c.name, judgeCriteria: c.judgeCriteria })));
        }
      } else if (event.type === 'done') {
        doneRef.current = true;
        es.close();
        setSteps(prev => prev.map(s => s.state !== 'error' ? { ...s, state: 'complete' } : s));
        setReadyPocId(event.pocId);
      } else if (event.type === 'error') {
        setSteps(prev => prev.map(s => s.id === event.step ? { ...s, state: 'error' } : s));
        setErrorMessage(event.message);
        es.close();
      }
    };

    es.onerror = () => {
      if (doneRef.current) { es.close(); return; }
      es.close();
      // Before showing an error, check if the job already completed (e.g. page was refreshed)
      api.get<{ pocId: string | null }>(`/pocs/scaffold/completed/${id}`)
        .then(({ pocId }) => {
          if (pocId) {
            setReadyPocId(pocId);
          } else {
            setSteps(prev => {
              const inProgress = prev.find(s => s.state === 'in-progress');
              if (!inProgress) return prev;
              return prev.map(s => s.id === inProgress.id ? { ...s, state: 'error' } : s);
            });
            setErrorMessage('Connection to server lost. Please retry.');
          }
        })
        .catch(() => {
          setSteps(prev => {
            const inProgress = prev.find(s => s.state === 'in-progress');
            if (!inProgress) return prev;
            return prev.map(s => s.id === inProgress.id ? { ...s, state: 'error' } : s);
          });
          setErrorMessage('Connection to server lost. Please retry.');
        });
    };
  }

  useEffect(() => {
    if (!jobId) return;
    if (locationState) {
      // Never persist the API key — sessionStorage survives refreshes and is
      // readable by anything running on this origin. Retry after a refresh
      // proceeds without the key (fine for local endpoints).
      const { apiKey: _apiKey, ...persistable } = locationState;
      sessionStorage.setItem(`scaffold_${jobId}`, JSON.stringify(persistable));
    }
    openStream(jobId);
    return () => esRef.current?.close();
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRetry() {
    if (!locationState) return;
    try {
      const { jobId: newJobId } = await api.post<{ jobId: string }>('/pocs/scaffold', {
        description: locationState.description,
        endpointUrl: locationState.endpointUrl,
        apiKey: locationState.apiKey,
        model: locationState.model,
        globalProviderId: locationState.globalProviderId,
      });
      setSteps(INITIAL_STEPS.map(s => ({ ...s })));
      setPreviewName(null);
      setPreviewSystemPrompt(null);
      setPreviewTools(null);
      setPreviewEvalCases(null);
      setErrorMessage(null);
      setReadyPocId(null);
      navigate(`/scaffold/${newJobId}`, { state: locationState, replace: true });
    } catch {
      setErrorMessage('Could not start a new generation. Please go back and try again.');
    }
  }

  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-white">While we build your POC…</h1>
          {locationState?.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{locationState.description}</p>
          )}
        </div>

        {readyPocId && (
          <div
            className="rounded-2xl border border-green-500/30 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,16,16,0) 60%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-green-300">Your POC is ready!</p>
                <p className="text-xs text-gray-500 mt-0.5">Keep playing or head over whenever you're ready.</p>
              </div>
              <button
                onClick={() => {
                if (jobId) sessionStorage.removeItem(`scaffold_${jobId}`);
                navigate(`/poc/${readyPocId}`);
              }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-300 text-sm font-semibold hover:bg-green-500/25 transition-colors whitespace-nowrap"
              >
                Take me there
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <TriviaCard active={!errorMessage} />

        <ScaffoldProgress
          steps={steps}
          previewName={previewName}
          previewSystemPrompt={previewSystemPrompt}
          previewTools={previewTools}
          previewEvalCases={previewEvalCases}
          errorMessage={errorMessage}
          onRetry={locationState ? handleRetry : undefined}
        />
      </div>
    </div>
  );
}
