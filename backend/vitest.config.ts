import { defineConfig } from 'vitest/config';

/**
 * Конфигурация тестов (Vitest).
 *
 * Здесь мы задаём переменные окружения ДО того, как загрузятся модули
 * приложения. Это важно: config/env.ts валидирует окружение при импорте и
 * падает, если секретов нет. В тестах подставляем безопасные значения и
 * отдельную тестовую базу, чтобы не задеть рабочую.
 */
export default defineConfig({
  test: {
    // node — тестируем серверный код, браузерное окружение не нужно.
    environment: 'node',
    // Один воркер: у нас один файл SQLite, параллельная запись из разных
    // процессов привела бы к блокировкам. Последовательный прогон предсказуем.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Отдельная тестовая база — не трогаем рабочую ./data/voxdesk.sqlite.
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: './data/voxdesk.test.sqlite',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
      BCRYPT_ROUNDS: '4', // минимум раундов — тесты идут быстрее
      LOG_LEVEL: 'silent',
      SEED_ADMIN_EMAIL: 'admin@voxdesk.local',
      SEED_ADMIN_PASSWORD: 'admin12345',
    },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/dist/**', '**/*.config.*', '**/tests/**'],
    },
  },
});
