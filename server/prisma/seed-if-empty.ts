import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

// On first deploy the database is empty, so fill it with the demo data. Later deploys leave real data alone.
const prisma = new PrismaClient();
const topics = await prisma.topic.count();
await prisma.$disconnect();
if (topics === 0) {
  console.log('Empty database, seeding demo data…');
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
} else {
  console.log('Database already has data, skipping seed.');
}
