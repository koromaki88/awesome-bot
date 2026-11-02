import { escapeMarkdown } from 'discord.js';

import { fetchCanvasAssignments, fetchCanvasCourse } from '../../canvas/client.js';

export const assignmentsUsageMessage = 'Usage: `!canvas assignments <course ID or name>`';

function dueTimestamp(assignment) {
  const timestamp = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  return Number.isNaN(timestamp) ? Infinity : timestamp;
}

function assignmentLine(assignment) {
  const name = escapeMarkdown((assignment.name ?? 'Untitled assignment').replace(/\s+/g, ' ').slice(0, 200));
  const url = assignment.html_url;
  const label = url && /^https?:\/\//.test(url) && url.length <= 2000
    ? `[${name}](${url.replace(/\)/g, '%29')})`
    : name;
  const timestamp = dueTimestamp(assignment);
  const seconds = Math.floor(timestamp / 1000);
  const date = Number.isFinite(timestamp) ? `<t:${seconds}:f> (<t:${seconds}:R>)` : 'No due date';
  return `- ${label} — ${date}`;
}

export function formatAssignmentMessages(course, assignments) {
  const sorted = assignments.filter((assignment) => assignment.workflow_state !== 'deleted')
    .sort((left, right) => dueTimestamp(left) - dueTimestamp(right)
      || (left.name ?? '').localeCompare(right.name ?? ''));
  const introduction = 'Due dates, oldest first. Assignments without due dates are listed last.\n\n';
  const pages = [];
  let page = '';
  for (const assignment of sorted) {
    const line = assignmentLine(assignment);
    if (page && introduction.length + page.length + line.length + 1 > 3800) {
      pages.push(page);
      page = '';
    }
    page += `${page ? '\n' : ''}${line}`;
  }
  if (page) pages.push(page);
  if (!pages.length) pages.push('No assignments found for this course.');

  const courseName = course.name ?? course.course_code ?? `Course ${course.id}`;
  return pages.map((body, index) => ({
    allowedMentions: { parse: [] },
    embeds: [{
      title: `Assignments — ${courseName}`.slice(0, 240),
      description: `${introduction}${body}`,
      color: 0xe13f29,
      footer: { text: `Course ${course.id} • Page ${index + 1}/${pages.length} • ${sorted.length} assignment(s)` },
    }],
  }));
}

export async function getAssignmentMessages(courseId) {
  const [course, assignments] = await Promise.all([
    fetchCanvasCourse(courseId),
    fetchCanvasAssignments(courseId, { includePast: true }),
  ]);
  return formatAssignmentMessages(course, assignments);
}
