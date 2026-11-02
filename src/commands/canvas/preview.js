import { formatAnnouncementMessages } from '../../canvas/announcementDelivery.js';
import { fetchCanvasAnnouncements, fetchCanvasCourse } from '../../canvas/client.js';

const defaultPreviewPosition = 1;
const maxPreviewPosition = 10;

export const previewUsageMessage = 'Usage: `!canvas preview <course ID or name> [position]` (quote names ending in a number)';

export function parseTextPreviewArgs(args) {
  const input = args.join(' ').trim();
  if (!input) return null;

  let courseInput;
  let positionInput;
  if (input.startsWith('"') || input.startsWith("'")) {
    const quoted = input.match(/^(?:"([^"]+)"|'([^']+)')(?:\s+(\S+))?$/);
    if (!quoted) return null;
    courseInput = (quoted[1] ?? quoted[2]).trim();
    positionInput = quoted[3];
  } else if (/^\d+$/.test(args[0])) {
    if (args.length > 2) return null;
    [courseInput, positionInput] = args;
  } else {
    const parts = [...args];
    if (parts.length > 1 && /^[+-]?\d+(?:\.\d+)?$/.test(parts.at(-1))) positionInput = parts.pop();
    courseInput = parts.join(' ');
  }

  const position = parsePreviewPosition(positionInput);
  return courseInput && position !== null ? { courseInput, position } : null;
}

export function parsePreviewPosition(input) {
  if (input === undefined || input === null || input === '') return defaultPreviewPosition;

  const position = Number(input);
  if (!Number.isInteger(position) || position < 1 || position > maxPreviewPosition) return null;

  return position;
}

function announcementTimestamp(announcement) {
  const value = announcement.posted_at ?? announcement.created_at ?? announcement.delayed_post_at ?? announcement.updated_at;
  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function toPreviewAnnouncement(announcement, course) {
  return {
    canvas_course_id: String(course.id),
    course_name: course.name ?? course.course_code ?? `Course ${course.id}`,
    title: announcement.title ?? 'Untitled announcement',
    message: announcement.message,
    html_url: announcement.html_url,
    posted_at: announcement.posted_at,
  };
}

export async function previewCourseAnnouncement({ courseId, position, channel }) {
  const [course, announcements] = await Promise.all([
    fetchCanvasCourse(courseId),
    fetchCanvasAnnouncements(courseId),
  ]);
  const announcement = [...announcements]
    .sort((left, right) => announcementTimestamp(right) - announcementTimestamp(left))
    .at(position - 1);

  if (!announcement) return false;

  for (const message of formatAnnouncementMessages(toPreviewAnnouncement(announcement, course))) {
    await channel.send(message);
  }

  return true;
}

export function formatPreviewResult(sent, position) {
  if (!sent) return `No active Canvas announcement found at position ${position} for that course.`;

  return `Previewed announcement ${position}.`;
}
