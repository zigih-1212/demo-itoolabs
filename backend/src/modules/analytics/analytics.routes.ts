/**
 * Маршруты модуля аналитики.
 * Все эндпоинты защищены ролью: смотреть сводки могут admin и supervisor.
 */
import { Router } from 'express';
import { analyticsController, activityQuerySchema } from './analytics.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../lib/http.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requireRole('admin', 'supervisor'));

analyticsRouter.get('/dashboard', asyncHandler(analyticsController.dashboard));
analyticsRouter.get('/agents', asyncHandler(analyticsController.agents));
analyticsRouter.get('/queues', asyncHandler(analyticsController.queues));
analyticsRouter.get('/hourly', asyncHandler(analyticsController.hourly));
analyticsRouter.get(
  '/activity',
  validateQuery(activityQuerySchema),
  asyncHandler(analyticsController.activity),
);
