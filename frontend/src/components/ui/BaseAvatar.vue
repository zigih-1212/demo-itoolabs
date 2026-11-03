<script setup lang="ts">
import { computed } from 'vue';
import { getInitials } from '@/utils/format';
import { cx } from '@/utils/helpers';

/**
 * Аватар пользователя: инициалы на цветном фоне.
 *
 * Цвет фона берётся из поля avatarColor, которое backend подбирает для каждого
 * пользователя детерминированно по e-mail. Ничего не нужно хранить на клиенте —
 * у одного и того же человека всегда один и тот же цвет в любом месте системы.
 */

interface Props {
  name: string;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const initials = computed(() => getInitials(props.name));

/** Если цвет не пришёл — нейтральный фон, чтобы не сломать вид. */
const style = computed(() => ({
  backgroundColor: props.color || 'var(--color-neutral-400)',
}));
</script>

<template>
  <span
    :class="cx('avatar', `avatar--${size}`)"
    :style="style"
    :title="name"
  >
    <span aria-hidden="true">{{ initials }}</span>
    <span class="visually-hidden">{{ name }}</span>
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  color: $color-text-inverse;
  font-weight: $font-weight-semibold;
  flex-shrink: 0;
  user-select: none;

  &--sm {
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
  }

  &--md {
    width: 36px;
    height: 36px;
    font-size: $font-size-sm;
  }

  &--lg {
    width: 48px;
    height: 48px;
    font-size: $font-size-md;
  }
}
</style>
