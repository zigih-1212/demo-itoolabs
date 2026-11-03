/**
 * Контроллер контактов — тонкий слой над сервисом.
 */
import type { Request, Response } from 'express';
import { contactsService } from './contacts.service.js';
import { currentAuth } from '../../middleware/auth.middleware.js';
import { getBody, getParams, getQuery } from '../../middleware/validate.middleware.js';
import { paginationMeta, success } from '../../lib/http.js';
import type {
  CreateContactBody,
  ListContactsQuery,
  UpdateContactBody,
} from './contacts.schema.js';

export const contactsController = {
  list(_req: Request, res: Response): void {
    const query = getQuery<ListContactsQuery>(res);
    const { items, total, page, limit } = contactsService.list(query);
    res.json(success(items, paginationMeta(total, { page, limit, offset: (page - 1) * limit })));
  },

  getById(_req: Request, res: Response): void {
    const { id } = getParams<{ id: number }>(res);
    res.json(success(contactsService.getById(id)));
  },

  create(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const body = getBody<CreateContactBody>(res);
    res.status(201).json(success(contactsService.create(body, auth.sub)));
  },

  update(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    const body = getBody<UpdateContactBody>(res);
    res.json(success(contactsService.update(id, body, auth.sub)));
  },

  remove(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    contactsService.remove(id, auth.sub);
    res.status(204).send();
  },
};
