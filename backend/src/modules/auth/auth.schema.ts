/**
 * Схемы валидации модуля аутентификации.
 */
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Некорректный e-mail'),
  password: z
    .string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .max(72, 'Пароль слишком длинный'),
  fullName: z.string().min(2, 'Укажите имя').max(120),
});

export const loginSchema = z.object({
  email: z.string().email('Некорректный e-mail'),
  password: z.string().min(1, 'Введите пароль'),
});

export const refreshSchema = z.object({
  // В браузерном клиенте refresh-токен приходит в httpOnly-cookie,
  // но в body тоже принимаем — удобно для тестов и мобильных клиентов.
  refreshToken: z.string().min(1).optional(),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
