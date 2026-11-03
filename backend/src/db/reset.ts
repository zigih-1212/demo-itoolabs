/**
 * Полный сброс базы данных.
 *
 * Запуск: npm run db:reset
 *
 * Удаляет файл БД (вместе с WAL-файлами) и пересоздаёт схему.
 * Нужен, когда хочется начать «с чистого листа»: например, испорчены
 * демо-данные или схема менялась в процессе разработки.
 *
 * ВНИМАНИЕ: удаляет ВСЕ данные. Используется только в разработке —
 * в продакшене такого скрипта быть не должно.
 */
import { rmSync } from 'node:fs';
import { databasePath } from './connection.js';
import { logger } from '../lib/logger.js';

// WAL-режим держит данные не только в основном файле, но и в -wal/-shm.
// Удаляем все три, иначе после «сброса» можно увидеть старые записи.
const files = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];

for (const file of files) {
  try {
    rmSync(file, { force: true });
    logger.info({ file }, 'Файл БД удалён');
  } catch (error) {
    logger.warn({ file, err: error }, 'Не удалось удалить файл БД');
  }
}

logger.info('База данных сброшена. Запустите npm run db:migrate и npm run db:seed.');
