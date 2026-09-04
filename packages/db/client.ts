import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as path from 'path';
import * as fs from 'fs';

// Automatically load .env from root if not present in process.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_DnOKAdN92Uuy@ep-crimson-dawn-aecffvu8-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const client = neon(connectionString);
export const db = drizzle(client, { schema });
