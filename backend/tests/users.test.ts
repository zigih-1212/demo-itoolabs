/**
 * Тесты модуля пользователей — в первую очередь проверяем ПРАВА ДОСТУПА.
 *
 * Это самая важная категория тестов в B2B-системе: неправильная проверка
 * роли означает, что оператор сможет удалять людей или менять себе роль.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp, createTestUser, withAuth } from './helpers.js';

const app = buildApp();

describe('GET /api/users', () => {
  it('требует авторизации', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('возвращает список с метаданными пагинации', async () => {
    const admin = await createTestUser({ role: 'admin' });

    const res = await withAuth(request(app).get('/api/users?limit=5&page=1'), admin.token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('не отдаёт хэш пароля в списке', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await withAuth(request(app).get('/api/users'), admin.token);

    for (const user of res.body.data) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.password_hash).toBeUndefined();
    }
  });
});

describe('POST /api/users — создание сотрудника', () => {
  it('админ может создать пользователя', async () => {
    const admin = await createTestUser({ role: 'admin' });

    const res = await withAuth(request(app).post('/api/users'), admin.token).send({
      email: 'created@test.local',
      password: 'password123',
      fullName: 'Созданный Сотрудник',
      role: 'agent',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('created@test.local');
  });

  it('обычный оператор НЕ может создавать пользователей (403)', async () => {
    const agent = await createTestUser({ role: 'agent' });

    const res = await withAuth(request(app).post('/api/users'), agent.token).send({
      email: 'forbidden@test.local',
      password: 'password123',
      fullName: 'Не Пройдёт',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/users/:id — смена роли', () => {
  it('не-админ не может повысить роль', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const target = await createTestUser({ role: 'agent' });

    const res = await withAuth(
      request(app).patch(`/api/users/${target.id}`),
      supervisor.token,
    ).send({ role: 'admin' });

    expect(res.status).toBe(403);
  });

  it('админ может повысить роль', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser({ role: 'agent' });

    const res = await withAuth(request(app).patch(`/api/users/${target.id}`), admin.token).send({
      role: 'supervisor',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('supervisor');
  });

  it('супервизор может изменить имя, но не роль', async () => {
    const supervisor = await createTestUser({ role: 'supervisor' });
    const target = await createTestUser({ role: 'agent' });

    const okRes = await withAuth(
      request(app).patch(`/api/users/${target.id}`),
      supervisor.token,
    ).send({ fullName: 'Новое Имя' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.fullName).toBe('Новое Имя');

    const roleRes = await withAuth(
      request(app).patch(`/api/users/${target.id}`),
      supervisor.token,
    ).send({ role: 'admin' });
    expect(roleRes.status).toBe(403);
  });
});

describe('DELETE /api/users/:id', () => {
  it('админ не может удалить самого себя', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await withAuth(request(app).delete(`/api/users/${admin.id}`), admin.token);
    expect(res.status).toBe(403);
  });

  it('админ удаляет другого пользователя (204)', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const victim = await createTestUser({ role: 'agent' });

    const res = await withAuth(request(app).delete(`/api/users/${victim.id}`), admin.token);
    expect(res.status).toBe(204);

    const check = await withAuth(request(app).get(`/api/users/${victim.id}`), admin.token);
    expect(check.status).toBe(404);
  });

  it('оператор не может удалять (403)', async () => {
    const agent = await createTestUser({ role: 'agent' });
    const victim = await createTestUser({ role: 'agent' });

    const res = await withAuth(request(app).delete(`/api/users/${victim.id}`), agent.token);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/users/me/password — смена своего пароля', () => {
  it('меняет пароль по верному текущему', async () => {
    const user = await createTestUser({ password: 'oldpassword1' });

    const res = await withAuth(request(app).post('/api/users/me/password'), user.token).send({
      currentPassword: 'oldpassword1',
      newPassword: 'newpassword1',
    });
    expect(res.status).toBe(200);

    // Старый пароль больше не подходит, новый — работает.
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'oldpassword1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'newpassword1' });
    expect(newLogin.status).toBe(200);
  });

  it('отклоняет неверный текущий пароль', async () => {
    const user = await createTestUser({ password: 'oldpassword1' });

    const res = await withAuth(request(app).post('/api/users/me/password'), user.token).send({
      currentPassword: 'totally-wrong',
      newPassword: 'newpassword1',
    });
    expect(res.status).toBe(401);
  });
});
