import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, configureHttp } from '@/api';
import type { LoginPayload, RegisterPayload } from '@/api/auth.api';
import type { User, UserRole } from '@/api/types';

const ACCESS_TOKEN_KEY = 'voxdesk.accessToken';

/**
 * Store авторизации (Pinia).
 *
 * Зачем Pinia, а не «просто ref в App.vue»: состояние сессии нужно в десятках
 * мест — в шапке, в роутере (охрана маршрутов), в каждом API-запросе. Pinia
 * даёт единое реактивное хранилище, типизированное и удобное для тестов.
 *
 * Где хранится токен:
 * - access-токен — в памяти + дублируется в localStorage, чтобы пережить
 *   перезагрузку страницы (в реальном проде безопаснее держать только в памяти
 *   и восстанавливать через refresh-cookie; здесь — компромисс ради удобства демо).
 * - refresh-токен — ВСЕГДА в httpOnly-cookie, установленной бэкендом.
 *   JavaScript его не видит, поэтому украсть через XSS его нельзя.
 */
export const useAuthStore = defineStore('auth', () => {
  // --- Состояние ------------------------------------------------------------
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  const isInitialized = ref(false);
  const isLoading = ref(false);

  // --- Геттеры (вычисляемые свойства) --------------------------------------
  const isAuthenticated = computed(() => user.value !== null && accessToken.value !== null);
  const role = computed<UserRole | null>(() => user.value?.role ?? null);

  /** Может ли текущий пользователь управлять сотрудниками и очередями. */
  const canManage = computed(() => role.value === 'admin' || role.value === 'supervisor');

  /** Только администратор: управление ролями, удаление пользователей. */
  const isAdmin = computed(() => role.value === 'admin');

  // --- Внутренние помощники -------------------------------------------------
  function setToken(token: string | null): void {
    accessToken.value = token;

    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }

  function setSession(result: { user: User; accessToken: string }): void {
    user.value = result.user;
    setToken(result.accessToken);
  }

  // --- Действия -------------------------------------------------------------

  /** Регистрация. Возвращает пользователя, но НЕ авторизует автоматически. */
  async function register(payload: RegisterPayload): Promise<User> {
    isLoading.value = true;

    try {
      const { data } = await authApi.register(payload);
      setSession(data);
      return data.user;
    } finally {
      isLoading.value = false;
    }
  }

  /** Вход по e-mail и паролю. */
  async function login(payload: LoginPayload): Promise<User> {
    isLoading.value = true;

    try {
      const { data } = await authApi.login(payload);
      setSession(data);
      return data.user;
    } finally {
      isLoading.value = false;
    }
  }

  /** Выход: гасим сессию на бэкенде и очищаем локальное состояние. */
  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Даже если сервер недоступен, локально сессию нужно завершить.
    } finally {
      user.value = null;
      setToken(null);
    }
  }

  /**
   * Восстановление сессии при старте приложения.
   * Сценарий: пользователь обновил страницу — access-токен мог истечь, но
   * refresh-cookie ещё жива. Пробуем получить /auth/me, а при 401 — обновиться.
   */
  async function bootstrap(): Promise<void> {
    if (isInitialized.value) return;

    try {
      if (accessToken.value) {
        const { data } = await authApi.me();
        user.value = data;
      }
    } catch {
      // Токен недействителен — пробуем обновить через cookie.
      try {
        const { data } = await authApi.refresh();
        setSession(data);
      } catch {
        // Обновление не удалось — пользователь не авторизован.
        user.value = null;
        setToken(null);
      }
    } finally {
      isInitialized.value = true;
    }
  }

  /** Тихая попытка обновления токена; используется interceptor'ом http. */
  async function refreshToken(): Promise<string | null> {
    try {
      const { data } = await authApi.refresh();
      setSession(data);
      return data.accessToken;
    } catch {
      return null;
    }
  }

  /** Принудительный сброс сессии (вызывается при окончательной потере авторизации). */
  function clearSession(): void {
    user.value = null;
    setToken(null);
  }

  /**
   * Подключаем http-клиент к store. Делается один раз при инициализации
   * приложения (см. main.ts). Так модуль http не импортирует store напрямую,
   * и мы избегаем циклической зависимости.
   */
  function bindHttp(): void {
    configureHttp({
      getAccessToken: () => accessToken.value,
      refresh: () => refreshToken(),
      onUnauthorized: () => clearSession(),
    });
  }

  return {
    // состояние
    user,
    accessToken,
    isInitialized,
    isLoading,
    // геттеры
    isAuthenticated,
    role,
    canManage,
    isAdmin,
    // действия
    register,
    login,
    logout,
    bootstrap,
    refreshToken,
    clearSession,
    bindHttp,
  };
});
