import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function initDatabase(storagePath: string): Database.Database {
  // Ensure storage directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  const dbPath = path.join(storagePath, 'photo-selector.db');

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  // Create migrations table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Check which migrations have been applied
  const appliedMigrations = database
    .prepare('SELECT name FROM migrations')
    .all()
    .map((row: any) => row.name);

  // Migration 001: Initial schema
  if (!appliedMigrations.includes('001_initial_schema')) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        prompt TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        original_filename TEXT NOT NULL,
        original_path TEXT NOT NULL,
        thumbnail_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        file_size INTEGER,
        score REAL,
        ai_comment TEXT,
        selected INTEGER DEFAULT 0,
        similarity_group_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_photos_project_id ON photos(project_id);
      CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(file_hash);
      CREATE INDEX IF NOT EXISTS idx_photos_score ON photos(score);
      CREATE INDEX IF NOT EXISTS idx_photos_similarity_group ON photos(similarity_group_id);

      CREATE TABLE IF NOT EXISTS prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        is_preset INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO migrations (name) VALUES ('001_initial_schema');
    `);
  }

  // Migration 002: Default prompt templates
  if (!appliedMigrations.includes('002_default_templates')) {
    database.exec(`
      INSERT OR IGNORE INTO prompt_templates (name, prompt, is_preset) VALUES
        ('Candid Moments', 'Prioritize candid moments and genuine expressions over posed shots', 1),
        ('Technical Quality', 'Prioritize technical quality: sharpness, proper exposure, and good composition', 1),
        ('Family Photos', 'Prioritize photos where all family members are present and clearly visible', 1),
        ('Portrait Focus', 'Prioritize portraits with good facial expressions and eye contact', 1);

      INSERT INTO migrations (name) VALUES ('002_default_templates');
    `);
  }
}
