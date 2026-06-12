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
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  createdAt: string;
}

export interface RunMetrics {
  accuracy: number | null;
  avgLatencyMs: number | null;
  avgPromptTokens: number | null;
  avgCompletionTokens: number | null;
  avgTotalTokens: number | null;
  tokensPerSecond: number | null;
  efficiencyScore: number | null;
}

export interface PocConfigVersionSummary {
  id: string;
  versionNumber: number;
  changeLabel: string;
  createdAt: string;
}

export interface PocConfigVersion extends PocConfigVersionSummary {
  systemPrompt: string;
  tools: string;
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
  configVersionId?: string | null;
  snapshotConfigVersionNumber?: number | null;
  snapshotSystemPrompt?: string | null;
  snapshotModel: string;
  snapshotEndpointUrl: string;
  snapshotJudgeModel: string;
  snapshotJudgeProviderName: string;
  metrics?: RunMetrics | null;
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
  runAMetrics: RunMetrics;
  runBMetrics: RunMetrics;
  cases: RunComparisonCase[];
}

export interface LlmConnection {
  id: string;
  pocConfigId?: string;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
}

export interface LlmProvider {
  id: string;
  pocConfigId?: string;
  isGlobal?: boolean;
  name: string;
  isDefault: boolean;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
  availableModels?: string[];
  hasApiKey?: boolean;
  apiKeyHint?: string;
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

// Scaffold SSE event types
export type ScaffoldStep = 'system-prompt' | 'tools' | 'eval-cases' | 'saving';

export interface ScaffoldStepStartEvent {
  type: 'step-start';
  step: ScaffoldStep;
  index: number;
  total: number;
}

export interface ScaffoldContentPayload {
  type: 'system-prompt' | 'tools' | 'eval-cases';
  name?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  evalCases?: Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }>;
}

export interface ScaffoldStepCompleteEvent {
  type: 'step-complete';
  step: ScaffoldStep;
  content?: ScaffoldContentPayload;
}

export interface ScaffoldDoneEvent {
  type: 'done';
  pocId: string;
}

export interface ScaffoldErrorEvent {
  type: 'error';
  step: ScaffoldStep;
  message: string;
}

export type ScaffoldStreamEvent =
  | ScaffoldStepStartEvent
  | ScaffoldStepCompleteEvent
  | ScaffoldDoneEvent
  | ScaffoldErrorEvent;

export interface ScaffoldJobResponse {
  jobId: string;
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

// Chat types
export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatStreamTextDelta {
  type: 'text-delta';
  delta: string;
}

export interface ChatStreamReasoningDelta {
  type: 'reasoning-delta';
  delta: string;
}

export interface ChatStreamToolCallStart {
  type: 'tool-call-start';
  toolCallId: string;
  toolName: string;
}

export interface ChatStreamToolCallArgsDelta {
  type: 'tool-call-args-delta';
  toolCallId: string;
  argsDelta: string;
}

export interface ChatStreamToolCallResult {
  type: 'tool-call-result';
  toolCallId: string;
  result: string;
}

export interface ChatStreamDone {
  type: 'done';
}

export interface ChatStreamError {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamTextDelta
  | ChatStreamReasoningDelta
  | ChatStreamToolCallStart
  | ChatStreamToolCallArgsDelta
  | ChatStreamToolCallResult
  | ChatStreamDone
  | ChatStreamError;
