import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Конфигурация сборщика Vite.
 *
 * Почему именно Vite, а не «классический» Webpack (как в вакансии)?
 * Vite решает ту же задачу (сборка ES-модулей, HMR, прод-бандл), но на порядок
 * быстрее на старте за счёт ленивой компиляции. Синтаксис ES6/ESNext, SCSS и
 * алиасы путей работают «из коробки», поэтому код остаётся современным и
 * переносимым. Если проект вернут на Webpack — структура `src/` не изменится.
 */
export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      // Алиас '@' → папка src. Позволяет писать `import { ... } from '@/api'`
      // вместо длинных относительных путей '../../../'. Это же соглашение
      // используется в tsconfig.json (paths), чтобы редактор и сборщик совпадали.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Прокси: запросы фронтенда на /api перенаправляются на backend (порт 4000).
    // Зачем нужно: в dev-режиме фронт и бэк живут на разных портах, и это
    // избавляет от CORS-проблем и от необходимости знать адрес API в коде.
    // В проде (или в Docker) тот же /api обслуживает reverse-proxy/nginx.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Sourcemaps в прод-сборке упрощают разбор ошибок, но увеличивают размер.
    sourcemap: false,
    // Разбиваем вендорные библиотеки в отдельный чанк: браузер кэширует их
    // отдельно от кода приложения, и после релиза пользователь качает только
    // изменившийся код приложения.
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
});
