/**
 * Глобальная подготовка тестовой среды.
 *
 * Выполняется перед каждым тестовым файлом. Задача одна: дать каждому файлу
 * ЧИСТУЮ базу. Мы удаляем файл тестовой БД и заново применяем схему, поэтому
 * тесты не зависят от порядка запуска и от данных других файлов.
 *
 * Почему удаляем файл, а не «DELETE FROM»: так гарантированно сбрасываются
 * автоинкременты и остатки WAL-журнала — состояние действительно с нуля.
 */
import { afterAll, beforeAll } from 'vitest';
import { rmSync } from 'node:fs';
import { closeDatabase, databasePath, getDatabase } from '../src/db/connection.js';
import { SCHEMA_SQL } from '../src/db/schema.js';

beforeAll(() => {
  // На случай, если соединение осталось от предыдущего файла в том же процессе.
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
  getDatabase().exec(SCHEMA_SQL);
});

afterAll(() => {
  closeDatabase();
});
