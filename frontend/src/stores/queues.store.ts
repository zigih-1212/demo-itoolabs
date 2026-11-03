import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { queuesApi } from '@/api';
import type { QueuePayload } from '@/api/queues.api';
import type { Queue } from '@/api/types';

/**
 * Store очередей распределения звонков.
 * Очередей немного, поэтому пагинация не нужна — грузим весь список целиком.
 */
export const useQueuesStore = defineStore('queues', () => {
  const items = ref<Queue[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const activeQueues = computed(() => items.value.filter((queue) => queue.isActive));
  const total = computed(() => items.value.length);

  async function fetchList(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      items.value = await queuesApi.list();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить очереди';
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function create(payload: QueuePayload): Promise<Queue> {
    const { data } = await queuesApi.create(payload);
    await fetchList();
    return data;
  }

  async function update(id: number, payload: Partial<QueuePayload>): Promise<Queue> {
    const { data } = await queuesApi.update(id, payload);
    const index = items.value.findIndex((queue) => queue.id === id);
    if (index !== -1) items.value[index] = data;
    return data;
  }

  async function remove(id: number): Promise<void> {
    await queuesApi.remove(id);
    items.value = items.value.filter((queue) => queue.id !== id);
  }

  return { items, isLoading, error, activeQueues, total, fetchList, create, update, remove };
});
