<script setup lang="ts">
/**
 * Заглушка для пустых списков и отсутствующих данных.
 *
 * Разные состояния интерфейса (пусто / ошибка / загрузка) — то, о чём часто
 * забывают. Отдельный компонент заставляет задуматься о «пустом» состоянии
 * каждой таблицы: пользователь должен видеть объяснение, а не пустой экран.
 */

interface Props {
  title: string;
  description?: string;
  /** Глиф-иконка сверху. По умолчанию — нейтральный. */
  icon?: string;
  /** Вариант для ошибок — красноватая иконка. */
  variant?: 'default' | 'error';
}

withDefaults(defineProps<Props>(), {
  icon: '📭',
  variant: 'default',
});
</script>

<template>
  <div
    class="empty"
    :class="{ 'empty--error': variant === 'error' }"
    role="status"
  >
    <span
      class="empty__icon"
      aria-hidden="true"
    >{{ icon }}</span>
    <h3 class="empty__title">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="empty__description"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.default"
      class="empty__action"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: $space-12 $space-6;
  gap: $space-2;

  &__icon {
    font-size: 40px;
    line-height: 1;
    margin-bottom: $space-2;
    opacity: 0.9;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__description {
    font-size: $font-size-sm;
    color: $color-text-muted;
    max-width: 420px;
  }

  &__action {
    margin-top: $space-3;
  }

  &--error &__icon {
    filter: hue-rotate(-40deg);
  }
}
</style>
