import { http } from './http';
import type {
  Call,
  CallDirection,
  CallStatus,
  CallSummary,
  CallWithRelations,
  DailyActivityPoint,
  PaginationMeta,
} from './types';

export interface ListCallsParams {
  direction?: CallDirection;
  status?: CallStatus;
  agentId?: number;
  contactId?: number;
  queueId?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CallPayload {
  direction: CallDirection;
  status?: CallStatus;
  phoneNumber: string;
  agentId?: number | null;
  queueId?: number | null;
  contactId?: number | null;
  durationSec?: number;
  notes?: string | null;
}

/** API-модуль звонков: журнал, сводка и активность по дням. */
export const callsApi = {
  list: async (
    params: ListCallsParams = {},
  ): Promise<{ items: CallWithRelations[]; meta?: PaginationMeta }> => {
    const res = await http.get<CallWithRelations[]>('/calls', { query: { ...params } });
    return { items: res.data, meta: res.meta };
  },

  getById: (id: number) => http.get<CallWithRelations>(`/calls/${id}`),

  create: (payload: CallPayload) => http.post<Call>('/calls', payload),

  update: (id: number, payload: Partial<CallPayload>) => http.patch<Call>(`/calls/${id}`, payload),

  /** Сводка для «плиток» на дашборде: всего, отвечено, пропущено, процент. */
  summary: async (): Promise<CallSummary> => {
    const res = await http.get<CallSummary>('/calls/summary');
    return res.data;
  },

  /** Активность по дням (для графика). */
  activity: async (days = 14): Promise<DailyActivityPoint[]> => {
    const res = await http.get<DailyActivityPoint[]>('/calls/activity', { query: { days } });
    return res.data;
  },
};
