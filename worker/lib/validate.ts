/**
 * Маленькие помощники валидации для edge-версии.
 *
 * В Node-бэкенде используется Zod. Здесь мы обходимся лёгкими функциями:
 * на Workers важен размер бандла и скорость, а набор правил небольшой.
 * Каждая функция бросает HttpError(400) с понятным сообщением — их ловит
 * общий обработчик.
 */

import { badRequest } from './http';

export type Json = Record<string, unknown>;

/** Читает JSON-тело запроса, гарантируя, что это объект. */
export async function readJson(request: Request): Promise<Json> {
  try {
    const data = await request.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Json;
    return {};
  } catch {
    return {};
  }
}

/** Обязательная непустая строка. */
export function requireString(body: Json, field: string, opts: { min?: number; max?: number } = {}): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`Поле «${field}» обязательно`, { [field]: ['Поле обязательно для заполнения'] });
  }
  const trimmed = value.trim();
  if (opts.min && trimmed.length < opts.min) {
    throw badRequest(`Поле «${field}» слишком короткое`, { [field]: [`Минимум ${opts.min} символов`] });
  }
  if (opts.max && trimmed.length > opts.max) {
    throw badRequest(`Поле «${field}» слишком длинное`, { [field]: [`Максимум ${opts.max} символов`] });
  }
  return trimmed;
}

/** Необязательная строка. */
export function optionalString(body: Json, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest(`Поле «${field}» должно быть строкой`);
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/** Обязательный, но nullable-допустимый идентификатор (число). */
export function requireNumber(body: Json, field: string): number {
  const value = Number(body[field]);
  if (!Number.isFinite(value) || value <= 0) {
    throw badRequest(`Поле «${field}» должно быть положительным числом`);
  }
  return Math.floor(value);
}

export function optionalNumber(body: Json, field: string): number | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw badRequest(`Поле «${field}» должно быть числом`);
  return Math.floor(num);
}

/** Проверяет, что значение входит в допустимый набор. */
export function requireEnum<T extends string>(body: Json, field: string, allowed: readonly T[]): T {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`Недопустимое значение поля «${field}»`, {
      [field]: [`Допустимо: ${allowed.join(', ')}`],
    });
  }
  return value as T;
}

export function optionalEnum<T extends string>(body: Json, field: string, allowed: readonly T[]): T | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`Недопустимое значение поля «${field}»`);
  }
  return value as T;
}

export function optionalBoolean(body: Json, field: string): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`Поле «${field}» должно быть логическим`);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function optionalStringArray(body: Json, field: string): string[] | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw badRequest(`Поле «${field}» должно быть массивом`);
  return value.map((v) => String(v)).filter((v) => v.length > 0);
}
