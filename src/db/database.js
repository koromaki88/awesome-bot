import Database from 'better-sqlite3';

export const db = new Database(process.env.DATABASE_PATH ?? 'data/bot.sqlite');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
