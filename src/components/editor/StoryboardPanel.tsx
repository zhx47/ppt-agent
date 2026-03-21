import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FileText, GripHorizontal, Palette, Plus, Search, Trash2 } from 'lucide-react';
import type { OutlineResponse, PageSummary } from '../../lib/ppt-api';
import type { EditorSurface } from './EditorBits';

type StoryboardContentPage = {
  key: string;
  page_id: string | null;
  title: string;
  content_outline: string[];
};

type StoryboardSection = {
  key: string;
  title: string;
  pages: StoryboardContentPage[];
};

type StoryboardPatchPayload = Array<{
  part_title: string;
  pages: Array<{
    page_id?: string | null;
    title: string;
    content_outline: string[];
  }>;
}>;

type DragItem =
  | { type: 'section'; sectionIndex: number }
  | { type: 'page'; sectionIndex: number; pageIndex: number };

type DropTarget =
  | { type: 'section'; sectionIndex: number; position: 'before' | 'after' }
  | { type: 'page'; sectionIndex: number; pageIndex: number; position: 'before' | 'after' };

function formatSectionNo(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function fixedPageLabel(pageRole: string): string {
  if (pageRole === 'cover') return '首页';
  if (pageRole === 'toc') return '目录';
  if (pageRole === 'end') return '结束页';
  return '固定页';
}

function normalizeTitle(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function normalizeBullets(items: string[], fallback: string): string[] {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  return normalized.length ? normalized : [fallback];
}

function cloneSections(sections: StoryboardSection[]): StoryboardSection[] {
  return sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({
      ...page,
      content_outline: [...page.content_outline],
    })),
  }));
}

function sanitizeSections(sections: StoryboardSection[]): StoryboardSection[] {
  return sections.map((section, sectionIndex) => ({
    ...section,
    title: normalizeTitle(section.title, `新章节 ${formatSectionNo(sectionIndex)}`),
    pages: section.pages.map((page, pageIndex) => ({
      ...page,
      title: normalizeTitle(page.title, `新内容页 ${pageIndex + 1}`),
      content_outline: normalizeBullets(page.content_outline, '补充当前页要点'),
    })),
  }));
}

function buildPayload(sections: StoryboardSection[]): StoryboardPatchPayload {
  return sanitizeSections(sections).map((section) => ({
    part_title: section.title,
    pages: section.pages.map((page) => ({
      page_id: page.page_id,
      title: page.title,
      content_outline: page.content_outline,
    })),
  }));
}

function buildSignature(sections: StoryboardSection[]): string {
  return JSON.stringify(buildPayload(sections));
}

function splitStoryboardPages(pages: PageSummary[]) {
  const orderedPages = [...pages].sort((left, right) => left.sort_order - right.sort_order);
  const prefixPages: PageSummary[] = [];
  const suffixPages: PageSummary[] = [];
  const contentPages: PageSummary[] = [];
  let seenContent = false;

  orderedPages.forEach((page) => {
    if (page.page_role === 'content') {
      seenContent = true;
      contentPages.push(page);
      return;
    }
    if (!seenContent) {
      prefixPages.push(page);
      return;
    }
    suffixPages.push(page);
  });

  return {prefixPages, suffixPages, contentPages};
}

function createContentPage(page: PageSummary): StoryboardContentPage {
  return {
    key: page.page_id,
    page_id: page.page_id,
    title: page.title,
    content_outline: page.content_outline,
  };
}

function buildSectionsFromPartTitle(contentPages: PageSummary[]): StoryboardSection[] {
  const sections: StoryboardSection[] = [];
  const sectionIndexByTitle = new Map<string, number>();

  contentPages.forEach((page) => {
    const title = normalizeTitle(page.part_title ?? '', '未命名章节');
    const existingIndex = sectionIndexByTitle.get(title);
    if (existingIndex === undefined) {
      sectionIndexByTitle.set(title, sections.length);
      sections.push({
        key: `part-${sections.length}`,
        title,
        pages: [createContentPage(page)],
      });
      return;
    }
    sections[existingIndex].pages.push(createContentPage(page));
  });

  return sections;
}

function buildSectionsFromOutline(contentPages: PageSummary[], outline: OutlineResponse | null): StoryboardSection[] {
  const parts = outline?.outline?.ppt_outline?.parts ?? [];
  if (!parts.length) {
    return buildSectionsFromPartTitle(contentPages);
  }

  const sections: StoryboardSection[] = [];
  let contentIndex = 0;

  for (const [partIndex, part] of parts.entries()) {
    const partPages = Array.isArray(part.pages) ? part.pages : [];
    const nextPages = contentPages.slice(contentIndex, contentIndex + partPages.length).map(createContentPage);
    if (nextPages.length !== partPages.length) {
      return buildSectionsFromPartTitle(contentPages);
    }
    sections.push({
      key: `part-${partIndex}`,
      title: normalizeTitle(part.part_title ?? '', `新章节 ${formatSectionNo(partIndex)}`),
      pages: nextPages,
    });
    contentIndex += partPages.length;
  }

  if (contentIndex !== contentPages.length) {
    return buildSectionsFromPartTitle(contentPages);
  }

  return sections;
}

function buildDisplayOrderMap(prefixPages: PageSummary[], sections: StoryboardSection[], suffixPages: PageSummary[]) {
  const displayOrderMap = new Map<string, number>();
  let currentOrder = 1;

  prefixPages.forEach((page) => {
    displayOrderMap.set(page.page_id, currentOrder);
    currentOrder += 1;
  });
  sections.forEach((section) => {
    section.pages.forEach((page) => {
      displayOrderMap.set(page.key, currentOrder);
      currentOrder += 1;
    });
  });
  suffixPages.forEach((page) => {
    displayOrderMap.set(page.page_id, currentOrder);
    currentOrder += 1;
  });

  return displayOrderMap;
}

function resolveDropPosition(event: DragEvent<HTMLElement>): 'before' | 'after' {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  return ratio < 0.5 ? 'before' : 'after';
}

function moveSection(
  sections: StoryboardSection[],
  sourceSectionIndex: number,
  targetSectionIndex: number,
  position: 'before' | 'after',
): StoryboardSection[] {
  if (sourceSectionIndex === targetSectionIndex && position === 'before') {
    return sections;
  }

  const nextSections = cloneSections(sections);
  const [movedSection] = nextSections.splice(sourceSectionIndex, 1);
  if (!movedSection) {
    return sections;
  }

  let insertIndex = targetSectionIndex + (position === 'after' ? 1 : 0);
  if (sourceSectionIndex < insertIndex) {
    insertIndex -= 1;
  }
  insertIndex = Math.max(0, Math.min(insertIndex, nextSections.length));
  nextSections.splice(insertIndex, 0, movedSection);
  return nextSections;
}

function movePage(
  sections: StoryboardSection[],
  sourceSectionIndex: number,
  sourcePageIndex: number,
  target: DropTarget,
): StoryboardSection[] {
  const nextSections = cloneSections(sections);
  const sourcePages = nextSections[sourceSectionIndex]?.pages;
  if (!sourcePages) {
    return sections;
  }

  const [movedPage] = sourcePages.splice(sourcePageIndex, 1);
  if (!movedPage) {
    return sections;
  }

  const targetPages = nextSections[target.sectionIndex]?.pages;
  if (!targetPages) {
    return sections;
  }

  let insertIndex =
    target.type === 'page'
      ? target.pageIndex + (target.position === 'after' ? 1 : 0)
      : target.position === 'before'
      ? 0
      : targetPages.length;

  if (sourceSectionIndex === target.sectionIndex && sourcePageIndex < insertIndex) {
    insertIndex -= 1;
  }

  insertIndex = Math.max(0, Math.min(insertIndex, targetPages.length));
  targetPages.splice(insertIndex, 0, movedPage);
  return nextSections;
}

function updateSectionTitle(sections: StoryboardSection[], sectionIndex: number, title: string): StoryboardSection[] {
  return sections.map((section, index) => (index === sectionIndex ? {...section, title} : section));
}

function updatePageTitle(sections: StoryboardSection[], sectionIndex: number, pageIndex: number, title: string): StoryboardSection[] {
  return sections.map((section, currentSectionIndex) => {
    if (currentSectionIndex !== sectionIndex) {
      return section;
    }
    return {
      ...section,
      pages: section.pages.map((page, currentPageIndex) => (currentPageIndex === pageIndex ? {...page, title} : page)),
    };
  });
}

function removeSection(sections: StoryboardSection[], sectionIndex: number): StoryboardSection[] {
  return sections.filter((_, index) => index !== sectionIndex);
}

function removePage(sections: StoryboardSection[], sectionIndex: number, pageIndex: number): StoryboardSection[] {
  return sections.map((section, currentSectionIndex) => {
    if (currentSectionIndex !== sectionIndex) {
      return section;
    }
    return {
      ...section,
      pages: section.pages.filter((_, currentPageIndex) => currentPageIndex !== pageIndex),
    };
  });
}

function InsertionIndicator({ position }: { position: 'before' | 'after' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-y-4 z-20 w-1 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)] ${
        position === 'before' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
      }`}
    />
  );
}

function JumpButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-2xl py-3 text-[10px] font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-300'
          : active
          ? 'bg-blue-50 text-blue-700'
          : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600'
      }`}
    >
      <span className="flex flex-col items-center justify-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

function StoryboardPageCard({
  pageId,
  title,
  contentOutline,
  roleLabel,
  displayOrder,
  surface,
  active,
  editable = false,
  draggable = false,
  saving = false,
  unsaved = false,
  dropPosition = null,
  onTitleChange,
  onTitleBlur,
  onDelete,
  onJump,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  pageId: string | null;
  title: string;
  contentOutline: string[];
  roleLabel: string;
  displayOrder: number;
  surface: EditorSurface;
  active: boolean;
  editable?: boolean;
  draggable?: boolean;
  saving?: boolean;
  unsaved?: boolean;
  dropPosition?: 'before' | 'after' | null;
  onTitleChange?: (value: string) => void;
  onTitleBlur?: () => void;
  onDelete?: () => void;
  onJump: (pageId: string, nextSurface: EditorSurface) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const jumpDisabled = !pageId || saving;

  return (
    <div
      draggable={draggable && !saving}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex min-h-[248px] w-[320px] shrink-0 flex-col rounded-[2rem] border-2 bg-white p-7 shadow-sm transition-all ${
        draggable && !saving ? 'cursor-grab active:cursor-grabbing' : ''
      } ${active ? 'border-blue-400 shadow-md shadow-blue-100' : 'border-slate-100 hover:shadow-md'}`}
    >
      {dropPosition ? <InsertionIndicator position={dropPosition} /> : null}
      {onDelete ? (
        <div className="pointer-events-none absolute -top-3 -right-3 z-20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-full border border-rose-100 bg-rose-50 p-2 text-rose-500 shadow-md transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-400">#{displayOrder}</div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              {roleLabel}
            </span>
            {unsaved ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                待保存
              </span>
            ) : null}
          </div>
        </div>
        {draggable ? (
          <div className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-400">
            <GripHorizontal size={16} />
          </div>
        ) : null}
      </div>

      {editable ? (
        <textarea
          value={title}
          rows={1}
          readOnly={saving}
          onChange={(event) => onTitleChange?.(event.target.value)}
          onBlur={() => onTitleBlur?.()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="w-full resize-none overflow-hidden bg-transparent text-lg font-bold leading-snug text-slate-800 outline-none"
        />
      ) : (
        <div className="text-lg font-bold leading-snug text-slate-800">{title}</div>
      )}

      <div className="mt-5 space-y-2.5">
        {contentOutline.map((item, index) => (
          <div key={`${index}-${item}`} className="text-xs font-medium leading-relaxed text-slate-500">
            {index + 1}. {item}
          </div>
        ))}
      </div>

      <div className="mt-auto flex justify-between gap-3 border-t border-slate-50 pt-4">
        <JumpButton
          active={active && surface === 'search'}
          disabled={jumpDisabled}
          icon={<Search size={18} />}
          label="搜索"
          onClick={() => pageId && onJump(pageId, 'search')}
        />
        <JumpButton
          active={active && surface === 'draft'}
          disabled={jumpDisabled}
          icon={<FileText size={18} />}
          label="初稿"
          onClick={() => pageId && onJump(pageId, 'draft')}
        />
        <JumpButton
          active={active && surface === 'design'}
          disabled={jumpDisabled}
          icon={<Palette size={18} />}
          label="设计稿"
          onClick={() => pageId && onJump(pageId, 'design')}
        />
      </div>
    </div>
  );
}

function SectionCard({
  index,
  title,
  pageCount,
  saving,
  dropPosition = null,
  onTitleChange,
  onTitleBlur,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  index: number;
  title: string;
  pageCount: number;
  saving: boolean;
  dropPosition?: 'before' | 'after' | null;
  onTitleChange: (value: string) => void;
  onTitleBlur: () => void;
  onDelete?: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      draggable={!saving}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="group relative flex min-h-[248px] w-[320px] shrink-0 cursor-grab flex-col rounded-[2rem] border-2 border-slate-100 bg-white p-7 shadow-sm transition-all hover:shadow-md active:cursor-grabbing"
    >
      {dropPosition ? <InsertionIndicator position={dropPosition} /> : null}
      {onDelete ? (
        <div className="pointer-events-none absolute -top-3 -right-3 z-20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-full border border-rose-100 bg-rose-50 p-2 text-rose-500 shadow-md transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <span className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
          章节
        </span>
        <div className="flex items-center gap-3">
          <span className="text-5xl font-bold tracking-tighter text-slate-200">{formatSectionNo(index)}</span>
          <div className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-400">
            <GripHorizontal size={16} />
          </div>
        </div>
      </div>

      <textarea
        value={title}
        rows={4}
        readOnly={saving}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={onTitleBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="mt-8 w-full resize-none overflow-hidden bg-transparent text-2xl font-bold leading-snug text-slate-800 outline-none"
      />

      <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <span>Section</span>
        <span>{pageCount} Pages</span>
      </div>
    </div>
  );
}

function AddCard({
  label,
  disabled,
  highlighted = false,
  onClick,
  onDragOver,
  onDrop,
}: {
  label: string;
  disabled?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex min-h-[248px] w-[320px] shrink-0 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed bg-white/70 transition-all ${
        disabled
          ? 'cursor-not-allowed border-slate-200 text-slate-300'
          : highlighted
          ? 'border-blue-400 bg-blue-50/70 text-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]'
          : 'border-slate-300 text-slate-400 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-600'
      }`}
    >
      <div className="rounded-full border border-slate-200 bg-white p-3 shadow-sm">
        <Plus size={22} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export default function StoryboardPanel({
  outline,
  pages,
  activePageId,
  surface,
  isSaving,
  onJump,
  onReorder,
}: {
  outline: OutlineResponse | null;
  pages: PageSummary[];
  activePageId: string | null;
  surface: EditorSurface;
  isSaving: boolean;
  onJump: (pageId: string, nextSurface: EditorSurface) => void;
  onReorder: (parts: StoryboardPatchPayload) => Promise<void>;
}) {
  const tempIdRef = useRef(0);
  const layout = useMemo(() => {
    const {prefixPages, suffixPages, contentPages} = splitStoryboardPages(pages);
    return {
      prefixPages,
      suffixPages,
      sections: buildSectionsFromOutline(contentPages, outline),
    };
  }, [outline, pages]);

  const [sections, setSections] = useState<StoryboardSection[]>(layout.sections);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    setSections(layout.sections);
  }, [layout.sections]);

  const syncedSignature = useMemo(() => buildSignature(layout.sections), [layout.sections]);
  const localSignature = useMemo(() => buildSignature(sections), [sections]);
  const isDirty = localSignature !== syncedSignature;

  const displayOrderMap = useMemo(
    () => buildDisplayOrderMap(layout.prefixPages, sections, layout.suffixPages),
    [layout.prefixPages, layout.suffixPages, sections],
  );

  const clearDragState = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const persistSections = (nextSections: StoryboardSection[]) => {
    const sanitized = sanitizeSections(nextSections);
    setSections(sanitized);
    if (isSaving) {
      return;
    }
    if (buildSignature(sanitized) === syncedSignature) {
      return;
    }
    void onReorder(buildPayload(sanitized));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, item: DragItem) => {
    if (isSaving) {
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
    setDraggedItem(item);
  };

  const handleSectionDragOver = (event: DragEvent<HTMLDivElement>, sectionIndex: number) => {
    if (!draggedItem || isSaving) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDropTarget({type: 'section', sectionIndex, position: resolveDropPosition(event)});
  };

  const handlePageDragOver = (event: DragEvent<HTMLDivElement>, sectionIndex: number, pageIndex: number) => {
    if (!draggedItem || draggedItem.type !== 'page' || isSaving) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDropTarget({type: 'page', sectionIndex, pageIndex, position: resolveDropPosition(event)});
  };

  const handleSectionAppendDragOver = (event: DragEvent<HTMLButtonElement>, sectionIndex: number) => {
    if (!draggedItem || draggedItem.type !== 'page' || isSaving) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDropTarget({type: 'section', sectionIndex, position: 'after'});
  };

  const handleSectionDrop = (event: DragEvent<HTMLDivElement>, sectionIndex: number) => {
    if (!draggedItem || !dropTarget || isSaving) {
      clearDragState();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (dropTarget.type !== 'section' || dropTarget.sectionIndex !== sectionIndex) {
      clearDragState();
      return;
    }

    const nextSections =
      draggedItem.type === 'section'
        ? moveSection(sections, draggedItem.sectionIndex, sectionIndex, dropTarget.position)
        : movePage(sections, draggedItem.sectionIndex, draggedItem.pageIndex, dropTarget);

    if (buildSignature(nextSections) !== buildSignature(sections)) {
      persistSections(nextSections);
    }
    clearDragState();
  };

  const handlePageDrop = (event: DragEvent<HTMLDivElement>, sectionIndex: number, pageIndex: number) => {
    if (!draggedItem || !dropTarget || draggedItem.type !== 'page' || isSaving) {
      clearDragState();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (dropTarget.type !== 'page' || dropTarget.sectionIndex !== sectionIndex || dropTarget.pageIndex !== pageIndex) {
      clearDragState();
      return;
    }

    const nextSections = movePage(sections, draggedItem.sectionIndex, draggedItem.pageIndex, dropTarget);
    if (buildSignature(nextSections) !== buildSignature(sections)) {
      persistSections(nextSections);
    }
    clearDragState();
  };

  const handleSectionAppendDrop = (event: DragEvent<HTMLButtonElement>, sectionIndex: number) => {
    if (!draggedItem || draggedItem.type !== 'page' || isSaving) {
      clearDragState();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const target: DropTarget = {type: 'section', sectionIndex, position: 'after'};
    const nextSections = movePage(sections, draggedItem.sectionIndex, draggedItem.pageIndex, target);
    if (buildSignature(nextSections) !== buildSignature(sections)) {
      persistSections(nextSections);
    }
    clearDragState();
  };

  const handleAddSection = () => {
    if (isSaving) {
      return;
    }
    const nextSections = [
      ...sections,
      {
        key: `section-${Date.now()}`,
        title: `新章节 ${formatSectionNo(sections.length)}`,
        pages: [],
      },
    ];
    persistSections(nextSections);
  };

  const handleAddPage = (sectionIndex: number) => {
    if (isSaving) {
      return;
    }
    tempIdRef.current += 1;
    const nextSections = sections.map((section, currentIndex) => {
      if (currentIndex !== sectionIndex) {
        return section;
      }
      return {
        ...section,
        pages: [
          ...section.pages,
          {
            key: `temp-page-${tempIdRef.current}`,
            page_id: null,
            title: `新内容页 ${section.pages.length + 1}`,
            content_outline: ['补充当前页要点'],
          },
        ],
      };
    });
    persistSections(nextSections);
  };

  const handleDeleteSection = (sectionIndex: number) => {
    if (isSaving) {
      return;
    }
    const section = sections[sectionIndex];
    if (!section) {
      return;
    }
    const shouldDelete =
      typeof window === 'undefined'
        ? true
        : window.confirm(`删除章节「${section.title || `章节 ${formatSectionNo(sectionIndex)}`}」？章节内 ${section.pages.length} 个内容页会一起删除。`);
    if (!shouldDelete) {
      return;
    }
    persistSections(removeSection(sections, sectionIndex));
  };

  const handleDeletePage = (sectionIndex: number, pageIndex: number) => {
    if (isSaving) {
      return;
    }
    const page = sections[sectionIndex]?.pages[pageIndex];
    if (!page) {
      return;
    }
    const shouldDelete =
      typeof window === 'undefined' ? true : window.confirm(`删除页面「${page.title || `内容页 ${pageIndex + 1}`}」？`);
    if (!shouldDelete) {
      return;
    }
    persistSections(removePage(sections, sectionIndex, pageIndex));
  };

  const rootEntries = [
    ...layout.prefixPages.map((page) => ({
      key: page.page_id,
      label: fixedPageLabel(page.page_role),
      tone: 'fixed' as const,
    })),
    ...sections.map((section, index) => ({
      key: section.key,
      label: `${formatSectionNo(index)} ${normalizeTitle(section.title, `新章节 ${formatSectionNo(index)}`)}`,
      tone: 'section' as const,
    })),
    ...layout.suffixPages.map((page) => ({
      key: page.page_id,
      label: fixedPageLabel(page.page_role),
      tone: 'fixed' as const,
    })),
  ];

  return (
    <div
      className="flex-1 overflow-auto bg-[#f4f5f7] p-12"
      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
    >
      <div className="mx-auto max-w-[2200px]">
        <div className="w-full overflow-x-auto pb-6">
          <div className="flex min-h-full w-max items-start gap-16">
            <div className="sticky left-0 z-20 w-[300px] shrink-0 self-center">
              <div className="relative rounded-[2rem] border border-blue-400/30 bg-[#5ab0ff] p-6 text-white shadow-xl shadow-blue-200/50">
                <div className="mb-6 text-right text-[10px] font-bold uppercase tracking-widest opacity-80">Contents</div>
                <div className="space-y-4 pr-2">
                  {rootEntries.map((entry) => (
                    <div key={entry.key} className="flex items-start gap-3 text-sm font-bold leading-snug opacity-95">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          entry.tone === 'section' ? 'bg-white/20 text-white' : 'bg-slate-900/15 text-white/80'
                        }`}
                      >
                        {entry.tone === 'section' ? '章节' : '固定'}
                      </span>
                      <span>{entry.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-5">
                  <span className="text-xs font-bold tracking-wide">PPT Structure</span>
                  <span className="text-xs opacity-80">{sections.length} 个章节</span>
                </div>
                <div className="absolute top-1/2 -right-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
              </div>
            </div>

            <div className="relative flex flex-col gap-12">
              <div className="absolute bottom-[120px] left-[-2rem] top-[120px] w-px border-l-2 border-dashed border-slate-300" />

              {layout.prefixPages.map((page) => (
                <div key={page.page_id} className="relative flex items-center gap-8">
                  <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
                  <StoryboardPageCard
                    pageId={page.page_id}
                    title={page.title}
                    contentOutline={page.content_outline}
                    roleLabel={fixedPageLabel(page.page_role)}
                    displayOrder={displayOrderMap.get(page.page_id) ?? page.sort_order}
                    surface={surface}
                    active={page.page_id === activePageId}
                    saving={isSaving}
                    onJump={onJump}
                  />
                </div>
              ))}

              {sections.map((section, sectionIndex) => (
                <div key={section.key} className="relative flex items-center gap-12">
                  <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />

                  <SectionCard
                    index={sectionIndex}
                    title={section.title}
                    pageCount={section.pages.length}
                    saving={isSaving}
                    dropPosition={
                      dropTarget?.type === 'section' && dropTarget.sectionIndex === sectionIndex ? dropTarget.position : null
                    }
                    onTitleChange={(value) => setSections((current) => updateSectionTitle(current, sectionIndex, value))}
                    onTitleBlur={() => {
                      if (isDirty) {
                        persistSections(sections);
                      }
                    }}
                    onDelete={() => handleDeleteSection(sectionIndex)}
                    onDragStart={(event) => handleDragStart(event, {type: 'section', sectionIndex})}
                    onDragOver={(event) => handleSectionDragOver(event, sectionIndex)}
                    onDrop={(event) => handleSectionDrop(event, sectionIndex)}
                    onDragEnd={clearDragState}
                  />

                  <div className="relative flex items-center gap-8">
                    <div className="absolute top-1/2 -left-12 h-px w-12 border-t-2 border-dashed border-slate-300" />

                    {section.pages.map((page, pageIndex) => (
                      <div key={page.key} className="relative flex items-center gap-8">
                        {pageIndex > 0 ? (
                          <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
                        ) : null}
                        <StoryboardPageCard
                          pageId={page.page_id}
                          title={page.title}
                          contentOutline={page.content_outline}
                          roleLabel="内容页"
                          displayOrder={displayOrderMap.get(page.key) ?? sectionIndex + pageIndex + 1}
                          surface={surface}
                          active={page.page_id === activePageId}
                          editable
                          draggable
                          saving={isSaving}
                          unsaved={!page.page_id}
                          dropPosition={
                            dropTarget?.type === 'page' &&
                            dropTarget.sectionIndex === sectionIndex &&
                            dropTarget.pageIndex === pageIndex
                              ? dropTarget.position
                              : null
                          }
                          onTitleChange={(value) =>
                            setSections((current) => updatePageTitle(current, sectionIndex, pageIndex, value))
                          }
                          onTitleBlur={() => {
                            if (isDirty) {
                              persistSections(sections);
                            }
                          }}
                          onDelete={() => handleDeletePage(sectionIndex, pageIndex)}
                          onJump={onJump}
                          onDragStart={(event) => handleDragStart(event, {type: 'page', sectionIndex, pageIndex})}
                          onDragOver={(event) => handlePageDragOver(event, sectionIndex, pageIndex)}
                          onDrop={(event) => handlePageDrop(event, sectionIndex, pageIndex)}
                          onDragEnd={clearDragState}
                        />
                      </div>
                    ))}

                    <div className="relative flex items-center gap-8">
                      <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
                      <AddCard
                        label="添加新内容页"
                        disabled={isSaving}
                        highlighted={
                          draggedItem?.type === 'page' &&
                          dropTarget?.type === 'section' &&
                          dropTarget.sectionIndex === sectionIndex &&
                          dropTarget.position === 'after'
                        }
                        onClick={() => handleAddPage(sectionIndex)}
                        onDragOver={(event) => handleSectionAppendDragOver(event, sectionIndex)}
                        onDrop={(event) => handleSectionAppendDrop(event, sectionIndex)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="relative flex items-center gap-12">
                <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
                <AddCard label="添加新章节" disabled={isSaving} onClick={handleAddSection} />
              </div>

              {layout.suffixPages.map((page) => (
                <div key={page.page_id} className="relative flex items-center gap-8">
                  <div className="absolute top-1/2 -left-8 h-px w-8 border-t-2 border-dashed border-slate-300" />
                  <StoryboardPageCard
                    pageId={page.page_id}
                    title={page.title}
                    contentOutline={page.content_outline}
                    roleLabel={fixedPageLabel(page.page_role)}
                    displayOrder={displayOrderMap.get(page.page_id) ?? page.sort_order}
                    surface={surface}
                    active={page.page_id === activePageId}
                    saving={isSaving}
                    onJump={onJump}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
