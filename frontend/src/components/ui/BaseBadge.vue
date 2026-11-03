<script setup lang="ts">
import { computed } from 'vue';
import { cx } from '@/utils/helpers';
import type { Tone } from '@/utils/labels';

/**
 * Маленький цветной «бейдж» для статусов и меток.
 *
 * Тон (цвет) приходит из справочников labels.ts — единое место, где решается,
 * что, например, «Пропущен» — это красный, а «Разговор» — зелёный. Поэтому
 * цвет статуса нигде не задаётся руками, а берётся из одного источника.
 */

interface Props {
  tone?: Tone;
  /** Точка-индикатор слева от текста (для статусов присутствия). */
  dot?: boolean;
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
  dot: false,
  size: 'md',
});

const classes = computed(() => cx('badge', `badge--${props.tone}`, `badge--${props.size}`));
</script>

<template>
  <span :class="classes">
    <span
      v-if="dot"
      class="badge__dot"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.badge {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  border-radius: $radius-full;
  font-weight: $font-weight-medium;
  line-height: 1;
  white-space: nowrap;

  &--sm {
    padding: 3px $space-2;
    font-size: $font-size-xs;
  }

  &--md {
    padding: 4px $space-3;
    font-size: $font-size-xs;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: currentcolor;
  }

  // Светлый фон + насыщенный текст — мягко и читаемо на белых карточках.
  &--neutral {
    background: $color-neutral-100;
    color: $color-neutral-700;
  }

  &--info {
    background: $color-info-50;
    color: $color-info-600;
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
}
</style>
