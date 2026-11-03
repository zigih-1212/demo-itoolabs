<script setup lang="ts">
import { computed, useId } from 'vue';
import { cx } from '@/utils/helpers';

/**
 * Выпадающий список (select).
 *
 * Компонент-обёртка над нативным <select>: родной элемент лучше всего работает
 * с клавиатурой, мобильными устройствами и скринридерами. Мы лишь приводим его
 * к общему виду и повторяем логику label/error/hint из BaseInput.
 */

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string | number | null | undefined;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const uid = useId();
const selectId = `select-${uid}`;
const errorId = `${selectId}-error`;
const hintId = `${selectId}-hint`;

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.error) ids.push(errorId);
  if (props.hint) ids.push(hintId);
  return ids.length ? ids.join(' ') : undefined;
});

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div :class="cx('field', { 'field--error': !!error, 'field--disabled': disabled })">
    <label
      v-if="label"
      :for="selectId"
      class="field__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="field__required"
        aria-hidden="true"
      >*</span>
    </label>

    <select
      :id="selectId"
      :value="modelValue ?? ''"
      :required="required"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="describedBy"
      class="field__select"
      @change="onChange"
    >
      <option
        v-if="placeholder"
        value=""
        disabled
      >
        {{ placeholder }}
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

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

  &__select {
    width: 100%;
    height: 38px;
    padding: 0 $space-8 0 $space-3;
    background-color: $color-surface;
    border: 1px solid $color-border-strong;
    border-radius: $radius-md;
    cursor: pointer;
    transition: border-color $transition-fast;
    // Своя стрелка вместо системной — для единообразия во всех браузерах.
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right $space-3 center;
    appearance: none;
    @include focus-ring;

    &:hover:not(:disabled) {
      border-color: $color-neutral-400;
    }

    &:disabled {
      background-color: $color-neutral-100;
      cursor: not-allowed;
    }
  }

  &__hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__error {
    font-size: $font-size-xs;
    color: $color-danger-600;
  }

  &--error &__select {
    border-color: $color-danger-500;

    &:focus-visible {
      outline-color: $color-danger-500;
    }
  }
}
</style>
