/**
 * Звонки и аналитика (edge-версия).
 *
 * Здесь собраны «тяжёлые» агрегаты (сводка, дневная активность, рейтинг
 * операторов, загрузка очередей, распределение по часам). Реализация
 * повторяет SQL-логику Node-бэкенда, но имена полей приведены к тому виду,
 * который ожидает фронтенд (camelCase, totalCalls, answerRate и т. д.).
 *
 * Почему агрегации в SQL, а не в JS-цикле: на edge каждый лишний проход по
 * данным — это CPU-время и деньги. Считать должен движок БД.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { notFound, json, paginationMeta, badRequest } from '../lib/http';
import { readJson, requireString, requireEnum, optionalString, optionalNumber } from '../lib/validate';
import { findUserById, type AuthContext } from './auth';

const DIRECTIONS = ['inbound', 'outbound'] as const;

/** SQL-выборка звонка с именами связанных сущностей (contact/agent/queue). */
const CALL_SELECT = `
  SELECT c.*,
         ct.full_name AS contact_name,
         u.full_name  AS agent_name,
         q.name       AS queue_name
  FROM calls c
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN users    u  ON u.id  = c.agent_id
  LEFT JOIN queues   q  ON q.id  = c.queue_id`;

interface CallRow {
  id: number;
  direction: string;
  status: string;
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
  contact_name: string | null;
  agent_name: string | null;
  queue_name: string | null;
}

function toCall(row: CallRow) {
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
    contactName: row.contact_name,
    agentName: row.agent_name,
    queueName: row.queue_name,
  };
}

export async function listCalls(db: D1Database, url: URL): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  const direction = url.searchParams.get('direction');
  const status = url.searchParams.get('status');
  if (direction) {
    where.push('c.direction = ?');
    params.push(direction);
  }
  if (status) {
    where.push('c.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM calls c ${clause}`).bind(...params).first<{ c: number }>();
  const rows = await db.prepare(`${CALL_SELECT} ${clause} ORDER BY c.started_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset).all<CallRow>();

  return json((rows.results ?? []).map(toCall), paginationMeta(countRow?.c ?? 0, { page, limit }));
}

export async function getCall(db: D1Database, id: number): Promise<Response> {
  const row = await db.prepare(`${CALL_SELECT} WHERE c.id = ?`).bind(id).first<CallRow>();
  if (!row) throw notFound('Звонок не найден');
  return json(toCall(row));
}

export async function createCall(env: { DB: D1Database }, request: Request, actorId: number): Promise<Response> {
  const body = await readJson(request);
  const direction = requireEnum(body, 'direction', DIRECTIONS);
  const phoneNumber = requireString(body, 'phoneNumber', { min: 5, max: 32 });
  const status = (optionalString(body, 'status') as string) ?? 'completed';
  const agentId = optionalNumber(body, 'agentId') ?? null;
  const queueId = optionalNumber(body, 'queueId') ?? null;
  const durationSec = Number(body.durationSec ?? 0) || 0;
  const waitSec = Number(body.waitSec ?? 0) || 0;

  if (agentId && !(await findUserById(env.DB, agentId))) throw badRequest('Указанный оператор не найден');
  if (queueId) {
    const q = await env.DB.prepare('SELECT id FROM queues WHERE id = ?').bind(queueId).first();
    if (!q) throw badRequest('Указанная очередь не найдена');
  }

  // Автопривязка контакта по номеру, если contactId не задан.
  let contactId = optionalNumber(body, 'contactId') ?? null;
  if (!contactId) {
    const contact = await env.DB.prepare('SELECT id FROM contacts WHERE phone = ?').bind(phoneNumber).first<{ id: number }>();
    if (contact) contactId = contact.id;
  }

  const now = Date.now();
  const answered = status === 'answered' || status === 'completed';
  const finished = status === 'completed' || status === 'missed' || status === 'failed';
  const answeredAt = answered ? new Date(now - (durationSec + waitSec) * 1000).toISOString() : null;
  const endedAt = finished ? new Date(now).toISOString() : null;

  const res = await env.DB.prepare(
    `INSERT INTO calls (direction, status, contact_id, agent_id, queue_id, phone_number, answered_at, ended_at, duration_sec, wait_sec, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(direction, status, contactId, agentId, queueId, phoneNumber, answeredAt, endedAt, durationSec, waitSec, optionalString(body, 'notes') ?? null).run();

  await env.DB.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(actorId, 'call.created', 'call', Number(res.meta.last_row_id)).run();

  return getCall(env.DB, Number(res.meta.last_row_id));
}

export async function updateCall(env: { DB: D1Database }, request: Request, id: number, actorId: number): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM calls WHERE id = ?').bind(id).first();
  if (!existing) throw notFound('Звонок не найден');
  const body = await readJson(request);

  const fields: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, value: unknown) => {
    fields.push(`${col} = ?`);
    params.push(value);
  };
  const status = optionalString(body, 'status');
  if (status) set('status', status);
  const agentId = optionalNumber(body, 'agentId');
  if (agentId !== undefined) set('agent_id', agentId);
  const durationSec = optionalNumber(body, 'durationSec');
  if (durationSec !== undefined && durationSec !== null) set('duration_sec', durationSec);
  const notes = optionalString(body, 'notes');
  if (notes !== undefined) set('notes', notes);
  if (fields.length === 0) return getCall(env.DB, id);

  params.push(id);
  await env.DB.prepare(`UPDATE calls SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  await env.DB.prepare('INSERT INTO activity_log (actor_id, action, entity_type, entity_id) VALUES (?,?,?,?)')
    .bind(actorId, 'call.updated', 'call', id).run();
  return getCall(env.DB, id);
}

/** Сводка для плиток дашборда. */
export async function callSummary(db: D1Database): Promise<Response> {
  const rows = await db.prepare('SELECT status, COUNT(*) AS c FROM calls GROUP BY status').all<{ status: string; c: number }>();
  const statuses: Record<string, number> = { queued: 0, ringing: 0, answered: 0, completed: 0, missed: 0, failed: 0 };
  let total = 0;
  for (const row of rows.results ?? []) {
    statuses[row.status] = row.c;
    total += row.c;
  }
  const durationRow = await db.prepare('SELECT COALESCE(SUM(duration_sec),0) AS total, COALESCE(AVG(duration_sec),0) AS avg FROM calls').first<{ total: number; avg: number }>();
  const answered = (statuses.answered ?? 0) + (statuses.completed ?? 0);
  const missed = (statuses.missed ?? 0) + (statuses.failed ?? 0);
  return json({
    total,
    statuses,
    answered,
    missed,
    answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
    missRate: total > 0 ? Math.round((missed / total) * 100) : 0,
    totalTalkSeconds: durationRow?.total ?? 0,
    averageTalkSeconds: Math.round(durationRow?.avg ?? 0),
  });
}

/** Активность по дням (входящие/исходящие) за N дней. */
export async function callActivity(db: D1Database, days: number): Promise<Response> {
  const rows = await db.prepare(
    `SELECT date(started_at) AS day,
            SUM(CASE WHEN direction = 'inbound'  THEN 1 ELSE 0 END) AS inbound,
            SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
     FROM calls
     WHERE started_at >= date('now', ?)
     GROUP BY day
     ORDER BY day ASC`,
  ).bind(`-${days} days`).all<{ day: string; inbound: number; outbound: number }>();
  return json((rows.results ?? []).map((r) => ({ date: r.day, inbound: r.inbound, outbound: r.outbound })));
}

/** Рейтинг операторов в форме, ожидаемой фронтендом. */
async function agentPerformance(db: D1Database) {
  const rows = await db.prepare(
    `SELECT u.id AS agent_id, u.full_name AS agent_name, u.avatar_color AS avatar_color,
            COUNT(c.id) AS total,
            SUM(CASE WHEN c.status IN ('answered','completed') THEN 1 ELSE 0 END) AS answered,
            SUM(CASE WHEN c.status IN ('missed','failed')     THEN 1 ELSE 0 END) AS missed,
            COALESCE(SUM(c.duration_sec),0) AS total_talk,
            CAST(COALESCE(AVG(c.duration_sec),0) AS INTEGER) AS avg_talk
     FROM users u
     LEFT JOIN calls c ON c.agent_id = u.id
     WHERE u.role IN ('agent','supervisor')
     GROUP BY u.id
     ORDER BY total DESC, u.full_name ASC`,
  ).all<{ agent_id: number; agent_name: string; avatar_color: string; total: number; answered: number; missed: number; total_talk: number; avg_talk: number }>();
  return (rows.results ?? []).map((r) => ({
    agentId: r.agent_id,
    agentName: r.agent_name,
    avatarColor: r.avatar_color,
    totalCalls: r.total,
    answeredCalls: r.answered,
    missedCalls: r.missed,
    talkSeconds: r.total_talk,
    averageTalkSeconds: r.avg_talk,
    answerRate: r.total > 0 ? Math.round((r.answered / r.total) * 100) : 0,
  }));
}

/** Загрузка очередей в форме, ожидаемой фронтендом. */
async function queueLoad(db: D1Database) {
  const rows = await db.prepare(
    `SELECT q.id AS queue_id, q.name AS queue_name, q.strategy AS strategy, q.is_active AS is_active,
            SUM(CASE WHEN c.status IN ('queued','ringing') THEN 1 ELSE 0 END) AS waiting,
            SUM(CASE WHEN c.status = 'answered' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN c.status IN ('missed','failed') THEN 1 ELSE 0 END) AS missed,
            COUNT(c.id) AS total
     FROM queues q
     LEFT JOIN calls c ON c.queue_id = q.id
     GROUP BY q.id
     ORDER BY total DESC`,
  ).all<{ queue_id: number; queue_name: string; strategy: string; is_active: number; waiting: number; active: number; completed: number; missed: number; total: number }>();
  return (rows.results ?? []).map((r) => ({
    queueId: r.queue_id,
    queueName: r.queue_name,
    strategy: r.strategy,
    isActive: r.is_active === 1,
    waiting: r.waiting ?? 0,
    active: r.active ?? 0,
    completed: r.completed ?? 0,
    missed: r.missed ?? 0,
    totalCalls: r.total,
  }));
}

async function hourlyDistribution(db: D1Database) {
  const rows = await db.prepare(
    `SELECT CAST(strftime('%H', started_at) AS INTEGER) AS hour, COUNT(*) AS total
     FROM calls GROUP BY hour ORDER BY hour ASC`,
  ).all<{ hour: number; total: number }>();
  const byHour = new Map((rows.results ?? []).map((r) => [r.hour, r.total]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, total: byHour.get(hour) ?? 0 }));
}

async function recentActivity(db: D1Database, limit = 15) {
  const rows = await db.prepare(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?',
  ).bind(limit).all<{ id: number; actor_id: number | null; action: string; entity_type: string; entity_id: number | null; meta: string; created_at: string }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    meta: safeJson(r.meta),
    createdAt: r.created_at,
  }));
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function analyticsDashboard(db: D1Database): Promise<Response> {
  const [agents, queues, hourly, activity] = await Promise.all([
    agentPerformance(db),
    queueLoad(db),
    hourlyDistribution(db),
    recentActivity(db, 15),
  ]);
  return json({ agents, queues, hourly, recentActivity: activity });
}

export async function analyticsAgents(db: D1Database): Promise<Response> {
  return json(await agentPerformance(db));
}
export async function analyticsQueues(db: D1Database): Promise<Response> {
  return json(await queueLoad(db));
}
export async function analyticsHourly(db: D1Database): Promise<Response> {
  return json(await hourlyDistribution(db));
}
export async function analyticsActivity(db: D1Database, url: URL): Promise<Response> {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));
  return json(await recentActivity(db, limit));
}

export type { AuthContext };
