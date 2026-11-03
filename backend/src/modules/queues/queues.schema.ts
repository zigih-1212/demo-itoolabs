/**
 * Zod-схемы модуля очередей.
 */
import { z } from 'zod';

export const queueStrategySchema = z.enum(['longest_idle', 'round_robin', 'ring_all']);

export const createQueueSchema = z.object({
  name: z.string().min(2, 'Название слишком короткое').max(80),
  strategy: queueStrategySchema.default('longest_idle'),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateQueueSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    strategy: queueStrategySchema.optional(),
    description: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Нужно передать хотя бы одно поле для обновления',
  });

export type CreateQueueBody = z.infer<typeof createQueueSchema>;
export type UpdateQueueBody = z.infer<typeof updateQueueSchema>;
