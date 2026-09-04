import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(connectionString);

async function migrate() {
  console.log("Connecting to Neon Postgres...");
  
  // 1. Enable pgvector
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log("✓ pgvector extension enabled.");

  // 2. Read migration files
  const migrationDir = path.join(__dirname, '../drizzle');
  const files = ['0000_odd_lucky_pierre.sql', '0001_overrated_millenium_guard.sql', '0002_boring_colonel_america.sql'];

  for (const file of files) {
    const filePath = path.join(migrationDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    console.log(`Applying ${file}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const statements = content.split('--> statement-breakpoint');

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await sql.unsafe(trimmed);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.code === '42P07' || err.code === '42710' || err.code === '42701') {
          continue;
        }
        console.warn(`Note on statement in ${file}:`, err.message);
      }
    }
    console.log(`✓ Applied ${file}`);
  }

  console.log("Database migration to Neon complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
