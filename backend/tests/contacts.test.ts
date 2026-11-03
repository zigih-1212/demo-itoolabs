/**
 * Тесты модуля контактов.
 *
 * Ключевые сценарии: CRUD, поиск, фильтр по тегам, запрет дублирующегося
 * номера и — что особенно важно — проверка прав на изменение/удаление.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp, createTestUser, withAuth } from './helpers.js';

const app = buildApp();

/**
 * Быстрое создание контакта с токеном.
 *
 * Телефон по умолчанию делаем уникальным: сервис запрещает дубли номеров
 * (COALESCE-инварианта «один номер — один контакт»), поэтому фиксированный
 * номер ломал бы тесты, создающие несколько контактов подряд.
 */
let contactCounter = 0;

async function createContact(token: string, overrides: Record<string, unknown> = {}) {
  contactCounter += 1;
  const uniquePhone = `+7 (900) 000-${String(contactCounter).padStart(2, '0')}-${String(
    10 + contactCounter,
  )}`;

  return withAuth(request(app).post('/api/contacts'), token).send({
    fullName: 'Клиент Тестовый',
    phone: uniquePhone,
    email: `client${contactCounter}@example.com`,
    company: 'ООО «Тест»',
    tags: ['vip'],
    ...overrides,
  });
}

describe('POST /api/contacts', () => {
  it('создаёт контакт', async () => {
    const user = await createTestUser();
    const res = await createContact(user.token);

    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Клиент Тестовый');
    expect(res.body.data.tags).toEqual(['vip']);
  });

  it('отклоняет контакт с неверным телефоном', async () => {
    const user = await createTestUser();
    const res = await createContact(user.token, { phone: 'abc-телефон' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('не даёт создать два контакта с одинаковым телефоном', async () => {
    const user = await createTestUser();
    const phone = '+7 (999) 000-00-01';
    await createContact(user.token, { phone });
    const dup = await createContact(user.token, { phone, fullName: 'Дубль Номера' });

    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/contacts', () => {
  it('ищет по подстроке имени', async () => {
    const user = await createTestUser();
    await createContact(user.token, { fullName: 'УникальныйПоиск Клиентов', phone: '+7 111 111 11 11' });

    const res = await withAuth(
      request(app).get('/api/contacts?search=УникальныйПоиск'),
      user.token,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].fullName).toContain('УникальныйПоиск');
  });

  it('фильтрует по тегу', async () => {
    const user = await createTestUser();
    await createContact(user.token, { tags: ['госзаказ'], phone: '+7 222 222 22 22' });

    const res = await withAuth(request(app).get('/api/contacts?tag=госзаказ'), user.token);

    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { tags: string[] }) => c.tags.includes('госзаказ'))).toBe(true);
  });

  it('возвращает метаданные пагинации', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).get('/api/contacts?page=1&limit=5'), user.token);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
  });
});

describe('PATCH /api/contacts/:id', () => {
  it('обновляет поля контакта', async () => {
    const user = await createTestUser({ role: 'supervisor' });
    const created = await createContact(user.token);
    const id = created.body.data.id as number;

    const res = await withAuth(request(app).patch(`/api/contacts/${id}`), user.token).send({
      company: 'Новая Компания',
      tags: ['vip', 'потенциальный'],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.company).toBe('Новая Компания');
    expect(res.body.data.tags).toEqual(['vip', 'потенциальный']);
  });

  it('обычный оператор не может менять контакт (403)', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const created = await createContact(supervisor.token);
    const id = created.body.data.id as number;

    const agent = await createTestUser({ role: 'agent' });
    const res = await withAuth(request(app).patch(`/api/contacts/${id}`), agent.token).send({
      company: 'Взлом',
    });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/contacts/:id', () => {
  it('оператор не может удалять контакты (403)', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const created = await createContact(supervisor.token);
    const id = created.body.data.id as number;

    const agent = await createTestUser({ role: 'agent' });
    const res = await withAuth(request(app).delete(`/api/contacts/${id}`), agent.token);
    expect(res.status).toBe(403);
  });

  it('супервизор удаляет контакт (204)', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const created = await createContact(supervisor.token);
    const id = created.body.data.id as number;

    const res = await withAuth(request(app).delete(`/api/contacts/${id}`), supervisor.token);
    expect(res.status).toBe(204);
  });
});

describe('GET /api/contacts/:id', () => {
  it('возвращает 404 для несуществующего контакта', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).get('/api/contacts/999999'), user.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
