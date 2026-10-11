import { readFileSync } from 'fs'
import path from 'path'
import { SQLiteDatabase } from '../core/database.js'
import { logger } from '../core/logger.js'

const MIGRATIONS_PATH = path.resolve(import.meta.dir, '../../migrations.sql')

export function runMigrations(db: SQLiteDatabase): void {
  const sql = readFileSync(MIGRATIONS_PATH, 'utf-8')

  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  let applied = 0
  let skipped = 0

  for (const statement of statements) {
    try {
      db.execute(statement)
      applied++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/duplicate column name|already exists/i.test(message)) {
        skipped++
        logger.debug({ statement: statement.split('\n')[0] }, 'Migration already applied, skipping')
        continue
      }
      logger.error({ error, statement }, 'Migration failed')
      throw error
    }
  }

  logger.info(`Migrations applied: ${applied}, skipped: ${skipped}`)
}
