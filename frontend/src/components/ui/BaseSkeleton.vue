<script setup lang="ts">
/**
 * Скелетон — «мерцающая» заглушка на время загрузки данных.
 *
 * Почему не просто спиннер: скелетон показывает примерную структуру будущего
 * контента, поэтому переход к данным проходит плавно, без «прыжка» верстки.
 * Это заметная деталь качества интерфейса.
 */

interface Props {
  /** Сколько строк-заглушек отрисовать. */
  rows?: number;
  /** Высота одной строки. */
  height?: string;
  /** Круглая форма — для аватаров. */
  circle?: boolean;
}

withDefaults(defineProps<Props>(), {
  rows: 3,
  height: '16px',
  circle: false,
});
</script>

<template>
  <div
    class="skeleton"
    aria-hidden="true"
  >
    <span
      v-for="row in rows"
      :key="row"
      class="skeleton__row"
      :class="{ 'skeleton__row--circle': circle }"
      :style="{ height, width: row === rows && rows > 1 ? '60%' : '100%' }"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.skeleton {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__row {
    display: block;
    border-radius: $radius-sm;
    // Плавное «дыхание» фона вместо резкого мигания.
    background: linear-gradient(
      90deg,
      $color-neutral-100 25%,
      $color-neutral-200 37%,
      $color-neutral-100 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease infinite;

    &--circle {
      width: 40px !important;
      border-radius: $radius-full;
    }
  }
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

// Уважаем настройку «уменьшить движение».
@media (prefers-reduced-motion: reduce) {
  .skeleton__row {
    animation: none;
  }
}
</style>
