import { getPendingAnnouncementDeliveries, markAnnouncementDeliverySent } from '../db/announcements.js';

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractImageUrls(html) {
  return [...(html ?? '').matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => normalizeCanvasUrl(match[1]));
}

function normalizeCanvasUrl(url) {
  if (!url || url.startsWith('http')) return url;

  const baseUrl = process.env.CANVAS_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl || !url.startsWith('/')) return url;

  return `${baseUrl}${url}`;
}

function stripHtml(value) {
  return (value ?? '').replace(/<[^>]+>/g, '');
}

function htmlToText(html) {
  return decodeHtmlEntities(
    (html ?? '')
      .replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, (_, url, text) => `[${stripHtml(text)}](${normalizeCanvasUrl(url)})`)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function chunkMessage(content, maxLength = 3700) {
  if (content.length <= maxLength) return [content];

  const chunks = [];
  let remaining = content;

  while (remaining.length > maxLength) {
    const splitAt = Math.max(
      remaining.lastIndexOf('\n', maxLength),
      remaining.lastIndexOf(' ', maxLength),
    );
    const end = splitAt > 0 ? splitAt : maxLength;

    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) chunks.push(remaining);

  return chunks;
}

function truncateEmbedTitle(title) {
  if (title.length <= 256) return title;

  return `${title.slice(0, 253)}...`;
}

function validTimestamp(value) {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatAnnouncementMessages(announcement) {
  const courseName = announcement.course_name ?? `Course ${announcement.canvas_course_id}`;
  const body = htmlToText(announcement.message) || 'No announcement content.';
  const source = announcement.html_url ? `\n\n[Open in Canvas](${announcement.html_url})` : '';
  const content = `${body}${source}`;
  const imageUrls = extractImageUrls(announcement.message);
  const chunks = chunkMessage(content);
  const author = `Announcement - ${courseName} (${announcement.canvas_course_id})`;
  const announcementTitle = announcement.title ?? 'Untitled announcement';
  const timestamp = validTimestamp(announcement.posted_at);
  const messages = chunks.map((description, index) => ({
    embeds: [
      {
        title: truncateEmbedTitle(chunks.length > 1 ? `${announcementTitle} (${index + 1}/${chunks.length})` : announcementTitle),
        url: announcement.html_url ?? undefined,
        description,
        color: 0xe13f29,
        author: { name: author },
        timestamp,
        image: index === 0 && imageUrls[0] ? { url: imageUrls[0] } : undefined,
      },
    ],
  }));

  for (const imageUrl of imageUrls.slice(1)) {
    messages.push({ embeds: [{ title: 'Announcement image', image: { url: imageUrl }, color: 0xe13f29, author: { name: author } }] });
  }

  return messages;
}

export async function sendPendingAnnouncements(client, options = {}) {
  const deliveries = getPendingAnnouncementDeliveries(options);

  for (const delivery of deliveries) {
    const channel = await client.channels.fetch(delivery.channel_id).catch(() => null);
    if (!channel?.isTextBased()) continue;

    for (const message of formatAnnouncementMessages(delivery)) {
      await channel.send(message);
    }

    markAnnouncementDeliverySent(delivery.id);
  }
}
