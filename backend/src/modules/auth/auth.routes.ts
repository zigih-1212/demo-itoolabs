/**
 * Маршруты модуля аутентификации.
 *
 * Файлы *.routes.ts — это маршрутизация: метод + путь + цепочка middleware.
 * Роутер монтируется в app.ts под префиксом /api/auth, поэтому здесь пути
 * пишутся без префикса ('/login', '/register').
 *
 * Порядок валидатора и контроллера важен: сначала rate-limit, потом валидация,
 * потом бизнес-логика. Дешёвые проверки — раньше дорогих.
 */
import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../lib/http.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));

authRouter.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

authRouter.post('/logout', asyncHandler(authController.logout));

// Защищённый маршрут: сначала проверяем access-токен, потом отдаём профиль.
authRouter.get('/me', authenticate, asyncHandler(authController.me));
