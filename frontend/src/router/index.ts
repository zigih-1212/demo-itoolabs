import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Маршрутизация приложения.
 *
 * Два важных принципа:
 * 1. Ленивая загрузка (dynamic import) — код каждой страницы грузится только
 *    при переходе на неё. Первый экран открывается быстрее, bundle меньше.
 * 2. Метаданные маршрута (`meta`) описывают требования: нужна ли авторизация
 *    и какие роли допущены. Проверяются они одним guards-ом ниже — так политика
 *    доступа описана декларативно рядом с самим маршрутом.
 */

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, layout: 'auth' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { public: true, layout: 'auth' },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Дашборд', icon: 'grid' },
  },
  {
    path: '/calls',
    name: 'calls',
    component: () => import('@/views/CallsView.vue'),
    meta: { title: 'Журнал звонков', icon: 'phone' },
  },
  {
    path: '/contacts',
    name: 'contacts',
    component: () => import('@/views/ContactsView.vue'),
    meta: { title: 'Контакты', icon: 'users' },
  },
  {
    path: '/queues',
    name: 'queues',
    component: () => import('@/views/QueuesView.vue'),
    meta: { title: 'Очереди', icon: 'layers', roles: ['admin', 'supervisor'] },
  },
  {
    path: '/team',
    name: 'team',
    component: () => import('@/views/TeamView.vue'),
    meta: { title: 'Команда', icon: 'user-cog', roles: ['admin', 'supervisor'] },
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('@/views/AnalyticsView.vue'),
    meta: { title: 'Аналитика', icon: 'chart', roles: ['admin', 'supervisor'] },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Настройки', icon: 'settings' },
  },
  {
    // «Ловушка» для несуществующих адресов.
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // При переходе прокручиваем страницу наверх (кроме возврата назад).
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 };
  },
});

/**
 * Глобальный страж навигации.
 * Выполняется перед каждым переходом и решает: пустить, перенаправить на вход
 * или отдать 403. Логика централизована — не размазана по страницам.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // Восстанавливаем сессию один раз перед первым переходом.
  if (!auth.isInitialized) {
    await auth.bootstrap();
  }

  const isPublic = to.meta.public === true;

  // Неавторизованного — на страницу входа с запоминанием, куда он шёл.
  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Авторизованного не пускаем на страницы входа/регистрации.
  if (isPublic && auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    return { name: 'dashboard' };
  }

  // Проверка ролей: если у маршрута задан список roles, а роли пользователя
  // в нём нет — отправляем на дашборд (а не 403-страницу, чтобы не пугать).
  const allowedRoles = to.meta.roles as string[] | undefined;

  if (allowedRoles && auth.role && !allowedRoles.includes(auth.role)) {
    return { name: 'dashboard' };
  }

  return true;
});

/** Прокидываем заголовок страницы в <title> — мелочь, но важно для UX. */
router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} — VoxDesk` : 'VoxDesk — облачная АТС';
});
