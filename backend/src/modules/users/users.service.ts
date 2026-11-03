/**
 * Сервис пользователей — бизнес-логика.
 *
 * Разделение repository/service важно понимать так:
 *  - repository знает про SQL и таблицы;
 *  - service знает про ПРАВИЛА (нельзя завести двух пользователей с одним
 *    e-mail; стать нельзя менять себе роль; после смены пароля нужно
 *    отозвать сессии).
 *
 * Контроллеры вызывают сервисы, сервисы — репозитории. Никто «не прыгает»
 * через слой: это обеспечивает тестируемость и заменяемость частей.
 */
import { usersRepository } from './users.repository.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { activityRepository } from '../activity/activity.repository.js';
import { authRepository } from '../auth/auth.repository.js';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from './users.schema.js';
import type { User } from '../../domain/types.js';

/** Палитра для автоматического выбора цвета аватара при создании. */
const AVATAR_PALETTE = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function pickAvatarColor(seed: string): string {
  // Простая детерминированная «хэш-функция»: одинаковому e-mail всегда
  // достаётся одинаковая иконка — так аватары выглядят стабильно.
  let sum = 0;
  for (const char of seed) sum += char.charCodeAt(0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length] as string;
}

export const usersService = {
  /** Список пользователей с пагинацией. */
  list(query: ListUsersQuery): { items: User[]; total: number; page: number; limit: number } {
    const offset = (query.page - 1) * query.limit;
    const { items, total } = usersRepository.list({
      search: query.search,
      role: query.role,
      offset,
      limit: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  },

  /** Получить пользователя по id или выбросить 404. */
  getById(id: number): User {
    const record = usersRepository.findById(id);
    if (!record) throw new NotFoundError('Пользователь не найден');
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  },

  /** Создание сотрудника (админское действие). */
  async create(body: CreateUserBody, actorId: number): Promise<User> {
    const existing = usersRepository.findByEmail(body.email);
    if (existing) {
      throw new ConflictError('Пользователь с таким e-mail уже зарегистрирован');
    }

    const passwordHash = await hashPassword(body.password);
    const user = usersRepository.create({
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      role: body.role,
      avatarColor: body.avatarColor ?? pickAvatarColor(body.email),
    });

    activityRepository.log({
      actorId,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      meta: { email: user.email, role: user.role },
    });

    return user;
  },

  /** Обновление профиля. */
  update(id: number, body: UpdateUserBody, actor: { id: number; role: string }): User {
    const target = usersRepository.findById(id);
    if (!target) throw new NotFoundError('Пользователь не найден');

    // Защита от «повышения прав»: менять роль может только администратор.
    if (body.role && body.role !== target.role && actor.role !== 'admin') {
      throw new ForbiddenError('Изменять роль может только администратор');
    }

    const updated = usersRepository.update(id, body);
    if (!updated) throw new NotFoundError('Пользователь не найден');

    activityRepository.log({
      actorId: actor.id,
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      meta: { fields: Object.keys(body) },
    });

    return updated;
  },

  /** Смена собственного пароля с проверкой старого. */
  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const record = usersRepository.findById(id);
    if (!record) throw new NotFoundError('Пользователь не найден');

    const valid = await verifyPassword(currentPassword, record.passwordHash);
    if (!valid) throw new UnauthorizedError('Текущий пароль неверен');

    const passwordHash = await hashPassword(newPassword);
    usersRepository.updatePassword(id, passwordHash);

    // Ключевой момент безопасности: после смены пароля все прежние
    // refresh-сессии становятся недействительны. Иначе украденный
    // refresh-токен продолжил бы работать.
    authRepository.revokeAllForUser(id);

    activityRepository.log({
      actorId: id,
      action: 'user.password_changed',
      entityType: 'user',
      entityId: id,
    });
  },

  /** Удаление пользователя (только админ). */
  remove(id: number, actor: { id: number; role: string }): void {
    if (actor.role !== 'admin') {
      throw new ForbiddenError('Удалять пользователей может только администратор');
    }
    // Нельзя удалить самого себя — иначе можно остаться без доступа.
    if (actor.id === id) {
      throw new ForbiddenError('Нельзя удалить собственную учётную запись');
    }
    const record = usersRepository.findById(id);
    if (!record) throw new NotFoundError('Пользователь не найден');

    usersRepository.remove(id);
    activityRepository.log({
      actorId: actor.id,
      action: 'user.deleted',
      entityType: 'user',
      entityId: id,
      meta: { email: record.email },
    });
  },
};
