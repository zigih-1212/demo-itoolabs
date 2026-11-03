/**
 * Точка входа Cloudflare Worker.
 *
 * Это «edge-двойник» Node-бэкенда (voxdesk/backend): тот же REST-контракт,
 * та же схема и те же правила доступа, но работающий на Cloudflare Workers с
 * базой D1 (serverless SQLite). Фронтенд (voxdesk/frontend) общается с ним
 * без изменений, потому что формат ответов и адреса совпадают.
 *
 * Почему отдельная реализация, а не тот же Express-код: Workers не запускает
 * Node-сервер и не поддерживает модуль node:sqlite. Зато даёт глобальный
 * масштаб, отсутствие сервера и бесплатный тариф. Это осознанный компромисс —
 * см. docs/adr/007-edge-deployment.md.
 *
 * Файлы статики (собранный фронтенд) отдаёт биндинг ASSETS; воркер
 * обрабатывает только /api/* (run_worker_first в wrangler.jsonc).
 */

import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { corsPreflight, handle, HttpError, notFound } from './lib/http';
import { ensureReady } from './db';
import * as auth from './api/auth';
import * as users from './api/users';
import * as contacts from './api/contacts';
import * as calls from './api/calls';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  SEED_ADMIN_EMAIL: string;
  SEED_ADMIN_PASSWORD: string;
}

/** Простой числовой id из сегмента пути, иначе 400. */
function idParam(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректный идентификатор');
  return Math.floor(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS-preflight (полезно, если фронтенд когда-нибудь переедет на другой
    // домен; в связке «ассеты + воркер» он не обязателен, но безопасен).
    if (request.method === 'OPTIONS') return corsPreflight();

    // Всё, что не /api — отдаём как статику собранного фронтенда.
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    return handle(async () => {
      // Гарантируем схему и демо-данные до первого запроса.
      await ensureReady(env.DB);

      const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      const [resource, sub, sub2] = segments;
      const method = request.method;

      // --- Служебный health-check ---
      if (resource === 'health') {
        return Response.json({
          data: { status: 'ok', uptime: 0, timestamp: new Date().toISOString(), runtime: 'cloudflare-workers' },
        });
      }

      // --- Аутентификация (публичные маршруты) ---
      if (resource === 'auth') {
        if (sub === 'register' && method === 'POST') return auth.register(env, request);
        if (sub === 'login' && method === 'POST') return auth.login(env, request);
        if (sub === 'refresh' && method === 'POST') return auth.refresh(env, request);
        if (sub === 'logout' && method === 'POST') return auth.logout(env, request);
        if (sub === 'me' && method === 'GET') return auth.me(env, request);
        throw notFound('Маршрут не найден');
      }

      // --- Всё остальное требует авторизации ---
      const ctx = await auth.requireAuth(env, request);

      if (resource === 'users') {
        if (!sub && method === 'GET') return users.listUsers(env.DB, url);
        if (!sub && method === 'POST') return users.createUser(env.DB, request, ctx);
        if (sub === 'me' && sub2 === 'password' && method === 'POST') return users.changeOwnPassword(env.DB, request, ctx);
        if (sub && method === 'GET') return users.getUser(env.DB, idParam(sub));
        if (sub && method === 'PATCH') return users.updateUser(env.DB, request, idParam(sub), ctx);
        if (sub && method === 'DELETE') return users.deleteUser(env.DB, idParam(sub), ctx);
        throw notFound('Маршрут не найден');
      }

      if (resource === 'contacts') {
        if (!sub && method === 'GET') return contacts.listContacts(env.DB, url);
        if (!sub && method === 'POST') return contacts.createContact(env.DB, request, ctx);
        if (sub && method === 'GET') return contacts.getContact(env.DB, idParam(sub));
        if (sub && method === 'PATCH') return contacts.updateContact(env.DB, request, idParam(sub), ctx);
        if (sub && method === 'DELETE') return contacts.deleteContact(env.DB, idParam(sub), ctx);
        throw notFound('Маршрут не найден');
      }

      if (resource === 'queues') {
        // Читать очереди может любой вошедший; менять — admin/supervisor.
        if (!sub && method === 'GET') return contacts.listQueues(env.DB);
        if (sub && method === 'GET') return contacts.getQueue(env.DB, idParam(sub));
        if (!sub && method === 'POST') {
          auth.requireRole(ctx, 'admin', 'supervisor');
          return contacts.createQueue(env.DB, request, ctx);
        }
        if (sub && method === 'PATCH') {
          auth.requireRole(ctx, 'admin', 'supervisor');
          return contacts.updateQueue(env.DB, request, idParam(sub), ctx);
        }
        if (sub && method === 'DELETE') {
          auth.requireRole(ctx, 'admin', 'supervisor');
          return contacts.deleteQueue(env.DB, idParam(sub), ctx);
        }
        throw notFound('Маршрут не найден');
      }

      if (resource === 'calls') {
        if (sub === 'summary' && method === 'GET') return calls.callSummary(env.DB);
        if (sub === 'activity' && method === 'GET') {
          const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? '14') || 14));
          return calls.callActivity(env.DB, days);
        }
        if (!sub && method === 'GET') return calls.listCalls(env.DB, url);
        if (!sub && method === 'POST') return calls.createCall(env, request, ctx.sub);
        if (sub && method === 'GET') return calls.getCall(env.DB, idParam(sub));
        if (sub && method === 'PATCH') return calls.updateCall(env, request, idParam(sub), ctx.sub);
        throw notFound('Маршрут не найден');
      }

      if (resource === 'analytics') {
        // Аналитика — только руководству.
        auth.requireRole(ctx, 'admin', 'supervisor');
        if (sub === 'dashboard' && method === 'GET') return calls.analyticsDashboard(env.DB);
        if (sub === 'agents' && method === 'GET') return calls.analyticsAgents(env.DB);
        if (sub === 'queues' && method === 'GET') return calls.analyticsQueues(env.DB);
        if (sub === 'hourly' && method === 'GET') return calls.analyticsHourly(env.DB);
        if (sub === 'activity' && method === 'GET') return calls.analyticsActivity(env.DB, url);
        throw notFound('Маршрут не найден');
      }

      throw notFound('Маршрут не найден');
    });
  },
};
