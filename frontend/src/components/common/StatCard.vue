<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';

/**
 * Карточка-показатель для дашборда: крупное значение, подпись и опциональный
 * индикатор динамики. Такие карточки — «лицо» дашборда, поэтому вынесены в
 * отдельный компонент с единым оформлением.
 */

interface Props {
  label: string;
  value: string | number;
  /** Иконка слева от значения. */
  icon?: string;
  /** Цвет иконки-подложки. */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Изменение в процентах: положительное — вверх, отрицательное — вниз. */
  trend?: number | null;
  hint?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'primary',
  trend: null,
  loading: false,
});

const trendUp = computed(() => (props.trend ?? 0) >= 0);
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__head">
      <span
        class="stat-card__icon"
        :class="`stat-card__icon--${tone}`"
      >
        <AppIcon
          :name="icon ?? 'zap'"
          :size="18"
        />
      </span>
      <span
        v-if="trend !== null"
        class="stat-card__trend"
        :class="{ 'stat-card__trend--down': !trendUp }"
      >
        <AppIcon
          :name="trendUp ? 'trending-up' : 'trending-down'"
          :size="14"
        />
        {{ Math.abs(trend) }}%
      </span>
    </div>

    <BaseSkeleton
      v-if="loading"
      :rows="2"
    />

    <template v-else>
      <p class="stat-card__value">
        {{ value }}
      </p>
      <p class="stat-card__label">
        {{ label }}
      </p>
      <p
        v-if="hint"
        class="stat-card__hint"
      >
        {{ hint }}
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.stat-card {
  @include card;
  padding: $space-5;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $space-4;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: $radius-md;

    &--primary {
      background: $color-primary-50;
      color: $color-primary-600;
    }

    &--success {
      background: $color-success-50;
      color: $color-success-600;
    }

    &--warning {
      background: $color-warning-50;
      color: $color-warning-600;
    }

    &--danger {
      background: $color-danger-50;
      color: $color-danger-600;
    }

    &--info {
      background: $color-info-50;
      color: $color-info-600;
    }
  }

  &__trend {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-success-600;

    &--down {
      color: $color-danger-600;
    }
  }

  &__value {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    line-height: 1.1;
  }

  &__label {
    margin-top: $space-1;
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__hint {
    margin-top: $space-2;
    font-size: $font-size-xs;
    color: $color-text-subtle;
  }
}
</style>
