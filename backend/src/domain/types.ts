/**
 * Общие типы предметной области (домена).
 *
 * Держим их в одном месте, чтобы фронтенд и бэкенд «говорили на одном языке»:
 * и там, и там используется одна форма сущностей. В реальном монорепо этот
 * файл можно вынести в отдельный shared-пакет — но для демо достаточно
 * явного дублирования типов с комментариями.
 */

export type UserRole = 'admin' | 'supervisor' | 'agent';
export type UserStatus = 'online' | 'busy' | 'offline';

/** Пользователь так, как он отдаётся клиенту (без хэша пароля). */
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

/** Полная запись пользователя в БД — включает секреты, наружу не отдаётся. */
export interface UserRecord extends User {
  passwordHash: string;
}

export interface Contact {
  id: number;
  ownerId: number | null;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type QueueStrategy = 'longest_idle' | 'round_robin' | 'ring_all';

export interface Queue {
  id: number;
  name: string;
  strategy: QueueStrategy;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'queued' | 'ringing' | 'answered' | 'completed' | 'missed' | 'failed';

export interface Call {
  id: number;
  direction: CallDirection;
  status: CallStatus;
  contactId: number | null;
  agentId: number | null;
  queueId: number | null;
  phoneNumber: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number;
  waitSec: number;
  recordingUrl: string | null;
  notes: string | null;
  createdAt: string;
}

/** Полезная нагрузка access-токена (то, что кладём в JWT). */
export interface AuthTokenPayload {
  sub: number;
  email: string;
  role: UserRole;
}

/** Пара токенов, которую получает клиент после входа. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Ответ на успешный вход/регистрацию: токены + данные пользователя. */
export interface AuthResult extends AuthTokens {
  user: User;
}
