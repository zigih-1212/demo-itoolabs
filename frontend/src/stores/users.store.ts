import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { usersApi } from '@/api';
import type {
  ChangePasswordPayload,
  CreateUserPayload,
  ListUsersParams,
  UpdateUserPayload,
} from '@/api/users.api';
import type { PaginationMeta, User } from '@/api/types';

/**
 * Store сотрудников (пользователей системы).
 * По той же схеме, что и журнал звонков: данные + фильтры + пагинация.
 */
export const useUsersStore = defineStore('users', () => {
  const items = ref<User[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const filters = ref<Required<Pick<ListUsersParams, 'page' | 'limit'>> & {
    search: string;
    role: string | null;
  }>({
    search: '',
    role: null,
    page: 1,
    limit: 20,
  });

  const total = computed(() => meta.value?.total ?? 0);

  async function fetchList(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: ListUsersParams = {
        search: filters.value.search || undefined,
        page: filters.value.page,
        limit: filters.value.limit,
      };

      if (filters.value.role) {
        params.role = filters.value.role as User['role'];
      }

      const { items: rows, meta: pageMeta } = await usersApi.list(params);
      items.value = rows;
      meta.value = pageMeta ?? null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить сотрудников';
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function create(payload: CreateUserPayload): Promise<User> {
    const { data } = await usersApi.create(payload);
    await fetchList();
    return data;
  }

  async function update(id: number, payload: UpdateUserPayload): Promise<User> {
    const { data } = await usersApi.update(id, payload);

    // Обновляем строку в списке без полной перезагрузки — меньше запросов.
    const index = items.value.findIndex((user) => user.id === id);
    if (index !== -1) items.value[index] = data;

    return data;
  }

  async function remove(id: number): Promise<void> {
    await usersApi.remove(id);
    items.value = items.value.filter((user) => user.id !== id);
  }

  async function changePassword(payload: ChangePasswordPayload): Promise<void> {
    await usersApi.changePassword(payload);
  }

  function setFilter(patch: Partial<typeof filters.value>): void {
    filters.value = { ...filters.value, ...patch, page: 1 };
    void fetchList();
  }

  function setPage(page: number): void {
    filters.value.page = page;
    void fetchList();
  }

  return {
    items,
    meta,
    isLoading,
    error,
    filters,
    total,
    fetchList,
    create,
    update,
    remove,
    changePassword,
    setFilter,
    setPage,
  };
});
