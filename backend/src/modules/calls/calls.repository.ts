/**
 * Репозиторий звонков.
 *
 * Самый «нагруженный» репозиторий: журнал звонков читается на дашборде,
 * в аналитике, в карточке контакта. Поэтому здесь аккуратно построены
 * запросы с фильтрами и соединениями (JOIN), чтобы одним запросом получить
 * звонок вместе с именем оператора и контакта — без «N+1» запросов.
 */
import { getDatabase } from '../../db/connection.js';
import type { Call, CallDirection, CallStatus } from '../../domain/types.js';

interface CallRow {
  id: number;
  direction: CallDirection;
  status: CallStatus;
  contact_id: number | null;
  agent_id: number | null;
  queue_id: number | null;
  phone_number: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_sec: number;
  wait_sec: number;
  recording_url: string | null;
  notes: string | null;
  created_at: string;
}

/** Расширенная модель для списков: плюс человекочитаемые имена. */
export interface CallWithRelations extends Call {
  contactName: string | null;
  agentName: string | null;
  queueName: string | null;
}

interface CallJoinedRow extends CallRow {
  contact_name: string | null;
  agent_name: string | null;
  queue_name: string | null;
}

function toCall(row: CallRow): Call {
  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    contactId: row.contact_id,
    agentId: row.agent_id,
    queueId: row.queue_id,
    phoneNumber: row.phone_number,
    startedAt: row.started_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    waitSec: row.wait_sec,
    recordingUrl: row.recording_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toCallWithRelations(row: CallJoinedRow): CallWithRelations {
  return {
    ...toCall(row),
    contactName: row.contact_name,
    agentName: row.agent_name,
    queueName: row.queue_name,
  };
}

export interface CreateCallInput {
  direction: CallDirection;
  status: CallStatus;
  contactId?: number | null;
  agentId?: number | null;
  queueId?: number | null;
  phoneNumber: string;
  durationSec?: number;
  waitSec?: number;
  answeredAt?: string | null;
  endedAt?: string | null;
  notes?: string | null;
}

/** Базовый SELECT с JOIN — переиспользуется в списке и в чтении по id. */
const JOINED_SELECT = /* sql */ `
  SELECT
    c.*,
    ct.full_name AS contact_name,
    ag.full_name AS agent_name,
    q.name       AS queue_name
  FROM calls c
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN users    ag ON ag.id = c.agent_id
  LEFT JOIN queues   q  ON q.id  = c.queue_id
`;

export const callsRepository = {
  findById(id: number): Call | null {
    const row = getDatabase()
      .prepare('SELECT * FROM calls WHERE id = ?')
      .get(id) as CallRow | undefined;
    return row ? toCall(row) : null;
  },

  findByIdWithRelations(id: number): CallWithRelations | null {
    const row = getDatabase()
      .prepare(`${JOINED_SELECT} WHERE c.id = ?`)
      .get(id) as CallJoinedRow | undefined;
    return row ? toCallWithRelations(row) : null;
  },

  create(input: CreateCallInput): Call {
    const result = getDatabase()
      .prepare(
        `INSERT INTO calls
           (direction, status, contact_id, agent_id, queue_id, phone_number,
            answered_at, ended_at, duration_sec, wait_sec, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.direction,
        input.status,
        input.contactId ?? null,
        input.agentId ?? null,
        input.queueId ?? null,
        input.phoneNumber,
        input.answeredAt ?? null,
        input.endedAt ?? null,
        input.durationSec ?? 0,
        input.waitSec ?? 0,
        input.notes ?? null,
      );
    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error('Не удалось прочитать созданный звонок');
    return created;
  },

  /** Частичное обновление — используется при смене статуса звонка. */
  update(
    id: number,
    patch: Partial<
      Pick<
        Call,
        'status' | 'agentId' | 'durationSec' | 'waitSec' | 'answeredAt' | 'endedAt' | 'notes'
      >
    >,
  ): Call | null {
    const sets: string[] = [];
    const args: unknown[] = [];

    if (patch.status !== undefined) {
      sets.push('status = ?');
      args.push(patch.status);
    }
    if (patch.agentId !== undefined) {
      sets.push('agent_id = ?');
      args.push(patch.agentId);
    }
    if (patch.durationSec !== undefined) {
      sets.push('duration_sec = ?');
      args.push(patch.durationSec);
    }
    if (patch.waitSec !== undefined) {
      sets.push('wait_sec = ?');
      args.push(patch.waitSec);
    }
    if (patch.answeredAt !== undefined) {
      sets.push('answered_at = ?');
      args.push(patch.answeredAt);
    }
    if (patch.endedAt !== undefined) {
      sets.push('ended_at = ?');
      args.push(patch.endedAt);
    }
    if (patch.notes !== undefined) {
      sets.push('notes = ?');
      args.push(patch.notes);
    }

    if (sets.length === 0) return this.findById(id);

    args.push(id);
    getDatabase()
      .prepare(`UPDATE calls SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);

    return this.findById(id);
  },

  /** Список звонков с фильтрами и сортировкой. */
  list(params: {
    direction?: CallDirection;
    status?: CallStatus;
    agentId?: number;
    contactId?: number;
    queueId?: number;
    from?: string;
    to?: string;
    offset: number;
    limit: number;
  }): { items: CallWithRelations[]; total: number } {
    const where: string[] = [];
    const args: unknown[] = [];

    if (params.direction) {
      where.push('c.direction = ?');
      args.push(params.direction);
    }
    if (params.status) {
      where.push('c.status = ?');
      args.push(params.status);
    }
    if (params.agentId) {
      where.push('c.agent_id = ?');
      args.push(params.agentId);
    }
    if (params.contactId) {
      where.push('c.contact_id = ?');
      args.push(params.contactId);
    }
    if (params.queueId) {
      where.push('c.queue_id = ?');
      args.push(params.queueId);
    }
    if (params.from) {
      where.push('c.started_at >= ?');
      args.push(params.from);
    }
    if (params.to) {
      where.push('c.started_at <= ?');
      args.push(params.to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = getDatabase()
      .prepare(`SELECT COUNT(*) AS count FROM calls c ${whereSql}`)
      .get(...args) as { count: number };

    const rows = getDatabase()
      .prepare(`${JOINED_SELECT} ${whereSql} ORDER BY c.started_at DESC, c.id DESC LIMIT ? OFFSET ?`)
      .all(...args, params.limit, params.offset) as CallJoinedRow[];

    return { items: rows.map(toCallWithRelations), total: totalRow.count };
  },

  /** Сводка по статусам — для метрик дашборда одним запросом. */
  statusCounts(): Record<CallStatus, number> {
    const rows = getDatabase()
      .prepare('SELECT status, COUNT(*) AS count FROM calls GROUP BY status')
      .all() as { status: CallStatus; count: number }[];

    // Инициализируем все статусы нулями, чтобы фронтенд не проверял undefined.
    const result: Record<CallStatus, number> = {
      queued: 0,
      ringing: 0,
      answered: 0,
      completed: 0,
      missed: 0,
      failed: 0,
    };
    for (const row of rows) result[row.status] = row.count;
    return result;
  },

  /** Суммарная длительность и среднее — основа метрик. */
  durationStats(): { totalSec: number; avgSec: number; count: number } {
    const row = getDatabase()
      .prepare(
        'SELECT COALESCE(SUM(duration_sec), 0) AS total, COALESCE(AVG(duration_sec), 0) AS avg, COUNT(*) AS count FROM calls',
      )
      .get() as { total: number; avg: number; count: number };
    return { totalSec: row.total, avgSec: Math.round(row.avg), count: row.count };
  },

  /**
   * Активность по дням за период — для линейного графика.
   * SQLite-функция date() вырезает дату из ISO-строки.
   */
  dailyActivity(days = 14): { date: string; inbound: number; outbound: number }[] {
    const rows = getDatabase()
      .prepare(
        `SELECT
           date(started_at) AS date,
           SUM(CASE WHEN direction = 'inbound'  THEN 1 ELSE 0 END) AS inbound,
           SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
         FROM calls
         WHERE started_at >= date('now', ?)
         GROUP BY date(started_at)
         ORDER BY date ASC`,
      )
      .all(`-${days} days`) as { date: string; inbound: number; outbound: number }[];
    return rows;
  },
};
