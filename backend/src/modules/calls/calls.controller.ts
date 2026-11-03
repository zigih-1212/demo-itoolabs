/**
 * Контроллер звонков — тонкий слой над сервисом.
 */
import type { Request, Response } from 'express';
import { callsService } from './calls.service.js';
import { currentAuth } from '../../middleware/auth.middleware.js';
import { getBody, getParams, getQuery } from '../../middleware/validate.middleware.js';
import { paginationMeta, success } from '../../lib/http.js';
import type {
  AnalyticsQuery,
  CreateCallBody,
  ListCallsQuery,
  UpdateCallBody,
} from './calls.schema.js';

export const callsController = {
  list(_req: Request, res: Response): void {
    const query = getQuery<ListCallsQuery>(res);
    const { items, total, page, limit } = callsService.list(query);
    res.json(success(items, paginationMeta(total, { page, limit, offset: (page - 1) * limit })));
  },

  getById(_req: Request, res: Response): void {
    const { id } = getParams<{ id: number }>(res);
    res.json(success(callsService.getById(id)));
  },

  create(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const body = getBody<CreateCallBody>(res);
    res.status(201).json(success(callsService.create(body, auth.sub)));
  },

  update(_req: Request, res: Response): void {
    const auth = currentAuth(res);
    const { id } = getParams<{ id: number }>(res);
    const body = getBody<UpdateCallBody>(res);
    res.json(success(callsService.update(id, body, auth.sub)));
  },

  /** Сводные метрики для дашборда. */
  summary(_req: Request, res: Response): void {
    res.json(success(callsService.summary()));
  },

  /** Дневная активность для графика. */
  activity(_req: Request, res: Response): void {
    const query = getQuery<AnalyticsQuery>(res);
    res.json(success(callsService.activity(query.days)));
  },
};
