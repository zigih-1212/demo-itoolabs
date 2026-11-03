/**
 * Маршруты модуля контактов.
 *
 * Все операции требуют авторизации (authenticate на весь роутер).
 * Удаление контакта ограничено ролями admin/supervisor: оператор не должен
 * безвозвратно удалять записи телефонной книги.
 */
import { Router } from 'express';
import { z } from 'zod';
import { contactsController } from './contacts.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../lib/http.js';
import {
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
} from './contacts.schema.js';

export const contactsRouter = Router();
contactsRouter.use(authenticate);

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

contactsRouter.get('/', validateQuery(listContactsQuerySchema), asyncHandler(contactsController.list));

contactsRouter.get('/:id', validateParams(idParamSchema), asyncHandler(contactsController.getById));

contactsRouter.post('/', validate(createContactSchema), asyncHandler(contactsController.create));

contactsRouter.patch(
  '/:id',
  requireRole('admin', 'supervisor'),
  validateParams(idParamSchema),
  validate(updateContactSchema),
  asyncHandler(contactsController.update),
);

contactsRouter.delete(
  '/:id',
  requireRole('admin', 'supervisor'),
  validateParams(idParamSchema),
  asyncHandler(contactsController.remove),
);
