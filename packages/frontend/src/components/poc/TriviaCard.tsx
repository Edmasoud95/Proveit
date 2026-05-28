import { useEffect, useRef, useState } from 'react';

interface Q {
  q: string;
  a: boolean;
  explain: string;
}

const BANK: Q[] = [
  {
    q: 'Giving an LLM concrete output examples before the real task is called "few-shot prompting."',
    a: true,
    explain: 'Few-shot prompting embeds 2–5 input→output demonstrations in the prompt so the model learns the expected pattern before your real request.',
  },
  {
    q: 'Higher temperature makes LLM outputs more predictable and consistent.',
    a: false,
    explain: 'Higher temperature increases randomness and creativity. Use temperature 0 when you need deterministic, reproducible outputs.',
  },
  {
    q: 'LLM-as-judge evaluations can score thousands of test cases per hour without human effort.',
    a: true,
    explain: 'LLM judges scale automatically. A human review of thousands of cases would take days; an LLM judge can do it in minutes.',
  },
  {
    q: 'System prompts are ignored by the model when few-shot examples are present.',
    a: false,
    explain: 'System prompts are always processed. Few-shot examples complement the system prompt — they don\'t replace it.',
  },
  {
    q: 'Chain-of-thought prompting asks the model to show its reasoning before giving a final answer.',
    a: true,
    explain: '"Think step by step" instructions encourage the model to reason through a problem, which significantly improves accuracy on complex tasks.',
  },
  {
    q: 'Eval cases should test only the happy path to keep results clean and consistent.',
    a: false,
    explain: 'Good eval suites cover edge cases, adversarial inputs, and failure modes. Happy-path-only evals give false confidence.',
  },
  {
    q: 'An LLM agent can invoke multiple tools in a single response turn.',
    a: true,
    explain: 'Modern LLMs support parallel tool calls in one turn, letting agents batch independent operations and complete tasks faster.',
  },
  {
    q: 'The order of instructions in a system prompt has no meaningful effect on model behavior.',
    a: false,
    explain: 'Order matters — most models pay more attention to instructions near the beginning and end of the prompt. Critical rules go first.',
  },
  {
    q: 'A good eval criterion should be specific enough that two independent judges would reach the same verdict.',
    a: true,
    explain: 'Inter-rater agreement is a gold standard for eval quality. Vague criteria like "sounds good" produce inconsistent, useless scores.',
  },
  {
    q: 'Adding more tools to an agent always increases its capability and task success rate.',
    a: false,
    explain: 'Tool overload confuses models. Too many choices raise the chance the model picks the wrong one or invokes tools unnecessarily.',
  },
  {
    q: 'Mock tool responses let you test an agent\'s reasoning logic without making real API calls.',
    a: true,
    explain: 'This is exactly how Proveit works — stub out tool responses so you can verify call sequences and decision logic without a live backend.',
  },
  {
    q: 'Prompt engineering is a one-time task. Once a prompt is optimized it rarely needs to change.',
    a: false,
    explain: 'Model updates, new edge cases, and distributional shift all require prompt iteration. Prompts need ongoing maintenance like code does.',
  },
  {
    q: 'Smaller, specialized models often outperform large general models on narrow, well-defined tasks.',
    a: true,
    explain: 'A fine-tuned 7B model can beat GPT-4 on specific domains. Choosing the right model for the job matters as much as prompt quality.',
  },
  {
    q: 'The system prompt is re-sent to the LLM with every single API request.',
    a: true,
    explain: 'LLMs are stateless — there\'s no memory across API calls. The system prompt must be included every time to establish context.',
  },
  {
    q: 'RAG (retrieval-augmented generation) helps reduce LLM hallucinations on factual queries.',
    a: true,
    explain: 'By grounding the model in retrieved documents, RAG gives it accurate facts to cite instead of generating plausible-but-wrong answers.',
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'idle' | 'correct' | 'wrong' | 'skipped';

export function TriviaCard({ active }: { active: boolean }) {
  const [questions] = useState(() => shuffle(BANK));
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [visible, setVisible] = useState(true);
  const [bonusKey, setBonusKey] = useState(0);
  const [showBonus, setShowBonus] = useState(false);
  const timerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const pickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[step % questions.length];
  const qNum = (step % questions.length) + 1;

  function resetTimerBar() {
    const el = timerRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.width = '100%';
    void el.offsetWidth;
    el.style.transition = 'width 15s linear';
    el.style.width = '0%';
  }

  function advance() {
    setVisible(false);
    setTimeout(() => {
      setStep(s => s + 1);
      phaseRef.current = 'idle';
      setPhase('idle');
      setVisible(true);
    }, 280);
  }

  function pick(choice: boolean) {
    if (phaseRef.current !== 'idle') return;
    const correct = choice === q.a;
    const next: Phase = correct ? 'correct' : 'wrong';
    phaseRef.current = next;
    setPhase(next);
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    if (correct) {
      setBonusKey(k => k + 1);
      setShowBonus(true);
      setTimeout(() => setShowBonus(false), 800);
    }
    pickTimerRef.current = setTimeout(advance, 4500);
  }

  function handleNext() {
    if (pickTimerRef.current) {
      clearTimeout(pickTimerRef.current);
      pickTimerRef.current = null;
    }
    advance();
  }

  useEffect(() => {
    if (!active) return;
    phaseRef.current = 'idle';
    setPhase('idle');
    setVisible(true);
    resetTimerBar();
    const t = setTimeout(() => {
      if (phaseRef.current !== 'idle') return;
      phaseRef.current = 'skipped';
      setPhase('skipped');
      setTimeout(advance, 450);
    }, 15000);
    return () => clearTimeout(t);
  }, [step, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  const revealed = phase === 'correct' || phase === 'wrong';

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1e1b2e 0%, #1a1a1a 60%)',
        boxShadow: '0 0 40px rgba(124,106,255,0.07), 0 2px 8px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
        transition: 'opacity 0.28s ease, transform 0.28s ease',
      }}
    >
      {/* Timer — top border of the card */}
      <div className="h-[2px] w-full bg-white/[0.05] overflow-hidden">
        <div
          ref={timerRef}
          className="h-full"
          style={{ width: '100%', background: 'linear-gradient(90deg, #7c6aff, #a78bfa)' }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent/70">
          Did you know?
        </span>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-[11px] text-gray-500">
              Score <span className="text-white font-semibold tabular-nums">{score.correct * 10}</span>
            </span>
            {showBonus && (
              <span
                key={bonusKey}
                className="absolute -top-4 right-0 text-[11px] font-bold text-green-400 pointer-events-none"
                style={{ animation: 'float-up 0.8s ease-out forwards' }}
              >
                +10
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-600 tabular-nums">{qNum} / {questions.length}</span>
        </div>
      </div>

      {/* Question */}
      <p className="px-5 pt-3 pb-5 text-[15px] font-medium text-gray-100 leading-[1.6]">
        {q.q}
      </p>

      {/* Buttons */}
      {!revealed ? (
        <div className="flex gap-3 px-5 pb-5">
          {([true, false] as const).map(v => (
            <button
              key={String(v)}
              onClick={() => pick(v)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300
                         border border-white/[0.08] bg-white/[0.04]
                         hover:border-accent/50 hover:bg-accent/10 hover:text-white
                         active:scale-95 transition-all duration-150"
            >
              {v ? 'True' : 'False'}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5 pb-5 flex flex-col gap-4">
          {/* Result banner */}
          <div
            className={`rounded-xl px-5 py-4 border ${
              phase === 'correct'
                ? 'bg-green-500/[0.10] border-green-500/25'
                : 'bg-red-500/[0.10] border-red-500/25'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xl leading-none ${phase === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {phase === 'correct' ? '✓' : '✗'}
              </span>
              <span className={`text-base font-bold ${phase === 'correct' ? 'text-green-300' : 'text-red-300'}`}>
                {phase === 'correct' ? 'Correct!' : `Wrong — the answer is ${q.a ? 'True' : 'False'}`}
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{q.explain}</p>
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-300
                         border border-white/[0.08] bg-white/[0.04]
                         hover:border-accent/50 hover:bg-accent/10 hover:text-white
                         active:scale-95 transition-all duration-150"
            >
              Next question
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
