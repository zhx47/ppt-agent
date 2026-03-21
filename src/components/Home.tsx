import { useEffect, useState } from 'react';
import { Search, Plus, FileText, Clock, LoaderCircle } from 'lucide-react';
import { ApiError, createProject, listProjects, type ProjectSummary } from '../lib/ppt-api';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function projectPreviewLabel(project: ProjectSummary): string {
  if (project.preview_surface === 'design') return '首页设计稿';
  if (project.preview_surface === 'draft') return '首页初稿';
  return '方案兜底';
}

function projectPreviewTone(project: ProjectSummary): string {
  if (project.preview_surface === 'design') return 'bg-emerald-500/90 text-white';
  if (project.preview_surface === 'draft') return 'bg-blue-500/90 text-white';
  return 'bg-slate-800/60 text-white';
}

export default function Home({ onStart }: { onStart: (project: ProjectSummary) => void }) {
  const [requestText, setRequestText] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const response = await listProjects();
        if (!cancelled) {
          setProjects(response.items);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : '最近项目读取失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateProject = async () => {
    const nextRequest = requestText.trim();
    if (!nextRequest || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const project = await createProject(nextRequest);
      onStart(project);
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError('项目创建失败');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pt-32 px-6">
      <h1 className="text-5xl font-bold text-center mb-12 text-slate-800 tracking-tight">AI PPT 生成助手</h1>

      <div
        className={`max-w-3xl mx-auto rounded-[2rem] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 transition-shadow hover:shadow-xl hover:shadow-slate-200/50 ${
          error ? 'mb-4' : 'mb-20'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="pt-1 text-slate-400 shrink-0">
            <Search size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <textarea
              value={requestText}
              placeholder="输入你的 PPT 需求，例如：生成一份关于 2024 年人工智能发展趋势的报告..."
              rows={5}
              className="min-h-[160px] w-full resize-none bg-transparent text-lg leading-7 text-slate-700 outline-none placeholder:text-slate-400"
              onChange={(event) => setRequestText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateProject();
                }
              }}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-xs leading-5 text-slate-400">Enter 换行，Ctrl/Cmd + Enter 开始生成</div>
          <button
            onClick={() => {
              void handleCreateProject();
            }}
            disabled={isCreating || !requestText.trim()}
            className="h-12 self-end rounded-xl bg-blue-600 px-6 text-white font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 flex items-center justify-center gap-2 shadow-sm"
          >
            {isCreating ? <LoaderCircle size={20} className="animate-spin" /> : <Plus size={20} />}
            开始生成
          </button>
        </div>
      </div>
      {error ? <p className="max-w-3xl mx-auto mb-16 text-sm text-red-600">{error}</p> : null}

      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-700">
          <Clock size={20} className="text-slate-400" />
          最近项目
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading && (
            <div className="md:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-sm text-slate-500">
              正在读取最近项目...
            </div>
          )}
          {!isLoading && projects.length === 0 && (
            <div className="md:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-sm text-slate-500">
              还没有项目，先创建一个任务。
            </div>
          )}
          {!isLoading &&
            projects.map((project) => (
              <div
                key={project.project_id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group"
                onClick={() => onStart(project)}
              >
                <div className="relative mb-4 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 aspect-video group-hover:border-blue-100 transition-colors">
                  {project.preview_svg_markup ? (
                    <div
                      className="absolute inset-0 bg-white [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: project.preview_svg_markup }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center group-hover:bg-blue-50/50 transition-colors">
                      <FileText size={36} className="text-slate-300 group-hover:text-blue-300 transition-colors" />
                    </div>
                  )}
                  <div className={`absolute right-3 top-3 rounded-md px-2 py-1 text-[10px] font-medium backdrop-blur-md ${projectPreviewTone(project)}`}>
                    {projectPreviewLabel(project)}
                  </div>
                </div>
                <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {project.title}
                </h3>
                <p className="text-sm text-slate-400 mt-1.5">{formatDate(project.updated_at)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
