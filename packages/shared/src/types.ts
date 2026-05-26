export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface EvalCaseInput {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  context?: Record<string, unknown>;
}

export interface PocConfigSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PocConfig extends PocConfigSummary {
  systemPrompt: string;
  tools: ToolDefinition[];
  metadata: Record<string, unknown>;
  evalCases: EvalCase[];
  llmConnection?: LlmConnection;
}

export interface EvalCase {
  id: string;
  pocConfigId: string;
  name: string;
  input: EvalCaseInput;
  judgeCriteria: string;
  order: number;
  createdAt: string;
}

export type EvalResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'errored';
export type EvalRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface EvalResult {
  id: string;
  evalCaseId: string;
  runId: string;
  status: EvalResultStatus;
  score?: number;
  reasoning?: string;
  rawResponse?: string;
  latencyMs?: number;
  createdAt: string;
}

export interface EvalRun {
  id: string;
  pocConfigId: string;
  status: EvalRunStatus;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  startedAt: string;
  completedAt?: string;
}

export interface EvalRunDetail extends EvalRun {
  results: Array<EvalResult & { caseName: string }>;
}

export interface LlmConnection {
  id: string;
  pocConfigId: string;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
}

export interface LlmConnectionTestResult {
  status: 'connected' | 'failed';
  models?: string[];
  latencyMs?: number;
  error?: string;
}

// SSE event payloads
export interface EvalCaseStartEvent {
  caseId: string;
  name: string;
}

export interface EvalCaseCompleteEvent {
  caseId: string;
  status: EvalResultStatus;
  score: number;
  reasoning: string;
  latencyMs: number;
}

export interface EvalRunCompleteEvent {
  runId: string;
  passed: number;
  failed: number;
  total: number;
}

export interface EvalErrorEvent {
  caseId: string;
  error: string;
}
