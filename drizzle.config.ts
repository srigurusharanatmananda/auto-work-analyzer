import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Deliberately not defaulted. A drizzle-kit command that silently targets
    // some fallback database is how you generate a migration against the wrong
    // schema, or push to production believing it is local.
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
