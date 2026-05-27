export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mockResponse?: string;
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
export type FailureStep = 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response';

export interface ToolCallStep {
  id: string;
  name: string;
  arguments: string;
}

export type PipelineStep =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCallStep[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

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
  runNumber: number;
  evalSuiteVersionId?: string | null;
  evalSuiteVersionNumber?: number | null;
  snapshotModel: string;
  snapshotEndpointUrl: string;
  snapshotJudgeModel: string;
  snapshotJudgeProviderName: string;
}

export interface EvalResultDetail {
  caseId: string;
  caseName: string;
  status: EvalResultStatus;
  score: number | null;
  reasoning: string | null;
  rawResponse: string | null;
  latencyMs: number | null;
  pipelineTrace: PipelineStep[] | null;
  errorDetail: string | null;
  failureStep: FailureStep | null;
}

export interface EvalRunDetail extends EvalRun {
  snapshotSystemPrompt: string;
  results: EvalResultDetail[];
}

export interface EvalSuiteVersionSummary {
  id: string;
  versionNumber: number;
  casesSnapshot: EvalCaseSnapshot[];
  createdAt: string;
  runCount: number;
}

export interface EvalCaseSnapshot {
  id: string;
  name: string;
  input: string;
  judgeCriteria: string;
  order: number;
}

export interface RunComparisonCase {
  caseId: string;
  caseName: string;
  runAStatus: EvalResultStatus | 'not_executed';
  runBStatus: EvalResultStatus | 'not_executed';
  change: 'improved' | 'regressed' | 'both_passed' | 'both_failed';
}

export interface CompareRunsResponse {
  runA: EvalRun;
  runB: EvalRun;
  cases: RunComparisonCase[];
}

export interface LlmConnection {
  id: string;
  pocConfigId: string;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
}

export interface LlmProvider {
  id: string;
  pocConfigId: string;
  name: string;
  isDefault: boolean;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
  availableModels?: string[];
}

export type TaskType = 'agent' | 'judge' | 'eval-gen' | 'stub-gen';

export interface TaskModelOverride {
  taskType: TaskType;
  connectionId: string;
  providerName: string;
  model: string;
}

export interface LlmRoutingConfig {
  providers: LlmProvider[];
  overrides: TaskModelOverride[];
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
  caseName: string;
  status: EvalResultStatus;
  score: number | null;
  reasoning: string | null;
  rawResponse: string | null;
  latencyMs: number | null;
  pipelineTrace: PipelineStep[] | null;
  failureStep: FailureStep | null;
  errorDetail: string | null;
  agentModel: string;
  agentProviderName: string;
  agentEndpointUrl: string;
  judgeModel: string | null;
  judgeProviderName: string | null;
}

export interface EvalStepUpdateEvent {
  caseId: string;
  step: 'agent' | 'judge';
  model: string;
  providerName: string;
  endpointUrl?: string;
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
