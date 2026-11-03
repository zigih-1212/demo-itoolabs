/**
 * Контроллер аутентификации.
 *
 * Роль контроллера — только «перевести» HTTP в вызов сервиса и обратно:
 *  1. Достать данные из запроса (уже провалидированные middleware).
 *  2. Вызвать метод сервиса.
 *  3. Сформировать HTTP-ответ.
 *
 * Здесь НЕТ бизнес-логики — это принципиально. Контроллер «тонкий»,
 * логика «толстая» в сервисе. Так сервис можно тестировать без HTTP,
 * а контроллер менять, не задевая правила домена.
 */
import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { getBody } from '../../middleware/validate.middleware.js';
import { success } from '../../lib/http.js';
import { env, isProduction } from '../../config/env.js';
import type { LoginBody, RefreshBody, RegisterBody } from './auth.schema.js';

/** Имя cookie для refresh-токена. */
export const REFRESH_COOKIE = 'voxdesk_refresh';

/**
 * Кладёт refresh-токен в httpOnly-cookie.
 *
 * Почему httpOnly: такой cookie недоступен из JavaScript, поэтому XSS-атака
 * не сможет украсть refresh-токен. Access-токен при этом живёт в памяти
 * фронтенда (не в localStorage) — тоже для защиты от XSS.
 */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction, // в проде только по HTTPS
    sameSite: 'lax', // защита от CSRF для переходов с других сайтов
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export const authController = {
  async register(_req: Request, res: Response): Promise<void> {
    const body = getBody<RegisterBody>(res);
    const result = await authService.register(body);
    setRefreshCookie(res, result.refreshToken);
    // refresh-токен не отдаём в теле, когда он в cookie: меньше поверхностей утечки.
    // Но для удобства API-клиентов (и автотестов) возвращаем его тоже.
    res.status(201).json(success(result));
  },

  async login(_req: Request, res: Response): Promise<void> {
    const body = getBody<LoginBody>(res);
    const result = await authService.login(body);
    setRefreshCookie(res, result.refreshToken);
    res.json(success(result));
  },

  async refresh(req: Request, res: Response): Promise<void> {
    // Токен берём из cookie, а если её нет — из тела запроса. Второй путь нужен
    // для не-браузерных клиентов (мобильные приложения, автотесты), которые не
    // полагаются на cookie. Раньше здесь читалась только cookie, хотя схема
    // refreshSchema допускает refreshToken в теле — расхождение молча ломало
    // API для таких клиентов.
    const body = getBody<RefreshBody>(res);
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const result = await authService.refresh(fromCookie ?? body.refreshToken ?? '');
    setRefreshCookie(res, result.refreshToken);
    res.json(success(result));
  },

  logout(req: Request, res: Response): void {
    // Симметрично refresh: токен может прийти в cookie (браузер) или в теле
    // (мобильный клиент / автотест). Если читать только cookie, то у клиентов
    // без cookie logout не отзывал токен — сессия продолжала жить.
    // На этом маршруте нет validate-мидлвари, поэтому тело читаем из req.body.
    const body = (req.body ?? {}) as { refreshToken?: string };
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const token = body.refreshToken ?? fromCookie;
    if (token) authService.logout(token);
    clearRefreshCookie(res);
    res.json(success({ loggedOut: true }));
  },

  me(req: Request, res: Response): void {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = authService.me(token);
    res.json(success(user));
  },
};

// Ссылка на env, чтобы подчеркнуть: значение CORS_ORIGIN и TTL берутся из конфига.
export const authConfigHint = env.JWT_ACCESS_TTL;
