import { getCourseSubscriptionsByChannel } from '../../db/subscriptions.js';

function normalizeName(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function matchScore(query, name) {
  if (query === name) return 1;
  if (name.includes(query)) return 0.9 + 0.09 * query.length / name.length;
  if (query.length < 3) return 0;

  // Compare against the full name and word windows so a typo in a partial name
  // can still match courses with a code or semester prefix.
  const words = name.split(' ');
  const windowSize = query.split(' ').length;
  const candidates = [name];
  for (let index = 0; index + windowSize <= words.length; index += 1) {
    candidates.push(words.slice(index, index + windowSize).join(' '));
  }
  const similarity = Math.max(...candidates.map((candidate) =>
    1 - editDistance(query, candidate) / Math.max(query.length, candidate.length),
  ));
  return similarity >= 0.6 ? similarity * 0.85 : 0;
}

export function findClosestCourses(input, subscriptions) {
  const query = normalizeName(input);
  if (!query) return [];

  const ranked = subscriptions
    .filter((subscription) => subscription.course_name)
    .map((subscription) => ({ subscription, score: matchScore(query, normalizeName(subscription.course_name)) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) return [];
  return ranked.filter(({ score }) => ranked[0].score - score < 0.01)
    .map(({ subscription }) => subscription);
}

export function resolvePreviewCourse(input, { guildId, channelId }) {
  const courseInput = input.trim();
  if (/^\d+$/.test(courseInput)) return { courseId: courseInput };

  const subscriptions = getCourseSubscriptionsByChannel(guildId, channelId);
  const matches = findClosestCourses(courseInput, subscriptions);
  if (!matches.length) {
    return { error: 'No matching Canvas course is watched in this channel. Try a closer name or use a course ID.' };
  }
  if (matches.length > 1) {
    const choices = matches.slice(0, 5).map((course) => `- ${course.course_name} (${course.canvas_course_id})`);
    return { error: `Several watched courses match that name. Use a more specific name or a course ID:\n${choices.join('\n')}` };
  }

  return { courseId: matches[0].canvas_course_id };
}
