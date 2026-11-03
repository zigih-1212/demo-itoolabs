<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useCallsStore } from '@/stores/calls.store';
import { useAuthStore } from '@/stores/auth.store';
import { callsApi } from '@/api';
import type { CallSummary, DailyActivityPoint } from '@/api';
import { ref } from 'vue';
import {
  formatDuration,
  formatNumber,
  formatRatePercent,
  formatDateTime,
  formatRelative,
} from '@/utils/format';
import { callStatusLabels, callDirectionLabels, statusInfo } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import BarChart from '@/components/common/BarChart.vue';
import type { BarChartPoint } from '@/components/common/BarChart.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseAvatar from '@/components/ui/BaseAvatar.vue';
import BaseEmpty from '@/components/ui/BaseEmpty.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Дашборд — «главный экран» системы.
 *
 * Здесь собираются ключевые показатели колл-центра: сводка по звонкам,
 * график активности за две недели, таблица загрузки операторов и лента
 * последних событий. Данные берём из двух источников (сводка и активность —
 * из calls API, всё остальное — из analytics) и грузим параллельно: так экран
 * появляется быстрее, чем если запрашивать последовательно.
 */

const analytics = useAnalyticsStore();
const callsStore = useCallsStore();
const auth = useAuthStore();

const summary = ref<CallSummary | null>(null);
const activity = ref<DailyActivityPoint[]>([]);
const coreLoading = ref(true);

/** Сводные плитки: статусы берём из summary, остальное — из аналитики. */
const cards = computed(() => [
  {
    label: 'Всего звонков',
    value: formatNumber(summary.value?.total ?? 0),
    icon: 'phone',
    tone: 'primary' as const,
    hint: 'за всё время',
  },
  {
    label: 'Отвечено',
    value: formatRatePercent(summary.value?.answerRate ?? 0),
    icon: 'check-circle',
    tone: 'success' as const,
    hint: `${formatNumber(summary.value?.answered ?? 0)} звонков`,
  },
  {
    label: 'Пропущено',
    value: formatNumber(summary.value?.missed ?? 0),
    icon: 'alert-circle',
    tone: 'danger' as const,
    hint: 'требуют внимания',
  },
  {
    label: 'Средняя длительность',
    value: formatDuration(summary.value?.averageTalkSeconds ?? 0),
    icon: 'clock',
    tone: 'info' as const,
    hint: `всего ${formatDuration(summary.value?.totalTalkSeconds ?? 0)}`,
  },
]);

/** Данные для графика активности: входящие + исходящие за 14 дней. */
const activityPoints = computed<BarChartPoint[]>(() =>
  activity.value.map((point) => ({
    label: point.date.slice(8) + '.' + point.date.slice(5, 7),
    value: point.inbound,
    secondary: point.outbound,
  })),
);

const recentCalls = computed(() => callsStore.items.slice(0, 6));

onMounted(async () => {
  // Запускаем независимые запросы параллельно, чтобы не ждать их по очереди.
  await Promise.allSettled([
    loadCore(),
    analytics.fetchDashboard(),
    callsStore.fetchList(),
  ]);
});

async function loadCore(): Promise<void> {
  coreLoading.value = true;
  try {
    const [summaryRes, activityRes] = await Promise.all([
      callsApi.summary(),
      callsApi.activity(14),
    ]);
    summary.value = summaryRes;
    activity.value = activityRes;
  } finally {
    coreLoading.value = false;
  }
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}
</script>

<template>
  <div class="dashboard">
    <PageHeader
      :title="`${greeting()}, ${auth.user?.fullName ?? ''}`"
      description="Обзор работы колл-центра: показатели, активность и последние события"
    >
      <template #actions>
        <BaseButton
          variant="secondary"
          @click="loadCore"
        >
          <AppIcon
            name="refresh"
            :size="16"
          />
          Обновить
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Ключевые показатели -->
    <section class="dashboard__stats">
      <StatCard
        v-for="card in cards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
        :tone="card.tone"
        :hint="card.hint"
        :loading="coreLoading"
      />
    </section>

    <div class="dashboard__grid">
      <!-- График активности -->
      <section class="card dashboard__chart">
        <header class="card__head">
          <h2 class="card__title">
            Активность за 14 дней
          </h2>
          <BaseBadge tone="neutral">
            Входящие / Исходящие
          </BaseBadge>
        </header>
        <div
          v-if="coreLoading"
          class="dashboard__chart-skeleton"
        >
          <BaseSkeleton
            :rows="6"
            height="24px"
          />
        </div>
        <BaseEmpty
          v-else-if="activityPoints.length === 0"
          title="Пока нет данных"
          description="Как только появятся звонки, здесь построится график"
          icon="📈"
        />
        <BarChart
          v-else
          :points="activityPoints"
          tone="primary"
          show-legend
          :legend-labels="['Входящие', 'Исходящие']"
        />
      </section>

      <!-- Загрузка операторов -->
      <section class="card dashboard__agents">
        <header class="card__head">
          <h2 class="card__title">
            Операторы
          </h2>
          <RouterLink
            to="/analytics"
            class="card__link"
          >
            Вся аналитика
          </RouterLink>
        </header>

        <BaseSkeleton
          v-if="analytics.isLoading && !analytics.agents.length"
          :rows="4"
        />
        <BaseEmpty
          v-else-if="analytics.agents.length === 0"
          title="Нет операторов"
          icon="👥"
        />
        <ul
          v-else
          class="agent-list"
        >
          <li
            v-for="agent in analytics.agents.slice(0, 5)"
            :key="agent.agentId"
            class="agent-list__row"
          >
            <BaseAvatar
              :name="agent.agentName"
              :color="agent.avatarColor"
              size="sm"
            />
            <div class="agent-list__info">
              <span class="agent-list__name">{{ agent.agentName }}</span>
              <span class="agent-list__meta">{{ formatNumber(agent.totalCalls) }} звонков</span>
            </div>
            <div class="agent-list__rate">
              <span class="agent-list__rate-value">{{ formatRatePercent(agent.answerRate) }}</span>
              <span class="agent-list__rate-label">отвечено</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div class="dashboard__grid">
      <!-- Последние звонки -->
      <section class="card dashboard__calls">
        <header class="card__head">
          <h2 class="card__title">
            Последние звонки
          </h2>
          <RouterLink
            to="/calls"
            class="card__link"
          >
            Весь журнал
          </RouterLink>
        </header>

        <BaseSkeleton
          v-if="callsStore.isLoading && !recentCalls.length"
          :rows="5"
        />
        <BaseEmpty
          v-else-if="recentCalls.length === 0"
          title="Звонков пока нет"
          icon="📞"
        />
        <ul
          v-else
          class="call-list"
        >
          <li
            v-for="call in recentCalls"
            :key="call.id"
            class="call-list__row"
          >
            <span
              class="call-list__direction"
              :class="`call-list__direction--${call.direction}`"
            >
              <AppIcon
                :name="call.direction === 'inbound' ? 'phone-incoming' : 'phone-outgoing'"
                :size="16"
              />
            </span>
            <div class="call-list__info">
              <span class="call-list__name">
                {{ call.contactName ?? call.phoneNumber }}
              </span>
              <span class="call-list__meta">
                {{ callDirectionLabels[call.direction].label }} ·
                {{ formatRelative(call.startedAt) }}
              </span>
            </div>
            <BaseBadge :tone="statusInfo(callStatusLabels, call.status).tone">
              {{ statusInfo(callStatusLabels, call.status).label }}
            </BaseBadge>
            <span class="call-list__duration">{{ formatDuration(call.durationSec) }}</span>
          </li>
        </ul>
      </section>

      <!-- Лента событий -->
      <section class="card dashboard__activity">
        <header class="card__head">
          <h2 class="card__title">
            Лента событий
          </h2>
          <BaseBadge tone="info">
            realtime-лог
          </BaseBadge>
        </header>

        <BaseSkeleton
          v-if="analytics.isLoading && !analytics.recentActivity.length"
          :rows="5"
        />
        <BaseEmpty
          v-else-if="analytics.recentActivity.length === 0"
          title="Событий нет"
          icon="📋"
        />
        <ul
          v-else
          class="activity-feed"
        >
          <li
            v-for="entry in analytics.recentActivity.slice(0, 7)"
            :key="entry.id"
            class="activity-feed__item"
          >
            <span class="activity-feed__dot" />
            <div class="activity-feed__body">
              <span class="activity-feed__action">{{ entry.action }}</span>
              <span class="activity-feed__time">{{ formatDateTime(entry.createdAt) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  gap: $space-6;

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $space-4;

    @include down('lg') {
      grid-template-columns: repeat(2, 1fr);
    }

    @include down('sm') {
      grid-template-columns: 1fr;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: $space-4;

    @include down('lg') {
      grid-template-columns: 1fr;
    }
  }

  &__chart-skeleton {
    padding: $space-4 0;
  }
}

.card {
  @include card;
  padding: $space-5;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $space-4;
    gap: $space-3;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__link {
    font-size: $font-size-sm;
    color: $color-primary-600;
    font-weight: $font-weight-medium;

    &:hover {
      text-decoration: underline;
    }
  }
}

.agent-list {
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-3 0;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
    }
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: $font-weight-medium;
    color: $color-text;
    @include truncate;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__rate {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__rate-value {
    font-weight: $font-weight-semibold;
    color: $color-success-600;
  }

  &__rate-label {
    font-size: 10px;
    color: $color-text-subtle;
  }
}

.call-list {
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-3 0;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
    }
  }

  &__direction {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: $radius-full;
    flex-shrink: 0;

    &--inbound {
      background: $color-info-50;
      color: $color-info-600;
    }

    &--outbound {
      background: $color-neutral-100;
      color: $color-neutral-600;
    }
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: $font-weight-medium;
    color: $color-text;
    @include truncate;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__duration {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-variant-numeric: tabular-nums;
    min-width: 48px;
    text-align: right;
  }
}

.activity-feed {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__item {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
  }

  &__dot {
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: $radius-full;
    background: $color-primary-500;
    flex-shrink: 0;
  }

  &__body {
    display: flex;
    flex-direction: column;
  }

  &__action {
    font-size: $font-size-sm;
    color: $color-text;
  }

  &__time {
    font-size: $font-size-xs;
    color: $color-text-subtle;
  }
}
</style>
