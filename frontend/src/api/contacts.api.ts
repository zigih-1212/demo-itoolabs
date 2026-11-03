import { http } from './http';
import type { Contact, PaginationMeta } from './types';

export type ContactSort = 'name' | 'created' | 'company';

export interface ListContactsParams {
  search?: string;
  tag?: string;
  sort?: ContactSort;
  page?: number;
  limit?: number;
}

export interface ContactPayload {
  fullName: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
}

/** API-модуль контактов (клиентской базы). */
export const contactsApi = {
  list: async (
    params: ListContactsParams = {},
  ): Promise<{ items: Contact[]; meta?: PaginationMeta }> => {
    const res = await http.get<Contact[]>('/contacts', { query: { ...params } });
    return { items: res.data, meta: res.meta };
  },

  getById: (id: number) => http.get<Contact>(`/contacts/${id}`),

  create: (payload: ContactPayload) => http.post<Contact>('/contacts', payload),

  update: (id: number, payload: Partial<ContactPayload>) =>
    http.patch<Contact>(`/contacts/${id}`, payload),

  remove: (id: number) => http.delete<void>(`/contacts/${id}`),
};
