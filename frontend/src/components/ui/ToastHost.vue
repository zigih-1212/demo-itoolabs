<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store';
import AppIcon from './AppIcon.vue';
import type { ToastTone } from '@/stores/toast.store';

/**
 * Контейнер всплывающих уведомлений.
 *
 * Рисуется один раз в корне приложения и слушает стор уведомлений. Любой код в
 * приложении может вызвать `toast.success('Сохранено')`, а отобразит его этот
 * компонент. Уведомления объявлены live-регионом (aria-live), чтобы
 * скринридер озвучивал их появление.
 *
 * Телепортируем в body — чтобы уведомления были поверх всего и не обрезались
 * контейнерами со скроллом.
 */

const toast = useToastStore();

/** Иконка подбирается по тональности уведомления. */
const icons: Record<ToastTone, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-circle',
  info: 'info',
};
</script>

<template>
  <Teleport to="body">
    <div
      class="toasts"
      role="region"
      aria-label="Уведомления"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <div
          v-for="item in toast.toasts"
          :key="item.id"
          class="toast"
          :class="`toast--${item.tone}`"
        >
          <span class="toast__icon">
            <AppIcon
              :name="icons[item.tone]"
              :size="18"
            />
          </span>
          <div class="toast__body">
            <p class="toast__title">
              {{ item.title }}
            </p>
            <p
              v-if="item.message"
              class="toast__message"
            >
              {{ item.message }}
            </p>
          </div>
          <button
            type="button"
            class="toast__close"
            aria-label="Закрыть уведомление"
            @click="toast.dismiss(item.id)"
          >
            <AppIcon
              name="x"
              :size="14"
            />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.toasts {
  position: fixed;
  top: $space-4;
  right: $space-4;
  z-index: $z-toast;
  display: flex;
  flex-direction: column;
  gap: $space-3;
  max-width: 380px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: $space-3;
  padding: $space-3 $space-4;
  background: $color-surface;
  border: 1px solid $color-border;
  border-left: 3px solid $color-neutral-400;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  pointer-events: auto;

  &__icon {
    margin-top: 1px;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text;
  }

  &__message {
    margin-top: 2px;
    font-size: $font-size-xs;
    color: $color-text-muted;
    line-height: $line-height-relaxed;
  }

  &__close {
    flex-shrink: 0;
    color: $color-text-subtle;
    border-radius: $radius-sm;
    transition: color $transition-fast;

    &:hover {
      color: $color-text;
    }
  }

  // Цвет боковой полосы и иконки — по тональности.
  &--success {
    border-left-color: $color-success-500;

    .toast__icon {
      color: $color-success-500;
    }
  }

  &--error {
    border-left-color: $color-danger-500;

    .toast__icon {
      color: $color-danger-500;
    }
  }

  &--warning {
    border-left-color: $color-warning-500;

    .toast__icon {
      color: $color-warning-500;
    }
  }

  &--info {
    border-left-color: $color-info-500;

    .toast__icon {
      color: $color-info-500;
    }
  }
}

// Анимация выезда справа.
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity $transition-base,
    transform $transition-base;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.toast-move {
  transition: transform $transition-base;
}
</style>
