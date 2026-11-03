import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/**
 * Конфигурация Vitest для фронтенда.
 *
 * Ключевые отличия от backend: среда 'jsdom' (эмуляция браузера для тестов
 * компонентов) и подключение плагина Vue, чтобы тесты понимали .vue-файлы.
 * Тестируем в первую очередь «чистую» логику: утилиты, форматтеры, store.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
    },
  },
});
