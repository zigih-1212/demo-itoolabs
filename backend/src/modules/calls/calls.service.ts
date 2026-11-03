/**
 * Сервис звонков.
 *
 * Бизнес-правило, которое здесь реализовано: при создании звонка мы пытаемся
 * автоматически привязать его к контакту по номеру телефона, если клиент
 * не передал contactId явно. Это и есть то «узнавание клиента», ради которого
 * существует CRM-часть колл-центра.
 */
import { callsRepository, type CallWithRelations } from './calls.repository.js';
import { contactsRepository } from '../contacts/contacts.repository.js';
import { usersRepository } from '../users/users.repository.js';
import { queuesRepository } from '../queues/queues.repository.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { activityRepository } from '../activity/activity.repository.js';
import type { Call } from '../../domain/types.js';
import type { CreateCallBody, ListCallsQuery, UpdateCallBody } from './calls.schema.js';

export const callsService = {
  list(query: ListCallsQuery): {
    items: CallWithRelations[];
    total: number;
    page: number;
    limit: number;
  } {
    const offset = (query.page - 1) * query.limit;
    const { items, total } = callsRepository.list({
      direction: query.direction,
      status: query.status,
      agentId: query.agentId,
      contactId: query.contactId,
      queueId: query.queueId,
      from: query.from,
      to: query.to,
      offset,
      limit: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  },

  getById(id: number): CallWithRelations {
    const call = callsRepository.findByIdWithRelations(id);
    if (!call) throw new NotFoundError('Звонок не найден');
    return call;
  },

  create(body: CreateCallBody, actorId: number): Call {
    // Проверяем существование связанных сущностей — иначе получим «висячие» FK.
    // (Внешние ключи с ON DELETE SET NULL защищают при удалении, но не при вставке.)
    if (body.agentId && !usersRepository.findById(body.agentId)) {
      throw new ValidationError('Указанный оператор не найден');
    }
    if (body.queueId && !queuesRepository.findById(body.queueId)) {
      throw new ValidationError('Указанная очередь не найдена');
    }

    // Автоподстановка контакта по номеру, если id не задан явно.
    let contactId = body.contactId ?? null;
    if (!contactId) {
      const contact = contactsRepository.findByPhone(body.phoneNumber);
      if (contact) contactId = contact.id;
    }

    // Для завершённого/отвеченного звонка вычисляем метки времени по длительности —
    // так демо-данные остаются внутренне согласованными.
    const now = Date.now();
    const answeredAt =
      body.status === 'answered' || body.status === 'completed'
        ? new Date(now - (body.durationSec + body.waitSec) * 1000).toISOString()
        : null;
    const endedAt =
      body.status === 'completed' || body.status === 'missed' || body.status === 'failed'
        ? new Date(now).toISOString()
        : null;

    const call = callsRepository.create({
      direction: body.direction,
      status: body.status,
      contactId,
      agentId: body.agentId ?? null,
      queueId: body.queueId ?? null,
      phoneNumber: body.phoneNumber,
      durationSec: body.durationSec,
      waitSec: body.waitSec,
      answeredAt,
      endedAt,
      notes: body.notes ?? null,
    });

    activityRepository.log({
      actorId,
      action: 'call.created',
      entityType: 'call',
      entityId: call.id,
      meta: { direction: call.direction, status: call.status },
    });

    return call;
  },

  update(id: number, body: UpdateCallBody, actorId: number): Call {
    const existing = callsRepository.findById(id);
    if (!existing) throw new NotFoundError('Звонок не найден');

    if (body.agentId && !usersRepository.findById(body.agentId)) {
      throw new ValidationError('Указанный оператор не найден');
    }

    const updated = callsRepository.update(id, body);
    if (!updated) throw new NotFoundError('Звонок не найден');

    activityRepository.log({
      actorId,
      action: 'call.updated',
      entityType: 'call',
      entityId: id,
      meta: { fields: Object.keys(body) },
    });

    return updated;
  },

  /**
   * Метрики для дашборда: статусы, длительность, дневная активность.
   * Всё считается запросами к БД (агрегации в SQL), а не в JS-цикле по всем
   * записям — это принципиально для масштабирования.
   */
  summary() {
    const statuses = callsRepository.statusCounts();
    const durations = callsRepository.durationStats();

    // Производные метрики, которые обычно показывают руководителю.
    const total = Object.values(statuses).reduce((sum, n) => sum + n, 0);
    const answered = statuses.answered + statuses.completed;
    const missed = statuses.missed + statuses.failed;
    const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;
    const missRate = total > 0 ? Math.round((missed / total) * 100) : 0;

    return {
      total,
      statuses,
      answered,
      missed,
      answerRate,
      missRate,
      totalTalkSeconds: durations.totalSec,
      averageTalkSeconds: durations.avgSec,
    };
  },

  activity(days: number) {
    return callsRepository.dailyActivity(days);
  },
};
