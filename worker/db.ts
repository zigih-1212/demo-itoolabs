/**
 * Слой базы данных edge-версии (Cloudflare D1).
 *
 * Та же схема, что и в Node-бэкенде (backend/src/db/schema.ts), но D1 — это
 * serverless SQLite, работающий через асинхронный API (prepare/bind/first/all).
 *
 * Здесь же — «ленивое» развёртывание: при первом обращении воркер сам создаёт
 * таблицы и наполняет их демо-данными. Так деплой не требует отдельных ручных
 * шагов с миграциями: развернул — и сразу работает.
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { hashPassword } from './lib/crypto';

/** DDL-инструкции. Все — CREATE ... IF NOT EXISTS, поэтому повтор безопасен. */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    full_name     TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','supervisor','agent')),
    status        TEXT    NOT NULL DEFAULT 'offline' CHECK (status IN ('online','busy','offline')),
    avatar_color  TEXT    NOT NULL DEFAULT '#4f46e5',
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    revoked_at TEXT,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,
  `CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name  TEXT    NOT NULL,
    phone      TEXT    NOT NULL,
    email      TEXT,
    company    TEXT,
    tags       TEXT    NOT NULL DEFAULT '[]',
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)`,
  `CREATE TABLE IF NOT EXISTS queues (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    strategy    TEXT    NOT NULL DEFAULT 'longest_idle' CHECK (strategy IN ('longest_idle','round_robin','ring_all')),
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS calls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    direction     TEXT    NOT NULL CHECK (direction IN ('inbound','outbound')),
    status        TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','ringing','answered','completed','missed','failed')),
    contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    agent_id      INTEGER REFERENCES users(id)    ON DELETE SET NULL,
    queue_id      INTEGER REFERENCES queues(id)   ON DELETE SET NULL,
    phone_number  TEXT    NOT NULL,
    started_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    answered_at   TEXT,
    ended_at      TEXT,
    duration_sec  INTEGER NOT NULL DEFAULT 0,
    wait_sec      INTEGER NOT NULL DEFAULT 0,
    recording_url TEXT,
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calls_agent ON calls(agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_queue ON calls(queue_id)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at)`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT    NOT NULL,
    entity_type TEXT    NOT NULL,
    entity_id   INTEGER,
    meta        TEXT    NOT NULL DEFAULT '{}',
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_log(actor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at)`,
];

/** Детерминированный ГПСЧ (seed 20260101) — данные при каждом деплое одинаковы. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO-строка «сейчас минус N минут» — для истории звонков за две недели. */
function isoDaysAgo(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Наполняет пустую базу демо-данными.
 * Идемпотентно: вызывается только когда таблица users пуста.
 */
async function seedDemoData(db: D1Database): Promise<void> {
  const rand = mulberry32(20260101);
  const demoHash = await hashPassword('demo12345');
  const adminHash = await hashPassword('admin12345');
  const AVATARS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  const firstNames = ['Иван', 'Мария', 'Сергей', 'Анна', 'Дмитрий', 'Елена', 'Алексей', 'Ольга', 'Павел', 'Татьяна', 'Николай', 'Ирина', 'Андрей', 'Светлана', 'Михаил', 'Юлия'];
  const lastNames = ['Иванов', 'Петрова', 'Смирнов', 'Кузнецова', 'Соколов', 'Попова', 'Лебедев', 'Новикова', 'Морозов', 'Волкова', 'Егоров', 'Козлова'];
  const companies = ['ООО Ромашка', 'АО Вектор', 'ООО ТехноСофт', 'ИП Орлов', 'ООО СтройМастер', 'ГК Логистик', 'ООО МедСервис', 'АО Энерджи'];
  const tagPool = ['vip', 'партнёр', 'новый', 'оптовый', 'риск'];
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)] as T;

  // Пользователи: админ + супервайзер + 6 операторов.
  await db.prepare(
    `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color) VALUES (?,?,?,?,?,?)`,
  ).bind('admin@voxdesk.local', adminHash, 'Администратор Системы', 'admin', 'online', '#4f46e5').run();
  await db.prepare(
    `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color) VALUES (?,?,?,?,?,?)`,
  ).bind('supervisor@voxdesk.local', demoHash, 'Ольга Кузнецова', 'supervisor', 'online', '#0ea5e9').run();

  const agentIds: number[] = [];
  const agentNames: string[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const status = pick(['online', 'online', 'busy', 'offline']);
    const res = await db.prepare(
      `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color) VALUES (?,?,?,?,?,?)`,
    ).bind(`agent${i}@voxdesk.local`, demoHash, name, 'agent', status, AVATARS[i % AVATARS.length]).run();
    agentIds.push(Number(res.meta.last_row_id));
    agentNames.push(name);
  }

  // Очереди распределения звонков.
  const queueDefs: Array<[string, string, string]> = [
    ['Отдел продаж', 'longest_idle', 'Первая линия для входящих запросов от клиентов.'],
    ['Техподдержка', 'round_robin', 'Консультации по продукту и решение технических вопросов.'],
    ['VIP-клиенты', 'ring_all', 'Приоритетная линия для ключевых клиентов.'],
  ];
  const queueIds: number[] = [];
  for (const [name, strategy, description] of queueDefs) {
    const res = await db.prepare(
      `INSERT INTO queues (name, strategy, description, is_active) VALUES (?,?,?,1)`,
    ).bind(name, strategy, description).run();
    queueIds.push(Number(res.meta.last_row_id));
  }

  // Контакты — телефонная книга.
  const contactIds: number[] = [];
  const contactPhones: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const phone = `+79${Math.floor(100000000 + rand() * 899999999)}`;
    const email = `client${i + 1}@example.com`;
    const company = pick(companies);
    const tags: string[] = [];
    const tagCount = Math.floor(rand() * 3);
    for (let t = 0; t < tagCount; t += 1) {
      const tag = pick(tagPool);
      if (!tags.includes(tag)) tags.push(tag);
    }
    const res = await db.prepare(
      `INSERT INTO contacts (owner_id, full_name, phone, email, company, tags, notes) VALUES (?,?,?,?,?,?,?)`,
    ).bind(pick(agentIds), name, phone, email, company, JSON.stringify(tags), 'Клиент из демо-базы.').run();
    contactIds.push(Number(res.meta.last_row_id));
    contactPhones.push(phone);
  }

  // Звонки за последние 14 дней.
  const statuses = ['completed', 'completed', 'answered', 'missed', 'failed', 'ringing'] as const;
  for (let day = 13; day >= 0; day -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - day);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const callsToday = isWeekend ? Math.floor(rand() * 8) : 12 + Math.floor(rand() * 16);
    for (let c = 0; c < callsToday; c += 1) {
      const direction = rand() > 0.45 ? 'inbound' : 'outbound';
      const status = pick([...statuses]);
      const hour = 9 + Math.floor(rand() * 9);
      const minute = Math.floor(rand() * 60);
      const startedAt = isoDaysAgo(day, hour, minute);
      const answered = status === 'completed' || status === 'answered';
      const duration = answered ? 30 + Math.floor(rand() * 600) : 0;
      const wait = Math.floor(rand() * 45);
      const contactIdx = Math.floor(rand() * contactIds.length);
      const agentIdx = Math.floor(rand() * agentIds.length);
      const queueIdx = Math.floor(rand() * queueIds.length);
      const answeredAt = answered
        ? new Date(new Date(startedAt).getTime() + wait * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
        : null;
      const endedAt = answered
        ? new Date(new Date(startedAt).getTime() + (wait + duration) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
        : null;
      await db.prepare(
        `INSERT INTO calls (direction, status, contact_id, agent_id, queue_id, phone_number, started_at, answered_at, ended_at, duration_sec, wait_sec)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(direction, status, contactIds[contactIdx], agentIds[agentIdx], queueIds[queueIdx], contactPhones[contactIdx], startedAt, answeredAt, endedAt, duration, wait).run();
    }
  }

  // Лента событий (аудит) — что происходило в системе.
  const actions: Array<[string, string]> = [
    ['user.login', 'user'],
    ['contact.created', 'contact'],
    ['call.completed', 'call'],
    ['queue.updated', 'queue'],
    ['user.created', 'user'],
    ['contact.updated', 'contact'],
  ];
  for (let i = 0; i < 20; i += 1) {
    const [action, entityType] = pick(actions);
    await db.prepare(
      `INSERT INTO activity_log (actor_id, action, entity_type, entity_id, meta) VALUES (?,?,?,?,?)`,
    ).bind(pick(agentIds), action, entityType, 1 + Math.floor(rand() * 10), '{}').run();
  }
}

let ready = false;

/**
 * Гарантирует, что схема создана и данные есть.
 * Вызывается один раз на изолят воркера (флаг `ready`).
 */
export async function ensureReady(db: D1Database): Promise<void> {
  if (ready) return;
  await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)));
  const row = await db.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  if (!row || row.c === 0) {
    await seedDemoData(db);
  }
  ready = true;
}

/** Список DDL-инструкций — экспортируется для отдельной миграции через CLI. */
export const schemaStatements = SCHEMA_STATEMENTS;

export type PreparedStatement = D1PreparedStatement;
