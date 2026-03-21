import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Database,
  Download,
  FileText,
  LoaderCircle,
  Paperclip,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Wand2,
} from 'lucide-react';
import {
  ApiError,
  connectProjectEventStream,
  createExport,
  createMessage,
  generatePageDesign,
  generatePageDraft,
  generatePageSearchQueries,
  generatePageSummary,
  getExportDownloadUrl,
  getOutline,
  getPage,
  getProject,
  listMessages,
  listPages,
  patchPageOutline,
  patchStoryboard,
  patchPageSummary,
  retryPageSearchResult,
  runBatchAction,
  runPageSearch,
  type OutlineResponse,
  type PageSummary,
  type ProjectMessage,
  type ProjectSummary,
  type UiSurface,
} from '../lib/ppt-api';
import { createSingleFlightRunner } from '../lib/single-flight';
import { summarizeSourcePipeline, shouldRefreshFromEvent } from '../lib/workflow-ui';
import { AgentActivityCard, agentRunFromMessage, reduceAgentRunMap, type AgentRunView } from './AgentActivity';
import { DataModal, PageThumbnail, renderStageBadge, renderStatusPill, SearchResultCard, SvgCanvas, type EditorSurface } from './editor/EditorBits';
import PresentationPlayer, { type PresentationSlide, type PresentationSurface } from './editor/PresentationPlayer';
import StoryboardPanel from './editor/StoryboardPanel';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function toTimestamp(value?: string): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function replacePageSummary(items: PageSummary[], updatedPage: PageSummary): PageSummary[] {
  return items.map((item) => (item.page_id === updatedPage.page_id ? {...item, ...updatedPage} : item));
}

export default function Editor({
  project,
  onBack,
  onProjectUpdated,
}: {
  project: ProjectSummary;
  onBack: () => void;
  onProjectUpdated: (project: ProjectSummary) => void;
}) {
  const [surface, setSurface] = useState<EditorSurface>('search');
  const [outline, setOutline] = useState<OutlineResponse | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [activePage, setActivePage] = useState<PageSummary | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [liveRuns, setLiveRuns] = useState<Record<string, AgentRunView>>({});
  const [chatInput, setChatInput] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [bulletDraft, setBulletDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingOutline, setIsSavingOutline] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isStoryboardOpen, setIsStoryboardOpen] = useState(false);
  const [isSavingStoryboard, setIsSavingStoryboard] = useState(false);
  const [isPreparingPresentation, setIsPreparingPresentation] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [presentationSurface, setPresentationSurface] = useState<PresentationSurface>('design');
  const [presentationSlides, setPresentationSlides] = useState<PresentationSlide[]>([]);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [retryingSearchSourceIds, setRetryingSearchSourceIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const activePageIdRef = useRef<string | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.scope_type === 'project' || message.target_page_id === activePage?.page_id),
    [activePage?.page_id, messages],
  );
  const visibleMessageAgentRunIds = useMemo(
    () =>
      new Set(
        visibleMessages
          .map((message) => agentRunFromMessage(message)?.agent_run_id)
          .filter((value): value is string => Boolean(value)),
      ),
    [visibleMessages],
  );
  const liveRunList = useMemo(
    () =>
      (Object.values(liveRuns) as AgentRunView[])
        .filter((item) => item.live && (!item.target_page_id || item.target_page_id === activePage?.page_id))
        .filter((item) => !visibleMessageAgentRunIds.has(item.agent_run_id)),
    [activePage?.page_id, liveRuns, visibleMessageAgentRunIds],
  );
  const searchStats = useMemo(() => summarizeSourcePipeline(activePage?.page_search_results ?? []), [activePage?.page_search_results]);
  const timelineItems = useMemo(() => {
    const items = [
      ...visibleMessages.map((message, index) => ({
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
  }, [liveRunList, visibleMessages]);
  const isPageSearchRunning = useMemo(
    () =>
      (Object.values(liveRuns) as AgentRunView[]).some((item) => {
        if (!item.live || item.target_page_id !== activePage?.page_id) {
          return false;
        }
        const actionType = typeof item.router_decision?.action_type === 'string' ? item.router_decision.action_type : '';
        return actionType === 'page_search_run' || actionType === 'page_search_refresh';
      }),
    [activePage?.page_id, liveRuns],
  );

  useEffect(() => {
    activePageIdRef.current = activePage?.page_id ?? null;
  }, [activePage?.page_id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [projectResponse, messageResponse, pagesResponse, outlineResponse] = await Promise.all([
          getProject(project.project_id),
          listMessages(project.project_id),
          listPages(project.project_id),
          getOutline(project.project_id).catch(() => null),
        ]);
        if (cancelled) return;
        onProjectUpdated(projectResponse);
        setMessages(messageResponse.items);
        setPages(pagesResponse.items);
        setOutline(outlineResponse);
        const nextId = activePageIdRef.current && pagesResponse.items.some((item) => item.page_id === activePageIdRef.current)
          ? activePageIdRef.current
          : pagesResponse.items[0]?.page_id ?? null;
        activePageIdRef.current = nextId;
        setActivePage(nextId ? await getPage(project.project_id, nextId) : null);
        setError(null);
      } catch (caughtError) {
        if (!cancelled) setError(getErrorMessage(caughtError, '工作区读取失败'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    const refresh = createSingleFlightRunner(load);
    refresh.schedule();
    const disconnect = connectProjectEventStream(project.project_id, {
      onEvent: (event) => {
        setLiveRuns((current) => reduceAgentRunMap(current, event));
        if (shouldRefreshFromEvent(event)) refresh.schedule();
      },
      onError: () => setError((current) => current ?? '事件流已断开，稍后会自动重连。'),
    });
    return () => {
      cancelled = true;
      refresh.dispose();
      disconnect();
    };
  }, [onProjectUpdated, project.project_id]);

  useEffect(() => {
    if (!activePage) {
      setTitleDraft('');
      setBulletDraft('');
      setSummaryDraft('');
      return;
    }
    setTitleDraft(activePage.title);
    setBulletDraft(activePage.content_outline.join('\n'));
    setSummaryDraft(activePage.page_summary_md);
  }, [activePage]);

  const handleSaveOutline = async () => {
    if (!activePage || isSavingOutline) return;
    setIsSavingOutline(true);
    try {
      const nextPage = await patchPageOutline(project.project_id, activePage.page_id, {
        title: titleDraft.trim(),
        content_outline: bulletDraft.split('\n').map((item) => item.trim()).filter(Boolean),
        section_title: activePage.part_title,
      });
      setActivePage(nextPage);
      setPages((current) => replacePageSummary(current, nextPage));
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '页面结构保存失败'));
    } finally {
      setIsSavingOutline(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!activePage || isSavingSummary) return;
    setIsSavingSummary(true);
    try {
      const nextPage = await patchPageSummary(project.project_id, activePage.page_id, summaryDraft);
      setActivePage(nextPage);
      setPages((current) => replacePageSummary(current, nextPage));
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'summary 保存失败'));
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSendMessage = async () => {
    const content = chatInput.trim();
    if (!content || isSendingMessage || !activePage) return;
    setIsSendingMessage(true);
    try {
      const message = await createMessage(project.project_id, {
        scope_type: 'page',
        target_page_id: activePage.page_id,
        ui_surface: surface as UiSurface,
        content_md: content,
      });
      setMessages((current) => [...current, message]);
      setChatInput('');
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '消息发送失败'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const runAction = async (runner: () => Promise<unknown>) => {
    try {
      await runner();
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '动作执行失败'));
    }
  };

  const handleOpenPage = async (pageId: string, nextSurface?: EditorSurface) => {
    activePageIdRef.current = pageId;
    if (nextSurface) {
      setSurface(nextSurface);
    }
    setActivePage(await getPage(project.project_id, pageId));
  };

  const handleOpenPresentation = async () => {
    if (surface === 'search' || !pages.length || isPreparingPresentation) {
      return;
    }

    const targetSurface: PresentationSurface = surface;
    const orderedPages = [...pages].sort((left, right) => left.sort_order - right.sort_order);
    const nextIndex = Math.max(
      orderedPages.findIndex((page) => page.page_id === activePage?.page_id),
      0,
    );

    setIsPreparingPresentation(true);
    try {
      const detailedPages = await Promise.all(
        orderedPages.map(async (page) => {
          if (page.page_id === activePage?.page_id && activePage) {
            return activePage;
          }
          if (targetSurface === 'draft' && !page.current_draft_version_id) {
            return null;
          }
          if (targetSurface === 'design' && !page.current_design_version_id) {
            return null;
          }
          try {
            return await getPage(project.project_id, page.page_id);
          } catch {
            return null;
          }
        }),
      );

      const slides = orderedPages.map((page, index) => {
        const detail = detailedPages[index];
        const fallbackMarkup = page.preview_surface === targetSurface ? page.preview_svg_markup ?? null : null;
        const markup =
          targetSurface === 'draft'
            ? detail?.draft?.draft_svg_markup ?? fallbackMarkup
            : detail?.design?.design_svg_markup ?? fallbackMarkup;

        return {
          pageId: page.page_id,
          sortOrder: page.sort_order,
          title: detail?.title ?? page.title,
          pageRole: page.page_role,
          partTitle: detail?.part_title ?? page.part_title,
          markup,
        } satisfies PresentationSlide;
      });

      setPresentationSurface(targetSurface);
      setPresentationSlides(slides);
      setPresentationIndex(nextIndex);
      setIsPresentationOpen(true);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '放映准备失败'));
    } finally {
      setIsPreparingPresentation(false);
    }
  };

  const handleStoryboardReorder = async (
    parts: Array<{
      part_title: string;
      pages: Array<{
        page_id?: string | null;
        title: string;
        content_outline: string[];
      }>;
    }>,
  ) => {
    if (isSavingStoryboard) return;
    setIsSavingStoryboard(true);
    try {
      const response = await patchStoryboard(project.project_id, {parts});
      setPages(response.items);
      setOutline(response.outline);
      if (activePageIdRef.current) {
        const nextSummary = response.items.find((item) => item.page_id === activePageIdRef.current);
        if (nextSummary) {
          setActivePage((current) => (current ? {...current, ...nextSummary} : current));
        } else {
          const fallbackPage = response.items[0] ?? null;
          activePageIdRef.current = fallbackPage?.page_id ?? null;
          setActivePage(fallbackPage ? await getPage(project.project_id, fallbackPage.page_id) : null);
        }
      } else if (!activePage && response.items.length) {
        const fallbackPage = response.items[0];
        activePageIdRef.current = fallbackPage.page_id;
        setActivePage(await getPage(project.project_id, fallbackPage.page_id));
      }
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '结构保存失败'));
    } finally {
      setIsSavingStoryboard(false);
    }
  };

  const handleRetrySearchResult = async (sourceId: string) => {
    if (!activePage || retryingSearchSourceIds[sourceId]) {
      return;
    }
    setRetryingSearchSourceIds((current) => ({
      ...current,
      [sourceId]: true,
    }));
    try {
      const nextPage = await retryPageSearchResult(project.project_id, activePage.page_id, sourceId);
      setActivePage(nextPage);
      setPages((current) => replacePageSummary(current, nextPage));
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '资料重试失败'));
    } finally {
      setRetryingSearchSourceIds((current) => {
        const next = {...current};
        delete next[sourceId];
        return next;
      });
    }
  };

  const previewMarkup = surface === 'design' ? activePage?.design?.design_svg_markup ?? null : surface === 'draft' ? activePage?.draft?.draft_svg_markup ?? null : null;
  const searchDisabled = activePage?.page_role !== 'content';
  const canPresent = surface !== 'search' && pages.length > 0;

  if (project.current_stage === 'outline') {
    return (
      <div className="h-screen flex flex-col bg-[#f8f9fa]">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium"><ArrowLeft size={18} />返回</button>
          <div className="font-semibold text-slate-800">大纲生成中</div>
          <div className="text-sm text-slate-400">{outline ? '大纲已生成，等待切换' : '正在处理'}</div>
        </header>
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          <div className="flex-1 rounded-[2rem] border border-slate-200 bg-white shadow-sm p-8 space-y-4">
            <div className="text-2xl font-semibold text-slate-800">正在生成大纲并切换到搜索工作台</div>
            <div className="text-sm text-slate-500 leading-relaxed">右侧卡片会实时显示当前步骤和异常。这个阶段结束后会自动进入搜索工作台。</div>
          </div>
          <div className="w-[440px] bg-white border border-slate-200 rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
              {liveRunList.map((run) => <div key={run.agent_run_id} className="flex justify-start"><AgentActivityCard run={run} /></div>)}
              {messages.map((message) => message.role === 'assistant' ? (
                <div key={message.id} className="flex justify-start">
                  {agentRunFromMessage(message) ? <AgentActivityCard run={{...agentRunFromMessage(message)!, content_md: message.content_md}} accent="emerald" /> : <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full"><p className="text-sm text-slate-600 whitespace-pre-wrap">{message.content_md}</p></div>}
                </div>
              ) : null)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] text-slate-800">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
        <div className="w-56 h-full flex items-center justify-center border-r border-slate-200 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-[220px]">
            {(['search', 'draft', 'design'] as const).map((item) => (
              <button key={item} onClick={() => setSurface(item)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${surface === item ? 'bg-white shadow-sm text-slate-800 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
                {item === 'search' ? '搜索' : item === 'draft' ? '初稿' : '设计稿'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 px-6 font-semibold text-slate-800 flex items-center gap-3 flex-wrap">
          {activePage?.title || project.title}
          {activePage ? renderStageBadge('search', activePage.search_status) : null}
          {activePage ? renderStageBadge('summary', activePage.summary_status) : null}
          {activePage ? renderStageBadge('draft', activePage.draft_status) : null}
          {activePage ? renderStageBadge('design', activePage.design_status) : null}
        </div>
        <div className="flex items-center gap-3 px-6 shrink-0">
          <button onClick={() => setIsStoryboardOpen((current) => !current)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all ${isStoryboardOpen ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}><StickyNote size={18} />便利贴</button>
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"><ArrowLeft size={18} />返回</button>
          <button onClick={() => { void handleOpenPresentation(); }} disabled={!canPresent || isPreparingPresentation} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 disabled:opacity-40">{isPreparingPresentation ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={18} />}放映</button>
          <button onClick={() => void runAction(() => surface === 'search' ? runBatchAction(project.project_id, 'project_batch_search') : surface === 'draft' ? runBatchAction(project.project_id, 'project_batch_draft') : runBatchAction(project.project_id, 'project_batch_design'))} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"><Sparkles size={18} />{surface === 'search' ? '批量搜索' : surface === 'draft' ? '批量初稿' : '批量设计'}</button>
          {surface === 'search' ? <button onClick={() => void runAction(() => runBatchAction(project.project_id, 'project_batch_summary'))} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"><Wand2 size={18} />批量 summary</button> : null}
          <button onClick={async () => { setIsExporting(true); try { const job = await createExport(project.project_id); window.open(getExportDownloadUrl(project.project_id, job.export_id), '_blank', 'noopener,noreferrer'); setError(null); } catch (caughtError) { setError(getErrorMessage(caughtError, '导出失败')); } finally { setIsExporting(false); } }} disabled={isExporting} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:bg-blue-300">{isExporting ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}导出</button>
        </div>
      </header>

      {isStoryboardOpen ? (
        <StoryboardPanel
          outline={outline}
          pages={pages}
          activePageId={activePage?.page_id ?? null}
          surface={surface}
          isSaving={isSavingStoryboard}
          onJump={(pageId, nextSurface) => {
            setIsStoryboardOpen(false);
            void runAction(() => handleOpenPage(pageId, nextSurface));
          }}
          onReorder={handleStoryboardReorder}
        />
      ) : (
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
          <div className="p-4 flex justify-between items-center border-b border-slate-100 text-sm"><span className="font-semibold text-slate-800">幻灯片</span><span className="text-slate-400 font-medium">共 {pages.length} 张</span></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pages.map((page) => <PageThumbnail key={page.page_id} page={page} active={page.page_id === activePage?.page_id} onClick={() => void runAction(() => handleOpenPage(page.page_id))} />)}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-[#f3f4f6]">
          <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between gap-6">
            <div><div className="text-xs uppercase tracking-wide text-slate-400">{activePage?.page_role} / {activePage?.part_title || '未分组'}</div><div className="text-2xl font-semibold text-slate-800">{activePage?.title || '未选择页面'}</div></div>
            {surface === 'search' ? <div className="flex flex-wrap gap-2 justify-end">{renderStatusPill('搜索结果', `${searchStats.total} 条`, 'slate')}{renderStatusPill('全文完成', `${searchStats.readReady}/${searchStats.total}`, searchStats.readReady ? 'emerald' : 'amber')}{renderStatusPill('向量完成', `${searchStats.vectorReady}/${searchStats.total}`, searchStats.vectorReady ? 'blue' : 'amber')}</div> : null}
          </div>
          <div className="flex-1 overflow-auto p-8">
            {surface === 'search' ? (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between"><div><div className="text-lg font-semibold text-slate-800">当前页资料池</div><div className="text-sm text-slate-500 mt-1">Bocha 摘要、全文抓取和向量化状态会持续写回这里。</div></div><div className="text-sm text-slate-500">文档 {activePage?.page_corpus_digest.document_count ?? 0} / chunk {activePage?.page_corpus_digest.chunk_count ?? 0}</div></div>
                  {searchDisabled ? <div className="text-sm text-slate-500">固定页不参与页级搜索，直接使用大纲结构进入 draft/design。</div> : activePage?.page_search_results.length ? <div className="space-y-4">{activePage.page_search_results.map((item) => <SearchResultCard key={item.id} item={item} onRetry={(sourceId) => { void handleRetrySearchResult(sourceId); }} retrying={Boolean(retryingSearchSourceIds[item.id])} allowRetry={!isPageSearchRunning} />)}</div> : <div className="text-sm text-slate-400">当前页还没有资料池结果。右侧聊天栏会实时显示 agent 进度。</div>}
                </div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between"><div className="text-lg font-semibold text-slate-800">当前页 summary 预览</div><button onClick={() => setIsDataModalOpen(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FileText size={14} className="inline mr-1" />在弹窗中编辑</button></div>
                  {activePage?.page_summary_md ? <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{activePage.page_summary_md}</div> : <div className="text-sm text-slate-400">当前页 summary 尚未生成。</div>}
                </div>
              </div>
            ) : <SvgCanvas markup={previewMarkup} placeholder={surface === 'draft' ? '当前页初稿尚未生成' : '当前页设计稿尚未生成'} />}
          </div>
        </div>

        <div className="w-[440px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-sm">
          <div className="border-b border-slate-100 bg-white px-4 py-4 space-y-3 shrink-0">
            <div className="text-xs uppercase tracking-wide text-slate-400">页面动作</div>
            <div className="flex flex-wrap gap-2">
              {surface === 'search' ? (
                <>
                  <button disabled={!activePage || searchDisabled} onClick={() => activePage && void runAction(() => generatePageSearchQueries(project.project_id, activePage.page_id))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">生成搜索词</button>
                  <button disabled={!activePage || searchDisabled} onClick={() => activePage && void runAction(() => runPageSearch(project.project_id, activePage.page_id, 'page_search_run'))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">搜索</button>
                  <button disabled={!activePage || searchDisabled} onClick={() => activePage && void runAction(() => runPageSearch(project.project_id, activePage.page_id, 'page_search_refresh'))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><RefreshCw size={14} className="inline mr-1" />覆盖重搜</button>
                  <button disabled={!activePage || searchDisabled} onClick={() => activePage && void runAction(() => generatePageSummary(project.project_id, activePage.page_id))} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">生成 summary</button>
                </>
              ) : surface === 'draft' ? (
                <button disabled={!activePage} onClick={() => activePage && void runAction(() => generatePageDraft(project.project_id, activePage.page_id))} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">生成当前页初稿</button>
              ) : (
                <button disabled={!activePage} onClick={() => activePage && void runAction(() => generatePageDesign(project.project_id, activePage.page_id))} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">生成当前页设计稿</button>
              )}
              <button disabled={!activePage} onClick={() => setIsDataModalOpen(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} className="inline mr-1" />手动编辑原数据</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
            {timelineItems.map((item) =>
              item.type === 'run' ? (
                <div key={item.key} className="flex justify-start">
                  <AgentActivityCard run={item.run} />
                </div>
              ) : item.message.role === 'user' ? (
                <div key={item.key} className="flex justify-end">
                  <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm whitespace-pre-wrap shadow-sm">{item.message.content_md}</div>
                </div>
              ) : (
                <div key={item.key} className="flex justify-start">
                  {agentRunFromMessage(item.message) ? <AgentActivityCard run={{...agentRunFromMessage(item.message)!, content_md: item.message.content_md}} accent="emerald" /> : <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full"><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.message.content_md}</p></div>}
                </div>
              ),
            )}
            {!timelineItems.length && !isLoading ? <div className="text-sm text-slate-400 text-center pt-6">当前阶段还没有对话内容。</div> : null}
          </div>
          <div className="p-5 bg-white border-t border-slate-100 space-y-3">
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="bg-slate-50 rounded-2xl flex items-end p-2.5 border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <button className="p-2.5 text-slate-400"><Paperclip size={20} /></button>
              <textarea value={chatInput} placeholder={surface === 'search' ? '例如：把标题改成...，或者先只生成搜索词' : surface === 'draft' ? '例如：重生成这一页初稿，强调数据对比' : '例如：重生成设计稿，保留结构但增强层次'} className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-sm text-slate-700" rows={1} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSendMessage(); } }} />
              <button disabled={isSendingMessage || !chatInput.trim() || !activePage} onClick={() => void handleSendMessage()} className="p-2.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed">{isSendingMessage ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}</button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400"><div className="flex items-center gap-1"><Database size={12} />页面上下文已绑定</div><div className="flex items-center gap-1"><Search size={12} />按 Enter 发送，Shift + Enter 换行</div></div>
          </div>
        </div>
      </div>
      )}

      <DataModal
        open={isDataModalOpen}
        surface={surface}
        page={activePage}
        titleDraft={titleDraft}
        bulletDraft={bulletDraft}
        summaryDraft={summaryDraft}
        onTitleChange={setTitleDraft}
        onBulletChange={setBulletDraft}
        onSummaryChange={setSummaryDraft}
        onSaveOutline={() => void handleSaveOutline()}
        onSaveSummary={() => void handleSaveSummary()}
        onClose={() => setIsDataModalOpen(false)}
        isSavingOutline={isSavingOutline}
        isSavingSummary={isSavingSummary}
      />
      {isPresentationOpen ? (
        <PresentationPlayer
          slides={presentationSlides}
          index={presentationIndex}
          surface={presentationSurface}
          onIndexChange={setPresentationIndex}
          onClose={() => setIsPresentationOpen(false)}
        />
      ) : null}
    </div>
  );
}
