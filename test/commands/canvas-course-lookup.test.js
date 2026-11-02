import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';

const { findClosestCourses, resolveCanvasCourse } = await import('../../src/commands/canvas/courseLookup.js');
const { initializeSchema } = await import('../../src/db/schema.js');
const { upsertCourseSubscription } = await import('../../src/db/subscriptions.js');
initializeSchema();

const courses = [
  { canvas_course_id: '1', course_name: 'COMP 2000 Operating Systems' },
  { canvas_course_id: '2', course_name: 'Biology 101' },
  { canvas_course_id: '3', course_name: 'Advanced Biology 101' },
];

test('course names support case-insensitive exact, partial, and typo matches', () => {
  assert.equal(findClosestCourses('BIOLOGY 101', courses)[0].canvas_course_id, '2');
  assert.equal(findClosestCourses('Operating Systems', courses)[0].canvas_course_id, '1');
  assert.equal(findClosestCourses('operatng sytems', courses)[0].canvas_course_id, '1');
  assert.equal(findClosestCourses('biolgy', courses)[0].canvas_course_id, '2');
  assert.deepEqual(findClosestCourses('unrelated astronomy', courses), []);
  assert.deepEqual(findClosestCourses('!!!', courses), []);
  assert.deepEqual(findClosestCourses('anything', []), []);
});

test('equally close names are treated as ambiguous', () => {
  const duplicates = [
    { canvas_course_id: '1', course_name: 'Operating Systems' },
    { canvas_course_id: '2', course_name: 'Operating Systems' },
  ];
  assert.equal(findClosestCourses('operating', duplicates).length, 2);
});

test('name resolution uses only subscriptions in the current channel and guild', () => {
  for (const course of [
    { channelId: 'current', guildId: 'guild-1', canvasCourseId: '11', courseName: 'Operating Systems' },
    { channelId: 'other', guildId: 'guild-1', canvasCourseId: '22', courseName: 'Biology' },
    { channelId: 'current', guildId: 'guild-2', canvasCourseId: '33', courseName: 'Chemistry' },
  ]) upsertCourseSubscription(course);

  const context = { guildId: 'guild-1', channelId: 'current' };
  assert.deepEqual(resolveCanvasCourse('operatng sytems', context), { courseId: '11' });
  assert.match(resolveCanvasCourse('Biology', context).error, /No matching/);
  assert.match(resolveCanvasCourse('Chemistry', context).error, /No matching/);
  assert.match(resolveCanvasCourse('Operating Systems', { ...context, channelId: 'empty' }).error, /No matching/);
});

test('explicit course IDs still work without a subscription', () => {
  assert.deepEqual(resolveCanvasCourse('99999', { guildId: 'guild-1', channelId: 'empty' }), { courseId: '99999' });
});

test('ambiguous resolution asks for a specific name or course ID', () => {
  for (const canvasCourseId of ['44', '55']) {
    upsertCourseSubscription({
      guildId: 'guild-1', channelId: 'ambiguous', canvasCourseId, courseName: 'Biology',
    });
  }
  const result = resolveCanvasCourse('biology', { guildId: 'guild-1', channelId: 'ambiguous' });
  assert.match(result.error, /Several watched courses/);
  assert.match(result.error, /44/);
  assert.match(result.error, /55/);
  assert.equal(result.courseId, undefined);
});

test('omitted courses use the sole subscription in the current channel and guild', () => {
  for (const course of [
    { channelId: 'default-course', guildId: 'guild-1', canvasCourseId: '66', courseName: null },
    { channelId: 'different-channel', guildId: 'guild-1', canvasCourseId: '77', courseName: 'Biology' },
    { channelId: 'default-course', guildId: 'guild-2', canvasCourseId: '88', courseName: 'Chemistry' },
  ]) upsertCourseSubscription(course);

  const context = { guildId: 'guild-1', channelId: 'default-course' };
  for (const input of [undefined, null, '', '  ']) {
    assert.deepEqual(resolveCanvasCourse(input, context), { courseId: '66' });
  }
  assert.deepEqual(resolveCanvasCourse('999', context), { courseId: '999' });
  assert.match(resolveCanvasCourse('unrelated name', context).error, /No matching/);
});

test('omitted courses require clarification if the channel has zero or multiple subscriptions', () => {
  for (const canvasCourseId of ['44', '55']) {
    upsertCourseSubscription({
      guildId: 'guild-1', channelId: 'multiple-defaults', canvasCourseId, courseName: 'Biology',
    });
  }
  const empty = resolveCanvasCourse(undefined, { guildId: 'guild-1', channelId: 'empty' });
  assert.match(empty.error, /No Canvas courses are watched in this channel/);
  const multiple = resolveCanvasCourse(undefined, { guildId: 'guild-1', channelId: 'multiple-defaults' });
  assert.match(multiple.error, /Multiple Canvas courses/);
  assert.match(multiple.error, /44/);
  assert.match(multiple.error, /55/);
  assert.equal(multiple.courseId, undefined);
});
