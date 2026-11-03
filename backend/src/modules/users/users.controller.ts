/**
 * Контроллер пользователей. Тонкий слой над сервисом (см. пояснение в auth.controller).
 */
import type { Request, Response } from 'express';
import { usersService } from './users.service.js';
import { currentAuth } from '../../middleware/auth.middleware.js';
import { getBody, getParams, getQuery } from '../../middleware/validate.middleware.js';
import { paginationMeta, success } from '../../lib/http.js';
import type {
  ChangePasswordBody,
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
} from './users.schema.js';

const SERVICE_NAME = 'users';

export const usersController = {
  list(_req: Request, res: Response): void {
    const query = getQuery<ListUsersQuery>(res);
    const { items, total, page, limit } = usersService.list(query);
    res.json(success(items, paginationMeta(total, { page, limit, offset: (page - 1) * limit })));
  },

  getById(_req: Request, res: Response): void {
    const { id } = getParams<{ id: number }>(res);
    res.json(success(usersService.getById(id)));
  },

  async create(_req: Request, res: Response): Promise<void> {
    const actor = currentAuth(res);
    const body = getBody<CreateUserBody>(res);
    const user = await usersService.create(body, actor.sub);
    res.status(201).json(success(user));
  },

  update(_req: Request, res: Response): void {
    const actor = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    const body = getBody<UpdateUserBody>(res);
    res.json(success(usersService.update(id, body, { id: actor.sub, role: actor.role })));
  },

  async changePassword(_req: Request, res: Response): Promise<void> {
    const actor = currentAuth(res);
    const body = getBody<ChangePasswordBody>(res);
    await usersService.changePassword(actor.sub, body.currentPassword, body.newPassword);
    res.json(success({ changed: true }));
  },

  remove(_req: Request, res: Response): void {
    const actor = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    usersService.remove(id, { id: actor.sub, role: actor.role });
    res.status(204).send();
  },
};

// Экспортируем имя сервиса для логов/трассировки (единый стиль модулей).
export const usersServiceName = SERVICE_NAME;
