<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useQueuesStore } from '@/stores/queues.store';
import { useToastStore } from '@/stores/toast.store';
import { confirm } from '@/composables/useConfirm';
import type { Queue, QueueStrategy, QueuePayload } from '@/api';
import { ApiError } from '@/api';
import { queueStrategyLabels, queueStrategyHints } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseEmpty from '@/components/ui/BaseEmpty.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Очереди распределения звонков.
 *
 * Очередь — это правило, по которому входящий звонок назначается оператору.
 * Стратегия определяет алгоритм:
 * - «Дольше всех ждёт» — свободному дольше всех оператору;
 * - «По кругу» — по очереди между операторами;
 * - «Все одновременно» — звонок звонит всем, кто берёт первым.
 *
 * Экран показывает очереди карточками с краткой статистикой и позволяет
 * управлять ими (создать/изменить/включить-выключить/удалить).
 */
const queues = useQueuesStore();
const toast = useToastStore();

/** Статистика очередей из аналитики — сколько звонков в работе и т.д. */
// Статистику подтянет аналитика, но карточкам достаточно полей из /queues.

onMounted(() => {
  void queues.fetchList();
});

const isModalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number | null>(null);

const form = reactive<QueuePayload>({
  name: '',
  strategy: 'longest_idle',
  description: '',
  isActive: true,
});

const isEditing = ref(false);

const strategyOptions = [
  { value: 'longest_idle', label: 'Дольше всех ждёт' },
  { value: 'round_robin', label: 'По кругу' },
  { value: 'ring_all', label: 'Все одновременно' },
];

const strategyTone: Record<QueueStrategy, 'info' | 'success' | 'warning'> = {
  longest_idle: 'info',
  round_robin: 'success',
  ring_all: 'warning',
};

function openCreate(): void {
  editingId.value = null;
  isEditing.value = false;
  form.name = '';
  form.strategy = 'longest_idle';
  form.description = '';
  form.isActive = true;
  isModalOpen.value = true;
}

function openEdit(queue: Queue): void {
  editingId.value = queue.id;
  isEditing.value = true;
  form.name = queue.name;
  form.strategy = queue.strategy;
  form.description = queue.description ?? '';
  form.isActive = queue.isActive;
  isModalOpen.value = true;
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    toast.error('Проверьте форму', 'Укажите название очереди');
    return;
  }

  const payload: QueuePayload = {
    name: form.name.trim(),
    strategy: form.strategy,
    description: form.description?.trim() || undefined,
    isActive: form.isActive,
  };

  submitting.value = true;
  try {
    if (isEditing.value && editingId.value !== null) {
      await queues.update(editingId.value, payload);
      toast.success('Очередь обновлена');
    } else {
      await queues.create(payload);
      toast.success('Очередь создана');
    }
    isModalOpen.value = false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error('Конфликт', 'Очередь с таким названием уже существует');
    } else {
      toast.error('Не удалось сохранить', err instanceof Error ? err.message : 'Ошибка');
    }
  } finally {
    submitting.value = false;
  }
}

/** Быстрое переключение активности очереди прямо из карточки. */
async function toggleActive(queue: Queue): Promise<void> {
  try {
    await queues.update(queue.id, { isActive: !queue.isActive });
    toast.success(queue.isActive ? 'Очередь выключена' : 'Очередь включена');
  } catch (err) {
    toast.error('Не удалось изменить', err instanceof Error ? err.message : 'Ошибка');
  }
}

async function removeQueue(queue: Queue): Promise<void> {
  const confirmed = await confirm({
    title: 'Удалить очередь?',
    message: `Очередь «${queue.name}» будет удалена. Звонки в ней переназначены не будут.`,
    confirmLabel: 'Удалить',
    danger: true,
  });

  if (!confirmed) return;

  try {
    await queues.remove(queue.id);
    toast.success('Очередь удалена');
  } catch (err) {
    toast.error('Не удалось удалить', err instanceof Error ? err.message : 'Ошибка');
  }
}
</script>

<template>
  <div class="queues-view">
    <PageHeader
      title="Очереди"
      description="Правила распределения входящих звонков между операторами"
    >
      <template #actions>
        <BaseButton @click="openCreate">
          <AppIcon
            name="plus"
            :size="16"
          />
          Создать очередь
        </BaseButton>
      </template>
    </PageHeader>

    <BaseSkeleton
      v-if="queues.isLoading && !queues.items.length"
      :rows="4"
    />

    <BaseEmpty
      v-else-if="!queues.isLoading && queues.items.length === 0"
      title="Очередей пока нет"
      description="Создайте первую очередь, чтобы распределять звонки"
      icon="🗂️"
    >
      <BaseButton
        variant="secondary"
        @click="openCreate"
      >
        Создать очередь
      </BaseButton>
    </BaseEmpty>

    <section
      v-else
      class="queue-grid"
    >
      <article
        v-for="queue in queues.items"
        :key="queue.id"
        class="queue-card"
      >
        <header class="queue-card__head">
          <div>
            <h3 class="queue-card__name">
              {{ queue.name }}
            </h3>
            <BaseBadge
              :tone="strategyTone[queue.strategy]"
              size="sm"
            >
              {{ queueStrategyLabels[queue.strategy] }}
            </BaseBadge>
          </div>
          <BaseBadge
            :tone="queue.isActive ? 'success' : 'neutral'"
            dot
            size="sm"
          >
            {{ queue.isActive ? 'Активна' : 'Выключена' }}
          </BaseBadge>
        </header>

        <p class="queue-card__desc">
          {{ queue.description ?? queueStrategyHints[queue.strategy] }}
        </p>

        <footer class="queue-card__foot">
          <button
            class="queue-card__toggle"
            @click="toggleActive(queue)"
          >
            <AppIcon
              :name="queue.isActive ? 'x' : 'check'"
              :size="14"
            />
            {{ queue.isActive ? 'Выключить' : 'Включить' }}
          </button>
          <div class="queue-card__actions">
            <button
              class="icon-btn"
              title="Редактировать"
              @click="openEdit(queue)"
            >
              <AppIcon
                name="edit"
                :size="16"
              />
            </button>
            <button
              class="icon-btn icon-btn--danger"
              title="Удалить"
              @click="removeQueue(queue)"
            >
              <AppIcon
                name="trash"
                :size="16"
              />
            </button>
          </div>
        </footer>
      </article>
    </section>

    <BaseModal
      v-model="isModalOpen"
      :title="isEditing ? 'Редактировать очередь' : 'Новая очередь'"
      size="md"
    >
      <div class="form-stack">
        <BaseInput
          v-model="form.name"
          label="Название"
          required
          placeholder="Отдел продаж"
        />
        <BaseSelect
          v-model="form.strategy"
          label="Стратегия распределения"
          :options="strategyOptions"
          :hint="queueStrategyHints[form.strategy as QueueStrategy]"
        />
        <BaseInput
          v-model="form.description"
          label="Описание"
          placeholder="Кому и зачем адресована очередь"
        />
      </div>
      <template #footer>
        <BaseButton
          variant="secondary"
          @click="isModalOpen = false"
        >
          Отмена
        </BaseButton>
        <BaseButton
          :loading="submitting"
          @click="submit"
        >
          {{ isEditing ? 'Сохранить' : 'Создать' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $space-4;
}

.queue-card {
  @include card;
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-5;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-3;
  }

  &__name {
    margin-bottom: $space-2;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
  }

  &__desc {
    flex: 1;
    font-size: $font-size-sm;
    color: $color-text-muted;
    @include line-clamp(3);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: $space-3;
    border-top: 1px solid $color-border;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    font-size: $font-size-sm;
    color: $color-text-muted;
    @include focus-ring;

    &:hover {
      color: $color-text;
    }
  }

  &__actions {
    display: flex;
    gap: $space-1;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: $color-text-muted;
  border-radius: $radius-md;
  transition:
    background-color $transition-fast,
    color $transition-fast;
  @include focus-ring;

  &:hover {
    background: $color-neutral-100;
    color: $color-text;
  }

  &--danger:hover {
    background: $color-danger-50;
    color: $color-danger-600;
  }
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}
</style>
