/**
 * Репозиторий очередей распределения звонков.
 */
import { getDatabase } from '../../db/connection.js';
import type { Queue, QueueStrategy } from '../../domain/types.js';

interface QueueRow {
  id: number;
  name: string;
  strategy: QueueStrategy;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** SQLite не имеет boolean — хранит 0/1. Наружу отдаём настоящий boolean. */
function toQueue(row: QueueRow): Queue {
  return {
    id: row.id,
    name: row.name,
    strategy: row.strategy,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateQueueInput {
  name: string;
  strategy: QueueStrategy;
  description?: string | null;
  isActive?: boolean;
}

export const queuesRepository = {
  findById(id: number): Queue | null {
    const row = getDatabase()
      .prepare('SELECT * FROM queues WHERE id = ?')
      .get(id) as QueueRow | undefined;
    return row ? toQueue(row) : null;
  },

  findByName(name: string): Queue | null {
    const row = getDatabase()
      .prepare('SELECT * FROM queues WHERE name = ?')
      .get(name) as QueueRow | undefined;
    return row ? toQueue(row) : null;
  },

  list(): Queue[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM queues ORDER BY name COLLATE NOCASE ASC')
      .all() as QueueRow[];
    return rows.map(toQueue);
  },

  create(input: CreateQueueInput): Queue {
    const result = getDatabase()
      .prepare(
        `INSERT INTO queues (name, strategy, description, is_active)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.strategy,
        input.description ?? null,
        input.isActive === false ? 0 : 1,
      );
    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error('Не удалось прочитать созданную очередь');
    return created;
  },

  update(
    id: number,
    patch: Partial<Pick<Queue, 'name' | 'strategy' | 'description' | 'isActive'>>,
  ): Queue | null {
    const sets: string[] = [];
    const args: unknown[] = [];

    if (patch.name !== undefined) {
      sets.push('name = ?');
      args.push(patch.name);
    }
    if (patch.strategy !== undefined) {
      sets.push('strategy = ?');
      args.push(patch.strategy);
    }
    if (patch.description !== undefined) {
      sets.push('description = ?');
      args.push(patch.description);
    }
    if (patch.isActive !== undefined) {
      sets.push('is_active = ?');
      args.push(patch.isActive ? 1 : 0);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    args.push(id);

    getDatabase()
      .prepare(`UPDATE queues SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);

    return this.findById(id);
  },

  remove(id: number): boolean {
    const result = getDatabase().prepare('DELETE FROM queues WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /** Количество звонков в очереди — для карточек на дашборде. */
  callsCount(queueId: number): number {
    const row = getDatabase()
      .prepare('SELECT COUNT(*) AS count FROM calls WHERE queue_id = ?')
      .get(queueId) as { count: number };
    return row.count;
  },
};
