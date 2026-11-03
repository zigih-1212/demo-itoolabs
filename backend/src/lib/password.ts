/**
 * Хэширование паролей.
 *
 * Почему bcrypt, а не SHA-256:
 *  - SHA спроектирован быть БЫСТРЫМ — именно это нам не нужно для пароля.
 *    Видеокарта перебирает миллиарды SHA-хэшей в секунду.
 *  - bcrypt намеренно медленный и включает «соль» (случайные данные),
 *    поэтому два одинаковых пароля дают разные хэши, а подбор становится
 *    невыгодно дорогим.
 *
 * Стоимость (rounds) берётся из env: 10 — разумный баланс скорость/стойкость
 * для демо; в продакшене часто ставят 12.
 */
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Превращает пароль в необратимый хэш для хранения в БД. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

/** Сравнивает введённый пароль с сохранённым хэшем. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
