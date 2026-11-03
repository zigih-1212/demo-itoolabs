/// <reference types="vite/client" />

/**
 * Типизация переменных окружения фронтенда.
 *
 * Благодаря этому интерфейсу `import.meta.env.VITE_API_BASE_URL` типизирован,
 * и опечатка в имени переменной станет ошибкой компиляции, а не молчаливым
 * `undefined` в рантайме.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Заглушка для импорта .vue-файлов в TypeScript.
 * Без неё vue-tsc/редактор не понимает, что `import App from './App.vue'` — это
 * Vue-компонент. Реальную типизацию компонентов даёт плагин Vue в редакторе.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
