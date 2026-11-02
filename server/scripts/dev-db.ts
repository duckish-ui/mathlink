import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs a real PostgreSQL server for local development, no Docker or install needed.
 * Data lives in server/.pgdata. Matches DATABASE_URL in .env.example.
 */
const PORT = 5433;
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.pgdata');

function portInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Already running from another terminal: nothing to do, just stay alive so `npm run dev` keeps going.
if (await portInUse(PORT)) {
  console.log(`Postgres already running on port ${PORT}`);
  setInterval(() => {}, 1 << 30);
} else {
  // A hard kill leaves a stale lock file behind that stops Postgres from starting again.
  const lock = path.join(dataDir, 'postmaster.pid');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8').split('\n')[0]);
    if (!processAlive(pid)) rmSync(lock);
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'mathlink',
    password: 'mathlink',
    port: PORT,
    persistent: true,
    onLog: () => {},
  });

  try {
    if (!existsSync(path.join(dataDir, 'PG_VERSION'))) await pg.initialise();
    await pg.start();
  } catch (err) {
    console.error('Could not start Postgres:', err ?? 'unknown error (see server/.pgdata/log)');
    process.exit(1);
  }
  try {
    await pg.createDatabase('mathlink');
  } catch {
    // Already exists.
  }
  console.log(`Postgres ready on postgresql://localhost:${PORT}/mathlink`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
