/**
 * Точка входа приложения.
 *
 * Здесь: запуск сервера, проверка подключения к БД и КОРРЕКТНОЕ завершение
 * (graceful shutdown). Последний пункт часто забывают, а он важен:
 * при перезапуске/остановке контейнера нельзя обрывать активные запросы.
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { closeDatabase, getDatabase } from './db/connection.js';
import { SCHEMA_SQL } from './db/schema.js';

function main(): void {
  // Проверяем БД на старте и применяем схему, если таблиц ещё нет.
  // Это делает первый запуск «из коробки» рабочим: не нужно помнить
  // про отдельную команду миграции.
  const db = getDatabase();
  db.exec(SCHEMA_SQL);
  logger.info('Схема БД проверена/применена');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `VoxDesk API запущен: http://localhost:${env.PORT}/api`,
    );
  });

  /**
   * Graceful shutdown: при SIGINT (Ctrl+C) и SIGTERM (Docker/kubernetes)
   * перестаём принимать новые соединения, дожидаемся завершения текущих
   * запросов и только потом закрываем БД и процесс.
   */
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Получен сигнал остановки, завершаем работу...');
    server.close(() => {
      closeDatabase();
      logger.info('Сервер остановлен корректно');
      process.exit(0);
    });

    // Страховка: если через 10 секунд не завершилось — выходим принудительно.
    setTimeout(() => {
      logger.error('Принудительное завершение: сервер не остановился вовремя');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Необработанные ошибки/отказы — логируем и аварийно завершаемся,
  // чтобы процесс не «завис» в неопределённом состоянии.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Необработанный отказ промиса');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Необработанное исключение — завершаем процесс');
    process.exit(1);
  });
}

main();
