/**
 * Типы данных, которые фронтенд получает от backend.
 *
 * Почему типы продублированы, а не импортируются из backend-пакета?
 * По-хорошему это должен быть общий пакет @voxdesk/shared-types. В рамках
 * демо мы держим копию рядом, но держим её синхронной с backend/src/domain.
 * В реальном проекте при расхождении контракта типы сгенерировали бы из
 * OpenAPI-схемы — это убирает «дрейф» между фронтом и бэком.
 */

/** Роли пользователей. От роли зависят права доступа. */
export type UserRole = 'admin' | 'supervisor' | 'agent';

/** Статус оператора: определяет доступность для распределения звонков. */
export type UserStatus = 'online' | 'busy' | 'offline';

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

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'missed'
  | 'failed';

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

/** Звонок вместе с «расшифрованными» именами связанных сущностей (JOIN на бэке). */
export interface CallWithRelations extends Call {
  contactName: string | null;
  agentName: string | null;
  queueName: string | null;
}

/** Токены авторизации. access — короткоживущий, refresh — долгоживущий. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: User;
}

/** Метаданные пагинации, которые бэкенд возвращает рядом с данными. */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Сводка по звонкам для дашборда. */
export interface CallSummary {
  total: number;
  statuses: Record<CallStatus, number>;
  answered: number;
  missed: number;
  answerRate: number;
  missRate: number;
  totalTalkSeconds: number;
  averageTalkSeconds: number;
}

export interface DailyActivityPoint {
  date: string;
  inbound: number;
  outbound: number;
}

export interface AgentPerformanceRow {
  agentId: number;
  agentName: string;
  avatarColor: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  talkSeconds: number;
  averageTalkSeconds: number;
  answerRate: number;
}

export interface QueueLoadRow {
  queueId: number;
  queueName: string;
  strategy: QueueStrategy;
  isActive: boolean;
  waiting: number;
  active: number;
  completed: number;
  missed: number;
  totalCalls: number;
}

export interface HourlyPoint {
  hour: number;
  total: number;
}

export interface ActivityEntry {
  id: number;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsDashboard {
  agents: AgentPerformanceRow[];
  queues: QueueLoadRow[];
  hourly: HourlyPoint[];
  recentActivity: ActivityEntry[];
}

/** Стандартный конверт успешного ответа API. */
export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Стандартный конверт ошибки API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
