import { PermissionsBitField } from 'discord.js';

export const permissionLevels = {
  member: 'member',
  serverAdmin: 'server_admin',
  privilegedUser: 'privileged_user',
};

const accessDeniedMessage = 'You do not have permission to use this command.';

function parseUserIds(value) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function getPrivilegedUserIds() {
  return parseUserIds(process.env.APPROVED_USER_IDS);
}

function isServerAdmin(permissions) {
  return permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
}

function isAllowed({ level, userId, permissions }) {
  if (!level || level === permissionLevels.member) return true;

  if (level === permissionLevels.serverAdmin) {
    return isServerAdmin(permissions);
  }

  if (level === permissionLevels.privilegedUser) {
    return getPrivilegedUserIds().has(userId);
  }

  return false;
}

export async function enforceSlashPermission(command, interaction) {
  const level = command.permissions?.level;

  if (isAllowed({ level, userId: interaction.user.id, permissions: interaction.memberPermissions })) return true;

  await interaction.reply({ content: accessDeniedMessage, ephemeral: true });
  return false;
}

export async function enforceTextPermission(command, message) {
  const level = command.permissions?.level;

  if (isAllowed({ level, userId: message.author.id, permissions: message.member?.permissions })) return true;

  await message.reply(accessDeniedMessage);
  return false;
}
