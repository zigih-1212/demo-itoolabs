/**
 * Контроллер очередей — тонкий слой над сервисом.
 */
import type { Request, Response } from 'express';
import { queuesService } from './queues.service.js';
import { currentAuth } from '../../middleware/auth.middleware.js';
import { getBody, getParams } from '../../middleware/validate.middleware.js';
import { success } from '../../lib/http.js';
import type { CreateQueueBody, UpdateQueueBody } from './queues.schema.js';

export const queuesController = {
  list(_req: Request, res: Response): void {
    res.json(success(queuesService.list()));
  },

  getById(_req: Request, res: Response): void {
    const { id } = getParams<{ id: number }>(res);
    res.json(success(queuesService.getById(id)));
  },

  create(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const body = getBody<CreateQueueBody>(res);
    res.status(201).json(success(queuesService.create(body, auth.sub)));
  },

  update(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    const body = getBody<UpdateQueueBody>(res);
    res.json(success(queuesService.update(id, body, auth.sub)));
  },

  remove(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    queuesService.remove(id, auth.sub);
    res.status(204).send();
  },
};
