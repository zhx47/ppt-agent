import type { ProjectEvent } from './ppt-api';

export function shouldRefreshFromEvent(event: ProjectEvent): boolean {
  return [
    'agent.message',
    'action.step.completed',
    'action.step.failed',
    'status.changed',
    'workspace.data.updated',
    'requirements.answers_updated',
    'project.created',
  ].includes(event.event_type);
}

export function summarizeSourcePipeline(
  items: Array<{read_status?: string; vector_status?: string}>,
): {
  total: number;
  readReady: number;
  vectorReady: number;
  failed: number;
} {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.read_status === 'ready' || item.read_status === 'reused') {
        summary.readReady += 1;
      }
      if (item.vector_status === 'ready') {
        summary.vectorReady += 1;
      }
      if (item.read_status === 'failed' || item.vector_status === 'failed') {
        summary.failed += 1;
      }
      return summary;
    },
    {total: 0, readReady: 0, vectorReady: 0, failed: 0},
  );
}
