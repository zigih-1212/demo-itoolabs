/**
 * Схема базы данных.
 *
 * Почему SQL лежит строкой в .ts, а не в отдельном .sql-файле:
 * компилятор TypeScript (tsc) копирует в папку dist только .js-файлы.
 * Если бы схема лежала в schema.sql, в собранном приложении её бы
 * просто не оказалось, и миграция упала бы с "файл не найден".
 * Держим DDL прямо в коде — это исключает такой класс ошибок.
 *
 * Все таблицы создаются через `CREATE TABLE IF NOT EXISTS`, поэтому
 * повторный запуск миграции безопасен (идемпотентность).
 */
export const SCHEMA_SQL = /* sql */ `
-- ============================================================================
-- users — сотрудники: операторы (agent), руководители (supervisor), админы.
-- Роли проверяются на уровне БД через CHECK: даже если приложение ошибётся,
-- некорректная роль не попадёт в таблицу.
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'agent'
                        CHECK (role IN ('admin', 'supervisor', 'agent')),
  status        TEXT    NOT NULL DEFAULT 'offline'
                        CHECK (status IN ('online', 'busy', 'offline')),
  avatar_color  TEXT    NOT NULL DEFAULT '#4f46e5',
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================================
-- refresh_tokens — долгоживущие токены для безопасного продления сессии.
--
-- Почему не храним access-токены: они короткоживущие (15 минут) и
-- проверяются подписью, без похода в БД. А refresh-токен — долгий,
-- поэтому именно его нужно уметь отозвать (logout, подозрительная
-- активность). Храним не сам токен, а его SHA-256 хэш: утечка базы
-- не даст злоумышленнику возможности выдать себя за пользователя.
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  revoked_at TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================================
-- contacts — клиенты телефонной книги.
-- tags хранятся как JSON-строка ('["vip","priority"]'): SQLite не имеет
-- нативного массива, а отдельная таблица тегов для демо избыточна.
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name  TEXT    NOT NULL,
  phone      TEXT    NOT NULL,
  email      TEXT,
  company    TEXT,
  tags       TEXT    NOT NULL DEFAULT '[]',
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner  ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone  ON contacts(phone);

-- ============================================================================
-- queues — очереди распределения звонков (по отделам: продажи, поддержка...).
-- strategy определяет алгоритм выбора оператора.
-- ============================================================================
CREATE TABLE IF NOT EXISTS queues (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  strategy    TEXT    NOT NULL DEFAULT 'longest_idle'
                      CHECK (strategy IN ('longest_idle', 'round_robin', 'ring_all')),
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================================
-- calls — журнал звонков. Центральная таблица домена.
--
-- Обнуляемые ссылки (ON DELETE SET NULL): если удалить оператора или
-- контакт, история звонков не должна исчезнуть — она нужна для аналитики.
-- ============================================================================
CREATE TABLE IF NOT EXISTS calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  direction     TEXT    NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status        TEXT    NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'ringing', 'answered', 'completed', 'missed', 'failed')),
  contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  agent_id      INTEGER REFERENCES users(id)    ON DELETE SET NULL,
  queue_id      INTEGER REFERENCES queues(id)   ON DELETE SET NULL,
  phone_number  TEXT    NOT NULL,
  started_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  answered_at   TEXT,
  ended_at      TEXT,
  duration_sec  INTEGER NOT NULL DEFAULT 0,
  wait_sec      INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Индексы под реальные сценарии запросов: фильтр по оператору/контакту,
-- сортировка и группировка по времени для отчётов.
CREATE INDEX IF NOT EXISTS idx_calls_agent     ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact   ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_queue     ON calls(queue_id);
CREATE INDEX IF NOT EXISTS idx_calls_status    ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started   ON calls(started_at);

-- ============================================================================
-- activity_log — аудит действий. Кто что сделал и когда.
-- Нужен руководителю: «кто удалил контакт», «кто менял настройки очереди».
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   INTEGER,
  meta        TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`;
