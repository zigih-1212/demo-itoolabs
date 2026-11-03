/**
 * Схемы валидации для модуля пользователей (Zod).
 *
 * Почему валидация вынесена в отдельный файл:
 *  1. Схемы переиспользуются в нескольких местах (создание, обновление,
 *     фильтры списка) — держим их в одном источнике правды.
 *  2. Zod не только проверяет данные, но и выводит TypeScript-типы через
 *     z.infer — это исключает рассинхрон между валидацией и типами.
 *
 * Важно: валидация на сервере обязательна, даже если она есть на клиенте.
 * Клиент можно обойти (curl, Postman), поэтому сервер всегда проверяет вход.
 */
import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'supervisor', 'agent']);
export const userStatusSchema = z.enum(['online', 'busy', 'offline']);

/** Пароль: минимум 8 символов. Простая, но осмысленная политика для демо. */
const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать минимум 8 символов')
  .max(72, 'Пароль слишком длинный'); // 72 байта — предел bcrypt

export const createUserSchema = z.object({
  email: z.string().email('Некорректный e-mail'),
  password: passwordSchema,
  fullName: z.string().min(2, 'Имя слишком короткое').max(120),
  role: userRoleSchema.default('agent'),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB')
    .optional(),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    avatarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Нужно передать хотя бы одно поле для обновления',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Укажите текущий пароль'),
  newPassword: passwordSchema,
});

export const listUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: userRoleSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
