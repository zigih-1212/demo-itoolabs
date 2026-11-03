import { http } from './http';
import type {
  ActivityEntry,
  AgentPerformanceRow,
  AnalyticsDashboard,
  HourlyPoint,
  QueueLoadRow,
} from './types';

/**
 * API-модуль аналитики. Доступен только ролям admin/supervisor
 * (ограничение проверяется на бэкенде; фронт просто не показывает раздел агентам).
 */
export const analyticsApi = {
  dashboard: async (): Promise<AnalyticsDashboard> => {
    const res = await http.get<AnalyticsDashboard>('/analytics/dashboard');
    return res.data;
  },

  agents: async (): Promise<AgentPerformanceRow[]> => {
    const res = await http.get<AgentPerformanceRow[]>('/analytics/agents');
    return res.data;
  },

  queues: async (): Promise<QueueLoadRow[]> => {
    const res = await http.get<QueueLoadRow[]>('/analytics/queues');
    return res.data;
  },

  hourly: async (): Promise<HourlyPoint[]> => {
    const res = await http.get<HourlyPoint[]>('/analytics/hourly');
    return res.data;
  },

  activity: async (limit = 20): Promise<ActivityEntry[]> => {
    const res = await http.get<ActivityEntry[]>('/analytics/activity', { query: { limit } });
    return res.data;
  },
};
