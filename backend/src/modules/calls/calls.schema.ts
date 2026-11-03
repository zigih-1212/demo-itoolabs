/**
 * Zod-схемы модуля звонков.
 *
 * ISO-даты валидируем как строки с datetime-проверкой — так проще фильтровать
 * по диапазону в SQL (строковое сравнение ISO-дат работает лексикографически).
 */
import { z } from 'zod';

export const callDirectionSchema = z.enum(['inbound', 'outbound']);
export const callStatusSchema = z.enum([
  'queued',
  'ringing',
  'answered',
  'completed',
  'missed',
  'failed',
]);

/** Универсальная проверка ISO-даты/времени. */
const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Ожидается дата в формате ISO 8601');

export const createCallSchema = z.object({
  direction: callDirectionSchema,
  // В реальной системе статус выставляла бы телефония. Здесь мы разрешаем
  // создать звонок сразу в любом статусе — это удобно для демонстрации
  // журнала и ручного наполнения данными.
  status: callStatusSchema.default('completed'),
  contactId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),
  queueId: z.number().int().positive().nullable().optional(),
  phoneNumber: z.string().min(5).max(32),
  durationSec: z.number().int().min(0).max(24 * 3600).default(0),
  waitSec: z.number().int().min(0).max(24 * 3600).default(0),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateCallSchema = z
  .object({
    status: callStatusSchema.optional(),
    agentId: z.number().int().positive().nullable().optional(),
    durationSec: z.number().int().min(0).max(24 * 3600).optional(),
    waitSec: z.number().int().min(0).max(24 * 3600).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Нужно передать хотя бы одно поле для обновления',
  });

export const listCallsQuerySchema = z.object({
  direction: callDirectionSchema.optional(),
  status: callStatusSchema.optional(),
  agentId: z.coerce.number().int().positive().optional(),
  contactId: z.coerce.number().int().positive().optional(),
  queueId: z.coerce.number().int().positive().optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Период для аналитики: количество дней или явный диапазон. */
export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(14),
});

export type CreateCallBody = z.infer<typeof createCallSchema>;
export type UpdateCallBody = z.infer<typeof updateCallSchema>;
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
