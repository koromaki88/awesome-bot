import { getCourseSubscriptionsByGuild } from '../../db/subscriptions.js';

export function formatWatchlist(subscriptions) {
  if (subscriptions.length === 0) {
    return 'No Canvas courses are being watched in this server.';
  }

  const lines = subscriptions.map((subscription) => {
    const courseName = subscription.course_name ?? `Course ${subscription.canvas_course_id}`;
    return `- **${courseName}** (${subscription.canvas_course_id}) in <#${subscription.channel_id}>`;
  });

  return ['Watched Canvas courses:', ...lines].join('\n');
}

export function getWatchlistMessage(guildId) {
  return formatWatchlist(getCourseSubscriptionsByGuild(guildId));
}
