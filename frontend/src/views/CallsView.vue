<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useCallsStore } from '@/stores/calls.store';
import { useToastStore } from '@/stores/toast.store';
import { callsApi } from '@/api';
import type { CallPayload, CallWithRelations, CallDirection, CallStatus } from '@/api';
import {
  formatDuration,
  formatDateTime,
  formatPhone,
  formatNumber,
} from '@/utils/format';
import { callStatusLabels, callDirectionLabels, statusInfo } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import BasePagination from '@/components/ui/BasePagination.vue';
import BaseEmpty from '@/components/ui/BaseEmpty.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Журнал звонков.
 *
 * Это «рабочая лошадка» оператора и супервайзера: таблица со всеми звонками,
 * фильтрами по направлению/статусу и поиском, а также возможностью добавить
 * запись вручную (имитация того, что звонок пришёл из телефонии).
 *
 * Все данные и состояние фильтров живут в calls store — это позволяет
 * переиспользовать стор на других экранах и не терять фильтры при переходах.
 */

const calls = useCallsStore();
const toast = useToastStore();

/** Фильтры — локальные, но их сброс влияет на стор. Поиск дебаунсим. */
const searchInput = ref(calls.filters.search);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    calls.setFilter({ search: value });
    void calls.fetchList();
  }, 350);
});

watch(
  () => [calls.filters.direction, calls.filters.status],
  () => {
    void calls.fetchList();
  },
);

onMounted(() => {
  void calls.fetchList();
});

const directionOptions = [
  { value: '', label: 'Все направления' },
  { value: 'inbound', label: 'Входящие' },
  { value: 'outbound', label: 'Исходящие' },
];

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'queued', label: 'В очереди' },
  { value: 'ringing', label: 'Звонит' },
  { value: 'answered', label: 'Разговор' },
  { value: 'completed', label: 'Завершён' },
  { value: 'missed', label: 'Пропущен' },
  { value: 'failed', label: 'Ошибка' },
];

const hasFilters = computed(
  () =>
    !!calls.filters.search ||
    calls.filters.direction !== null ||
    calls.filters.status !== null,
);

function resetFilters(): void {
  searchInput.value = '';
  calls.resetFilters();
  void calls.fetchList();
}

/* ------------------------------- Модалка создания ------------------------------- */

const isModalOpen = ref(false);
const submitting = ref(false);

const form = reactive<CallPayload>({
  direction: 'inbound',
  status: 'completed',
  phoneNumber: '',
  agentId: null,
  queueId: null,
  notes: '',
});

function openCreate(): void {
  form.direction = 'inbound';
  form.status = 'completed';
  form.phoneNumber = '';
  form.agentId = null;
  form.queueId = null;
  form.notes = '';
  isModalOpen.value = true;
}

async function submitCreate(): Promise<void> {
  if (!form.phoneNumber.trim()) {
    toast.error('Проверьте форму', 'Укажите номер телефона');
    return;
  }

  submitting.value = true;
  try {
    await callsApi.create({
      direction: form.direction as CallDirection,
      status: form.status as CallStatus,
      phoneNumber: form.phoneNumber.trim(),
      agentId: form.agentId,
      queueId: form.queueId,
      notes: form.notes?.trim() || undefined,
    });
    toast.success('Звонок добавлен', 'Запись появилась в журнале');
    isModalOpen.value = false;
    await calls.fetchList();
  } catch (err) {
    toast.error('Не удалось добавить звонок', err instanceof Error ? err.message : 'Ошибка');
  } finally {
    submitting.value = false;
  }
}

function changePage(page: number): void {
  calls.setPage(page);
  void calls.fetchList();
}

/** Детали звонка — открываем компактную модалку с полной информацией. */
const selectedCall = ref<CallWithRelations | null>(null);
</script>

<template>
  <div class="calls-view">
    <PageHeader
      title="Журнал звонков"
      description="Все входящие и исходящие вызовы колл-центра"
    >
      <template #actions>
        <BaseButton @click="openCreate">
          <AppIcon
            name="plus"
            :size="16"
          />
          Добавить звонок
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Панель фильтров -->
    <section class="filters">
      <div class="filters__search">
        <BaseInput
          v-model="searchInput"
          type="search"
          placeholder="Поиск по номеру, контакту или заметке"
          icon="🔍"
        />
      </div>
      <BaseSelect
        :model-value="calls.filters.direction ?? ''"
        :options="directionOptions"
        @update:model-value="(v) => calls.setFilter({ direction: (v || null) as CallDirection | null })"
      />
      <BaseSelect
        :model-value="calls.filters.status ?? ''"
        :options="statusOptions"
        @update:model-value="(v) => calls.setFilter({ status: (v || null) as CallStatus | null })"
      />
      <BaseButton
        v-if="hasFilters"
        variant="ghost"
        @click="resetFilters"
      >
        <AppIcon
          name="x"
          :size="16"
        />
        Сбросить
      </BaseButton>
    </section>

    <!-- Таблица звонков -->
    <section class="card table-wrap">
      <BaseSkeleton
        v-if="calls.isLoading && !calls.items.length"
        :rows="6"
      />

      <BaseEmpty
        v-else-if="!calls.isLoading && calls.items.length === 0"
        title="Звонки не найдены"
        description="Измените фильтры или добавьте новый звонок"
        icon="📞"
      >
        <BaseButton
          variant="secondary"
          @click="resetFilters"
        >
          Сбросить фильтры
        </BaseButton>
      </BaseEmpty>

      <table
        v-else
        class="data-table"
      >
        <thead>
          <tr>
            <th>Направление</th>
            <th>Клиент</th>
            <th>Оператор</th>
            <th>Очередь</th>
            <th>Статус</th>
            <th class="data-table__num">
              Ожидание
            </th>
            <th class="data-table__num">
              Длительность
            </th>
            <th>Начало</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="call in calls.items"
            :key="call.id"
            class="data-table__row"
            @click="selectedCall = call"
          >
            <td>
              <span
                class="dir"
                :class="`dir--${call.direction}`"
              >
                <AppIcon
                  :name="call.direction === 'inbound' ? 'phone-incoming' : 'phone-outgoing'"
                  :size="14"
                />
                {{ callDirectionLabels[call.direction].label }}
              </span>
            </td>
            <td>
              <div class="cell-main">
                {{ call.contactName ?? 'Неизвестный' }}
              </div>
              <div class="cell-sub">
                {{ formatPhone(call.phoneNumber) }}
              </div>
            </td>
            <td>{{ call.agentName ?? '—' }}</td>
            <td>{{ call.queueName ?? '—' }}</td>
            <td>
              <BaseBadge :tone="statusInfo(callStatusLabels, call.status).tone">
                {{ statusInfo(callStatusLabels, call.status).label }}
              </BaseBadge>
            </td>
            <td class="data-table__num">
              {{ formatDuration(call.waitSec) }}
            </td>
            <td class="data-table__num">
              {{ formatDuration(call.durationSec) }}
            </td>
            <td class="cell-sub">
              {{ formatDateTime(call.startedAt) }}
            </td>
          </tr>
        </tbody>
      </table>

      <footer
        v-if="calls.items.length"
        class="table-footer"
      >
        <span class="table-footer__count">
          Всего: <strong>{{ formatNumber(calls.total) }}</strong>
        </span>
        <BasePagination
          :page="calls.filters.page"
          :pages="calls.totalPages"
          @change="changePage"
        />
      </footer>
    </section>

    <!-- Модалка: добавить звонок -->
    <BaseModal
      v-model="isModalOpen"
      title="Новый звонок"
      size="md"
    >
      <div class="form-grid">
        <BaseSelect
          v-model="form.direction"
          label="Направление"
          :options="[
            { value: 'inbound', label: 'Входящий' },
            { value: 'outbound', label: 'Исходящий' },
          ]"
        />
        <BaseSelect
          v-model="form.status"
          label="Статус"
          :options="statusOptions.filter((o) => o.value)"
        />
        <BaseInput
          v-model="form.phoneNumber"
          label="Номер телефона"
          placeholder="+7 (999) 123-45-67"
          required
        />
        <BaseInput
          v-model="form.notes"
          label="Заметка"
          placeholder="Кратко о разговоре"
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
          @click="submitCreate"
        >
          Добавить
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Модалка: детали звонка -->
    <BaseModal
      :model-value="selectedCall !== null"
      title="Детали звонка"
      size="md"
      @update:model-value="selectedCall = null"
    >
      <dl
        v-if="selectedCall"
        class="details"
      >
        <div class="details__row">
          <dt>Клиент</dt>
          <dd>{{ selectedCall.contactName ?? 'Неизвестный' }}</dd>
        </div>
        <div class="details__row">
          <dt>Номер</dt>
          <dd>{{ formatPhone(selectedCall.phoneNumber) }}</dd>
        </div>
        <div class="details__row">
          <dt>Направление</dt>
          <dd>{{ callDirectionLabels[selectedCall.direction].label }}</dd>
        </div>
        <div class="details__row">
          <dt>Статус</dt>
          <dd>
            <BaseBadge :tone="statusInfo(callStatusLabels, selectedCall.status).tone">
              {{ statusInfo(callStatusLabels, selectedCall.status).label }}
            </BaseBadge>
          </dd>
        </div>
        <div class="details__row">
          <dt>Оператор</dt>
          <dd>{{ selectedCall.agentName ?? '—' }}</dd>
        </div>
        <div class="details__row">
          <dt>Очередь</dt>
          <dd>{{ selectedCall.queueName ?? '—' }}</dd>
        </div>
        <div class="details__row">
          <dt>Начало</dt>
          <dd>{{ formatDateTime(selectedCall.startedAt) }}</dd>
        </div>
        <div class="details__row">
          <dt>Ожидание</dt>
          <dd>{{ formatDuration(selectedCall.waitSec) }}</dd>
        </div>
        <div class="details__row">
          <dt>Длительность</dt>
          <dd>{{ formatDuration(selectedCall.durationSec) }}</dd>
        </div>
        <div
          v-if="selectedCall.notes"
          class="details__row"
        >
          <dt>Заметка</dt>
          <dd>{{ selectedCall.notes }}</dd>
        </div>
      </dl>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: $space-3;
  align-items: start;

  @include down('lg') {
    grid-template-columns: 1fr 1fr;
  }

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}

.table-wrap {
  @include card;
  padding: 0;
  overflow: hidden;

  .data-table {
    padding: 0 $space-5;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: $space-3 $space-2;
    text-align: left;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $color-text-subtle;
    border-bottom: 1px solid $color-border;
  }

  &__num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  td {
    padding: $space-3 $space-2;
    border-bottom: 1px solid $color-border;
    font-size: $font-size-base;
    color: $color-text;
    vertical-align: middle;
  }

  &__row {
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
      background: $color-neutral-50;
    }

    &:last-child td {
      border-bottom: none;
    }
  }
}

.cell-main {
  font-weight: $font-weight-medium;
}

.cell-sub {
  font-size: $font-size-xs;
  color: $color-text-muted;
}

.dir {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-size-sm;

  &--inbound {
    color: $color-info-600;
  }

  &--outbound {
    color: $color-neutral-600;
  }
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4 $space-5;
  border-top: 1px solid $color-border;

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-4;

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}

.details {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-4;
    padding-bottom: $space-3;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  dt {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  dd {
    font-weight: $font-weight-medium;
    color: $color-text;
    text-align: right;
  }
}
</style>
