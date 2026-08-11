import { syncGuildSubscribedCourses } from '../../canvas/syncAssignments.js';
import { requireCanvasConfig } from './shared.js';

export function formatSyncResult(result) {
  return `Canvas sync complete: ${result.courses} course(s), ${result.assignments} assignment(s).`;
}

export async function syncGuildCanvasCourses(guildId) {
  requireCanvasConfig();
  return syncGuildSubscribedCourses(guildId);
}
