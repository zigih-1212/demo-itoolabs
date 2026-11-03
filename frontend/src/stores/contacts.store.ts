import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { contactsApi } from '@/api';
import type { ContactPayload, ContactSort, ListContactsParams } from '@/api/contacts.api';
import type { Contact, PaginationMeta } from '@/api/types';

/** Store клиентской базы (контактов). */
export const useContactsStore = defineStore('contacts', () => {
  const items = ref<Contact[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const filters = ref<{
    search: string;
    tag: string;
    sort: ContactSort;
    page: number;
    limit: number;
  }>({
    search: '',
    tag: '',
    sort: 'created',
    page: 1,
    limit: 20,
  });

  const total = computed(() => meta.value?.total ?? 0);

  async function fetchList(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: ListContactsParams = {
        search: filters.value.search || undefined,
        tag: filters.value.tag || undefined,
        sort: filters.value.sort,
        page: filters.value.page,
        limit: filters.value.limit,
      };

      const { items: rows, meta: pageMeta } = await contactsApi.list(params);
      items.value = rows;
      meta.value = pageMeta ?? null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить контакты';
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function create(payload: ContactPayload): Promise<Contact> {
    const { data } = await contactsApi.create(payload);
    await fetchList();
    return data;
  }

  async function update(id: number, payload: Partial<ContactPayload>): Promise<Contact> {
    const { data } = await contactsApi.update(id, payload);
    const index = items.value.findIndex((contact) => contact.id === id);
    if (index !== -1) items.value[index] = data;
    return data;
  }

  async function remove(id: number): Promise<void> {
    await contactsApi.remove(id);
    items.value = items.value.filter((contact) => contact.id !== id);
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
    setFilter,
    setPage,
  };
});
