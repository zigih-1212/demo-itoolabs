/**
 * Репозиторий пользователей.
 *
 * Слой репозитория — единственное место, где код знает про SQL и про то,
 * как строки БД превращаются в объекты домена (snake_case → camelCase).
 * Сервисы работают уже с чистыми объектами User/UserRecord и не зависят
 * от структуры таблиц: сменим SQLite на PostgreSQL — поменяется только этот файл.
 */
import { getDatabase } from '../../db/connection.js';
import type { User, UserRecord, UserRole, UserStatus } from '../../domain/types.js';

/** Строка таблицы users так, как её возвращает драйвер SQLite. */
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

/** Маппер строки БД в публичную модель пользователя (без пароля). */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Маппер строки БД во внутреннюю модель (с хэшем пароля). */
function toUserRecord(row: UserRow): UserRecord {
  return { ...toUser(row), passwordHash: row.password_hash };
}

/**
 * Убирает из записи хэш пароля, оставляя публичную модель User.
 * Нужен там, где репозиторий получает UserRecord (например, из findById),
 * но наружу обязан вернуть представление БЕЗ секретов. Так пароль не может
 * случайно утечь в ответ API.
 */
function toPublic(record: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = record;
  return user;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  avatarColor: string;
  status?: UserStatus;
}

export const usersRepository = {
  /** Ищет пользователя по e-mail (регистронезависимо — COLLATE NOCASE в схеме). */
  findByEmail(email: string): UserRecord | null {
    const row = getDatabase()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;
    return row ? toUserRecord(row) : null;
  },

  /** Ищет пользователя по id. */
  findById(id: number): UserRecord | null {
    const row = getDatabase()
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
    return row ? toUserRecord(row) : null;
  },

  /** Создаёт пользователя и возвращает его публичное представление. */
  create(input: CreateUserInput): User {
    const result = getDatabase()
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.email,
        input.passwordHash,
        input.fullName,
        input.role,
        input.status ?? 'offline',
        input.avatarColor,
      );

    const created = this.findById(Number(result.lastInsertRowid));
    // Сразу после INSERT запись обязана существовать. Если её нет — это
    // сломанная инварианта, бросаем явно, а не возвращаем null молча.
    if (!created) throw new Error('Не удалось прочитать созданного пользователя');
    return toPublic(created);
  },

  /** Список пользователей с фильтрами и пагинацией. */
  list(params: {
    search?: string;
    role?: UserRole;
    offset: number;
    limit: number;
  }): { items: User[]; total: number } {
    const where: string[] = [];
    const args: unknown[] = [];

    if (params.search) {
      // LIKE с двумя % ищет подстроку в имени или e-mail.
      where.push('(full_name LIKE ? OR email LIKE ?)');
      const like = `%${params.search}%`;
      args.push(like, like);
    }
    if (params.role) {
      where.push('role = ?');
      args.push(params.role);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = getDatabase()
      .prepare(`SELECT COUNT(*) AS count FROM users ${whereSql}`)
      .get(...args) as { count: number };

    const rows = getDatabase()
      .prepare(
        `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, params.limit, params.offset) as UserRow[];

    return { items: rows.map(toUser), total: totalRow.count };
  },
  /** Обновляет изменяемые поля профиля. */
  update(
    id: number,
    patch: Partial<Pick<User, 'fullName' | 'role' | 'status' | 'avatarColor'>>,
  ): User | null {
    const sets: string[] = [];
    const args: unknown[] = [];

    if (patch.fullName !== undefined) {
      sets.push('full_name = ?');
      args.push(patch.fullName);
    }
    if (patch.role !== undefined) {
      sets.push('role = ?');
      args.push(patch.role);
    }
    if (patch.status !== undefined) {
      sets.push('status = ?');
      args.push(patch.status);
    }
    if (patch.avatarColor !== undefined) {
      sets.push('avatar_color = ?');
      args.push(patch.avatarColor);
    }

    if (sets.length === 0) {
      const existing = this.findById(id);
      return existing ? toPublic(existing) : null;
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    args.push(id);

    getDatabase()
      .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);

    const updated = this.findById(id);
    return updated ? toPublic(updated) : null;
  },

  /** Меняет пароль (после смены пароля refresh-сессии отзываются в сервисе). */
  updatePassword(id: number, passwordHash: string): void {
    getDatabase()
      .prepare(
        `UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`,
      )
      .run(passwordHash, id);
  },

  /** Удаляет пользователя; связанные звонки сохраняются (agent_id → NULL). */
  remove(id: number): boolean {
    const result = getDatabase().prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /** Количество пользователей (используется в аналитике). */
  count(): number {
    const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM users').get() as {
      count: number;
    };
    return row.count;
  },
};
