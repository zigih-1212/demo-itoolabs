/**
 * Наполнение базы демонстрационными данными.
 *
 * Запуск: npm run db:seed
 *
 * Зачем нужен сид:
 *  - пустой интерфейс невозможно показать на собеседовании; нужны звонки,
 *    операторы, очереди и история, чтобы дашборд и графики были осмысленными;
 *  - данные детерминированные (генерируются с фиксированным «зерном»),
 *    поэтому у всех, кто запустит проект, картина одинаковая.
 *
 * Скрипт идемпотентен: если администратор уже существует, повторный запуск
 * не создаёт дубликатов.
 */
import { getDatabase, closeDatabase, transaction } from './connection.js';
import { SCHEMA_SQL } from './schema.js';
import { hashPassword } from '../lib/password.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Простой детерминированный генератор псевдослучайных чисел (mulberry32).
 * Почему не Math.random(): нужны ВОСПРОИЗВОДИМЫЕ данные. С фиксированным
 * зерном датасет всегда одинаков — удобно для скриншотов и тестов.
 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260101);

/** Случайный элемент массива. */
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** Случайное целое в диапазоне [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

const FIRST_NAMES = [
  'Анна', 'Иван', 'Мария', 'Пётр', 'Ольга', 'Сергей', 'Екатерина', 'Дмитрий',
  'Наталья', 'Алексей', 'Юлия', 'Максим', 'Татьяна', 'Андрей', 'Ирина', 'Павел',
] as const;

const LAST_NAMES = [
  'Смирнова', 'Иванов', 'Кузнецова', 'Петров', 'Соколова', 'Волков', 'Морозова',
  'Новиков', 'Фёдорова', 'Егоров', 'Павлова', 'Козлов', 'Степанова', 'Николаев',
] as const;

const COMPANIES = [
  'ООО «Ромашка»', 'АО «ТехноСофт»', 'ООО «Северный Ветер»', 'ГК «Альфа»',
  'ООО «Логистик Плюс»', 'АО «МедТех»', 'ООО «ФинансГрупп»', 'ИП Соколов А.А.',
  'ООО «СтройМир»', 'ПАО «ЭнергоСеть»',
] as const;

const TAGS = ['vip', 'потенциальный', 'проблемный', 'опт', 'розница', 'госзаказ', 'партнёр'] as const;

const AVATAR_COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
] as const;

/** Формирует ISO-строку «N дней назад в указанный час». */
function isoDaysAgo(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function seed(): Promise<void> {
  const db = getDatabase();
  db.exec(SCHEMA_SQL);

  // Идемпотентность: если админ уже есть, не дублируем данные.
  const existingAdmin = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(env.SEED_ADMIN_EMAIL) as { id: number } | undefined;

  if (existingAdmin) {
    logger.info('Демо-данные уже существуют, сид пропущен (используйте npm run db:reset).');
    return;
  }

  logger.info('Генерация демонстрационных данных...');

  // Хэшиruем пароли один раз: bcrypt намеренно медленный, а пользователей много.
  const adminHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const demoHash = await hashPassword('demo12345');

  // Транзакция: либо все демо-данные появятся, либо ни одного — без «полупустой»
  // базы, если что-то упадёт в середине.
  transaction(() => {
    // ——— Пользователи ———
    const insertUser = db.prepare(
      `INSERT INTO users (email, password_hash, full_name, role, status, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const adminId = Number(
      insertUser.run(
        env.SEED_ADMIN_EMAIL,
        adminHash,
        'Администратор Системы',
        'admin',
        'online',
        '#4f46e5',
      ).lastInsertRowid,
    );

    insertUser.run(
      'supervisor@voxdesk.local',
      demoHash,
      'Ольга Кузнецова',
      'supervisor',
      'online',
      '#0ea5e9',
    );

    // Операторы с правдоподобными именами и статусами.
    const agentIds: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const status = pick(['online', 'busy', 'offline'] as const);
      const id = Number(
        insertUser.run(
          `agent${i + 1}@voxdesk.local`,
          demoHash,
          `${first} ${last}`,
          'agent',
          status,
          pick(AVATAR_COLORS),
        ).lastInsertRowid,
      );
      agentIds.push(id);
    }

    // ——— Очереди ———
    const insertQueue = db.prepare(
      `INSERT INTO queues (name, strategy, description, is_active) VALUES (?, ?, ?, ?)`,
    );

    const salesQueueId = Number(
      insertQueue.run(
        'Отдел продаж',
        'longest_idle',
        'Входящие заявки и первичные консультации',
        1,
      ).lastInsertRowid,
    );
    const supportQueueId = Number(
      insertQueue.run(
        'Техподдержка',
        'round_robin',
        'Обращения клиентов по работе сервиса',
        1,
      ).lastInsertRowid,
    );
    const vipQueueId = Number(
      insertQueue.run(
        'VIP-клиенты',
        'ring_all',
        'Приоритетная линия для ключевых клиентов',
        1,
      ).lastInsertRowid,
    );
    const queueIds = [salesQueueId, supportQueueId, vipQueueId];

    // ——— Контакты ———
    const insertContact = db.prepare(
      `INSERT INTO contacts (owner_id, full_name, phone, email, company, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const contactIds: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const company = pick(COMPANIES);
      // Пары тегов, чтобы фильтрация по тегу давала непустой результат.
      const tagCount = randInt(0, 2);
      const tags: string[] = [];
      for (let t = 0; t < tagCount; t += 1) {
        const tag = pick(TAGS);
        if (!tags.includes(tag)) tags.push(tag);
      }
      const id = Number(
        insertContact.run(
          adminId,
          `${first} ${last}`,
          `+7 (${randInt(900, 999)}) ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}`,
          `client${i + 1}@example.com`,
          company,
          JSON.stringify(tags),
          random() > 0.7 ? 'Просили перезвонить после 18:00' : null,
        ).lastInsertRowid,
      );
      contactIds.push(id);
    }

    // ——— Звонки за последние 14 дней ———
    const insertCall = db.prepare(
      `INSERT INTO calls
         (direction, status, contact_id, agent_id, queue_id, phone_number,
          started_at, answered_at, ended_at, duration_sec, wait_sec, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // Вариативный набор статусов: большинство звонков отвечено, часть потеряна.
    const statusPool = [
      'completed', 'completed', 'completed', 'completed',
      'answered', 'answered',
      'missed', 'missed',
      'failed',
      'queued', 'ringing',
    ] as const;

    let callsCreated = 0;
    for (let day = 13; day >= 0; day -= 1) {
      // В выходные активность ниже — как в реальном колл-центре.
      const date = new Date();
      date.setDate(date.getDate() - day);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const callsPerDay = weekend ? randInt(3, 9) : randInt(12, 26);

      for (let i = 0; i < callsPerDay; i += 1) {
        const hour = randInt(9, 19); // рабочий день
        const minute = randInt(0, 59);
        const startedAt = isoDaysAgo(day, hour, minute);

        const status = pick(statusPool);
        const direction = random() > 0.45 ? 'inbound' : 'outbound';
        const queueId = pick(queueIds);
        const agentId = pick(agentIds);
        const contactId = pick(contactIds);

        const waitSec = status === 'queued' ? randInt(5, 120) : randInt(2, 45);
        const isTalking = status === 'completed' || status === 'answered';
        const durationSec = isTalking ? randInt(30, 900) : 0;

        const answeredAt = isTalking
          ? new Date(new Date(startedAt).getTime() + waitSec * 1000).toISOString()
          : null;
        const endedAt =
          status === 'completed' || status === 'missed' || status === 'failed'
            ? new Date(
                new Date(startedAt).getTime() + (waitSec + durationSec) * 1000,
              ).toISOString()
            : null;

        // Номер звонка: если контакт известен — берём его номер из карточки.
        const contactPhone = (
          db.prepare('SELECT phone FROM contacts WHERE id = ?').get(contactId) as
            | { phone: string }
            | undefined
        )?.phone ?? `+7 (900) ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}`;

        insertCall.run(
          direction,
          status,
          status === 'queued' || status === 'ringing' ? null : contactId,
          status === 'completed' || status === 'answered' ? agentId : null,
          queueId,
          contactPhone,
          startedAt,
          answeredAt,
          endedAt,
          durationSec,
          waitSec,
          status === 'missed' ? 'Клиент не дождался ответа' : null,
        );
        callsCreated += 1;
      }
    }

    // ——— Журнал событий (для ленты активности на дашборде) ———
    const insertActivity = db.prepare(
      `INSERT INTO activity_log (actor_id, action, entity_type, entity_id, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const activitySamples: [string, string][] = [
      ['call.created', 'call'],
      ['contact.created', 'contact'],
      ['user.updated', 'user'],
      ['queue.updated', 'queue'],
      ['auth.login', 'user'],
    ];
    for (let i = 0; i < 20; i += 1) {
      const [action, entityType] = activitySamples[i % activitySamples.length] as [string, string];
      insertActivity.run(
        pick([adminId, ...agentIds]),
        action,
        entityType,
        randInt(1, 20),
        JSON.stringify({ source: 'seed' }),
        isoDaysAgo(randInt(0, 6), randInt(9, 19), randInt(0, 59)),
      );
    }

    logger.info(
      { users: agentIds.length + 2, contacts: contactIds.length, calls: callsCreated, queues: 3 },
      'Демо-данные созданы',
    );
    logger.info(
      {
        admin: env.SEED_ADMIN_EMAIL,
        supervisor: 'supervisor@voxdesk.local',
        agent: 'agent1@voxdesk.local',
      },
      'Учётные записи (пароль операторов/руководителя: demo12345)',
    );
  });
}

try {
  await seed();
} catch (error) {
  logger.error({ err: error }, 'Сид завершился ошибкой');
  process.exitCode = 1;
} finally {
  closeDatabase();
}
