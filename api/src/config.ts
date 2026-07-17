export interface AppConfig {
  storageAccountName: string;
  tableName: string;
  settingsTableName: string;
  townHallName: string;
  maxQuestionLength: number;
  rateLimitEnabled: boolean;
  captchaEnabled: boolean;
  adminAllowedGroupId: string;
  adminAllowedUsers: string[];
}

export function getConfig(): AppConfig {
  return {
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME ?? '',
    tableName: process.env.TABLE_NAME ?? 'TownHallQuestions',
    settingsTableName: process.env.SETTINGS_TABLE_NAME ?? 'TownHallSettings',
    townHallName: process.env.TOWN_HALL_NAME ?? 'OEP Strategy Town Hall',
    maxQuestionLength: Number(process.env.MAX_QUESTION_LENGTH ?? '2000'),
    rateLimitEnabled: (process.env.RATE_LIMIT_ENABLED ?? 'true').toLowerCase() === 'true',
    captchaEnabled: (process.env.CAPTCHA_ENABLED ?? 'false').toLowerCase() === 'true',
    adminAllowedGroupId: process.env.ADMIN_ALLOWED_GROUP_ID ?? '',
    adminAllowedUsers: (process.env.ADMIN_ALLOWED_USERS ?? '')
      .split(',')
      .map((user) => user.trim().toLowerCase())
      .filter(Boolean)
  };
}
