import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText, Palette, X } from 'lucide-react';

export type PresentationSurface = 'draft' | 'design';

export type PresentationSlide = {
  pageId: string;
  sortOrder: number;
  title: string;
  pageRole: string;
  partTitle: string | null;
  markup: string | null;
};

function slidePlaceholder(surface: PresentationSurface): string {
  return surface === 'draft' ? '当前页初稿尚未生成' : '当前页设计稿尚未生成';
}

function slideRoleLabel(pageRole: string): string {
  if (pageRole === 'cover') return '首页';
  if (pageRole === 'toc') return '目录';
  if (pageRole === 'end') return '结束页';
  return '内容页';
}

export default function PresentationPlayer({
  slides,
  index,
  surface,
  onIndexChange,
  onClose,
}: {
  slides: PresentationSlide[];
  index: number;
  surface: PresentationSurface;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const activeSlide = slides[index] ?? null;
  const isFirst = index <= 0;
  const isLast = index >= slides.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        if (!isFirst) {
          onIndexChange(index - 1);
        }
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        if (!isLast) {
          onIndexChange(index + 1);
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [index, isFirst, isLast, onClose, onIndexChange]);

  if (!activeSlide) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.10),_transparent_36%)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/50">
              {surface === 'draft' ? <FileText size={14} /> : <Palette size={14} />}
              {surface === 'draft' ? '初稿放映' : '设计稿放映'}
            </div>
            <div className="truncate text-lg font-semibold text-white">{activeSlide.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-between gap-6 px-6 pb-6">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => !isFirst && onIndexChange(index - 1)}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-4 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-medium">
                #{activeSlide.sortOrder}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-medium">
                {slideRoleLabel(activeSlide.pageRole)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-medium">
                {activeSlide.partTitle || '未分组'}
              </span>
            </div>

            <div
              className="aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.55)]"
              style={{ width: 'min(92vw, calc((100vh - 13rem) * 16 / 9))' }}
            >
              {activeSlide.markup ? (
                <div
                  className="h-full w-full bg-white [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: activeSlide.markup }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100 text-slate-500">
                  <div className="text-base font-semibold">{slidePlaceholder(surface)}</div>
                  <div className="text-sm text-slate-400">{activeSlide.title}</div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={isLast}
            onClick={() => !isLast && onIndexChange(index + 1)}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-4 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-4 text-sm text-white/70">
              <div className="truncate">
                {index + 1} / {slides.length} · {activeSlide.title}
              </div>
              <div className="shrink-0">Esc 退出 · ← → 切换</div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.pageId}
                  type="button"
                  onClick={() => onIndexChange(slideIndex)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    slideIndex === index
                      ? 'border-blue-400 bg-blue-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">#{slide.sortOrder}</div>
                  <div className="mt-1 max-w-[10rem] truncate">{slide.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
