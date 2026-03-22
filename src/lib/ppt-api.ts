export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ProjectStage = 'init' | 'outline' | 'search' | 'draft' | 'design' | 'export';
export type ScopeType = 'project' | 'page';
export type UiSurface = 'init' | 'outline_loading' | 'search' | 'draft' | 'design';
export type PreviewSurface = 'design' | 'draft' | 'document' | 'fallback';

export interface WorkflowConstraint {
  code: string;
  label: string;
  detail: string;
}

export interface StyleOption {
  style_id: string;
  style_name: string;
  description: string;
  palette: Record<string, string>;
}

export interface ProjectSummary {
  project_id: string;
  title: string;
  request_text: string;
  current_stage: ProjectStage;
  page_count_target: number | null;
  style_preset: string | null;
  background_asset_path: string | null;
  workflow_constraints: WorkflowConstraint[];
  page_count: number;
  preview_surface?: PreviewSurface;
  preview_svg_markup?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
}

export interface RequirementOption {
  option_code: string;
  label: string;
  page_count?: number;
  reason?: string;
}

export interface RequirementQuestionOption {
  option_code: string;
  label: string;
  description?: string;
  value?: string | number;
}

export interface RequirementQuestion {
  question_code: string;
  label: string;
  description?: string;
  options: RequirementQuestionOption[];
  allow_custom: boolean;
}

export interface InitSearchQuery {
  query_text: string;
  query_purpose: string;
}

export interface InitSearchResult {
  id: string;
  query_text: string;
  query_purpose: string;
  search_rank: number;
  title: string;
  url: string;
  bocha_summary: string;
  snippet?: string;
  content_excerpt_md?: string;
  read_status?: string;
  vector_status?: string;
  source_document_id?: string | null;
}

export interface CorpusDigest {
  collection_id?: string;
  document_count: number;
  chunk_count: number;
  latest_document_title?: string;
  updated_at?: string | null;
}

export interface RequirementFormData {
  project_id: string;
  status: string;
  workflow_constraints: WorkflowConstraint[];
  init_search_queries: InitSearchQuery[];
  init_search_results: InitSearchResult[];
  init_corpus_digest: CorpusDigest;
  page_count_options: RequirementOption[];
  fixed_items: {
    page_count: {
      question_code: string;
      allow_custom: boolean;
    };
    style_preset: {
      question_code: string;
      options: StyleOption[];
      allow_custom?: boolean;
    };
    background_asset: {
      question_code: string;
      allow_upload: boolean;
      required: boolean;
    };
  };
  ai_questions: RequirementQuestion[];
  answers: Record<string, string | number>;
  suggested_actions: Array<{
    code: string;
    label: string;
    reason: string;
  }>;
}

export interface RequirementFormResponse {
  requirement_form: RequirementFormData;
}

export interface PageSearchQuery {
  query_text: string;
  query_purpose: string;
}

export interface Citation {
  citation_id?: string;
  source_document_id?: string;
  chunk_id?: string;
  title: string;
  url: string;
  excerpt_md?: string;
  citation_label?: string;
  rank_no?: number;
  relevance_score?: number;
  usage_note?: string;
}

export interface PageSearchResult {
  id: string;
  query_text: string;
  query_purpose?: string;
  search_rank: number;
  title: string;
  url: string;
  snippet?: string;
  content_excerpt_md?: string;
  read_status?: string;
  vector_status?: string;
  source_document_id?: string | null;
}

export interface PageSummary {
  page_id: string;
  project_id: string;
  page_code: string;
  page_role: string;
  part_title: string | null;
  sort_order: number;
  title: string;
  content_outline: string[];
  outline_status: string;
  search_status: string;
  summary_status: string;
  draft_status: string;
  design_status: string;
  page_search_queries: PageSearchQuery[];
  page_search_results: PageSearchResult[];
  page_corpus_digest: CorpusDigest;
  page_summary_md: string;
  page_summary_citations: Citation[];
  current_artifact_staleness: Record<string, boolean>;
  current_brief_version_id: string | null;
  current_draft_version_id: string | null;
  current_design_version_id: string | null;
  draft_preview_svg_markup?: string | null;
  design_preview_svg_markup?: string | null;
  preview_surface?: PreviewSurface;
  preview_svg_markup?: string | null;
  created_at: string;
  updated_at: string;
  draft?: DraftVersion | null;
  design?: DesignVersion | null;
}

export interface PageListResponse {
  items: PageSummary[];
}

export interface OutlineResponse {
  outline_version_id: string;
  project_id: string;
  version_no: number;
  status: string;
  outline: {
    ppt_outline: {
      cover: {
        title: string;
        sub_title: string;
        content: string[];
      };
      table_of_contents: {
        title: string;
        content: string[];
      };
      parts: Array<{
        part_title: string;
        pages: Array<{
          title: string;
          content: string[];
        }>;
      }>;
      end_page: {
        title: string;
        content: string[];
      };
    };
  };
  created_at: string;
  updated_at: string;
}

export interface StoryboardPatchRequest {
  parts: Array<{
    part_title: string;
    pages: Array<{
      page_id?: string | null;
      title: string;
      content_outline: string[];
    }>;
  }>;
}

export interface StoryboardPatchResponse {
  items: PageSummary[];
  outline: OutlineResponse;
}

export interface DraftVersion {
  draft_version_id: string;
  project_id: string;
  page_id: string;
  version_no: number;
  status: string;
  page_brief_version_id: string | null;
  research_session_id: string | null;
  draft_svg_markup: string;
  created_at: string;
  updated_at: string;
}

export interface DesignVersion {
  design_version_id: string;
  project_id: string;
  page_id: string;
  version_no: number;
  status: string;
  draft_version_id: string | null;
  style_pack_id: string | null;
  background_asset_path: string | null;
  design_svg_markup: string;
  style_pack: StyleOption;
  created_at: string;
  updated_at: string;
}

export interface ExportJob {
  export_id: string;
  project_id: string;
  export_format: string;
  status: string;
  file_path: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  stage: ProjectStage;
  scope_type: ScopeType;
  target_page_id: string | null;
  role: 'user' | 'assistant';
  content_md: string;
  structured_payload_json: Record<string, unknown>;
  created_at: string;
}

export interface MessageListResponse {
  items: ProjectMessage[];
}

export interface ActionJobResponse {
  status: string;
  agent_run_id: string;
}

export interface ProjectEvent {
  stream_id: number;
  event_id: string;
  event_type: string;
  project_id: string;
  stage: string;
  scope_type: ScopeType;
  target_page_id: string | null;
  agent_run_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

function buildUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') {
        message = payload.detail;
      } else {
        message = JSON.stringify(payload);
      }
    } catch {
      message = response.statusText;
    }
    throw new ApiError(message, response.status);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as Promise<T>;
}

export async function listProjects(limit = 20): Promise<ProjectListResponse> {
  return request<ProjectListResponse>(`/projects?limit=${limit}`);
}

export async function createProject(requestText: string, title?: string): Promise<ProjectSummary> {
  return request<ProjectSummary>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      request_text: requestText,
      title,
    }),
  });
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${projectId}`);
}

export async function listMessages(projectId: string): Promise<MessageListResponse> {
  return request<MessageListResponse>(`/projects/${projectId}/messages`);
}

export async function createMessage(
  projectId: string,
  payload: {
    scope_type: ScopeType;
    target_page_id: string | null;
    ui_surface: UiSurface;
    content_md: string;
    attachments?: Array<Record<string, unknown>>;
  },
): Promise<ProjectMessage> {
  return request<ProjectMessage>(`/projects/${projectId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      attachments: payload.attachments ?? [],
    }),
  });
}

export async function getRequirementForm(projectId: string): Promise<RequirementFormResponse> {
  return request<RequirementFormResponse>(`/projects/${projectId}/requirements/form`);
}

export async function submitRequirementAnswers(
  projectId: string,
  answers: Array<{question_code: string; value: string | number}>,
): Promise<RequirementFormResponse> {
  return request<RequirementFormResponse>(`/projects/${projectId}/requirements/answers:batch`, {
    method: 'POST',
    body: JSON.stringify({answers}),
  });
}

export async function retryInitSearchResult(projectId: string, sourceId: string): Promise<RequirementFormResponse> {
  return request<RequirementFormResponse>(`/projects/${projectId}/requirements/search-results/${sourceId}:retry`, {
    method: 'POST',
  });
}

export async function confirmRequirements(projectId: string, noteMd?: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${projectId}/requirements/confirm`, {
    method: 'POST',
    body: JSON.stringify({note_md: noteMd}),
  });
}

export async function uploadBackground(projectId: string, file: File): Promise<{background_asset_path: string}> {
  const formData = new FormData();
  formData.append('file', file);
  return request<{background_asset_path: string}>(`/projects/${projectId}/assets/backgrounds`, {
    method: 'POST',
    body: formData,
  });
}

export async function getOutline(projectId: string): Promise<OutlineResponse> {
  return request<OutlineResponse>(`/projects/${projectId}/outline`);
}

export async function patchStoryboard(projectId: string, payload: StoryboardPatchRequest): Promise<StoryboardPatchResponse> {
  return request<StoryboardPatchResponse>(`/projects/${projectId}/outline/storyboard`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listPages(projectId: string): Promise<PageListResponse> {
  return request<PageListResponse>(`/projects/${projectId}/pages`);
}

export async function getPage(projectId: string, pageId: string): Promise<PageSummary> {
  return request<PageSummary>(`/projects/${projectId}/pages/${pageId}`);
}

export async function retryPageSearchResult(projectId: string, pageId: string, sourceId: string): Promise<PageSummary> {
  return request<PageSummary>(`/projects/${projectId}/pages/${pageId}/search-results/${sourceId}:retry`, {
    method: 'POST',
  });
}

export async function patchPageOutline(
  projectId: string,
  pageId: string,
  payload: {
    title: string;
    content_outline: string[];
    section_title?: string | null;
  },
): Promise<PageSummary> {
  return request<PageSummary>(`/projects/${projectId}/pages/${pageId}/outline`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function generatePageSearchQueries(projectId: string, pageId: string): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/pages/${pageId}/search-queries:generate`, {
    method: 'POST',
  });
}

export async function runPageSearch(
  projectId: string,
  pageId: string,
  actionType: 'page_search_run' | 'page_search_refresh',
  replaceExisting = true,
): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/pages/${pageId}/search:run`, {
    method: 'POST',
    body: JSON.stringify({
      action_type: actionType,
      replace_existing: replaceExisting,
    }),
  });
}

export async function generatePageSummary(projectId: string, pageId: string): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/pages/${pageId}/summary:generate`, {
    method: 'POST',
  });
}

export async function patchPageSummary(projectId: string, pageId: string, summaryMd: string): Promise<PageSummary> {
  return request<PageSummary>(`/projects/${projectId}/pages/${pageId}/summary`, {
    method: 'PATCH',
    body: JSON.stringify({summary_md: summaryMd}),
  });
}

export async function generatePageDraft(projectId: string, pageId: string): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/pages/${pageId}/draft:generate`, {
    method: 'POST',
  });
}

export async function getPageDraft(projectId: string, pageId: string): Promise<DraftVersion> {
  return request<DraftVersion>(`/projects/${projectId}/pages/${pageId}/draft`);
}

export async function generatePageDesign(projectId: string, pageId: string): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/pages/${pageId}/design:generate`, {
    method: 'POST',
  });
}

export async function getPageDesign(projectId: string, pageId: string): Promise<DesignVersion> {
  return request<DesignVersion>(`/projects/${projectId}/pages/${pageId}/design`);
}

export async function runBatchAction(
  projectId: string,
  actionType: 'project_batch_search' | 'project_batch_summary' | 'project_batch_draft' | 'project_batch_design',
): Promise<ActionJobResponse> {
  return request<ActionJobResponse>(`/projects/${projectId}/actions/batch`, {
    method: 'POST',
    body: JSON.stringify({action_type: actionType}),
  });
}

export async function createExport(projectId: string): Promise<ExportJob> {
  return request<ExportJob>(`/projects/${projectId}/exports`, {
    method: 'POST',
    body: JSON.stringify({export_format: 'pptx'}),
  });
}

export function getExportDownloadUrl(projectId: string, exportId: string): string {
  return buildUrl(`/projects/${projectId}/exports/${exportId}/download`);
}

export function connectProjectEventStream(
  projectId: string,
  handlers: {
    onEvent: (event: ProjectEvent) => void;
    onError?: () => void;
  },
): () => void {
  const source = new EventSource(buildUrl(`/projects/${projectId}/events/stream`));
  source.onmessage = (event) => {
    handlers.onEvent(JSON.parse(event.data) as ProjectEvent);
  };
  source.onerror = () => {
    handlers.onError?.();
  };
  return () => {
    source.close();
  };
}
