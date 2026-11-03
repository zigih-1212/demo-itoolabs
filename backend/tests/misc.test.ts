/**
 * Тесты очередей, аналитики и служебных эндпоинтов.
 *
 * Здесь проверяются:
 *  - доступ к аналитике только у admin/supervisor;
 *  - CRUD очередей и защита от дублирующихся имён;
 *  - healthcheck (используется Docker и мониторингом);
 *  - единый формат ошибок для несуществующих маршрутов.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp, createTestUser, withAuth } from './helpers.js';

const app = buildApp();

describe('GET /api/health', () => {
  it('отвечает без авторизации и сообщает статус', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data).toHaveProperty('uptime');
  });
});

describe('/api/queues', () => {
  it('супервизор создаёт очередь', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });

    const res = await withAuth(request(app).post('/api/queues'), supervisor.token).send({
      name: 'Очередь Тестовая',
      strategy: 'round_robin',
      description: 'Проверка создания',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.strategy).toBe('round_robin');
    expect(res.body.data.isActive).toBe(true);
  });

  it('не даёт создать две очереди с одинаковым именем', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const body = { name: 'Очередь Дубль', strategy: 'longest_idle' };

    await withAuth(request(app).post('/api/queues'), supervisor.token).send(body);
    const dup = await withAuth(request(app).post('/api/queues'), supervisor.token).send(body);

    expect(dup.status).toBe(409);
  });

  it('оператор не может создавать очереди (403)', async () => {
    const agent = await createTestUser({ role: 'agent' });
    const res = await withAuth(request(app).post('/api/queues'), agent.token).send({
      name: 'Нельзя',
      strategy: 'ring_all',
    });
    expect(res.status).toBe(403);
  });

  it('любой авторизованный видит список', async () => {
    const agent = await createTestUser({ role: 'agent' });
    const res = await withAuth(request(app).get('/api/queues'), agent.token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('/api/analytics', () => {
  it('отдаёт дашборд супервизору', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const res = await withAuth(request(app).get('/api/analytics/dashboard'), supervisor.token);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('agents');
    expect(res.body.data).toHaveProperty('queues');
    expect(res.body.data).toHaveProperty('hourly');
    expect(res.body.data).toHaveProperty('recentActivity');
  });

  it('распределение по часам содержит ровно 24 точки', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const res = await withAuth(request(app).get('/api/analytics/hourly'), supervisor.token);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(24);
  });

  it('оператору аналитика запрещена (403)', async () => {
    const agent = await createTestUser({ role: 'agent' });
    const res = await withAuth(request(app).get('/api/analytics/dashboard'), agent.token);
    expect(res.status).toBe(403);
  });

  it('без токена — 401', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('Единый формат ошибок', () => {
  it('несуществующий маршрут → 404 с кодом NOT_FOUND', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('нечисловой id в параметре → 400 VALIDATION_ERROR', async () => {
    const user = await createTestUser();
    const res = await withAuth(request(app).get('/api/users/abc'), user.token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
