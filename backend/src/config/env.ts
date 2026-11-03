import 'dotenv/config';
import { z } from 'zod';

/**
 * Централизованная конфигурация приложения.
 *
 * Зачем это нужно: если читать `process.env.PORT` прямо в коде, то легко
 * получить «магическую строку» и падение в рантайме из-за опечатки или
 * отсутствующей переменной. Здесь мы один раз при старте приложения
 * валидируем все переменные и получаем строго типизированный объект.
 *
 * Если переменная отсутствует или неверна — приложение упадёт сразу при
 * запуске с понятным сообщением, а не через час в проде. Это принцип
 * «fail fast» — падать быстро и громко там, где это безопасно.
 */

/** Схема валидации переменных окружения. */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/voxdesk.sqlite'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET слишком короткий'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET слишком короткий'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['silent', 'debug', 'info', 'warn', 'error'])
    .default('info'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@voxdesk.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('admin12345'),
});

/** Разобранная и провалидированная конфигурация. */
export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Собираем понятный отчёт обо всех проблемах сразу, а не по одной.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
     
    console.error(
      `\n[config] Некорректная конфигурация окружения:\n${issues}\n\n` +
        `Подсказка: скопируйте .env.example в .env и заполните значения.\n`,
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

/** Удобные производные флаги. */
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
