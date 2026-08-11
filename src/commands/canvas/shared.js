export const canvasServerOnlyMessage = 'This command can only be used in a server.';
export const canvasUsageMessage = 'Usage: `!canvas <watch|unwatch|watchlist|sync> [canvasCourseId] [#channel]`';

export function requireCanvasConfig() {
  if (!process.env.CANVAS_BASE_URL || !process.env.CANVAS_ACCESS_TOKEN) {
    throw new Error('Canvas is not configured. Add CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN to .env.');
  }
}

export function parseChannelId(input) {
  return input?.match(/^<#(\d+)>$/)?.[1] ?? input;
}

export async function resolveTextChannel(message, channelInput) {
  const channelId = parseChannelId(channelInput) ?? message.channelId;
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  return channel?.isTextBased() ? channel : null;
}
