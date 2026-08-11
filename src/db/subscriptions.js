import { db } from './database.js';

export function upsertCourseSubscription({ guildId, channelId, canvasCourseId, courseName }) {
  return db.prepare(`
    INSERT INTO course_subscriptions (guild_id, channel_id, canvas_course_id, course_name, announcement_baseline_at)
    VALUES (@guildId, @channelId, @canvasCourseId, @courseName, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id, channel_id, canvas_course_id) DO UPDATE SET
      course_name = excluded.course_name,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `).get({ guildId, channelId, canvasCourseId, courseName });
}

export function getCourseSubscriptions() {
  return db.prepare(`
    SELECT *
    FROM course_subscriptions
    ORDER BY created_at ASC
  `).all();
}

export function getCourseSubscriptionsByGuild(guildId) {
  return db.prepare(`
    SELECT *
    FROM course_subscriptions
    WHERE guild_id = ?
    ORDER BY course_name COLLATE NOCASE ASC, canvas_course_id ASC, channel_id ASC
  `).all(guildId);
}

export function getCourseSubscriptionsByCourse(canvasCourseId) {
  return db.prepare(`
    SELECT *
    FROM course_subscriptions
    WHERE canvas_course_id = ?
  `).all(canvasCourseId);
}

export function removeCourseSubscription({ guildId, channelId, canvasCourseId }) {
  return db.prepare(`
    DELETE FROM course_subscriptions
    WHERE guild_id = @guildId
      AND channel_id = @channelId
      AND canvas_course_id = @canvasCourseId
    RETURNING *
  `).get({ guildId, channelId, canvasCourseId });
}
