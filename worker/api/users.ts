/**
 * Пользователи (edge-версия).
 *
 * Правила доступа те же, что в Node-бэкенде:
 *  - список видят все вошедшие, создавать может только admin;
 *  - менять роль вправе только admin (супервайзер — нет, иначе он повысит себя);
 *  - удалять может только admin и не самого себя.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { conflict, forbidden, notFound, json, paginationMeta, badRequest } from '../lib/http';
import { readJson, requireString, optionalString, optionalEnum } from '../lib/validate';
import { hashPassword } from '../lib/crypto';
import { findUserById, toPublicUser, type AuthContext } from './auth';

const ROLES = ['admin', 'supervisor', 'agent'] as const;
const STATUSES = ['online', 'busy', 'offline'] as const;

interface UserRow {
  id: number; email: string; password_hash: string; full_name: string;
  role: string; status: string; avatar_color: string; created_at: string; updated_at: string;
}

export async function listUsers(db: D1Database, url: URL): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  const search = url.searchParams.get('search');
  const role = url.searchParams.get('role');
  if (search) {
    where.push('(full_name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM users ${clause}`).bind(...params).first<{ c: number }>();
  const rows = await db.prepare(`SELECT * FROM users ${clause} ORDER BY created_at ASC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset).all<UserRow>();

  return json((rows.results ?? []).map(toPublicUser), paginationMeta(countRow?.c ?? 0, { page, limit }));
}

export async function getUser(db: D1Database, id: number): Promise<Response> {
  const user = await findUserById(db, id);
  if (!user) throw notFound('Пользователь не найден');
  return json(toPublicUser(user));
}

export async function createUser(db: D1Database, request: Request, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') throw forbidden('Только администратор может создавать пользователей');
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 160 }).toLowerCase();
  const password = requireString(body, 'password', { min: 8, max: 72 });
  const fullName = requireString(body, 'fullName', { min: 2, max: 120 });
  const role = optionalEnum(body, 'role', ROLES) ?? 'agent';

  const exists = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw conflict('Пользователь с таким e-mail уже существует');

  const passwordHash = await hashPassword(password);
  const res = await db.prepare(
    'INSERT INTO users (email, password_hash, full_name, role, status, avatar_color) VALUES (?,?,?,?,?,?)',
  ).bind(email, passwordHash, fullName, role, 'offline', '#4f46e5').run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'user.created', 'user', Number(res.meta.last_row_id)).run();
  return getUser(db, Number(res.meta.last_row_id));
}

export async function updateUser(db: D1Database, request: Request, id: number, auth: AuthContext): Promise<Response> {
  const user = await findUserById(db, id);
  if (!user) throw notFound('Пользователь не найден');
  const body = await readJson(request);

  const fields: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, value: unknown) => {
    fields.push(`${col} = ?`);
    params.push(value);
  };

  const fullName = optionalString(body, 'fullName');
  if (fullName) set('full_name', fullName);
  const status = optionalEnum(body, 'status', STATUSES);
  if (status) set('status', status);

  // Смену роли разрешаем только администратору.
  const role = optionalEnum(body, 'role', ROLES);
  if (role) {
    if (auth.role !== 'admin') throw forbidden('Менять роль может только администратор');
    set('role', role);
  }

  if (fields.length === 0) return getUser(db, id);
  set('updated_at', new Date().toISOString());
  params.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'user.updated', 'user', id).run();
  return getUser(db, id);
}

export async function deleteUser(db: D1Database, id: number, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') throw forbidden('Только администратор может удалять пользователей');
  if (auth.sub === id) throw forbidden('Вы не можете удалить собственную учётную запись');
  const user = await findUserById(db, id);
  if (!user) throw notFound('Пользователь не найден');
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'user.deleted', 'user', id).run();
  return json({ success: true });
}

export async function changeOwnPassword(db: D1Database, request: Request, auth: AuthContext): Promise<Response> {
  const body = await readJson(request);
  const current = requireString(body, 'currentPassword');
  const next = requireString(body, 'newPassword', { min: 8, max: 72 });
  const user = await findUserById(db, auth.sub);
  if (!user) throw notFound('Пользователь не найден');
  const { verifyPassword } = await import('../lib/crypto');
  if (!(await verifyPassword(current, user.password_hash))) {
    throw badRequest('Неверный текущий пароль');
  }
  const passwordHash = await hashPassword(next);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(passwordHash, new Date().toISOString(), auth.sub).run();
  // Отзываем все сессии: после смены пароля старые refresh-токены недействительны.
  await db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .bind(new Date().toISOString(), auth.sub).run();
  return json({ success: true });
}

export type { AuthContext };
