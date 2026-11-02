import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchCanvasAssignments } from '../../src/canvas/client.js';

test('reminder sync still fetches only future assignments by default', async (t) => {
  const previousBaseUrl = process.env.CANVAS_BASE_URL;
  const previousToken = process.env.CANVAS_ACCESS_TOKEN;
  process.env.CANVAS_BASE_URL = 'https://canvas.example.edu';
  process.env.CANVAS_ACCESS_TOKEN = 'test-token';
  t.after(() => {
    if (previousBaseUrl === undefined) delete process.env.CANVAS_BASE_URL;
    else process.env.CANVAS_BASE_URL = previousBaseUrl;
    if (previousToken === undefined) delete process.env.CANVAS_ACCESS_TOKEN;
    else process.env.CANVAS_ACCESS_TOKEN = previousToken;
  });
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, 'https://canvas.example.edu/api/v1/courses/123/assignments?bucket=future&per_page=100');
    return { ok: true, json: async () => [], headers: { get: () => null } };
  });
  assert.deepEqual(await fetchCanvasAssignments('123'), []);
});
