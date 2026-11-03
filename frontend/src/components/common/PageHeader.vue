<script setup lang="ts">
/**
 * Заголовок страницы: название раздела, пояснение и слот для действий справа
 * (кнопки «Добавить», фильтры и т.п.).
 *
 * Один компонент задаёт единый вид заголовков на всех страницах — иначе на
 * каждой странице он незаметно «поедет» по отступам и размеру шрифта.
 */

interface Props {
  title: string;
  description?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="page-header">
    <div class="page-header__text">
      <h2 class="page-header__title">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="page-header__description"
      >
        {{ description }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="page-header__actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  margin-bottom: $space-6;

  @include down(sm) {
    flex-direction: column;
  }

  &__text {
    min-width: 0;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__description {
    margin-top: $space-1;
    font-size: $font-size-base;
    color: $color-text-muted;
    line-height: $line-height-relaxed;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $space-2;
    flex-shrink: 0;
  }
}
</style>
