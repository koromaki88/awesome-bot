import { createMissingAnnouncementDelivery, upsertAnnouncement } from '../db/announcements.js';
import { getCourseSubscriptions, getCourseSubscriptionsByCourse, getCourseSubscriptionsByGuild } from '../db/subscriptions.js';
import { fetchCanvasAnnouncements } from './client.js';

export async function syncCourseAnnouncements(subscription) {
  const announcements = await fetchCanvasAnnouncements(subscription.canvas_course_id);
  const subscriptions = getCourseSubscriptionsByCourse(subscription.canvas_course_id);

  for (const canvasAnnouncement of announcements) {
    const announcement = upsertAnnouncement({
      canvasAnnouncementId: String(canvasAnnouncement.id),
      canvasCourseId: String(subscription.canvas_course_id),
      courseName: subscription.course_name,
      title: canvasAnnouncement.title ?? 'Untitled announcement',
      message: canvasAnnouncement.message,
      htmlUrl: canvasAnnouncement.html_url,
      postedAt: canvasAnnouncement.posted_at,
      canvasUpdatedAt: canvasAnnouncement.updated_at,
    });

    for (const courseSubscription of subscriptions) {
      createMissingAnnouncementDelivery(courseSubscription.id, announcement.id);
    }
  }

  return announcements.length;
}

async function syncSubscriptions(subscriptions) {
  const courseIds = new Set();
  let syncedAnnouncements = 0;

  for (const subscription of subscriptions) {
    if (courseIds.has(subscription.canvas_course_id)) continue;

    courseIds.add(subscription.canvas_course_id);
    syncedAnnouncements += await syncCourseAnnouncements(subscription);
  }

  return { courses: courseIds.size, announcements: syncedAnnouncements };
}

export async function syncSubscribedCourseAnnouncements() {
  return syncSubscriptions(getCourseSubscriptions());
}

export async function syncGuildSubscribedCourseAnnouncements(guildId) {
  return syncSubscriptions(getCourseSubscriptionsByGuild(guildId));
}
