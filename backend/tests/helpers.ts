/**
 * Тестовые помощники (test helpers).
 *
 * Выносим сюда повторяющуюся подготовку: создать пользователя с хэшированным
 * паролем, получить access-токен, отправить запрос через supertest. Тесты
 * становятся короткими и читаются как сценарии, а не как настройка инфраструктуры.
 */
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { usersRepository } from '../src/modules/users/users.repository.js';
import { signAccessToken } from '../src/lib/tokens.js';
import { hashPassword } from '../src/lib/password.js';
import type { UserRole } from '../src/domain/types.js';

/** Готовое приложение для supertest: один экземпляр на вызов, без порта. */
export function buildApp(): Express {
  return createApp();
}

let emailCounter = 0;

/** Создаёт пользователя напрямую через репозиторий (быстрее, чем HTTP-регистрация). */
export async function createTestUser(options?: {
  email?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
}): Promise<{ id: number; email: string; password: string; token: string; role: UserRole }> {
  emailCounter += 1;
  const email = options?.email ?? `user${emailCounter}@test.local`;
  const password = options?.password ?? 'password123';
  const role = options?.role ?? 'agent';
  const passwordHash = await hashPassword(password);

  const user = usersRepository.create({
    email,
    passwordHash,
    fullName: options?.fullName ?? `Тестовый ${emailCounter}`,
    role,
    avatarColor: '#4f46e5',
  });

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  return { id: user.id, email, password, token, role };
}

/** Обёртка над supertest с уже установленным заголовком Authorization. */
export function withAuth(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}
