import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-sync-announcements-')), 'bot.sqlite');

const { isAnnouncementDeliverable } = await import('../../src/canvas/syncAnnouncements.js');

test('announcement delivery skips announcements before the subscription baseline', () => {
  assert.equal(
    isAnnouncementDeliverable(
      { posted_at: '2026-08-11T11:59:59Z' },
      { announcement_baseline_at: '2026-08-11T12:00:00Z' },
    ),
    false,
  );
});

test('announcement delivery allows announcements at the subscription baseline', () => {
  assert.equal(
    isAnnouncementDeliverable(
      { posted_at: '2026-08-11T12:00:00Z' },
      { announcement_baseline_at: '2026-08-11T12:00:00Z' },
    ),
    true,
  );
});

test('announcement delivery allows announcements after the subscription baseline', () => {
  assert.equal(
    isAnnouncementDeliverable(
      { posted_at: '2026-08-11T12:00:01Z' },
      { announcement_baseline_at: '2026-08-11T12:00:00Z' },
    ),
    true,
  );
});

test('announcement delivery skips announcements without usable dates', () => {
  assert.equal(isAnnouncementDeliverable({}, { announcement_baseline_at: '2026-08-11T12:00:00Z' }), false);
  assert.equal(isAnnouncementDeliverable({ posted_at: 'not-a-date' }, { announcement_baseline_at: '2026-08-11T12:00:00Z' }), false);
  assert.equal(isAnnouncementDeliverable({ posted_at: '2026-08-11T12:00:00Z' }, {}), false);
});
