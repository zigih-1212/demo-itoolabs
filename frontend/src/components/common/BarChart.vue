<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '@/utils/format';

/**
 * Простой столбчатый график на «div-ах» (без сторонних библиотек).
 *
 * Почему без Chart.js и подобных: для демо важна лёгкость и наглядность, а
 * полноценная графическая библиотека добавила бы сотни килобайт в bundle ради
 * одной диаграммы. Здесь же столбцы — это обычные блоки с высотой в процентах,
 * которые легко стилизовать и адаптировать. Если графиков станет много —
 * заменить на библиотеку будет просто, интерфейс компонента уже абстрактный.
 */

export interface BarChartPoint {
  /** Подпись под столбцом (например, дата или час). */
  label: string;
  /** Основное значение. */
  value: number;
  /** Дополнительное значение (для сдвоенных столбцов), опционально. */
  secondary?: number;
}

interface Props {
  points: BarChartPoint[];
  /** Высота области графика. */
  height?: string;
  /** Цвет столбцов. */
  tone?: 'primary' | 'success' | 'info';
  /** Показывать легенду при использовании secondary. */
  showLegend?: boolean;
  legendLabels?: [string, string];
}

const props = withDefaults(defineProps<Props>(), {
  height: '220px',
  tone: 'primary',
  showLegend: false,
  legendLabels: () => ['Всего', ''],
});

/**
 * Максимум по значениям — база для расчёта высоты столбцов.
 * `|| 1` защищает от деления на ноль, когда все значения нулевые.
 */
const maxValue = computed(() => {
  const all = props.points.flatMap((p) => [p.value, p.secondary ?? 0]);
  return Math.max(...all, 1);
});

function barHeight(value: number): string {
  return `${Math.max((value / maxValue.value) * 100, value > 0 ? 2 : 0)}%`;
}

/** Разрежаем подписи по оси X, чтобы они не наслаивались. */
const labelStep = computed(() => Math.ceil(props.points.length / 8));
</script>

<template>
  <div class="chart">
    <div
      v-if="showLegend && legendLabels[0]"
      class="chart__legend"
    >
      <span class="chart__legend-item">
        <span
          class="chart__dot"
          :class="`chart__dot--${tone}`"
        />
        {{ legendLabels[0] }}
      </span>
      <span
        v-if="legendLabels[1]"
        class="chart__legend-item"
      >
        <span class="chart__dot chart__dot--secondary" />
        {{ legendLabels[1] }}
      </span>
    </div>

    <div
      class="chart__area"
      :style="{ height }"
    >
      <div
        v-for="(point, index) in points"
        :key="index"
        class="chart__column"
        :title="`${point.label}: ${formatNumber(point.value)}`"
      >
        <div class="chart__bars">
          <span
            class="chart__bar"
            :class="`chart__bar--${tone}`"
            :style="{ height: barHeight(point.value) }"
          />
          <span
            v-if="point.secondary !== undefined"
            class="chart__bar chart__bar--secondary"
            :style="{ height: barHeight(point.secondary) }"
          />
        </div>
        <span class="chart__label">
          {{ index % labelStep === 0 ? point.label : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.chart {
  &__legend {
    display: flex;
    align-items: center;
    gap: $space-4;
    margin-bottom: $space-4;
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__legend-item {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: $radius-sm;

    &--primary {
      background: $color-primary-600;
    }

    &--success {
      background: $color-success-500;
    }

    &--info {
      background: $color-info-500;
    }

    &--secondary {
      background: $color-neutral-300;
    }
  }

  &__area {
    display: flex;
    align-items: flex-end;
    gap: $space-1;
    padding-top: $space-2;
  }

  &__column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    min-width: 0;
  }

  &__bars {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    width: 100%;
  }

  &__bar {
    flex: 1;
    min-height: 2px;
    border-radius: $radius-sm $radius-sm 0 0;
    transition: height $transition-slow ease;

    &--primary {
      background: $color-primary-600;
    }

    &--success {
      background: $color-success-500;
    }

    &--info {
      background: $color-info-500;
    }

    &--secondary {
      background: $color-neutral-300;
    }
  }

  &__label {
    height: 18px;
    margin-top: $space-2;
    font-size: 10px;
    color: $color-text-subtle;
    white-space: nowrap;
  }
}
</style>
