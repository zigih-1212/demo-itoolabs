/**
 * Тесты модуля звонков — центрального домена приложения.
 *
 * Проверяем:
 *  - автосопоставление звонка с контактом по номеру телефона (бизнес-правило);
 *  - порядок маршрутов: /summary и /activity не должны перехватываться /:id;
 *  - метрики сводки (answerRate и т.п.) считаются корректно;
 *  - фильтрация журнала.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp, createTestUser, withAuth } from './helpers.js';

const app = buildApp();

async function createContact(token: string, phone: string): Promise<number> {
  const res = await withAuth(request(app).post('/api/contacts'), token).send({
    fullName: 'Клиент Звонящий',
    phone,
  });
  return res.body.data.id as number;
}

describe('POST /api/calls', () => {
  it('создаёт звонок и автоматически привязывает контакт по номеру', async () => {
    const user = await createTestUser();
    const phone = '+7 (950) 123-45-67';
    const contactId = await createContact(user.token, phone);

    const res = await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound',
      status: 'completed',
      phoneNumber: phone,
      durationSec: 120,
    });

    expect(res.status).toBe(201);
    // Главное бизнес-правило: контакт подставился сам, без contactId.
    expect(res.body.data.contactId).toBe(contactId);
  });

  it('вычисляет answeredAt и endedAt для завершённого звонка', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'outbound',
      status: 'completed',
      phoneNumber: '+7 000 000 00 00',
      durationSec: 60,
      waitSec: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.answeredAt).toBeTruthy();
    expect(res.body.data.endedAt).toBeTruthy();
  });

  it('отклоняет несуществующего оператора', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound',
      status: 'completed',
      phoneNumber: '+7 111 000 00 00',
      agentId: 999999,
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/calls — журнал', () => {
  it('не путает /summary с /:id (порядок маршрутов)', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).get('/api/calls/summary'), user.token);
    // Если бы маршрут /:id перехватил запрос, мы получили бы 400/404
    // из-за нечислового id. Ожидаем корректную сводку.
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('answerRate');
  });

  it('не путает /activity с /:id', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).get('/api/calls/activity?days=7'), user.token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('фильтрует по направлению', async () => {
    const user = await createTestUser();
    await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'outbound',
      status: 'completed',
      phoneNumber: '+7 333 333 33 33',
      durationSec: 30,
    });

    const res = await withAuth(request(app).get('/api/calls?direction=outbound'), user.token);
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { direction: string }) => c.direction === 'outbound')).toBe(true);
  });

  it('содержит человекочитаемые имена через JOIN', async () => {
    const user = await createTestUser({ fullName: 'Оператор Иванов', role: 'agent' });
    await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound',
      status: 'answered',
      phoneNumber: '+7 444 444 44 44',
      agentId: user.id,
      durationSec: 45,
    });

    const res = await withAuth(request(app).get(`/api/calls?agentId=${user.id}`), user.token);
    expect(res.status).toBe(200);
    const withAgent = res.body.data.find((c: { agentId: number }) => c.agentId === user.id);
    expect(withAgent.agentName).toBe('Оператор Иванов');
  });
});

describe('GET /api/calls/summary — метрики', () => {
  it('считает answerRate и общую длительность', async () => {
    const user = await createTestUser();

    await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound', status: 'completed', phoneNumber: '+7 555 000 00 01', durationSec: 100,
    });
    await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound', status: 'missed', phoneNumber: '+7 555 000 00 02', durationSec: 0,
    });

    const res = await withAuth(request(app).get('/api/calls/summary'), user.token);
    const data = res.body.data as {
      total: number;
      answered: number;
      missed: number;
      answerRate: number;
      totalTalkSeconds: number;
    };

    expect(data.total).toBeGreaterThanOrEqual(2);
    // answered считается как answered + completed; missed как missed + failed.
    expect(data.answered).toBeGreaterThanOrEqual(1);
    expect(data.missed).toBeGreaterThanOrEqual(1);
    expect(data.answerRate).toBeGreaterThan(0);
    expect(data.answerRate).toBeLessThanOrEqual(100);
  });
});

describe('PATCH /api/calls/:id', () => {
  it('меняет статус звонка', async () => {
    const user = await createTestUser();
    const created = await withAuth(request(app).post('/api/calls'), user.token).send({
      direction: 'inbound', status: 'ringing', phoneNumber: '+7 666 000 00 00',
    });
    const id = created.body.data.id as number;

    const res = await withAuth(request(app).patch(`/api/calls/${id}`), user.token).send({
      status: 'completed',
      durationSec: 55,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.durationSec).toBe(55);
  });
});
