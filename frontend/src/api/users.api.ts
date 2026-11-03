import { http } from './http';
import type { PaginationMeta, User, UserRole, UserStatus } from './types';

/** Фильтры и пагинация для списка пользователей. */
export interface ListUsersParams {
  search?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  avatarColor?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  avatarColor?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * API-модуль пользователей (сотрудников).
 * Заметьте: тип результата списка — пара «данные + meta», а не просто массив.
 * Пагинация — часть контракта, и это видно в типах.
 */
export const usersApi = {
  list: async (
    params: ListUsersParams = {},
  ): Promise<{ items: User[]; meta?: PaginationMeta }> => {
    const res = await http.get<User[]>('/users', { query: { ...params } });
    return { items: res.data, meta: res.meta };
  },

  getById: (id: number) => http.get<User>(`/users/${id}`),

  create: (payload: CreateUserPayload) => http.post<User>('/users', payload),

  update: (id: number, payload: UpdateUserPayload) => http.patch<User>(`/users/${id}`, payload),

  changePassword: (payload: ChangePasswordPayload) =>
    http.post<void>('/users/me/password', payload),

  remove: (id: number) => http.delete<void>(`/users/${id}`),
};
