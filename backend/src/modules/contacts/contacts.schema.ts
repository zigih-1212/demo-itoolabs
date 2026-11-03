/**
 * Zod-схемы модуля контактов.
 *
 * Телефон валидируем «мягко»: допускаем +, цифры, пробелы, дефисы, скобки.
 * Строгая валидация форматов разных стран — отдельная задача (libphonenumber),
 * для демо достаточно базового формата.
 */
import { z } from 'zod';

const phoneSchema = z
  .string()
  .min(5, 'Телефон слишком короткий')
  .max(32, 'Телефон слишком длинный')
  .regex(/^[+()\d\s-]+$/, 'Телефон может содержать только цифры, +, скобки и дефисы');

const tagsSchema = z.array(z.string().trim().min(1).max(32)).max(10, 'Не более 10 тегов');

export const createContactSchema = z.object({
  fullName: z.string().min(2, 'Укажите имя').max(160),
  phone: phoneSchema,
  email: z.string().email('Некорректный e-mail').nullable().optional(),
  company: z.string().max(160).nullable().optional(),
  tags: tagsSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateContactSchema = createContactSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Нужно передать хотя бы одно поле для обновления' },
);

export const listContactsQuerySchema = z.object({
  search: z.string().trim().min(1).max(160).optional(),
  tag: z.string().trim().min(1).max(32).optional(),
  sort: z.enum(['name', 'created', 'company']).default('created'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateContactBody = z.infer<typeof createContactSchema>;
export type UpdateContactBody = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
