import type { CallDirection, CallStatus, QueueStrategy, UserRole, UserStatus } from '@/api/types';

/**
 * Человекочитаемые подписи для «машинных» значений из бэкенда.
 *
 * Зачем: в базе и API удобны короткие латинские коды (online, missed, inbound),
 * а пользователю нужно показать осмысленный русский текст. Храним соответствие
 * в одном месте, чтобы подписи не разъезжались по компонентам.
 */

/** Тональность для стилизации: success/warning/danger/info/neutral. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface LabelInfo {
  label: string;
  /** Тональность для стилизации: success/warning/danger/info/neutral. */
  tone: Tone;
}

export const callStatusLabels: Record<CallStatus, LabelInfo> = {
  queued: { label: 'В очереди', tone: 'neutral' },
  ringing: { label: 'Звонит', tone: 'info' },
  answered: { label: 'Разговор', tone: 'success' },
  completed: { label: 'Завершён', tone: 'success' },
  missed: { label: 'Пропущен', tone: 'danger' },
  failed: { label: 'Ошибка', tone: 'danger' },
};

export const callDirectionLabels: Record<CallDirection, LabelInfo> = {
  inbound: { label: 'Входящий', tone: 'info' },
  outbound: { label: 'Исходящий', tone: 'neutral' },
};

export const userRoleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  supervisor: 'Супервайзер',
  agent: 'Оператор',
};

export const userStatusLabels: Record<UserStatus, LabelInfo> = {
  online: { label: 'На линии', tone: 'success' },
  busy: { label: 'Занят', tone: 'warning' },
  offline: { label: 'Не на линии', tone: 'neutral' },
};

export const queueStrategyLabels: Record<QueueStrategy, string> = {
  longest_idle: 'Дольше всех ждёт',
  round_robin: 'По кругу',
  ring_all: 'Все одновременно',
};

/** Описания стратегий — показываются как подсказка в форме очереди. */
export const queueStrategyHints: Record<QueueStrategy, string> = {
  longest_idle: 'Звонок уходит оператору, который дольше всех без вызова.',
  round_robin: 'Звонки распределяются по операторам по очереди, равномерно.',
  ring_all: 'Одновременно звонят все свободные операторы; берёт первый ответивший.',
};

/** Универсальный хелпер: вернуть информацию о статусе с запасным значением. */
export function statusInfo(map: Record<string, LabelInfo>, key: string): LabelInfo {
  return map[key] ?? { label: key, tone: 'neutral' };
}
