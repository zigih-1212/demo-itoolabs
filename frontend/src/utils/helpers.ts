/**
 * Небольшие функции-помощники общего назначения.
 * Держим их отдельно от форматтеров: тут — логика, там — представление.
 */

/**
 * Склеивает имена CSS-классов, отбрасывая ложные значения.
 * Удобно для условной стилизации в шаблонах Vue:
 *   :class="cx('btn', { 'btn--loading': isLoading })"
 */
export function cx(
  ...args: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  const classes: string[] = [];

  for (const arg of args) {
    if (!arg) continue;

    if (typeof arg === 'string') {
      classes.push(arg);
    } else {
      for (const [key, value] of Object.entries(arg)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}

/**
 * Задержка выполнения — обёртка над setTimeout в виде промиса.
 * Используется для искусственной паузы при переподключении и в тестах.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce: откладывает вызов функции, пока не пройдёт `wait` мс без
 * новых вызовов. Классика для полей поиска — не бить по API на каждую букву.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Убирает из объекта поля со значением undefined/null и пустые строки.
 * Перед отправкой формы: не засорять запрос пустыми параметрами.
 */
export function cleanObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key as keyof T] = value as T[keyof T];
  }

  return result;
}

/** Проверяет, что строка — корректный e-mail (мягкая проверка для UX). */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
