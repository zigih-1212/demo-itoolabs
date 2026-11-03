import { http } from './http';
import type { AuthResult, User } from './types';

/**
 * API-модуль авторизации.
 *
 * Каждая предметная область (auth, users, calls…) вынесена в свой файл.
 * Компоненты не знают про URL и формат запросов — они вызывают функции
 * с понятными именами. Захотим добавить кэш или оффлайн-режим — сделаем это
 * здесь, не трогая интерфейс.
 */

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    http.post<AuthResult>('/auth/register', payload, { skipAuth: true, skipRefresh: true }),

  login: (payload: LoginPayload) =>
    http.post<AuthResult>('/auth/login', payload, { skipAuth: true, skipRefresh: true }),

  /**
   * Обновление access-токена. refresh-токен лежит в httpOnly-cookie,
   * поэтому тело не требуется — браузер отправит cookie сам.
   */
  refresh: () =>
    http.post<AuthResult>('/auth/refresh', undefined, { skipAuth: true, skipRefresh: true }),

  logout: () => http.post<void>('/auth/logout', undefined, { skipAuth: true, skipRefresh: true }),

  me: () => http.get<User>('/auth/me'),
};
