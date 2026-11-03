<script setup lang="ts">
import { computed } from 'vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { confirmState, resolveConfirm } from '@/composables/useConfirm';

/**
 * Диалог подтверждения. Подключён один раз в App.vue и слушает общий сервис
 * useConfirm — конкретные страницы просто вызывают confirm(...).
 */

const isOpen = computed({
  get: () => confirmState.value !== null,
  set: (value: boolean) => {
    if (!value) resolveConfirm(false);
  },
});
</script>

<template>
  <BaseModal
    v-model="isOpen"
    :title="confirmState?.title"
    size="sm"
  >
    <p class="confirm__message">
      {{ confirmState?.message ?? 'Это действие нельзя отменить.' }}
    </p>

    <template #footer>
      <BaseButton
        variant="secondary"
        @click="resolveConfirm(false)"
      >
        {{ confirmState?.cancelLabel ?? 'Отмена' }}
      </BaseButton>
      <BaseButton
        :variant="confirmState?.danger ? 'danger' : 'primary'"
        @click="resolveConfirm(true)"
      >
        {{ confirmState?.confirmLabel ?? 'Подтвердить' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.confirm__message {
  color: $color-text-muted;
  line-height: $line-height-relaxed;
}
</style>
