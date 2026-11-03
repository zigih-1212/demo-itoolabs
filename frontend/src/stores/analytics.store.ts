import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { analyticsApi } from '@/api';
import type { AnalyticsDashboard } from '@/api/types';

/**
 * Store аналитики и дашборда.
 *
 * Данные дашборда «тяжёлые» (несколько агрегатных запросов), поэтому кэшируем
 * их и обновляем вручную — при входе на страницу или по кнопке «Обновить».
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  const dashboard = ref<AnalyticsDashboard | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  const agents = computed(() => dashboard.value?.agents ?? []);
  const queues = computed(() => dashboard.value?.queues ?? []);
  const hourly = computed(() => dashboard.value?.hourly ?? []);
  const recentActivity = computed(() => dashboard.value?.recentActivity ?? []);

  /** Максимум по часовому графику — нужен для расчёта высоты столбцов. */
  const hourlyPeak = computed(() =>
    Math.max(1, ...hourly.value.map((point) => point.total)),
  );

  /** Загрузка всех данных дашборда одним запросом. */
  async function fetchDashboard(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      dashboard.value = await analyticsApi.dashboard();
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить аналитику';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    dashboard,
    isLoading,
    error,
    lastUpdated,
    agents,
    queues,
    hourly,
    recentActivity,
    hourlyPeak,
    fetchDashboard,
  };
});
