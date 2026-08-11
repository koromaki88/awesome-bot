function getCanvasConfig() {
  const { CANVAS_ACCESS_TOKEN, CANVAS_BASE_URL } = process.env;

  if (!CANVAS_ACCESS_TOKEN || !CANVAS_BASE_URL) {
    throw new Error('Missing CANVAS_BASE_URL or CANVAS_ACCESS_TOKEN in your environment.');
  }

  return {
    accessToken: CANVAS_ACCESS_TOKEN,
    baseUrl: CANVAS_BASE_URL.replace(/\/$/, ''),
  };
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;

  const links = linkHeader.split(',').map((part) => part.trim());
  const next = links.find((part) => part.includes('rel="next"'));
  const match = next?.match(/<([^>]+)>/);

  return match?.[1] ?? null;
}

export async function canvasRequest(path) {
  const { accessToken, baseUrl } = getCanvasConfig();
  const url = path.startsWith('http') ? path : `${baseUrl}/api/v1${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Canvas request failed: ${response.status} ${response.statusText} ${body}`);
  }

  return {
    data: await response.json(),
    nextUrl: parseNextLink(response.headers.get('link')),
  };
}

export async function fetchCanvasCourse(courseId) {
  const { data } = await canvasRequest(`/courses/${courseId}`);

  return data;
}

export async function fetchCanvasAssignments(courseId) {
  const assignments = [];
  let nextPath = `/courses/${courseId}/assignments?bucket=future&per_page=100`;

  while (nextPath) {
    const { data, nextUrl } = await canvasRequest(nextPath);
    assignments.push(...data);
    nextPath = nextUrl;
  }

  return assignments;
}

export async function fetchCanvasAnnouncements(courseId) {
  const announcements = [];
  let nextPath = `/announcements?context_codes[]=course_${courseId}&active_only=true&per_page=100`;

  while (nextPath) {
    const { data, nextUrl } = await canvasRequest(nextPath);
    announcements.push(...data);
    nextPath = nextUrl;
  }

  return announcements;
}
