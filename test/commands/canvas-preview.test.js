import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-canvas-preview-')), 'bot.sqlite');

const { formatPreviewResult, parsePreviewPosition, toPreviewAnnouncement } = await import('../../src/commands/canvas/preview.js');

test('preview position defaults to one', () => {
  assert.equal(parsePreviewPosition(undefined), 1);
});

test('preview position accepts integers from one to ten', () => {
  assert.equal(parsePreviewPosition('1'), 1);
  assert.equal(parsePreviewPosition('10'), 10);
});

test('preview position rejects invalid values', () => {
  assert.equal(parsePreviewPosition('0'), null);
  assert.equal(parsePreviewPosition('11'), null);
  assert.equal(parsePreviewPosition('1.5'), null);
  assert.equal(parsePreviewPosition('abc'), null);
});

test('preview result reports empty announcement previews', () => {
  assert.equal(formatPreviewResult(false, 3), 'No active Canvas announcement found at position 3 for that course.');
});

test('preview result reports sent announcements', () => {
  assert.equal(formatPreviewResult(true, 3), 'Previewed announcement 3.');
});

test('preview announcement uses fetched Canvas course name', () => {
  assert.deepEqual(
    toPreviewAnnouncement(
      {
        title: 'Announcement title',
        message: '<p>Body</p>',
        html_url: 'https://canvas.example.edu/announcement',
        posted_at: '2026-08-11T12:00:00Z',
      },
      {
        id: 171520,
        name: 'Operating Systems',
      },
    ),
    {
      canvas_course_id: '171520',
      course_name: 'Operating Systems',
      title: 'Announcement title',
      message: '<p>Body</p>',
      html_url: 'https://canvas.example.edu/announcement',
      posted_at: '2026-08-11T12:00:00Z',
    },
  );
});
