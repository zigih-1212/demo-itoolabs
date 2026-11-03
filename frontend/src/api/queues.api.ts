import { http } from './http';
import type { Queue, QueueStrategy } from './types';

export interface QueuePayload {
  name: string;
  strategy?: QueueStrategy;
  description?: string | null;
  isActive?: boolean;
}

/** API-модуль очередей распределения звонков. */
export const queuesApi = {
  list: async (): Promise<Queue[]> => {
    const res = await http.get<Queue[]>('/queues');
    return res.data;
  },

  getById: (id: number) => http.get<Queue>(`/queues/${id}`),

  create: (payload: QueuePayload) => http.post<Queue>('/queues', payload),

  update: (id: number, payload: Partial<QueuePayload>) =>
    http.patch<Queue>(`/queues/${id}`, payload),

  remove: (id: number) => http.delete<void>(`/queues/${id}`),
};
