<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

/**
 * Постраничная навигация.
 *
 * Показываем «умный» диапазон страниц (1 … текущая ±1 … последняя), а не все
 * подряд — иначе при сотнях страниц панель превращается в кашу. Кнопки
 * продуманы для клавиатуры и озвучены для скринридеров.
 */

interface Props {
  page: number;
  pages: number;
  /** Сколько соседних страниц показывать слева и справа от текущей. */
  siblings?: number;
}

const props = withDefaults(defineProps<Props>(), { siblings: 1 });

const emit = defineEmits<{
  change: [page: number];
}>();

/** Список номеров и «разрывов» (null = многоточие). */
const items = computed<(number | null)[]>(() => {
  const { page, pages, siblings } = props;

  // Если страниц мало — показываем всё без разрывов.
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  const range: (number | null)[] = [];
  const left = Math.max(2, page - siblings);
  const right = Math.min(pages - 1, page + siblings);

  range.push(1);
  if (left > 2) range.push(null);
  for (let i = left; i <= right; i++) range.push(i);
  if (right < pages - 1) range.push(null);
  range.push(pages);

  return range;
});

function goTo(target: number): void {
  if (target < 1 || target > props.pages || target === props.page) return;
  emit('change', target);
}
</script>

<template>
  <nav
    v-if="pages > 1"
    class="pagination"
    aria-label="Постраничная навигация"
  >
    <button
      type="button"
      class="pagination__btn"
      :disabled="page <= 1"
      aria-label="Предыдущая страница"
      @click="goTo(page - 1)"
    >
      <AppIcon
        name="chevron-left"
        :size="16"
      />
    </button>

    <template
      v-for="(item, index) in items"
      :key="index"
    >
      <span
        v-if="item === null"
        class="pagination__gap"
        aria-hidden="true"
      >…</span>
      <button
        v-else
        type="button"
        class="pagination__btn"
        :class="{ 'pagination__btn--active': item === page }"
        :aria-current="item === page ? 'page' : undefined"
        :aria-label="`Страница ${item}`"
        @click="goTo(item)"
      >
        {{ item }}
      </button>
    </template>

    <button
      type="button"
      class="pagination__btn"
      :disabled="page >= pages"
      aria-label="Следующая страница"
      @click="goTo(page + 1)"
    >
      <AppIcon
        name="chevron-right"
        :size="16"
      />
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.pagination {
  display: flex;
  align-items: center;
  gap: $space-1;

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 34px;
    padding: 0 $space-2;
    font-size: $font-size-sm;
    color: $color-text-muted;
    border-radius: $radius-md;
    transition:
      background-color $transition-fast,
      color $transition-fast;
    @include focus-ring;

    &:hover:not(:disabled) {
      background: $color-neutral-100;
      color: $color-text;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--active {
      background: $color-primary-600;
      color: $color-text-inverse;
      font-weight: $font-weight-medium;

      &:hover {
        background: $color-primary-600;
        color: $color-text-inverse;
      }
    }
  }

  &__gap {
    padding: 0 $space-1;
    color: $color-text-subtle;
  }
}
</style>
