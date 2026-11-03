/**
 * Middleware аутентификации.
 *
 * Express выполняет функции по цепочке: каждая может либо завершить запрос,
 * либо передать управление дальше через next(). Middleware авторизации
 * читает заголовок `Authorization: Bearer <access-token>`, проверяет токен
 * и кладёт данные пользователя в res.locals — оттуда их берут контроллеры.
 *
 * Почему res.locals, а не req.user: в Express типизация req расширяется
 * глобально (declaration merging), что неявно и хрупко. res.locals типизируем
 * явно через хелперы — это читаемее и безопаснее.
 */
import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/tokens.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import type { AuthTokenPayload, UserRole } from '../domain/types.js';

/** Достаёт Bearer-токен из заголовка Authorization. */
function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

/**
 * Требует валидный access-токен. Кладёт payload в res.locals.auth.
 * Если токена нет или он неверен — 401 и цепочка прерывается.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedError('Требуется авторизация');
    res.locals.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

/** Возвращает данные авторизованного пользователя из res.locals. */
export function currentAuth(res: Response): AuthTokenPayload {
  const auth = res.locals.auth as AuthTokenPayload | undefined;
  if (!auth) throw new UnauthorizedError('Требуется авторизация');
  return auth;
}

/**
 * Фабрика middleware проверки роли.
 * Использование: router.post('/', authenticate, requireRole('admin'), handler)
 * Такой подход (higher-order function) позволяет настраивать middleware
 * без дублирования кода для каждой роли.
 */
export function requireRole(...allowed: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const auth = currentAuth(res);
      if (!allowed.includes(auth.role)) {
        throw new ForbiddenError('Недостаточно прав для выполнения операции');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
