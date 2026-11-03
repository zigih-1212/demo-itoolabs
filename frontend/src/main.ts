import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth.store';

// Базовые стили подключаем один раз на весь проект.
import './styles/base.scss';

/**
 * Точка входа приложения.
 *
 * Порядок важен:
 * 1. Создаём Vue-приложение и подключаем Pinia (до роутера — роутер использует
 *    store авторизации в своих страж-функциях).
 * 2. Подключаем роутер.
 * 3. Связываем http-клиент со store авторизации: чтобы клиент умел доставать
 *    токен и сам обновлять его при 401.
 */

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// bindHttp должен выполниться до первого запроса из роутера.
const auth = useAuthStore(pinia);
auth.bindHttp();

app.use(router);
app.mount('#app');
