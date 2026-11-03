/**
 * Сервис контактов.
 *
 * Содержит правило, которое нельзя выразить в схеме: один и тот же номер
 * у одного владельца не должен дублироваться. Проверка «на существование»
 * делается здесь, в бизнес-логике, а не в валидаторе (валидатор не ходит в БД).
 */
import { contactsRepository } from './contacts.repository.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { activityRepository } from '../activity/activity.repository.js';
import type { Contact } from '../../domain/types.js';
import type { CreateContactBody, ListContactsQuery, UpdateContactBody } from './contacts.schema.js';

export const contactsService = {
  list(query: ListContactsQuery): {
    items: Contact[];
    total: number;
    page: number;
    limit: number;
  } {
    const offset = (query.page - 1) * query.limit;
    const { items, total } = contactsRepository.list({
      search: query.search,
      tag: query.tag,
      sort: query.sort,
      offset,
      limit: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  },

  getById(id: number): Contact {
    const contact = contactsRepository.findById(id);
    if (!contact) throw new NotFoundError('Контакт не найден');
    return contact;
  },

  create(body: CreateContactBody, ownerId: number): Contact {
    // Защита от дублей по номеру в пределах телефонной книги.
    const duplicate = contactsRepository.findByPhone(body.phone);
    if (duplicate) {
      throw new ConflictError('Контакт с таким номером уже существует');
    }

    const contact = contactsRepository.create({
      ownerId,
      fullName: body.fullName,
      phone: body.phone,
      email: body.email ?? null,
      company: body.company ?? null,
      tags: body.tags ?? [],
      notes: body.notes ?? null,
    });

    activityRepository.log({
      actorId: ownerId,
      action: 'contact.created',
      entityType: 'contact',
      entityId: contact.id,
      meta: { fullName: contact.fullName },
    });

    return contact;
  },

  update(id: number, body: UpdateContactBody, actorId: number): Contact {
    const existing = contactsRepository.findById(id);
    if (!existing) throw new NotFoundError('Контакт не найден');

    // Если меняется номер — проверяем, что новый не занят другим контактом.
    if (body.phone && body.phone !== existing.phone) {
      const duplicate = contactsRepository.findByPhone(body.phone);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Контакт с таким номером уже существует');
      }
    }

    const updated = contactsRepository.update(id, body);
    if (!updated) throw new NotFoundError('Контакт не найден');

    activityRepository.log({
      actorId,
      action: 'contact.updated',
      entityType: 'contact',
      entityId: id,
      meta: { fields: Object.keys(body) },
    });

    return updated;
  },

  remove(id: number, actorId: number): void {
    const existing = contactsRepository.findById(id);
    if (!existing) throw new NotFoundError('Контакт не найден');

    contactsRepository.remove(id);
    activityRepository.log({
      actorId,
      action: 'contact.deleted',
      entityType: 'contact',
      entityId: id,
      meta: { fullName: existing.fullName },
    });
  },
};
