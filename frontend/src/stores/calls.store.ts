import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { callsApi } from '@/api';
import type { ListCallsParams } from '@/api/calls.api';
import type { CallDirection, CallStatus, CallWithRelations, PaginationMeta } from '@/api/types';

/**
 * Store журнала звонков.
 *
 * Держим состояние списка, фильтры и пагинацию вместе — так страница журнала
 * остаётся тонкой: она лишь вызывает actions и рисует данные. Пагинация и
 * фильтры переживают переход между страницами внутри раздела.
 */
export const useCallsStore = defineStore('calls', () => {
  const items = ref<CallWithRelations[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Фильтры журнала. `null` означает «без фильтра».
  const filters = ref<{
    direction: CallDirection | null;
    status: CallStatus | null;
    search: string;
    page: number;
    limit: number;
  }>({
    direction: null,
    status: null,
    search: '',
    page: 1,
    limit: 20,
  });

  const total = computed(() => meta.value?.total ?? 0);
  const totalPages = computed(() => meta.value?.pages ?? 1);

  /** Загружает страницу журнала с учётом текущих фильтров. */
  async function fetchList(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: ListCallsParams = {
        direction: filters.value.direction ?? undefined,
        status: filters.value.status ?? undefined,
        page: filters.value.page,
        limit: filters.value.limit,
      };

      const { items: rows, meta: pageMeta } = await callsApi.list(params);
      items.value = rows;
      meta.value = pageMeta ?? null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить журнал';
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /** Установить фильтр и сбросить пагинацию на первую страницу. */
  function setFilter(patch: Partial<typeof filters.value>): void {
    filters.value = { ...filters.value, ...patch, page: 1 };
    void fetchList();
  }

  /** Перейти на другую страницу. */
  function setPage(page: number): void {
    filters.value.page = page;
    void fetchList();
  }

  /** Сбросить все фильтры к значениям по умолчанию. */
  function resetFilters(): void {
    filters.value = { direction: null, status: null, search: '', page: 1, limit: 20 };
    void fetchList();
  }

  return {
    items,
    meta,
    isLoading,
    error,
    filters,
    total,
    totalPages,
    fetchList,
    setFilter,
    setPage,
    resetFilters,
  };
});
