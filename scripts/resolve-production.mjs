import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

try {
  const result = await db.$executeRawUnsafe(`
    INSERT INTO _prisma_migrations (migration_name, started_at, applied_steps_count)
    VALUES ('20260713135349_init', NOW(), 1)
    ON CONFLICT (migration_name) DO NOTHING
  `)
  console.log('OK: applied migration rows:', result)
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await db.$disconnect()
}
