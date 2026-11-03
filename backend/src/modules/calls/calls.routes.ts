/**
 * Маршруты модуля звонков.
 *
 * ВАЖНО про порядок маршрутов: статические пути ('/summary', '/activity')
 * объявлены ДО динамического '/:id'. Иначе Express сопоставит запрос
 * GET /calls/summary с маршрутом '/:id' и попытается прочитать звонок
 * с id = "summary". Это классическая ошибка роутинга.
 */
import { Router } from 'express';
import { z } from 'zod';
import { callsController } from './calls.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../lib/http.js';
import {
  analyticsQuerySchema,
  createCallSchema,
  listCallsQuerySchema,
  updateCallSchema,
} from './calls.schema.js';

export const callsRouter = Router();
callsRouter.use(authenticate);

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

// ——— Статические пути (должны идти раньше '/:id') ———
callsRouter.get('/summary', asyncHandler(callsController.summary));
callsRouter.get(
  '/activity',
  validateQuery(analyticsQuerySchema),
  asyncHandler(callsController.activity),
);

// ——— Коллекция и CRUD ———
callsRouter.get('/', validateQuery(listCallsQuerySchema), asyncHandler(callsController.list));
callsRouter.post('/', validate(createCallSchema), asyncHandler(callsController.create));

// ——— Динамический путь id ———
callsRouter.get('/:id', validateParams(idParamSchema), asyncHandler(callsController.getById));
callsRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  validate(updateCallSchema),
  asyncHandler(callsController.update),
);
