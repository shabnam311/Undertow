import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use a fallback or throw if missing in production
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/undertow';

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
