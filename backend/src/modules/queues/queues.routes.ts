/**
 * Маршруты модуля очередей.
 *
 * Изменять очереди могут только admin/supervisor: это настройка телефонии,
 * рядовой оператор на неё не влияет.
 */
import { Router } from 'express';
import { z } from 'zod';
import { queuesController } from './queues.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate, validateParams } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../lib/http.js';
import { createQueueSchema, updateQueueSchema } from './queues.schema.js';

export const queuesRouter = Router();
queuesRouter.use(authenticate);

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

queuesRouter.get('/', asyncHandler(queuesController.list));

queuesRouter.get('/:id', validateParams(idParamSchema), asyncHandler(queuesController.getById));

queuesRouter.post(
  '/',
  requireRole('admin', 'supervisor'),
  validate(createQueueSchema),
  asyncHandler(queuesController.create),
);

queuesRouter.patch(
  '/:id',
  requireRole('admin', 'supervisor'),
  validateParams(idParamSchema),
  validate(updateQueueSchema),
  asyncHandler(queuesController.update),
);

queuesRouter.delete(
  '/:id',
  requireRole('admin', 'supervisor'),
  validateParams(idParamSchema),
  asyncHandler(queuesController.remove),
);
