<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue';

/**
 * Модальное окно.
 *
 * Реализованы ключевые требования доступности (WCAG):
 * - закрытие по Esc;
 * - блокировка скролла фона, пока окно открыто;
 * - клик по затемнению закрывает окно;
 * - role="dialog" + aria-modal, заголовок связан с окном.
 *
 * Отрисовывается через <Teleport> в body — так окно не «застревает» внутри
 * родительских контейнеров с overflow и рисуется поверх всего интерфейса.
 */

interface Props {
  modelValue: boolean;
  title?: string;
  /** Ширина окна. */
  size?: 'sm' | 'md' | 'lg';
  /** Закрывать ли по клику на фон. Для форм можно отключить, чтобы не терять данные. */
  closeOnBackdrop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnBackdrop: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function close(): void {
  emit('update:modelValue', false);
}

function onBackdrop(): void {
  if (props.closeOnBackdrop) close();
}

/** Esc закрывает окно — привычное поведение для клавиатуры. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

/**
 * Пока окно открыто — запрещаем прокрутку страницы под ним и слушаем Esc на
 * уровне окна. Слушатель на самом диалоге ненадёжен: клавиша долетит только
 * если фокус уже внутри, а сразу после открытия фокус ещё на кнопке, которая
 * окно вызвала. Снимаем и блокировку, и слушатель при закрытии/размонтировании.
 */
watch(
  () => props.modelValue,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';

    if (open) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
);

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal"
        role="presentation"
        @click.self="onBackdrop"
      >
        <div
          class="modal__panel"
          :class="`modal__panel--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header
            v-if="title || $slots.header"
            class="modal__header"
          >
            <slot name="header">
              <h2 class="modal__title">
                {{ title }}
              </h2>
            </slot>
            <button
              type="button"
              class="modal__close"
              aria-label="Закрыть"
              @click="close"
            >
              ✕
            </button>
          </header>

          <div class="modal__body">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="modal__footer"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.modal {
  position: fixed;
  inset: 0;
  z-index: $z-modal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-4;
  background: rgb(15 23 42 / 45%);
  backdrop-filter: blur(2px);

  &__panel {
    width: 100%;
    max-height: calc(100vh - #{$space-8});
    display: flex;
    flex-direction: column;
    background: $color-surface;
    border-radius: $radius-lg;
    box-shadow: $shadow-xl;
    overflow: hidden;

    &--sm {
      max-width: 420px;
    }

    &--md {
      max-width: 560px;
    }

    &--lg {
      max-width: 760px;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-4;
    padding: $space-4 $space-5;
    border-bottom: 1px solid $color-border;
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: $color-text-muted;
    border-radius: $radius-md;
    transition: background-color $transition-fast;
    @include focus-ring;

    &:hover {
      background: $color-neutral-100;
      color: $color-text;
    }
  }

  &__body {
    padding: $space-5;
    overflow-y: auto;
    @include custom-scrollbar;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: $space-3;
    padding: $space-4 $space-5;
    border-top: 1px solid $color-border;
    background: $color-neutral-50;
  }
}

// Плавное появление/исчезновение.
.modal-enter-active,
.modal-leave-active {
  transition: opacity $transition-base;

  .modal__panel {
    transition: transform $transition-base;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal__panel {
    transform: translateY(8px) scale(0.98);
  }
}
</style>
