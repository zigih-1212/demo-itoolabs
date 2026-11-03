/**
 * Маршруты модуля пользователей.
 *
 * Наглядно показаны правила доступа разных ролей:
 *  - читать список сотрудников могут все авторизованные;
 *  - создавать/удалять — только администратор;
 *  - обновлять — администратор или руководитель (проверка роли ещё раз
 *    происходит в сервисе для точечных правил, например смены роли).
 *
 * Двойная защита (на маршруте и в сервисе) — намеренная: маршрут отсекает
 * «грубые» случаи, сервис — тонкие, зависящие от данных.
 */
import { Router } from 'express';
import { z } from 'zod';
import { usersController } from './users.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../lib/http.js';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from './users.schema.js';

/** Все маршруты модуля защищены — вешаем authenticate один раз на роутер. */
export const usersRouter = Router();
usersRouter.use(authenticate);

/** Схема id в параметрах пути: всегда целое положительное число. */
const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

usersRouter.get('/', validateQuery(listUsersQuerySchema), asyncHandler(usersController.list));

usersRouter.get('/:id', validateParams(idParamSchema), asyncHandler(usersController.getById));

usersRouter.post(
  '/',
  requireRole('admin'),
  validate(createUserSchema),
  asyncHandler(usersController.create),
);

usersRouter.patch(
  '/:id',
  requireRole('admin', 'supervisor'),
  validateParams(idParamSchema),
  validate(updateUserSchema),
  asyncHandler(usersController.update),
);

// Смена собственного пароля — доступна любому авторизованному.
usersRouter.post(
  '/me/password',
  validate(changePasswordSchema),
  asyncHandler(usersController.changePassword),
);

usersRouter.delete(
  '/:id',
  requireRole('admin'),
  validateParams(idParamSchema),
  asyncHandler(usersController.remove),
);
