/**
 * Сервис аналитики.
 *
 * Собирает разрозненные агрегаты в один «снимок» для дашборда руководителя
 * (dashboard). Так фронтенд делает ОДИН запрос вместо пяти — это заметно
 * снижает нагрузку и упрощает клиентский код.
 */
import { analyticsRepository } from './analytics.repository.js';
import { activityRepository } from '../activity/activity.repository.js';

export const analyticsService = {
  /**
   * Полный агрегат для дашборда: KPI, активность по дням, рейтинг операторов,
   * загрузка очередей, распределение по часам, последние события.
   */
  dashboard() {
    return {
      agents: analyticsRepository.agentPerformance(),
      queues: analyticsRepository.queueLoad(),
      hourly: analyticsRepository.hourlyDistribution(),
      recentActivity: activityRepository.recent(15),
    };
  },

  agentPerformance() {
    return analyticsRepository.agentPerformance();
  },

  queueLoad() {
    return analyticsRepository.queueLoad();
  },

  hourlyDistribution() {
    return analyticsRepository.hourlyDistribution();
  },

  recentActivity(limit: number) {
    return activityRepository.recent(limit);
  },
};
