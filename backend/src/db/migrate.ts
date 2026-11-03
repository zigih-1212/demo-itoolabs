/**
 * Миграция схемы БД.
 *
 * Запуск: npm run db:migrate
 *
 * Для демо-проекта достаточно «миграции в один шаг»: полная, идемпотентная
 * схема. Для реального продукта здесь был бы журнал применённых миграций
 * (как в Knex/Alembic/Prisma Migrate) с историей версий — но для обучающего
 * демо это лишняя сложность, а подход с IF NOT EXISTS даёт тот же эффект
 * «можно запускать сколько угодно раз».
 */
import { getDatabase, closeDatabase, databasePath } from './connection.js';
import { SCHEMA_SQL } from './schema.js';
import { logger } from '../lib/logger.js';

function migrate(): void {
  const db = getDatabase();
  logger.info({ path: databasePath }, 'Применение схемы БД');
  db.exec(SCHEMA_SQL);
  logger.info('Схема применена успешно');
}

try {
  migrate();
} catch (error) {
  logger.error({ err: error }, 'Миграция завершилась ошибкой');
  process.exitCode = 1;
} finally {
  closeDatabase();
}
