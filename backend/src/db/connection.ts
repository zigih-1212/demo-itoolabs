/**
 * Подключение к базе данных.
 *
 * Используем встроенный в Node.js модуль `node:sqlite` (доступен с Node 22.5).
 * Почему это удачное решение для демо:
 *  1. Не нужен Docker и не нужна компиляция нативных модулей (как у better-sqlite3).
 *  2. Синхронный API — код читается линейно, без «ада промисов» на простых
 *     запросах. Для нагрузок демо-проекта это правильно; при переезде на
 *     PostgreSQL слой репозиториев меняется, а сервисы/роуты — нет.
 *
 * Модуль подключается через createRequire, потому что у `node:sqlite` нет
 * готовых типов ESM-импорта во всех версиях TypeScript; так мы обходим
 * несовместимость типов, сохраняя строгий режим.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const require = createRequire(import.meta.url);
 
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

/**
 * Минимальный интерфейс над DatabaseSync, чтобы не тянуть внутренние типы Node.
 * Описываем только то, что реально используем, — это делает зависимости явными.
 */
export interface SqliteStatement {
  /**
   * Возвращаемые строки намеренно нетипизированы (`unknown`): структуру знает
   * только вызывающий репозиторий, который приводит её к своему Row-интерфейсу.
   * Если объявить здесь `Record<string, unknown>`, приведение к конкретному
   * Row-типу перестанет компилироваться (TS2352) — а именно так и должно быть,
   * потому что строка БД и домен-модель — разные типы.
   */
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
}

/** Абсолютный путь к файлу БД (относительные пути в DATABASE_PATH допустимы). */
export const databasePath = resolve(process.cwd(), env.DATABASE_PATH);

let db: SqliteDatabase | null = null;

/**
 * Возвращает singleton-подключение к БД, открывая его при первом обращении.
 *
 * Почему singleton: открытие файла БД — дорогая операция, а SQLite не любит
 * множественные соединения из одного процесса на запись. Одно соединение
 * на процесс — рекомендованный режим для встроенного сервера.
 */
export function getDatabase(): SqliteDatabase {
  if (db) return db;

  // Папка ./data может отсутствовать при первом запуске — создаём заранее.
  mkdirSync(dirname(databasePath), { recursive: true });

  logger.info({ path: databasePath }, 'Открытие подключения к SQLite');
  db = new DatabaseSync(databasePath);

  // WAL-режим: параллельное чтение во время записи и меньше блокировок.
  db.exec('PRAGMA journal_mode = WAL;');
  // Внешние ключи в SQLite по умолчанию выключены — включаем явно,
  // иначе ON DELETE CASCADE/SET NULL молча не работают.
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  return db;
}

/** Аккуратное закрытие соединения при остановке процесса (см. index.ts). */
export function closeDatabase(): void {
  if (!db) return;
  logger.info('Закрытие подключения к SQLite');
  db.close();
  db = null;
}

/**
 * Транзакция. Оборачиваем набор запросов в BEGIN/COMMIT, а при ошибке —
 * ROLLBACK. Гарантирует атомарность: либо все изменения применяются,
 * либо ни одно (например, при создании звонка + обновлении его истории).
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
