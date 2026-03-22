import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  LoaderCircle,
  Paperclip,
  Search,
  Send,
  UploadCloud,
} from 'lucide-react';
import {
  ApiError,
  connectProjectEventStream,
  confirmRequirements,
  createMessage,
  getProject,
  getRequirementForm,
  listMessages,
  retryInitSearchResult,
  submitRequirementAnswers,
  uploadBackground,
  type InitSearchResult,
  type ProjectMessage,
  type ProjectSummary,
  type RequirementFormData,
  type RequirementQuestion,
} from '../lib/ppt-api';
import { createSingleFlightRunner } from '../lib/single-flight';
import { mergeMessageList, summarizeSourcePipeline, shouldRefreshFromEvent } from '../lib/workflow-ui';
import { AgentActivityCard, agentRunFromMessage, reduceAgentRunMap, type AgentRunView } from './AgentActivity';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function hasValue(value: string | number | undefined): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function toTimestamp(value?: string): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function renderStatusPill(label: string, value: string, tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' = 'slate') {
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-100'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 border-rose-100'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{label} · {value}</span>;
}

function renderSearchResult(
  source: InitSearchResult,
  options?: {
    onRetry?: (sourceId: string) => void;
    retrying?: boolean;
    allowRetry?: boolean;
  },
) {
  const readTone =
    source.read_status === 'failed'
      ? 'rose'
      : source.read_status === 'ready' || source.read_status === 'reused'
      ? 'emerald'
      : 'amber';
  const vectorTone = source.vector_status === 'ready' ? 'blue' : source.vector_status === 'failed' ? 'rose' : 'amber';
  const retryLabel = source.read_status === 'failed' ? '重试正文与向量化' : '重新向量化';
  const showRetry = Boolean(options?.onRetry) && Boolean(options?.allowRetry) && (source.read_status === 'failed' || source.vector_status !== 'ready');

  return (
    <div key={source.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <a href={source.url} target="_blank" rel="noreferrer" className="block text-base font-semibold text-blue-600 hover:underline break-words">
            {source.title}
          </a>
          <div className="text-xs text-emerald-600 break-all">{source.url}</div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {source.query_purpose}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {renderStatusPill('搜索', `R${source.search_rank}`, 'slate')}
        {renderStatusPill('全文', source.read_status ?? 'pending', readTone)}
        {renderStatusPill('向量', source.vector_status ?? 'pending', vectorTone)}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {source.content_excerpt_md || source.bocha_summary || source.snippet || 'Bocha 已返回结果，等待抓取正文。'}
      </p>
      {showRetry ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={options?.retrying}
            onClick={() => {
              options?.onRetry?.(source.id);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {options?.retrying ? '处理中...' : retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type RequirementStep =
  | {
      key: 'page_count_target';
      title: string;
      description: string;
      answered: boolean;
      kind: 'page_count';
    }
  | {
      key: 'style_preset';
      title: string;
      description: string;
      answered: boolean;
      kind: 'style_preset';
    }
  | {
      key: string;
      title: string;
      description?: string;
      answered: boolean;
      kind: 'question';
      question: RequirementQuestion;
    };

export default function ProjectStart({
  project,
  onBack,
  onProjectUpdated,
}: {
  project: ProjectSummary;
  onBack: () => void;
  onProjectUpdated: (project: ProjectSummary) => void;
}) {
  const [form, setForm] = useState<RequirementFormData | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [liveRuns, setLiveRuns] = useState<Record<string, AgentRunView>>({});
  const [chatInput, setChatInput] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [activeRequirementIndex, setActiveRequirementIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [retryingSourceIds, setRetryingSourceIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => form?.ai_questions ?? [], [form]);
  const pageCountAnswer = form?.answers.page_count_target;
  const styleAnswer = typeof form?.answers.style_preset === 'string' ? form.answers.style_preset : '';
  const answeredAllQuestions = questions.every((item) => hasValue(form?.answers[item.question_code]));
  const canConfirm = Boolean(pageCountAnswer) && Boolean(styleAnswer) && answeredAllQuestions && Boolean(form?.init_corpus_digest.document_count);
  const messageAgentRunIds = useMemo(
    () =>
      new Set(
        messages
          .map((message) => agentRunFromMessage(message)?.agent_run_id)
          .filter((value): value is string => Boolean(value)),
      ),
    [messages],
  );
  const liveRunList = useMemo(
    () =>
      (Object.values(liveRuns) as AgentRunView[])
        .filter((item) => item.live)
        .filter((item) => !messageAgentRunIds.has(item.agent_run_id)),
    [liveRuns, messageAgentRunIds],
  );
  const pipelineSummary = useMemo(
    () => summarizeSourcePipeline(form?.init_search_results ?? []),
    [form?.init_search_results],
  );
  const pageCountMatchesPreset = useMemo(
    () =>
      (form?.page_count_options ?? []).some(
        (option) => String(pageCountAnswer ?? '') === String(option.page_count ?? option.label),
      ),
    [form?.page_count_options, pageCountAnswer],
  );
  const styleMatchesPreset = useMemo(
    () => (form?.fixed_items.style_preset.options ?? []).some((style) => styleAnswer === style.style_id),
    [form?.fixed_items.style_preset.options, styleAnswer],
  );
  const pageCountCustomValue = customAnswers.page_count_target ?? (hasValue(pageCountAnswer) && !pageCountMatchesPreset ? String(pageCountAnswer) : '');
  const styleCustomValue = customAnswers.style_preset ?? (styleAnswer && !styleMatchesPreset ? styleAnswer : '');
  const requirementSteps = useMemo<RequirementStep[]>(
    () => [
      {
        key: 'page_count_target',
        title: '页数目标',
        description: '这是整份 PPT 的总页数，包含封面、目录、内容页和结尾页。',
        answered: hasValue(pageCountAnswer),
        kind: 'page_count',
      },
      {
        key: 'style_preset',
        title: '风格预设',
        description: '设计稿阶段严格使用这里选定的 style_preset；也可以直接填写自定义风格要求。',
        answered: hasValue(styleAnswer),
        kind: 'style_preset',
      },
      ...questions.map((question) => ({
        key: question.question_code,
        title: question.label,
        description: question.description,
        answered: hasValue(form?.answers[question.question_code]),
        kind: 'question' as const,
        question,
      })),
    ],
    [form?.answers, pageCountAnswer, questions, styleAnswer],
  );
  const activeRequirementStep = requirementSteps[activeRequirementIndex] ?? null;
  const timelineItems = useMemo(() => {
    const items = [
      ...messages.map((message, index) => ({
        key: `message-${message.id}`,
        type: 'message' as const,
        sortAt: toTimestamp(message.created_at),
        sortRank: 0,
        index,
        message,
      })),
      ...liveRunList.map((run, index) => ({
        key: `run-${run.agent_run_id}`,
        type: 'run' as const,
        sortAt: toTimestamp(run.started_at),
        sortRank: 1,
        index,
        run,
      })),
    ];
    items.sort((left, right) => {
      if (left.sortAt !== right.sortAt) {
        return left.sortAt - right.sortAt;
      }
      if (left.sortRank !== right.sortRank) {
        return left.sortRank - right.sortRank;
      }
      return left.index - right.index;
    });
    return items;
  }, [liveRunList, messages]);
  const currentRequirementPosition = requirementSteps.length ? activeRequirementIndex + 1 : 0;
  const isBootstrapRunning = useMemo(
    () => (Object.values(liveRuns) as AgentRunView[]).some((item) => item.live && item.title === '初始化资料准备'),
    [liveRuns],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [projectResponse, formResponse, messageResponse] = await Promise.all([
          getProject(project.project_id),
          getRequirementForm(project.project_id),
          listMessages(project.project_id),
        ]);
        if (cancelled) {
          return;
        }
        onProjectUpdated(projectResponse);
        setForm(formResponse.requirement_form);
        setMessages((current) => mergeMessageList(current, messageResponse.items));
        setError(null);
      } catch (caughtError) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError, '初始化数据读取失败'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsConfirming(false);
        }
      }
    };

    const refresh = createSingleFlightRunner(load);
    refresh.schedule();
    const disconnect = connectProjectEventStream(project.project_id, {
      onEvent: (event) => {
        setLiveRuns((current) => reduceAgentRunMap(current, event));
        if (shouldRefreshFromEvent(event)) {
          refresh.schedule();
        }
      },
      onError: () => {
        setError((current) => current ?? '事件流已断开，稍后会自动重连。');
      },
    });

    return () => {
      cancelled = true;
      refresh.dispose();
      disconnect();
    };
  }, [onProjectUpdated, project.project_id]);

  useEffect(() => {
    if (!requirementSteps.length) {
      return;
    }
    setActiveRequirementIndex((current) => Math.min(current, requirementSteps.length - 1));
  }, [requirementSteps.length]);

  const handleAnswer = async (questionCode: string, value: string | number) => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await submitRequirementAnswers(project.project_id, [{question_code: questionCode, value}]);
      setForm(response.requirement_form);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '保存答案失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetAnswer = async (questionCode: string, value: string | number) => {
    setCustomAnswers((current) => {
      if (!(questionCode in current)) {
        return current;
      }
      const next = {...current};
      delete next[questionCode];
      return next;
    });
    await handleAnswer(questionCode, value);
  };

  const handleCustomAnswer = async (question: RequirementQuestion) => {
    const rawValue = (customAnswers[question.question_code] ?? '').trim();
    if (!rawValue) {
      setError('请先填写自定义答案');
      return;
    }
    await handleAnswer(question.question_code, rawValue);
  };

  const handleFixedCustomAnswer = async (questionCode: 'page_count_target' | 'style_preset') => {
    const rawValue = (customAnswers[questionCode] ?? '').trim();
    if (!rawValue) {
      setError('请先填写自定义答案');
      return;
    }
    if (questionCode === 'page_count_target' && !/^\d+$/.test(rawValue)) {
      setError('页数目标必须填写正整数');
      return;
    }
    await handleAnswer(questionCode, rawValue);
  };

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsUploading(true);
    try {
      await uploadBackground(project.project_id, file);
      const response = await getRequirementForm(project.project_id);
      setForm(response.requirement_form);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '背景图上传失败'));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRetrySearchResult = async (sourceId: string) => {
    if (retryingSourceIds[sourceId]) {
      return;
    }
    setRetryingSourceIds((current) => ({
      ...current,
      [sourceId]: true,
    }));
    try {
      const response = await retryInitSearchResult(project.project_id, sourceId);
      setForm(response.requirement_form);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '资料重试失败'));
    } finally {
      setRetryingSourceIds((current) => {
        const next = {...current};
        delete next[sourceId];
        return next;
      });
    }
  };

  const sendMessage = async (content: string, options?: { clearInput?: boolean }) => {
    const normalizedContent = content.trim();
    if (!normalizedContent || isSendingMessage) {
      return;
    }
    setIsSendingMessage(true);
    try {
      const message = await createMessage(project.project_id, {
        scope_type: 'project',
        target_page_id: null,
        ui_surface: 'init',
        content_md: normalizedContent,
      });
      setMessages((current) => mergeMessageList(current, [message]));
      if (options?.clearInput) {
        setChatInput((current) => (current.trim() === normalizedContent ? '' : current));
      }
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '消息发送失败'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendMessage = async () => {
    await sendMessage(chatInput, {clearInput: true});
  };

  const handleConfirm = async () => {
    if (!canConfirm || isConfirming) {
      return;
    }
    setIsConfirming(true);
    try {
      const nextProject = await confirmRequirements(project.project_id);
      onProjectUpdated(nextProject);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '生成大纲失败'));
      setIsConfirming(false);
    }
  };

  const renderRequirementStep = () => {
    if (!activeRequirementStep) {
      return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">初始化问题还在生成，稍后会自动出现。</div>;
    }

    if (activeRequirementStep.kind === 'page_count') {
      const customSelected = hasValue(pageCountAnswer) && !pageCountMatchesPreset;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {form?.page_count_options.map((option) => {
              const selected = String(pageCountAnswer ?? '') === String(option.page_count ?? option.label);
              return (
                <button
                  type="button"
                  key={option.option_code}
                  disabled={isSubmitting}
                  onClick={() => {
                    void handlePresetAnswer('page_count_target', option.page_count ?? option.label);
                  }}
                  className={
                    selected
                      ? 'rounded-xl bg-blue-600 px-4 py-3 text-left text-white shadow-sm'
                      : 'rounded-xl border border-slate-200 px-4 py-3 text-left transition-all hover:border-blue-400 hover:text-blue-600'
                  }
                >
                  <div className="font-semibold">{option.label}</div>
                  <div className={selected ? 'mt-2 text-xs text-blue-50/90' : 'mt-2 text-xs text-slate-500'}>
                    {option.page_count ? `${option.page_count} 页` : option.reason || '使用该推荐值'}
                  </div>
                </button>
              );
            })}
          </div>
          {form?.fixed_items.page_count.allow_custom ? (
            <div className={`space-y-3 rounded-xl border px-4 py-4 ${customSelected ? 'border-blue-200 bg-blue-50/70' : 'border-dashed border-slate-300 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">自定义页数</div>
                  <div className="mt-1 text-xs text-slate-500">直接填写总页数，系统会把它当成整份 PPT 的明确目标。</div>
                </div>
                {customSelected ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">当前已使用</span> : null}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={pageCountCustomValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomAnswers((current) => ({
                      ...current,
                      page_count_target: value,
                    }));
                  }}
                  placeholder="例如：12"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleFixedCustomAnswer('page_count_target');
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
                >
                  保存
                </button>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeRequirementStep.kind === 'style_preset') {
      const customSelected = Boolean(styleAnswer) && !styleMatchesPreset;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {form?.fixed_items.style_preset.options.map((style) => {
              const selected = styleAnswer === style.style_id;
              return (
                <button
                  type="button"
                  key={style.style_id}
                  disabled={isSubmitting}
                  onClick={() => {
                    void handlePresetAnswer('style_preset', style.style_id);
                  }}
                  className={
                    selected
                      ? 'rounded-xl bg-slate-900 px-4 py-3 text-left text-white shadow-sm'
                      : 'rounded-xl border border-slate-200 px-4 py-3 text-left transition-all hover:border-slate-400'
                  }
                >
                  <div className="font-semibold">{style.style_name}</div>
                  <div className={selected ? 'mt-2 text-xs text-slate-200' : 'mt-2 text-xs text-slate-500'}>
                    {style.description}
                  </div>
                </button>
              );
            })}
          </div>

          {form?.fixed_items.style_preset.allow_custom ? (
            <div className={`space-y-3 rounded-xl border px-4 py-4 ${customSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-dashed border-slate-300 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-medium ${customSelected ? 'text-white' : 'text-slate-700'}`}>自定义风格要求</div>
                  <div className={`mt-1 text-xs ${customSelected ? 'text-slate-300' : 'text-slate-500'}`}>可以直接写视觉方向，例如“苹果发布会风格、银灰留白、强图表感”。</div>
                </div>
                {customSelected ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">当前已使用</span> : null}
              </div>
              <div className="flex gap-2">
                <input
                  value={styleCustomValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomAnswers((current) => ({
                      ...current,
                      style_preset: value,
                    }));
                  }}
                  placeholder="输入自定义风格要求"
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${customSelected ? 'border-white/20 bg-white/10 text-white placeholder:text-slate-300 focus:border-white/40' : 'border-slate-200 bg-white text-slate-700 focus:border-blue-500'}`}
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleFixedCustomAnswer('style_preset');
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${customSelected ? 'bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300'}`}
                >
                  保存
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
            <div className="text-sm font-medium text-slate-700">背景资源</div>
            <div className="text-xs text-slate-500">可选项，不会阻塞后续流程；如果上传，会在设计阶段作为底层氛围资源使用。</div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 transition-colors hover:border-blue-400 hover:bg-blue-50/50">
              <div className="flex items-center gap-3">
                <UploadCloud size={18} className="text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {form?.answers.background_asset ? '已上传背景资源，可重新选择' : '上传背景资源'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {form?.answers.background_asset ? String(form.answers.background_asset) : '支持可选背景图，不上传也可继续。'}
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{isUploading ? '上传中' : '可选'}</span>
              <input type="file" className="hidden" onChange={handleBackgroundUpload} />
            </label>
          </div>
        </div>
      );
    }

    const {question} = activeRequirementStep;
    return (
      <div className="space-y-4">
        {question.options.length ? (
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option) => {
              const selected = String(form?.answers[question.question_code] ?? '') === option.label;
              return (
                <button
                  type="button"
                  key={option.option_code}
                  disabled={isSubmitting}
                  onClick={() => {
                    void handlePresetAnswer(question.question_code, option.label);
                  }}
                  className={
                    selected
                      ? 'rounded-xl bg-blue-600 px-4 py-3 text-left text-white shadow-sm'
                      : 'rounded-xl border border-slate-200 px-4 py-3 text-left transition-all hover:border-blue-400 hover:text-blue-600'
                  }
                >
                  <div className="font-medium">{option.label}</div>
                  {option.description ? <div className={selected ? 'mt-2 text-xs text-blue-50/90' : 'mt-2 text-xs text-slate-500'}>{option.description}</div> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.allow_custom ? (
          <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
            <div className="text-sm font-medium text-slate-700">自定义答案</div>
            <div className="flex gap-2">
              <input
                value={customAnswers[question.question_code] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomAnswers((current) => ({
                    ...current,
                    [question.question_code]: value,
                  }));
                }}
                placeholder="如果推荐项不合适，可以直接填写"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  void handleCustomAnswer(question);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                保存
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] relative">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
          <ArrowLeft size={18} />
          返回
        </button>
        <div className="font-semibold text-slate-800">项目初始化</div>
        <button
          onClick={() => {
            void handleConfirm();
          }}
          disabled={!canConfirm || isConfirming}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isConfirming ? '开始生成大纲...' : '生成大纲'}
        </button>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden p-6 gap-6">
        <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">联网资料池</div>
                <div className="text-xl font-semibold text-slate-800">首轮搜索结果与入库状态</div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {renderStatusPill('搜索结果', `${pipelineSummary.total} 条`, 'slate')}
                {renderStatusPill('全文完成', `${pipelineSummary.readReady}/${pipelineSummary.total}`, pipelineSummary.readReady ? 'emerald' : 'amber')}
                {renderStatusPill('向量完成', `${pipelineSummary.vectorReady}/${pipelineSummary.total}`, pipelineSummary.vectorReady ? 'blue' : 'amber')}
              </div>
            </div>
            <div className="text-sm text-slate-500 leading-relaxed">
              Bocha 返回摘要后会先写入搜索结果；随后再抓取全文、切块向量化。左侧资料卡会持续反映当前入库阶段。
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">正在准备初始化资料...</div>
            ) : form?.init_search_results.length ? (
              form.init_search_results.map((source) =>
                renderSearchResult(source, {
                  onRetry: (sourceId) => {
                    void handleRetrySearchResult(sourceId);
                  },
                  retrying: Boolean(retryingSourceIds[source.id]),
                  allowRetry: !isBootstrapRunning,
                }),
              )
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                当前还没有搜索结果。右侧会实时显示 agent 的联网进度。
              </div>
            )}
          </div>
        </div>

        <div className="w-[460px] min-h-0 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
            {timelineItems.map((item) =>
              item.type === 'run' ? (
                <div key={item.key} className="flex justify-start">
                  <AgentActivityCard
                    run={item.run}
                    onRecommendationClick={(recommendation) => {
                      void sendMessage(recommendation.label);
                    }}
                    recommendationsDisabled={isSendingMessage}
                  />
                </div>
              ) : item.message.role === 'user' ? (
                <div key={item.key} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm text-white shadow-sm">
                    {item.message.content_md}
                  </div>
                </div>
              ) : (
                <div key={item.key} className="flex justify-start">
                  {agentRunFromMessage(item.message) ? (
                    <AgentActivityCard
                      run={{...agentRunFromMessage(item.message)!, content_md: item.message.content_md}}
                      onRecommendationClick={(recommendation) => {
                        void sendMessage(recommendation.label);
                      }}
                      recommendationsDisabled={isSendingMessage}
                    />
                  ) : (
                    <div className="w-full max-w-[95%] space-y-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                        <CheckCircle2 size={18} />
                        Agent 更新
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{item.message.content_md}</p>
                    </div>
                  )}
                </div>
              ),
            )}

            <div className="space-y-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                  <BookOpen size={18} />
                  内容需求单
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {answeredAllQuestions && pageCountAnswer && styleAnswer ? '已基本补齐' : '待补充'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {currentRequirementPosition}/{Math.max(requirementSteps.length, 1)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-slate-800">{activeRequirementStep?.title ?? '等待问题生成'}</div>
                    {activeRequirementStep?.description ? (
                      <div className="text-sm leading-relaxed text-slate-500">{activeRequirementStep.description}</div>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeRequirementStep?.answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {activeRequirementStep?.answered ? '已回答' : '待回答'}
                  </span>
                </div>

                {renderRequirementStep()}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={activeRequirementIndex === 0 || !requirementSteps.length}
                  onClick={() => {
                    setActiveRequirementIndex((current) => Math.max(0, current - 1));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  上一项
                </button>

                <div className="flex items-center gap-2">
                  {requirementSteps.map((step, index) => (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => {
                        setActiveRequirementIndex(index);
                      }}
                      className={`h-2.5 rounded-full transition-all ${index === activeRequirementIndex ? 'w-8 bg-blue-600' : step.answered ? 'w-2.5 bg-emerald-400' : 'w-2.5 bg-slate-300'}`}
                      aria-label={`跳转到 ${step.title}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!requirementSteps.length || activeRequirementIndex >= requirementSteps.length - 1}
                  onClick={() => {
                    setActiveRequirementIndex((current) => Math.min(requirementSteps.length - 1, current + 1));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一项
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 p-4 bg-white space-y-3">
            {form?.suggested_actions.length ? (
              <div className="flex flex-wrap gap-2">
                {form.suggested_actions.map((item) => (
                  <button
                    type="button"
                    key={item.code}
                    title={item.reason}
                    disabled={isSendingMessage}
                    onClick={() => {
                      void sendMessage(item.label);
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="bg-slate-50 rounded-xl flex items-end p-2 border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <button className="p-2.5 text-slate-400">
                <Paperclip size={20} />
              </button>
              <textarea
                value={chatInput}
                placeholder="例如：补充受众限制，或者要求重新做项目级搜索"
                className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-sm text-slate-700"
                rows={1}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <button
                disabled={isSendingMessage || !chatInput.trim()}
                onClick={() => {
                  void handleSendMessage();
                }}
                className="p-2.5 text-blue-600 hover:text-blue-700 transition-colors disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                {isSendingMessage ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1">
                <Database size={12} />
                init_corpus 文档数 {form?.init_corpus_digest.document_count ?? 0}
              </div>
              <div className="flex items-center gap-1">
                <Search size={12} />
                按 Enter 发送，Shift + Enter 换行
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
