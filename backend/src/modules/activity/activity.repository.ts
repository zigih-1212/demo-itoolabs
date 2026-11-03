/**
 * Модуль аудита (activity_log).
 *
 * Маленький модуль с одной задачей: записывать, кто и что сделал.
 * Вынесен отдельно от остальных, потому что его используют МНОГИЕ модули
 * (users, contacts, queues). Это пример правильной зависимости: модули
 * зависят от узкого «журнала», а не наоборот.
 */
import { getDatabase } from '../../db/connection.js';

export interface ActivityEntry {
  id: number;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

interface ActivityRow {
  id: number;
  actor_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  meta: string;
  created_at: string;
}

function toEntry(row: ActivityRow): ActivityEntry {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(row.meta) as Record<string, unknown>;
  } catch {
    // Повреждённый JSON в аудите не должен ронять запрос — просто пустой объект.
    meta = {};
  }
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    meta,
    createdAt: row.created_at,
  };
}

export const activityRepository = {
  /** Добавляет запись в журнал. Вызывается из сервисов после значимых действий. */
  log(input: {
    actorId: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    meta?: Record<string, unknown>;
  }): void {
    getDatabase()
      .prepare(
        `INSERT INTO activity_log (actor_id, action, entity_type, entity_id, meta)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.actorId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.meta ?? {}),
      );
  },

  /** Последние события (для дашборда руководителя). */
  recent(limit = 20): ActivityEntry[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM activity_log ORDER BY created_at DESC, id DESC LIMIT ?')
      .all(limit) as ActivityRow[];
    return rows.map(toEntry);
  },
};
