import { Bot, CheckCircle2, Circle, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ProjectEvent, ProjectMessage } from '../lib/ppt-api';

export interface AgentStepProgress {
  current?: number;
  total?: number;
  label?: string;
}

export interface AgentStepState {
  step_code: string;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  reason?: string;
  result?: Record<string, unknown>;
  error_message?: string;
  progress?: AgentStepProgress;
}

export interface AgentRecommendation {
  code: string;
  label: string;
  reason: string;
}

export interface AgentRunView {
  agent_run_id: string;
  title: string;
  origin?: string;
  stage?: string;
  scope_type?: string;
  target_page_id?: string | null;
  source_message_id?: string | null;
  started_at?: string;
  router_decision?: Record<string, unknown> | null;
  step_results: AgentStepState[];
  next_recommendations: AgentRecommendation[];
  content_md?: string;
  live?: boolean;
  run_status?: 'running' | 'completed' | 'failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStepPayload(
  payload: Record<string, unknown>,
  fallbackStatus: AgentStepState['status'],
): AgentStepState | null {
  const stepCode = String(payload.step_code ?? '').trim();
  if (!stepCode) {
    return null;
  }
  const stepName = String(payload.step_name ?? stepCode).trim();
  const status = String(payload.status ?? fallbackStatus).trim();
  return {
    step_code: stepCode,
    step_name: stepName,
    status: (status || fallbackStatus) as AgentStepState['status'],
    reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    result: isRecord(payload.result) ? payload.result : undefined,
    error_message: typeof payload.error_message === 'string' ? payload.error_message : undefined,
    progress: isRecord(payload.progress)
      ? {
          current: typeof payload.progress.current === 'number' ? payload.progress.current : undefined,
          total: typeof payload.progress.total === 'number' ? payload.progress.total : undefined,
          label: typeof payload.progress.label === 'string' ? payload.progress.label : undefined,
        }
      : undefined,
  };
}

function mergeStepStates(existing: AgentStepState[], incoming: AgentStepState): AgentStepState[] {
  const next = [...existing];
  const index = next.findIndex((item) => item.step_code === incoming.step_code);
  if (index === -1) {
    next.push(incoming);
    return next;
  }
  next[index] = {
    ...next[index],
    ...incoming,
  };
  return next;
}

function inferRunStatus(run: AgentRunView): AgentRunView['run_status'] {
  if (run.step_results.some((item) => item.status === 'failed')) {
    return 'failed';
  }
  if (run.live) {
    return 'running';
  }
  return 'completed';
}

export function reduceAgentRunMap(
  current: Record<string, AgentRunView>,
  event: ProjectEvent,
): Record<string, AgentRunView> {
  if (!event.agent_run_id) {
    return current;
  }

  const existing = current[event.agent_run_id] ?? {
    agent_run_id: event.agent_run_id,
    title: 'Agent 运行中',
    step_results: [],
    next_recommendations: [],
    live: true,
    run_status: 'running',
  };
  const payload = isRecord(event.payload) ? event.payload : {};
  const next: AgentRunView = {
    ...existing,
    stage: event.stage,
    scope_type: event.scope_type,
    target_page_id: event.target_page_id,
    live: event.event_type !== 'agent.run.completed',
  };

  if (event.event_type === 'agent.run.started') {
    next.title = String(payload.title ?? next.title);
    next.origin = String(payload.origin ?? '');
    next.started_at = event.created_at;
    next.source_message_id = typeof payload.message_id === 'string' ? payload.message_id : null;
  }

  if (event.event_type === 'router.decision') {
    next.router_decision = payload;
  }

  if (event.event_type === 'action.step.started') {
    const step = normalizeStepPayload(payload, 'running');
    if (step) {
      next.step_results = mergeStepStates(existing.step_results, step);
    }
  }

  if (event.event_type === 'action.step.progress') {
    const step = normalizeStepPayload(payload, 'running');
    if (step) {
      next.step_results = mergeStepStates(existing.step_results, step);
    }
  }

  if (event.event_type === 'action.step.completed' || event.event_type === 'action.step.failed') {
    const step = normalizeStepPayload(payload, event.event_type === 'action.step.failed' ? 'failed' : 'completed');
    if (step) {
      next.step_results = mergeStepStates(existing.step_results, step);
    }
  }

  if (event.event_type === 'recommendations.updated') {
    const recommendations = Array.isArray(payload.next_recommendations) ? payload.next_recommendations : [];
    next.next_recommendations = recommendations as AgentRecommendation[];
  }

  if (event.event_type === 'agent.run.completed') {
    next.live = false;
    if (typeof payload.status === 'string' && payload.status === 'failed') {
      next.run_status = 'failed';
    }
  }

  next.run_status = inferRunStatus(next);
  return {
    ...current,
    [event.agent_run_id]: next,
  };
}

export function agentRunFromMessage(message: ProjectMessage): AgentRunView | null {
  if (!isRecord(message.structured_payload_json)) {
    return null;
  }
  if (message.structured_payload_json.message_kind !== 'agent_run') {
    return null;
  }

  const completedSteps = Array.isArray(message.structured_payload_json.step_results)
    ? message.structured_payload_json.step_results
    : [];

  let stepResults: AgentStepState[] = [];
  for (const rawStep of completedSteps) {
    if (!isRecord(rawStep)) {
      continue;
    }
    const normalized = normalizeStepPayload(rawStep, 'completed');
    if (normalized) {
      stepResults = mergeStepStates(stepResults, normalized);
    }
  }

  const run: AgentRunView = {
    agent_run_id: String(message.structured_payload_json.agent_run_id ?? message.id),
    title: String(message.structured_payload_json.title ?? 'Agent 结果'),
    router_decision: isRecord(message.structured_payload_json.router_decision)
      ? message.structured_payload_json.router_decision
      : null,
    step_results: stepResults,
    next_recommendations: Array.isArray(message.structured_payload_json.next_recommendations)
      ? (message.structured_payload_json.next_recommendations as AgentRecommendation[])
      : [],
    content_md: message.content_md,
    live: false,
    run_status: 'completed',
  };
  run.run_status = inferRunStatus(run);
  return run;
}

function compactResult(result: Record<string, unknown> | undefined): string | null {
  if (!result) {
    return null;
  }
  const pieces = Object.entries(result)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return pieces.length ? pieces.join(' · ') : null;
}

function getRunTone(run: AgentRunView, accent: 'blue' | 'emerald') {
  if (run.run_status === 'failed') {
    return {
      text: 'text-rose-600',
      badge: 'bg-rose-50 text-rose-700 border-rose-100',
      label: 'failed',
    };
  }
  if (run.live) {
    return {
      text: accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600',
      badge: accent === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100',
      label: 'running',
    };
  }
  return {
    text: accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600',
    badge: accent === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100',
    label: 'done',
  };
}

function renderStepIcon(step: AgentStepState) {
  if (step.status === 'failed') {
    return <CircleAlert size={14} className="text-rose-500" />;
  }
  if (step.status === 'completed') {
    return <CheckCircle2 size={14} className="text-emerald-500" />;
  }
  if (step.status === 'running') {
    return <LoaderCircle size={14} className="text-blue-500 animate-spin" />;
  }
  return <Circle size={14} className="text-slate-300" />;
}

function renderStepStatus(step: AgentStepState): string {
  if (step.status === 'failed') {
    return '失败';
  }
  if (step.status === 'completed') {
    return '完成';
  }
  if (step.status === 'running') {
    return '进行中';
  }
  return '待执行';
}

export function AgentActivityCard({
  run,
  accent = 'blue',
  onRecommendationClick,
  recommendationsDisabled = false,
}: {
  run: AgentRunView;
  accent?: 'blue' | 'emerald';
  onRecommendationClick?: (recommendation: AgentRecommendation) => void;
  recommendationsDisabled?: boolean;
}) {
  const tone = getRunTone(run, accent);
  const visibleStepResults = run.live
    ? run.step_results
    : run.step_results.filter((item) => item.status !== 'pending');
  const decisionReason =
    run.router_decision && typeof run.router_decision.reason === 'string'
      ? run.router_decision.reason
      : null;
  const actionType =
    run.router_decision && typeof run.router_decision.action_type === 'string'
      ? run.router_decision.action_type
      : null;

  return (
    <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full space-y-4">
      <div className={`flex items-center justify-between text-sm font-semibold ${tone.text}`}>
        <div className="flex items-center gap-2">
          {run.run_status === 'failed' ? (
            <CircleAlert size={18} />
          ) : run.live ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {run.title}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>{tone.label}</span>
      </div>

      {decisionReason ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-sm text-slate-600 leading-relaxed space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-slate-700">判断用户意图</div>
            {actionType ? <span className="text-[11px] text-slate-400">{actionType}</span> : null}
          </div>
          <div>{decisionReason}</div>
        </div>
      ) : null}

      {visibleStepResults.length ? (
        <div className="space-y-2">
          {visibleStepResults.map((step) => {
            const resultText = compactResult(step.result);
            const progressCurrent = step.progress?.current ?? 0;
            const progressTotal = step.progress?.total ?? 0;
            const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0;
            return (
              <div key={step.step_code} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    {renderStepIcon(step)}
                    {step.step_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400">{step.step_code}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        step.status === 'failed'
                          ? 'bg-rose-50 text-rose-700'
                          : step.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : step.status === 'running'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {renderStepStatus(step)}
                    </span>
                  </div>
                </div>
                {step.reason ? <div className="text-xs text-slate-500 leading-relaxed">{step.reason}</div> : null}
                {step.progress && progressTotal > 0 ? (
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {step.progress.label ?? `${progressCurrent}/${progressTotal}`}
                    </div>
                  </div>
                ) : null}
                {step.error_message ? <div className="text-xs text-rose-600 leading-relaxed">{step.error_message}</div> : null}
                {resultText ? <div className="text-xs text-slate-500">{resultText}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {run.content_md ? <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{run.content_md}</p> : null}

      {run.next_recommendations.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">下一步建议</div>
          {run.next_recommendations.map((item) =>
            onRecommendationClick ? (
              <button
                type="button"
                key={item.code}
                disabled={recommendationsDisabled}
                onClick={() => onRecommendationClick(item)}
                className="w-full rounded-xl border border-slate-100 px-3 py-3 bg-white text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Bot size={14} className="text-slate-400" />
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-slate-500 leading-relaxed">{item.reason}</div>
              </button>
            ) : (
              <div key={item.code} className="rounded-xl border border-slate-100 px-3 py-3 bg-white">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Bot size={14} className="text-slate-400" />
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-slate-500 leading-relaxed">{item.reason}</div>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
