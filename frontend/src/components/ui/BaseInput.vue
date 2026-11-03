<script setup lang="ts">
import { computed, useId } from 'vue';
import { cx } from '@/utils/helpers';

/**
 * Текстовое поле ввода.
 *
 * Доступность (a11y) заложена в сам компонент: <label> связан с <input> через
 * сгенерированный id, ошибка объявляется через aria-describedby и aria-invalid,
 * а подсказка — тоже часть описания. Пользователь скринридера услышит и метку,
 * и сообщение об ошибке. Это заметно экономит время: не нужно помнить про
 * каждое поле в каждой форме.
 */

interface Props {
  modelValue: string | number | null | undefined;
  label?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'search' | 'number' | 'date';
  placeholder?: string;
  hint?: string;
  /** Текст ошибки. Если задан — поле подсвечивается красным. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  autocomplete?: string;
  /** Иконка-глиф слева (строкой), например '🔍'. */
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

const uid = useId();
const inputId = `field-${uid}`;
const errorId = `${inputId}-error`;
const hintId = `${inputId}-hint`;

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.error) ids.push(errorId);
  if (props.hint) ids.push(hintId);
  return ids.length ? ids.join(' ') : undefined;
});

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div :class="cx('field', { 'field--error': !!error, 'field--disabled': disabled })">
    <label
      v-if="label"
      :for="inputId"
      class="field__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="field__required"
        aria-hidden="true"
      >*</span>
    </label>

    <div class="field__control">
      <span
        v-if="icon"
        class="field__icon"
        aria-hidden="true"
      >{{ icon }}</span>
      <input
        :id="inputId"
        :type="type"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        class="field__input"
        @input="onInput"
        @blur="emit('blur')"
      >
    </div>

    <p
      v-if="error"
      :id="errorId"
      class="field__error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      :id="hintId"
      class="field__hint"
    >
      {{ hint }}
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.field {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-neutral-700;
  }

  &__required {
    color: $color-danger-500;
  }

  &__control {
    position: relative;
    display: flex;
    align-items: center;
  }

  &__icon {
    position: absolute;
    left: $space-3;
    font-size: $font-size-base;
    color: $color-text-subtle;
    pointer-events: none;
  }

  &__input {
    width: 100%;
    height: 38px;
    padding: 0 $space-3;
    background: $color-surface;
    border: 1px solid $color-border-strong;
    border-radius: $radius-md;
    transition:
      border-color $transition-fast,
      box-shadow $transition-fast;
    @include focus-ring;

    &::placeholder {
      color: $color-text-subtle;
    }

    &:hover:not(:disabled) {
      border-color: $color-neutral-400;
    }

    &:disabled {
      background: $color-neutral-100;
      cursor: not-allowed;
    }
  }

  // Если есть иконка — сдвигаем текст, чтобы не наезжал на неё.
  &__icon + &__input {
    padding-left: $space-10;
  }

  &__hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__error {
    font-size: $font-size-xs;
    color: $color-danger-600;
  }

  &--error &__input {
    border-color: $color-danger-500;

    &:focus-visible {
      outline-color: $color-danger-500;
    }
  }
}
</style>
