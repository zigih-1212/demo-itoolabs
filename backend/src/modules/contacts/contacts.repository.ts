/**
 * Репозиторий контактов.
 *
 * Обратите внимание на работу с полем tags: в БД это JSON-строка,
 * а наружу (и внутрь) ходит обычный массив строк. Преобразование
 * инкапсулировано здесь, в мапперах — сервис о формате хранения не знает.
 */
import { getDatabase } from '../../db/connection.js';
import type { Contact } from '../../domain/types.js';

interface ContactRow {
  id: number;
  owner_id: number | null;
  full_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  tags: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Безопасный парсинг tags: повреждённый JSON не должен ронять список. */
function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    ownerId: row.owner_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    tags: parseTags(row.tags),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateContactInput {
  ownerId: number;
  fullName: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
}

export const contactsRepository = {
  findById(id: number): Contact | null {
    const row = getDatabase()
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .get(id) as ContactRow | undefined;
    return row ? toContact(row) : null;
  },

  create(input: CreateContactInput): Contact {
    const result = getDatabase()
      .prepare(
        `INSERT INTO contacts (owner_id, full_name, phone, email, company, tags, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.ownerId,
        input.fullName,
        input.phone,
        input.email ?? null,
        input.company ?? null,
        JSON.stringify(input.tags ?? []),
        input.notes ?? null,
      );
    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error('Не удалось прочитать созданный контакт');
    return created;
  },

  /** Обновление с частичным патчем: меняем только переданные поля. */
  update(id: number, patch: Partial<Omit<CreateContactInput, 'ownerId'>>): Contact | null {
    const sets: string[] = [];
    const args: unknown[] = [];

    if (patch.fullName !== undefined) {
      sets.push('full_name = ?');
      args.push(patch.fullName);
    }
    if (patch.phone !== undefined) {
      sets.push('phone = ?');
      args.push(patch.phone);
    }
    if (patch.email !== undefined) {
      sets.push('email = ?');
      args.push(patch.email);
    }
    if (patch.company !== undefined) {
      sets.push('company = ?');
      args.push(patch.company);
    }
    if (patch.tags !== undefined) {
      sets.push('tags = ?');
      args.push(JSON.stringify(patch.tags));
    }
    if (patch.notes !== undefined) {
      sets.push('notes = ?');
      args.push(patch.notes);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    args.push(id);

    getDatabase()
      .prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);

    return this.findById(id);
  },

  remove(id: number): boolean {
    const result = getDatabase().prepare('DELETE FROM contacts WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /** Поиск с фильтрами + сортировка. Фильтр по тегу реализован через LIKE по JSON. */
  list(params: {
    search?: string;
    tag?: string;
    ownerId?: number;
    sort: 'name' | 'created' | 'company';
    offset: number;
    limit: number;
  }): { items: Contact[]; total: number } {
    const where: string[] = [];
    const args: unknown[] = [];

    if (params.search) {
      where.push('(full_name LIKE ? OR phone LIKE ? OR company LIKE ? OR email LIKE ?)');
      const like = `%${params.search}%`;
      args.push(like, like, like, like);
    }
    if (params.tag) {
      // Нестрогий поиск по JSON-строке. Для больших объёмов данных нужен
      // отдельный индекс/таблица тегов, но для демо этого достаточно.
      where.push('tags LIKE ?');
      args.push(`%"${params.tag}"%`);
    }
    if (params.ownerId) {
      where.push('owner_id = ?');
      args.push(params.ownerId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Сортировка через белый список — защита от SQL-инъекции через параметр sort.
    const orderBy =
      params.sort === 'name'
        ? 'full_name COLLATE NOCASE ASC'
        : params.sort === 'company'
          ? 'company COLLATE NOCASE ASC'
          : 'created_at DESC';

    const totalRow = getDatabase()
      .prepare(`SELECT COUNT(*) AS count FROM contacts ${whereSql}`)
      .get(...args) as { count: number };

    const rows = getDatabase()
      .prepare(
        `SELECT * FROM contacts ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      )
      .all(...args, params.limit, params.offset) as ContactRow[];

    return { items: rows.map(toContact), total: totalRow.count };
  },

  /** Поиск контакта по номеру — используется для сопоставления звонка с карточкой. */
  findByPhone(phone: string): Contact | null {
    const row = getDatabase()
      .prepare('SELECT * FROM contacts WHERE phone = ? LIMIT 1')
      .get(phone) as ContactRow | undefined;
    return row ? toContact(row) : null;
  },
};
