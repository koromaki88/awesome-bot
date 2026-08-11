import { db } from './database.js';

export function upsertAnnouncement(announcement) {
  return db.prepare(`
    INSERT INTO announcements (
      canvas_announcement_id,
      canvas_course_id,
      course_name,
      title,
      message,
      html_url,
      posted_at,
      canvas_updated_at
    )
    VALUES (
      @canvasAnnouncementId,
      @canvasCourseId,
      @courseName,
      @title,
      @message,
      @htmlUrl,
      @postedAt,
      @canvasUpdatedAt
    )
    ON CONFLICT(canvas_announcement_id, canvas_course_id) DO UPDATE SET
      course_name = excluded.course_name,
      title = excluded.title,
      message = excluded.message,
      html_url = excluded.html_url,
      posted_at = excluded.posted_at,
      canvas_updated_at = excluded.canvas_updated_at,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `).get(announcement);
}

export function createMissingAnnouncementDelivery(subscriptionId, announcementId) {
  db.prepare(`
    INSERT INTO announcement_deliveries (subscription_id, announcement_id)
    VALUES (?, ?)
    ON CONFLICT(subscription_id, announcement_id) DO NOTHING
  `).run(subscriptionId, announcementId);
}

export function getPendingAnnouncementDeliveries({ guildId } = {}) {
  const guildFilter = guildId ? 'AND course_subscriptions.guild_id = @guildId' : '';

  const statement = db.prepare(`
    SELECT
      announcement_deliveries.id,
      course_subscriptions.guild_id,
      course_subscriptions.channel_id,
      announcements.canvas_course_id,
      announcements.course_name,
      announcements.title,
      announcements.message,
      announcements.html_url,
      announcements.posted_at
    FROM announcement_deliveries
    JOIN course_subscriptions ON course_subscriptions.id = announcement_deliveries.subscription_id
    JOIN announcements ON announcements.id = announcement_deliveries.announcement_id
    WHERE announcement_deliveries.sent_at IS NULL
      ${guildFilter}
    ORDER BY COALESCE(announcements.posted_at, announcements.created_at) ASC
  `);

  return guildId ? statement.all({ guildId }) : statement.all();
}

export function markAnnouncementDeliverySent(deliveryId) {
  db.prepare(`
    UPDATE announcement_deliveries
    SET sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(deliveryId);
}
