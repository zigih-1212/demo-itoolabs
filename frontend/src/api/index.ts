/**
 * Точка входа в слой API.
 *
 * Компоненты импортируют отсюда: `import { callsApi, usersApi } from '@/api'`.
 * Единый баррель-файл упрощает импорты и позволяет в будущем подменить
 * реализацию (например, на мок-данные для тестов) в одном месте.
 */
export { http, ApiError, configureHttp } from './http';
export { authApi } from './auth.api';
export type { RegisterPayload, LoginPayload } from './auth.api';
export { usersApi } from './users.api';
export type {
  ListUsersParams,
  CreateUserPayload,
  UpdateUserPayload,
  ChangePasswordPayload,
} from './users.api';
export { contactsApi } from './contacts.api';
export type { ContactSort, ListContactsParams, ContactPayload } from './contacts.api';
export { queuesApi } from './queues.api';
export type { QueuePayload } from './queues.api';
export { callsApi } from './calls.api';
export type { ListCallsParams, CallPayload } from './calls.api';
export { analyticsApi } from './analytics.api';

export * from './types';
