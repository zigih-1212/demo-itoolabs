/**
 * Контакты и очереди (edge-версия).
 *
 * Контакты: CRUD справочника. Изменять может admin/supervisor, читать — любой
 * вошедший (оператору нужно видеть, кому звонить).
 * Очереди: CRUD распределения звонков, доступен admin/supervisor.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { conflict, forbidden, notFound, json, paginationMeta, badRequest } from '../lib/http';
import { readJson, requireString, optionalString, optionalEnum, optionalBoolean, optionalStringArray } from '../lib/validate';
import type { AuthContext } from './auth';

const STRATEGIES = ['longest_idle', 'round_robin', 'ring_all'] as const;

// ---------------------------------------------------------------------------
// Контакты
// ---------------------------------------------------------------------------

interface ContactRow {
  id: number; owner_id: number | null; full_name: string; phone: string;
  email: string | null; company: string | null; tags: string; notes: string | null;
  created_at: string; updated_at: string;
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toContact(row: ContactRow) {
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

export async function listContacts(db: D1Database, url: URL): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  const search = url.searchParams.get('search');
  const tag = url.searchParams.get('tag');
  if (search) {
    where.push('(full_name LIKE ? OR phone LIKE ? OR company LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (tag) {
    where.push('tags LIKE ?');
    params.push(`%"${tag}"%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Сортировка через белый список — имя колонки нельзя параметризовать, поэтому
  // подставляем только из фиксированного набора (защита от SQL-инъекции).
  const sortMap: Record<string, string> = {
    name: 'full_name ASC',
    company: 'company ASC',
    created: 'created_at DESC',
  };
  const order = sortMap[url.searchParams.get('sort') ?? 'created'] ?? 'created_at DESC';

  const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM contacts ${clause}`).bind(...params).first<{ c: number }>();
  const rows = await db.prepare(`SELECT * FROM contacts ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset).all<ContactRow>();
  return json((rows.results ?? []).map(toContact), paginationMeta(countRow?.c ?? 0, { page, limit }));
}

export async function getContact(db: D1Database, id: number): Promise<Response> {
  const row = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first<ContactRow>();
  if (!row) throw notFound('Контакт не найден');
  return json(toContact(row));
}

export async function createContact(db: D1Database, request: Request, auth: AuthContext): Promise<Response> {
  const body = await readJson(request);
  const fullName = requireString(body, 'fullName', { min: 2, max: 120 });
  const phone = requireString(body, 'phone', { min: 5, max: 32 });
  if (!/^[+()\d\s-]+$/.test(phone)) throw badRequest('Некорректный номер телефона', { phone: ['Допустимы цифры, пробелы и символы + ( ) -'] });

  const dup = await db.prepare('SELECT id FROM contacts WHERE phone = ?').bind(phone).first();
  if (dup) throw conflict('Контакт с таким номером уже существует');

  const tags = optionalStringArray(body, 'tags') ?? [];
  const res = await db.prepare(
    'INSERT INTO contacts (owner_id, full_name, phone, email, company, tags, notes) VALUES (?,?,?,?,?,?,?)',
  ).bind(auth.sub, fullName, phone, optionalString(body, 'email') ?? null, optionalString(body, 'company') ?? null, JSON.stringify(tags), optionalString(body, 'notes') ?? null).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'contact.created', 'contact', Number(res.meta.last_row_id)).run();
  return getContact(db, Number(res.meta.last_row_id));
}

export async function updateContact(db: D1Database, request: Request, id: number, auth: AuthContext): Promise<Response> {
  if (auth.role === 'agent') throw forbidden('Недостаточно прав');
  const row = await db.prepare('SELECT id, phone FROM contacts WHERE id = ?').bind(id).first<{ id: number; phone: string }>();
  if (!row) throw notFound('Контакт не найден');
  const body = await readJson(request);

  const fields: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, value: unknown) => {
    fields.push(`${col} = ?`);
    params.push(value);
  };

  const fullName = optionalString(body, 'fullName');
  if (fullName) set('full_name', fullName);
  const phone = optionalString(body, 'phone');
  if (phone) {
    if (!/^[+()\d\s-]+$/.test(phone)) throw badRequest('Некорректный номер телефона', { phone: ['Некорректный формат'] });
    if (phone !== row.phone) {
      const dup = await db.prepare('SELECT id FROM contacts WHERE phone = ? AND id != ?').bind(phone, id).first();
      if (dup) throw conflict('Контакт с таким номером уже существует');
    }
    set('phone', phone);
  }
  const email = optionalString(body, 'email');
  if (email !== undefined) set('email', email ?? null);
  const company = optionalString(body, 'company');
  if (company !== undefined) set('company', company ?? null);
  const notes = optionalString(body, 'notes');
  if (notes !== undefined) set('notes', notes ?? null);
  const tags = optionalStringArray(body, 'tags');
  if (tags !== undefined) set('tags', JSON.stringify(tags));

  if (fields.length === 0) return getContact(db, id);
  set('updated_at', new Date().toISOString());
  params.push(id);
  await db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'contact.updated', 'contact', id).run();
  return getContact(db, id);
}

export async function deleteContact(db: D1Database, id: number, auth: AuthContext): Promise<Response> {
  if (auth.role === 'agent') throw forbidden('Недостаточно прав');
  const row = await db.prepare('SELECT id FROM contacts WHERE id = ?').bind(id).first();
  if (!row) throw notFound('Контакт не найден');
  await db.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'contact.deleted', 'contact', id).run();
  return json({ success: true });
}

// ---------------------------------------------------------------------------
// Очереди
// ---------------------------------------------------------------------------

interface QueueRow {
  id: number; name: string; strategy: string; description: string | null;
  is_active: number; created_at: string; updated_at: string;
}

function toQueue(row: QueueRow) {
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

export async function listQueues(db: D1Database): Promise<Response> {
  const rows = await db.prepare('SELECT * FROM queues ORDER BY created_at ASC').all<QueueRow>();
  return json((rows.results ?? []).map(toQueue));
}

export async function getQueue(db: D1Database, id: number): Promise<Response> {
  const row = await db.prepare('SELECT * FROM queues WHERE id = ?').bind(id).first<QueueRow>();
  if (!row) throw notFound('Очередь не найдена');
  return json(toQueue(row));
}

export async function createQueue(db: D1Database, request: Request, auth: AuthContext): Promise<Response> {
  const body = await readJson(request);
  const name = requireString(body, 'name', { min: 2, max: 80 });
  const strategy = optionalEnum(body, 'strategy', STRATEGIES) ?? 'longest_idle';
  const description = optionalString(body, 'description') ?? null;
  const isActive = optionalBoolean(body, 'isActive') ?? true;

  const dup = await db.prepare('SELECT id FROM queues WHERE name = ?').bind(name).first();
  if (dup) throw conflict('Очередь с таким названием уже существует');

  const res = await db.prepare('INSERT INTO queues (name, strategy, description, is_active) VALUES (?,?,?,?)')
    .bind(name, strategy, description, isActive ? 1 : 0).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'queue.created', 'queue', Number(res.meta.last_row_id)).run();
  return getQueue(db, Number(res.meta.last_row_id));
}

export async function updateQueue(db: D1Database, request: Request, id: number, auth: AuthContext): Promise<Response> {
  const row = await db.prepare('SELECT id FROM queues WHERE id = ?').bind(id).first();
  if (!row) throw notFound('Очередь не найдена');
  const body = await readJson(request);

  const fields: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, value: unknown) => {
    fields.push(`${col} = ?`);
    params.push(value);
  };
  const name = optionalString(body, 'name');
  if (name) set('name', name);
  const strategy = optionalEnum(body, 'strategy', STRATEGIES);
  if (strategy) set('strategy', strategy);
  const description = optionalString(body, 'description');
  if (description !== undefined) set('description', description ?? null);
  const isActive = optionalBoolean(body, 'isActive');
  if (isActive !== undefined) set('is_active', isActive ? 1 : 0);

  if (fields.length === 0) return getQueue(db, id);
  set('updated_at', new Date().toISOString());
  params.push(id);
  await db.prepare(`UPDATE queues SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'queue.updated', 'queue', id).run();
  return getQueue(db, id);
}

export async function deleteQueue(db: D1Database, id: number, auth: AuthContext): Promise<Response> {
  const row = await db.prepare('SELECT id FROM queues WHERE id = ?').bind(id).first();
  if (!row) throw notFound('Очередь не найдена');
  await db.prepare('DELETE FROM queues WHERE id = ?').bind(id).run();
  await db.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(auth.sub, 'queue.deleted', 'queue', id).run();
  return json({ success: true });
}
