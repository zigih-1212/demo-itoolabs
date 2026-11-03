/**
 * Контроллер аналитики.
 *
 * Доступ к аналитике ограничен ролями admin/supervisor: рядовой оператор
 * не должен видеть показатели работы коллег. Ограничение навешивается
 * на уровне роутера (requireRole) — контроллер остаётся тонким.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from './analytics.service.js';
import { getQuery } from '../../middleware/validate.middleware.js';
import { success } from '../../lib/http.js';

export const analyticsController = {
  dashboard(_req: Request, res: Response): void {
    res.json(success(analyticsService.dashboard()));
  },

  agents(_req: Request, res: Response): void {
    res.json(success(analyticsService.agentPerformance()));
  },

  queues(_req: Request, res: Response): void {
    res.json(success(analyticsService.queueLoad()));
  },

  hourly(_req: Request, res: Response): void {
    res.json(success(analyticsService.hourlyDistribution()));
  },

  activity(_req: Request, res: Response): void {
    const query = getQuery<{ limit: number }>(res);
    res.json(success(analyticsService.recentActivity(query.limit)));
  },
};

/** Схема лимита для ленты активности. */
export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
