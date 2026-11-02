import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs a real PostgreSQL server for local development, no Docker or install needed.
 * Data lives in server/.pgdata. Matches DATABASE_URL in .env.example.
 */
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.pgdata');
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'mathlink',
  password: 'mathlink',
  port: 5433,
  persistent: true,
  onLog: () => {},
});

if (!existsSync(path.join(dataDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('mathlink');
} catch {
  // Already exists.
}
console.log('Postgres ready on postgresql://localhost:5433/mathlink');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
