<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { formatDuration, formatNumber, formatRatePercent, formatDateTime } from '@/utils/format';
import { queueStrategyLabels } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import BarChart from '@/components/common/BarChart.vue';
import type { BarChartPoint } from '@/components/common/BarChart.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseAvatar from '@/components/ui/BaseAvatar.vue';
import BaseEmpty from '@/components/ui/BaseEmpty.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Аналитика колл-центра.
 *
 * Экран для руководителя: распределение звонков по часам, загрузка очередей
 * и эффективность операторов. Все данные приходят одним запросом дашборда
 * (analytics store), чтобы не дёргать сервер за каждой метрикой.
 *
 * Аналитика доступна только администраторам и супервайзерам — маршрут
 * защищён в роутере, а API проверяет роль повторно на сервере.
 */
const analytics = useAnalyticsStore();

onMounted(() => {
  void analytics.fetchDashboard();
});

/** Точки графика по часам: показываем 24 часа (0–23). */
const hourlyPoints = computed<BarChartPoint[]>(() =>
  analytics.hourly.map((point) => ({
    label: `${point.hour}:00`,
    value: point.total,
  })),
);

/** Пик нагрузки — час с максимумом звонков. Пригодится как подсказка. */
const peakHour = computed(() => {
  if (!analytics.hourly.length) return null;
  return analytics.hourly.reduce(
    (best, point) => (point.total > best.total ? point : best),
    analytics.hourly[0]!,
  );
});

/** Операторы, отсортированные по числу обработанных звонков. */
const topAgents = computed(() =>
  [...analytics.agents].sort((a, b) => b.totalCalls - a.totalCalls),
);
</script>

<template>
  <div class="analytics-view">
    <PageHeader
      title="Аналитика"
      description="Нагрузка, очереди и эффективность операторов"
    >
      <template #actions>
        <BaseButton
          variant="secondary"
          :loading="analytics.isLoading"
          @click="analytics.fetchDashboard()"
        >
          <AppIcon
            name="refresh"
            :size="16"
          />
          Обновить
        </BaseButton>
      </template>
    </PageHeader>

    <template v-if="analytics.isLoading && !analytics.dashboard">
      <BaseSkeleton :rows="8" />
    </template>

    <template v-else-if="analytics.dashboard">
      <!-- Распределение по часам -->
      <section class="analytics-card">
        <header class="analytics-card__head">
          <div>
            <h2 class="analytics-card__title">
              Звонки по часам
            </h2>
            <p class="analytics-card__sub">
              Нагрузка за сутки. Пик —
              <strong v-if="peakHour">{{ peakHour.hour }}:00 ({{ formatNumber(peakHour.total) }} звонков)</strong>
              <strong v-else>нет данных</strong>
            </p>
          </div>
        </header>
        <BaseEmpty
          v-if="!analytics.hourly.length"
          title="Нет данных о звонках"
          icon="📊"
        />
        <BarChart
          v-else
          :points="hourlyPoints"
          tone="primary"
          height="200px"
        />
      </section>

      <div class="analytics-grid">
        <!-- Загрузка очередей -->
        <section class="analytics-card">
          <header class="analytics-card__head">
            <h2 class="analytics-card__title">
              Загрузка очередей
            </h2>
          </header>

          <BaseEmpty
            v-if="!analytics.queues.length"
            title="Очередей нет"
            icon="🗂️"
          />
          <table
            v-else
            class="mini-table"
          >
            <thead>
              <tr>
                <th>Очередь</th>
                <th>Стратегия</th>
                <th class="mini-table__num">
                  Обработано
                </th>
                <th class="mini-table__num">
                  Пропущено
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="queue in analytics.queues"
                :key="queue.queueId"
              >
                <td>
                  <div class="mini-table__name">
                    {{ queue.queueName }}
                  </div>
                  <BaseBadge
                    :tone="queue.isActive ? 'success' : 'neutral'"
                    size="sm"
                  >
                    {{ queue.isActive ? 'Активна' : 'Выключена' }}
                  </BaseBadge>
                </td>
                <td class="mini-table__muted">
                  {{ queueStrategyLabels[queue.strategy] }}
                </td>
                <td class="mini-table__num">
                  {{ formatNumber(queue.completed) }}
                </td>
                <td class="mini-table__num">
                  {{ formatNumber(queue.missed) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Эффективность операторов -->
        <section class="analytics-card">
          <header class="analytics-card__head">
            <h2 class="analytics-card__title">
              Эффективность операторов
            </h2>
          </header>

          <BaseEmpty
            v-if="!topAgents.length"
            title="Нет данных об операторах"
            icon="🧑‍💼"
          />
          <ul
            v-else
            class="agent-list"
          >
            <li
              v-for="agent in topAgents"
              :key="agent.agentId"
              class="agent-list__row"
            >
              <BaseAvatar
                :name="agent.agentName"
                :color="agent.avatarColor"
                size="sm"
              />
              <div class="agent-list__info">
                <div class="agent-list__name">
                  {{ agent.agentName }}
                </div>
                <div class="agent-list__meta">
                  {{ formatNumber(agent.totalCalls) }} звонков ·
                  {{ formatDuration(agent.talkSeconds) }} в разговорах
                </div>
              </div>
              <div class="agent-list__rate">
                <span class="agent-list__percent">{{ formatRatePercent(agent.answerRate) }}</span>
                <span class="agent-list__rate-label">дозвон</span>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <!-- Лента событий -->
      <section class="analytics-card">
        <header class="analytics-card__head">
          <h2 class="analytics-card__title">
            Последние события
          </h2>
        </header>
        <BaseEmpty
          v-if="!analytics.recentActivity.length"
          title="Событий пока нет"
          icon="🕒"
        />
        <ul
          v-else
          class="activity-feed"
        >
          <li
            v-for="entry in analytics.recentActivity"
            :key="entry.id"
            class="activity-feed__item"
          >
            <span class="activity-feed__dot" />
            <span class="activity-feed__text">{{ entry.action }}</span>
            <span class="activity-feed__time">{{ formatDateTime(entry.createdAt) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <BaseEmpty
      v-else
      title="Не удалось загрузить аналитику"
      description="Попробуйте обновить данные"
      variant="error"
      icon="⚠️"
    >
      <BaseButton
        variant="secondary"
        @click="analytics.fetchDashboard()"
      >
        Обновить
      </BaseButton>
    </BaseEmpty>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.analytics-view {
  display: flex;
  flex-direction: column;
  gap: $space-5;
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-5;

  @include down('lg') {
    grid-template-columns: 1fr;
  }
}

.analytics-card {
  @include card;
  padding: $space-5;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-4;
    margin-bottom: $space-4;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
  }

  &__sub {
    margin-top: $space-1;
    font-size: $font-size-sm;
    color: $color-text-muted;

    strong {
      color: $color-text;
    }
  }
}

.mini-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: $space-2;
    text-align: left;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    color: $color-text-subtle;
    border-bottom: 1px solid $color-border;
  }

  td {
    padding: $space-3 $space-2;
    border-bottom: 1px solid $color-border;
    font-size: $font-size-sm;
  }

  tr:last-child td {
    border-bottom: none;
  }

  &__num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__name {
    margin-bottom: $space-1;
    font-weight: $font-weight-medium;
  }

  &__muted {
    color: $color-text-muted;
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
    min-width: 0;
  }

  &__name {
    font-weight: $font-weight-medium;
    @include truncate;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__rate {
    text-align: right;
  }

  &__percent {
    display: block;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-success-600;
  }

  &__rate-label {
    font-size: 10px;
    color: $color-text-subtle;
  }
}

.activity-feed {
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-2 0;
    font-size: $font-size-sm;
  }

  &__dot {
    width: 8px;
    height: 8px;
    background: $color-primary-500;
    border-radius: $radius-full;
    flex-shrink: 0;
  }

  &__text {
    flex: 1;
    min-width: 0;
    @include truncate;
  }

  &__time {
    font-size: $font-size-xs;
    color: $color-text-subtle;
    white-space: nowrap;
  }
}
</style>
