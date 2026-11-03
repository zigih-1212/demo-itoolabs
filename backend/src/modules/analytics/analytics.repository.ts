/**
 * Репозиторий аналитики.
 *
 * Здесь живут только «тяжёлые» агрегирующие запросы: рейтинг операторов,
 * загрузка очередей, распределение по часам. Логика вынесена из calls,
 * потому что аналитика — отдельная ответственность и её набор запросов
 * будет расти независимо от CRUD звонков.
 */
import { getDatabase } from '../../db/connection.js';

export interface AgentPerformanceRow {
  agentId: number;
  agentName: string;
  total: number;
  answered: number;
  missed: number;
  avgTalkSec: number;
  totalTalkSec: number;
}

/** Рейтинг операторов: сколько обработали, сколько потеряли, средняя длительность. */
export const analyticsRepository = {
  agentPerformance(): AgentPerformanceRow[] {
    const rows = getDatabase()
      .prepare(
        `SELECT
           u.id        AS agent_id,
           u.full_name AS agent_name,
           COUNT(c.id) AS total,
           SUM(CASE WHEN c.status IN ('answered', 'completed') THEN 1 ELSE 0 END) AS answered,
           SUM(CASE WHEN c.status IN ('missed', 'failed')     THEN 1 ELSE 0 END) AS missed,
           CAST(AVG(c.duration_sec) AS INTEGER) AS avg_talk_sec,
           COALESCE(SUM(c.duration_sec), 0)     AS total_talk_sec
         FROM users u
         LEFT JOIN calls c ON c.agent_id = u.id
         WHERE u.role IN ('agent', 'supervisor')
         GROUP BY u.id
         ORDER BY total DESC, u.full_name ASC`,
      )
      .all() as {
      agent_id: number;
      agent_name: string;
      total: number;
      answered: number;
      missed: number;
      avg_talk_sec: number;
      total_talk_sec: number;
    }[];

    return rows.map((row) => ({
      agentId: row.agent_id,
      agentName: row.agent_name,
      total: row.total,
      answered: row.answered,
      missed: row.missed,
      avgTalkSec: row.avg_talk_sec ?? 0,
      totalTalkSec: row.total_talk_sec,
    }));
  },

  /** Нагрузка по очередям: сколько звонков прошло через каждую. */
  queueLoad(): { queueId: number; queueName: string; total: number; missed: number }[] {
    const rows = getDatabase()
      .prepare(
        `SELECT
           q.id        AS queue_id,
           q.name      AS queue_name,
           COUNT(c.id) AS total,
           SUM(CASE WHEN c.status IN ('missed', 'failed') THEN 1 ELSE 0 END) AS missed
         FROM queues q
         LEFT JOIN calls c ON c.queue_id = q.id
         GROUP BY q.id
         ORDER BY total DESC`,
      )
      .all() as { queue_id: number; queue_name: string; total: number; missed: number }[];

    return rows.map((row) => ({
      queueId: row.queue_id,
      queueName: row.queue_name,
      total: row.total,
      missed: row.missed,
    }));
  },

  /**
   * Распределение звонков по часам суток (0–23).
   * Помогает понять пиковые нагрузки и составить график смен.
   */
  hourlyDistribution(): { hour: number; total: number }[] {
    const rows = getDatabase()
      .prepare(
        `SELECT
           CAST(strftime('%H', started_at) AS INTEGER) AS hour,
           COUNT(*) AS total
         FROM calls
         GROUP BY hour
         ORDER BY hour ASC`,
      )
      .all() as { hour: number; total: number }[];

    // Заполняем пропущенные часы нулями: график должен быть непрерывным.
    const byHour = new Map(rows.map((row) => [row.hour, row.total]));
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total: byHour.get(hour) ?? 0,
    }));
  },
};
