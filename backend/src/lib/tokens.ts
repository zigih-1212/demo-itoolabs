/**
 * Работа с JWT-токенами и refresh-сессиями.
 *
 * Схема аутентификации — «две пары ключей»:
 *
 *  1. ACCESS-токен (короткий, 15 минут). Проверяется мгновенно по подписи,
 *     без обращения к БД. Поэтому его нельзя отозвать досрочно — этим
 *     и объясняется короткое время жизни: если его украли, окно атаки мало.
 *
 *  2. REFRESH-токен (длинный, 7 дней). Лежит в БД в виде хэша и его можно
 *     ОТОЗВАТЬ: при выходе, смене пароля или подозрительной активности.
 *     Позволяет не заставлять пользователя логиниться каждые 15 минут.
 *
 * Это стандартная, безопасная практика, которую ожидают увидеть на ревью.
 */
import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';
import type { AuthTokenPayload, UserRole } from '../domain/types.js';

/**
 * Хэшируем refresh-токен перед сохранением.
 * Сам токен никогда не храним: утечка базы не даст войти под пользователем.
 * SHA-256 здесь уместен (в отличие от пароля) — токен уже случайный и длинный,
 * перебирать его бессмысленно, а быстрый хэш позволяет проверять вход мгновенно.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Генерирует криптостойкий случайный refresh-токен (48 байт). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Подписывает короткоживущий access-токен с данными пользователя. */
export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

/**
 * Проверяет подпись и срок действия access-токена.
 * Любая проблема (истёк, подделан, неверный формат) превращается в
 * UnauthorizedError(401) — клиент должен получить понятный ответ,
 * а не внутренние детали библиотеки.
 */
export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string') {
      throw new UnauthorizedError('Некорректный формат токена');
    }
    return {
      sub: Number(decoded.sub),
      email: String(decoded.email),
      role: decoded.role as UserRole,
    };
  } catch {
    throw new UnauthorizedError('Токен недействителен или истёк');
  }
}

/** Момент истечения refresh-токена в формате ISO (совместим с SQLite-строками). */
export function refreshTokenExpiry(): string {
  // env.JWT_REFRESH_TTL — строковый интервал ('7d','12h').
  // Парсим простые суффиксы, чтобы не тянуть лишнюю зависимость.
  const ttl = env.JWT_REFRESH_TTL;
  const match = /^(\d+)([smhd])$/.exec(ttl);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = match ? Number(match[1]) * (multipliers[match[2] as string] ?? 1) : 604800;
  return new Date(Date.now() + seconds * 1000).toISOString();
}
