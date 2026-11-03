/**
 * Тесты модуля аутентификации.
 *
 * Проверяем не только «счастливый путь», но и правила безопасности:
 *  - новый пользователь НЕ может зарегистрироваться админом;
 *  - неверный e-mail и неверный пароль дают одинаковый ответ (не раскрываем,
 *    какие адреса существуют);
 *  - refresh-токен ротируется: старый после обновления недействителен.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp, createTestUser, withAuth } from './helpers.js';

const app = buildApp();

describe('POST /api/auth/register', () => {
  it('регистрирует нового пользователя и выдаёт токены', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'newbie@test.local',
      password: 'secret12345',
      fullName: 'Новый Сотрудник',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('newbie@test.local');
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.refreshToken).toBeTypeOf('string');
    // Пароль (или его хэш) никогда не покидает сервер.
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('не даёт регистрируемому стать администратором', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'sneaky@test.local',
      password: 'secret12345',
      fullName: 'Хитрюга',
      // Пытаемся протащить роль через тело — сервер обязан её проигнорировать.
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('agent');
  });

  it('отклоняет короткий пароль', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@test.local',
      password: '123',
      fullName: 'Короткий Пароль',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('отклоняет повторный e-mail', async () => {
    const body = { email: 'dup@test.local', password: 'secret12345', fullName: 'Дубликат' };
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  it('входит с верными данными', async () => {
    const user = await createTestUser({ email: 'login@test.local' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.local', password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('даёт ОДИНАКОВУЮ ошибку для несуществующего e-mail и неверного пароля', async () => {
    const user = await createTestUser({ email: 'same@test.local' });

    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: 'whatever123' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'same@test.local', password: 'wrongpass123' });

    // Оба ответа должны быть идентичны — иначе можно перебором узнать
    // существующие адреса.
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.body.error.message).toBe(wrongPassword.body.error.message);
    expect(user.id).toBeGreaterThan(0);
  });
});

describe('GET /api/auth/me', () => {
  it('возвращает текущего пользователя по access-токену', async () => {
    const user = await createTestUser({ email: 'me@test.local' });

    const res = await withAuth(request(app).get('/api/auth/me'), user.token);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.local');
  });

  it('возвращает 401 без токена', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('возвращает 401 при испорченном токене', async () => {
    const res = await withAuth(request(app).get('/api/auth/me'), 'not.a.jwt');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('ротирует refresh-токен: старый становится недействительным', async () => {
    const login = await request(app)
      .post('/api/auth/register')
      .send({ email: 'rotate@test.local', password: 'secret12345', fullName: 'Ротация Токенов' });

    const first = login.body.data.refreshToken as string;

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first });

    expect(refreshed.status).toBe(200);
    const second = refreshed.body.data.refreshToken as string;
    expect(second).not.toBe(first);

    // Повторное использование старого токена должно упасть.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
  });

  it('отклоняет несуществующий refresh-токен', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'nonexistent-token-value' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('отзывает refresh-токен', async () => {
    const login = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logout@test.local', password: 'secret12345', fullName: 'Выход Тестовый' });
    const refreshToken = login.body.data.refreshToken as string;

    const logout = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);

    // После выхода продлить сессию этим токеном нельзя.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });
});
