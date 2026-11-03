/**
 * Аутентификация (edge-версия).
 *
 * Логика повторяет Node-бэкенд:
 *  - регистрация всегда даёт роль 'agent' (никто не может самоназначить admin);
 *  - вход возвращает одинаковую ошибку для несуществующего e-mail и неверного
 *    пароля — чтобы нельзя было перебором узнать, какие почты зарегистрированы;
 *  - refresh-токен хранится в БД только в виде SHA-256 хэша и при обновлении
 *    ротируется (старый сразу отзывается).
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  hashPassword,
  verifyPassword,
  sha256hex,
  randomToken,
  parseTtlSeconds,
  signJwt,
  verifyJwt,
} from '../lib/crypto';
import { badRequest, conflict, forbidden, unauthorized, HttpError, json } from '../lib/http';
import { readJson, requireString, optionalString, isEmail, type Json } from '../lib/validate';

export interface Env {
  DB: D1Database;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  SEED_ADMIN_EMAIL: string;
  SEED_ADMIN_PASSWORD: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  status: string;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  status: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

/** Превращает строку БД в публичный объект пользователя (без хэша пароля). */
export function toPublicUser(row: UserRow): PublicUser {
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

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
}

export async function findUserById(db: D1Database, id: number): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

/** Выдаёт пару токенов: короткий access (JWT) и долгий refresh (в БД). */
async function issueTokens(env: Env, user: UserRow) {
  const accessToken = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    parseTtlSeconds(env.JWT_ACCESS_TTL),
  );
  const refreshToken = randomToken();
  const tokenHash = await sha256hex(refreshToken);
  const expiresAt = new Date(
    Date.now() + parseTtlSeconds(env.JWT_REFRESH_TTL) * 1000,
  ).toISOString();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',
  ).bind(user.id, tokenHash, expiresAt).run();
  return { accessToken, refreshToken };
}

export async function register(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 160 }).toLowerCase();
  const password = requireString(body, 'password', { min: 8, max: 72 });
  const fullName = requireString(body, 'fullName', { min: 2, max: 120 });
  if (!isEmail(email)) throw badRequest('Некорректный e-mail', { email: ['Некорректный e-mail'] });
  if (await findUserByEmail(env.DB, email)) throw conflict('Пользователь с таким e-mail уже существует');

  const passwordHash = await hashPassword(password);
  const res = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color)
     VALUES (?,?,?,'agent','offline','#4f46e5')`,
  ).bind(email, passwordHash, fullName).run();
  const user = await findUserById(env.DB, Number(res.meta.last_row_id));
  if (!user) throw new HttpError(500, 'INTERNAL_ERROR', 'Не удалось создать пользователя');
  const tokens = await issueTokens(env, user);
  return json({ ...tokens, user: toPublicUser(user) }, undefined, 201);
}

export async function login(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request);
  const email = (optionalString(body, 'email') ?? '').toLowerCase();
  const password = optionalString(body, 'password') ?? '';
  const user = await findUserByEmail(env.DB, email);
  // Одинаковое сообщение в обоих случаях — не выдаём, существует ли почта.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw unauthorized('Неверный e-mail или пароль');
  }
  const tokens = await issueTokens(env, user);
  return json({ ...tokens, user: toPublicUser(user) });
}

export async function refresh(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request);
  const token = optionalString(body, 'refreshToken') ?? '';
  if (!token) throw unauthorized('Refresh-токен не передан');
  const tokenHash = await sha256hex(token);
  const row = await env.DB.prepare(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL',
  ).bind(tokenHash).first<{ id: number; user_id: number; expires_at: string }>();
  if (!row) throw unauthorized('Недействительный refresh-токен');
  if (new Date(row.expires_at).getTime() < Date.now()) throw unauthorized('Refresh-токен истёк');

  const user = await findUserById(env.DB, row.user_id);
  if (!user) throw unauthorized('Пользователь не найден');

  // Ротация: старый токен отзываем, выдаём новый.
  await env.DB.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), row.id).run();
  const tokens = await issueTokens(env, user);
  return json({ ...tokens, user: toPublicUser(user) });
}

export async function logout(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request);
  const token = optionalString(body, 'refreshToken');
  if (token) {
    const tokenHash = await sha256hex(token);
    await env.DB.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?')
      .bind(new Date().toISOString(), tokenHash).run();
  }
  return json({ success: true });
}

/** Читает access-токен из заголовка Authorization. */
export function extractBearer(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export interface AuthContext {
  sub: number;
  email: string;
  role: string;
}

/** Требует валидный access-токен и возвращает контекст пользователя. */
export async function requireAuth(env: Env, request: Request): Promise<AuthContext> {
  const token = extractBearer(request);
  if (!token) throw unauthorized('Требуется авторизация');
  try {
    const payload = await verifyJwt(token, env.JWT_ACCESS_SECRET);
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    throw unauthorized('Недействительный или истёкший токен');
  }
}

/** Требует одну из указанных ролей. */
export function requireRole(auth: AuthContext, ...roles: string[]): void {
  if (!roles.includes(auth.role)) throw forbidden('Недостаточно прав');
}

export async function me(env: Env, request: Request): Promise<Response> {
  const auth = await requireAuth(env, request);
  const user = await findUserById(env.DB, auth.sub);
  if (!user) throw unauthorized('Пользователь не найден');
  return json(toPublicUser(user));
}

export type { Json };
