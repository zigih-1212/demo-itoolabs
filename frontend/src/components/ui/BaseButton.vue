<script setup lang="ts">
import { computed } from 'vue';
import { cx } from '@/utils/helpers';

/**
 * Базовая кнопка — фундаментальный элемент интерфейса.
 *
 * Почему единый компонент, а не <button class="..."> в каждом месте:
 * все кнопки получают одинаковое поведение (состояния загрузки/disabled,
 * клавиатурный фокус, размеры) и стиль. Поменять вид всех кнопок можно здесь.
 */

interface Props {
  /** Визуальный вариант: основной, второстепенный, опасный, «тихий». */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Показывает спиннер и блокирует повторные нажатия. */
  loading?: boolean;
  disabled?: boolean;
  /** Растянуть на всю ширину контейнера. */
  block?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
  type: 'button',
});

const classes = computed(() =>
  cx(
    'btn',
    `btn--${props.variant}`,
    `btn--${props.size}`,
    {
      'btn--block': props.block,
      'btn--loading': props.loading,
    },
  ),
);

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-busy="loading"
  >
    <span
      v-if="loading"
      class="btn__spinner"
      aria-hidden="true"
    />
    <span class="btn__content">
      <slot />
    </span>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  border-radius: $radius-md;
  font-weight: $font-weight-medium;
  white-space: nowrap;
  transition:
    background-color $transition-fast,
    border-color $transition-fast,
    color $transition-fast,
    box-shadow $transition-fast;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &__content {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
  }

  &--loading .btn__content {
    visibility: hidden;
  }

  &__spinner {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid currentcolor;
    border-top-color: transparent;
    border-radius: $radius-full;
    animation: spin 0.6s linear infinite;
  }

  // --- Размеры ---
  &--sm {
    height: 32px;
    padding: 0 $space-3;
    font-size: $font-size-sm;
  }

  &--md {
    height: 38px;
    padding: 0 $space-4;
    font-size: $font-size-base;
  }

  &--lg {
    height: 44px;
    padding: 0 $space-5;
    font-size: $font-size-md;
  }

  &--block {
    width: 100%;
  }

  // --- Варианты ---
  &--primary {
    background: $color-primary-600;
    color: $color-text-inverse;
    box-shadow: $shadow-sm;

    &:hover:not(:disabled) {
      background: $color-primary-700;
    }

    &:active:not(:disabled) {
      background: $color-primary-800;
    }
  }

  &--secondary {
    background: $color-surface;
    color: $color-text;
    border: 1px solid $color-border-strong;

    &:hover:not(:disabled) {
      background: $color-neutral-50;
      border-color: $color-neutral-400;
    }
  }

  &--danger {
    background: $color-danger-500;
    color: $color-text-inverse;

    &:hover:not(:disabled) {
      background: $color-danger-600;
    }
  }

  &--ghost {
    background: transparent;
    color: $color-text-muted;

    &:hover:not(:disabled) {
      background: $color-neutral-100;
      color: $color-text;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
