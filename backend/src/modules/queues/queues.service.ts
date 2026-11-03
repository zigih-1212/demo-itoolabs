/**
 * Сервис очередей.
 *
 * Закладываем основу «умного» распределения звонков: у каждой очереди есть
 * стратегия (strategy). Реализация самого алгоритма выбора оператора —
 * задача телефонии (в реальной системе это делал бы маршрутизатор звонков);
 * в демо мы храним и валидируем конфигурацию, а распределение показываем
 * в аналитике. Это честно: код не притворяется тем, чем не является.
 */
import { queuesRepository } from './queues.repository.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { activityRepository } from '../activity/activity.repository.js';
import type { Queue } from '../../domain/types.js';
import type { CreateQueueBody, UpdateQueueBody } from './queues.schema.js';

export const queuesService = {
  list(): Queue[] {
    return queuesRepository.list();
  },

  getById(id: number): Queue {
    const queue = queuesRepository.findById(id);
    if (!queue) throw new NotFoundError('Очередь не найдена');
    return queue;
  },

  create(body: CreateQueueBody, actorId: number): Queue {
    if (queuesRepository.findByName(body.name)) {
      throw new ConflictError('Очередь с таким названием уже существует');
    }
    const queue = queuesRepository.create({
      name: body.name,
      strategy: body.strategy,
      description: body.description ?? null,
      isActive: body.isActive,
    });
    activityRepository.log({
      actorId,
      action: 'queue.created',
      entityType: 'queue',
      entityId: queue.id,
      meta: { name: queue.name, strategy: queue.strategy },
    });
    return queue;
  },

  update(id: number, body: UpdateQueueBody, actorId: number): Queue {
    const existing = queuesRepository.findById(id);
    if (!existing) throw new NotFoundError('Очередь не найдена');

    if (body.name && body.name !== existing.name && queuesRepository.findByName(body.name)) {
      throw new ConflictError('Очередь с таким названием уже существует');
    }

    const updated = queuesRepository.update(id, body);
    if (!updated) throw new NotFoundError('Очередь не найдена');

    activityRepository.log({
      actorId,
      action: 'queue.updated',
      entityType: 'queue',
      entityId: id,
      meta: { fields: Object.keys(body) },
    });
    return updated;
  },

  remove(id: number, actorId: number): void {
    const existing = queuesRepository.findById(id);
    if (!existing) throw new NotFoundError('Очередь не найдена');
    queuesRepository.remove(id);
    activityRepository.log({
      actorId,
      action: 'queue.deleted',
      entityType: 'queue',
      entityId: id,
      meta: { name: existing.name },
    });
  },
};
