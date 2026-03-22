import { useEffect, useRef, useState, type FC } from 'react';
import { FileText, X } from 'lucide-react';
import type { PageSummary } from '../../lib/ppt-api';

export type EditorSurface = 'search' | 'draft' | 'design';

export function renderStageBadge(label: string, value: string) {
  const tone =
    value === 'ready' || value === 'confirmed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : value === 'running'
      ? 'bg-blue-50 text-blue-700 border-blue-100'
      : value === 'stale'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : value === 'failed'
      ? 'bg-rose-50 text-rose-700 border-rose-100'
      : 'bg-slate-50 text-slate-500 border-slate-200';
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${tone}`}>{label} · {value}</span>;
}

export function renderStatusPill(label: string, value: string, tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' = 'slate') {
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

function fitRect(containerWidth: number, containerHeight: number, aspectRatio: number) {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }
  const containerRatio = containerWidth / containerHeight;
  if (containerRatio > aspectRatio) {
    const height = containerHeight;
    return {
      width: Math.floor(height * aspectRatio),
      height: Math.floor(height),
    };
  }
  const width = containerWidth;
  return {
    width: Math.floor(width),
    height: Math.floor(width / aspectRatio),
  };
}

export const SvgCanvas: FC<{ markup: string | null; placeholder: string }> = ({ markup, placeholder }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({width: 0, height: 0});
  const fittedSize = fitRect(frameSize.width, frameSize.height, 16 / 9);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      setFrameSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        update();
      });
      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, []);

  const canvasStyle = fittedSize
    ? {
        width: `${fittedSize.width}px`,
        height: `${fittedSize.height}px`,
      }
    : {
        aspectRatio: '16 / 9',
        width: '100%',
      };

  if (!markup) {
    return (
      <div ref={frameRef} className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_55%)]">
        <div
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400 shadow-xl"
          style={canvasStyle}
        >
          {placeholder}
        </div>
      </div>
    );
  }
  return (
    <div ref={frameRef} className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_55%)]">
      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl [&_svg]:h-full [&_svg]:w-full"
        style={canvasStyle}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
};

function pagePreviewLabel(surface: EditorSurface): string {
  if (surface === 'design') return '设计稿';
  if (surface === 'draft') return '初稿';
  return '要点';
}

function pagePreviewTone(surface: EditorSurface): string {
  if (surface === 'design') return 'bg-emerald-500/90 text-white';
  if (surface === 'draft') return 'bg-blue-500/90 text-white';
  return 'bg-slate-800/60 text-white';
}

function pageSurfaceMarkup(page: PageSummary, surface: EditorSurface): string | null {
  if (surface === 'draft') {
    return page.draft_preview_svg_markup ?? null;
  }
  if (surface === 'design') {
    return page.design_preview_svg_markup ?? null;
  }
  return null;
}

function pageSurfacePlaceholder(page: PageSummary, surface: EditorSurface): string {
  if (surface === 'draft') {
    if (page.draft_status === 'running') return '初稿生成中';
    if (page.draft_status === 'failed') return '初稿生成失败';
    return '初稿尚未生成';
  }
  if (surface === 'design') {
    if (page.design_status === 'running') return '设计稿生成中';
    if (page.design_status === 'failed') return '设计稿生成失败';
    return '设计稿尚未生成';
  }
  return '无要点';
}

export const PageThumbnail: FC<{
  page: PageSummary;
  surface: EditorSurface;
  active: boolean;
  onClick: () => void;
}> = ({
  page,
  surface,
  active,
  onClick,
}) => {
  const surfaceMarkup = pageSurfaceMarkup(page, surface);
  const hasSvgPreview = Boolean(surfaceMarkup);
  const showOverlayBadges = hasSvgPreview;
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border-2 cursor-pointer overflow-hidden transition-all ${
        active ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-slate-100 hover:border-slate-300'
      }`}
    >
      {showOverlayBadges ? (
        <>
          <div className="absolute top-1.5 left-1.5 bg-slate-800/60 text-white text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-md font-medium z-10">
            {page.sort_order}
          </div>
          <div className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-md font-medium z-10 ${pagePreviewTone(surface)}`}>
            {pagePreviewLabel(surface)}
          </div>
        </>
      ) : null}
      <div className="aspect-video bg-slate-50 relative">
        {hasSvgPreview ? (
          <>
            <div
              className="absolute inset-0 bg-white [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: surfaceMarkup ?? '' }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent px-3 pb-2 pt-8">
              <div className="text-[10px] uppercase tracking-wide text-white/70">{page.page_role}</div>
              <div className="mt-1 text-xs font-semibold text-white leading-4 line-clamp-2">{page.title}</div>
            </div>
          </>
        ) : (
          surface === 'search' ? (
            <div className="flex h-full flex-col p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded-md bg-slate-800/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {page.sort_order}
                  </span>
                  <span className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                    {page.page_role}
                  </span>
                </div>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${pagePreviewTone(surface)}`}>
                  {pagePreviewLabel(surface)}
                </span>
              </div>
              <div className="mt-2 overflow-hidden">
                <div className="text-xs font-semibold text-slate-700 leading-4 line-clamp-2">{page.title}</div>
              </div>
              <div className="relative mt-0.5 overflow-hidden">
                {page.content_outline.length > 0 ? (
                  <div className="text-[11px] leading-4 text-slate-400 line-clamp-2">
                    {page.content_outline[0]}
                  </div>
                ) : (
                  <div className="text-[11px] leading-4 text-slate-400">无要点</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded-md bg-slate-800/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {page.sort_order}
                  </span>
                  <span className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                    {page.page_role}
                  </span>
                </div>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${pagePreviewTone(surface)}`}>
                  {pagePreviewLabel(surface)}
                </span>
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-700 leading-4 line-clamp-3">{page.title}</div>
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-2 text-[11px] leading-4 text-slate-400">
                {pageSurfacePlaceholder(page, surface)}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export const SearchResultCard: FC<{
  item: PageSummary['page_search_results'][number];
  onRetry?: (sourceId: string) => void;
  retrying?: boolean;
  allowRetry?: boolean;
}> = ({ item, onRetry, retrying, allowRetry }) => {
  const readTone =
    item.read_status === 'failed'
      ? 'rose'
      : item.read_status === 'ready' || item.read_status === 'reused'
      ? 'emerald'
      : 'amber';
  const vectorTone = item.vector_status === 'ready' ? 'blue' : item.vector_status === 'failed' ? 'rose' : 'amber';
  const retryLabel = item.read_status === 'failed' ? '重试正文与向量化' : '重新向量化';
  const showRetry = Boolean(onRetry) && Boolean(allowRetry) && (item.read_status === 'failed' || item.vector_status !== 'ready');
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <a href={item.url} target="_blank" rel="noreferrer" className="block text-base font-semibold text-blue-600 hover:underline break-words">
            {item.title}
          </a>
          <div className="text-xs text-emerald-600 break-all">{item.url}</div>
        </div>
        {item.query_purpose ? (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {item.query_purpose}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {renderStatusPill('搜索', `R${item.search_rank}`, 'slate')}
        {renderStatusPill('全文', item.read_status ?? 'pending', readTone)}
        {renderStatusPill('向量', item.vector_status ?? 'pending', vectorTone)}
      </div>
      <div className="text-xs text-slate-500">{item.query_text}</div>
      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {item.content_excerpt_md || item.snippet || '搜索摘要已入库，等待抓取全文。'}
      </p>
      {showRetry ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={retrying}
            onClick={() => onRetry?.(item.id)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? '处理中...' : retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const DataModal: FC<{
  open: boolean;
  surface: EditorSurface;
  page: PageSummary | null;
  titleDraft: string;
  bulletDraft: string;
  summaryDraft: string;
  onTitleChange: (value: string) => void;
  onBulletChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onSaveOutline: () => void;
  onSaveSummary: () => void;
  onClose: () => void;
  isSavingOutline: boolean;
  isSavingSummary: boolean;
}> = ({
  open,
  surface,
  page,
  titleDraft,
  bulletDraft,
  summaryDraft,
  onTitleChange,
  onBulletChange,
  onSummaryChange,
  onSaveOutline,
  onSaveSummary,
  onClose,
  isSavingOutline,
  isSavingSummary,
}) => {
  if (!open || !page) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{surface} / 原始数据</div>
            <div className="text-xl font-semibold text-slate-800">{page.title}</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="font-semibold text-slate-800">页面结构</div>
            <input value={titleDraft} onChange={(event) => onTitleChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <textarea value={bulletDraft} onChange={(event) => onBulletChange(event.target.value)} rows={6} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
            <div className="flex justify-end">
              <button onClick={onSaveOutline} disabled={isSavingOutline} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40">
                {isSavingOutline ? '保存中...' : '保存页面结构'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <FileText size={16} />
              当前页搜索词
            </div>
            {page.page_search_queries.length ? (
              <div className="space-y-3">
                {page.page_search_queries.map((item) => (
                  <div key={`${item.query_text}-${item.query_purpose}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="text-sm font-medium text-slate-700">{item.query_text}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.query_purpose}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">当前页还没有搜索词。</div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">当前页 summary</div>
              <div className="text-xs text-slate-500">引用数 {page.page_summary_citations.length}</div>
            </div>
            <textarea value={summaryDraft} onChange={(event) => onSummaryChange(event.target.value)} rows={10} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none resize-none focus:border-blue-500" placeholder="当前页 summary 会显示在这里。" />
            <div className="flex justify-end">
              <button onClick={onSaveSummary} disabled={isSavingSummary} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                {isSavingSummary ? '保存中...' : '保存 summary'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
