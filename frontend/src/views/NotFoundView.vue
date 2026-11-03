<script setup lang="ts">
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Страница 404.
 *
 * Отдельная «страница не найдена» — признак аккуратного продукта: пользователь
 * не упирается в пустой экран, а понимает, что произошло, и получает выход.
 */
const router = useRouter();
</script>

<template>
  <div class="not-found">
    <div class="not-found__code">
      404
    </div>
    <h1 class="not-found__title">
      Страница не найдена
    </h1>
    <p class="not-found__text">
      Возможно, ссылка устарела или страница была перемещена. Вернитесь на
      главную — там всё на месте.
    </p>
    <div class="not-found__actions">
      <BaseButton @click="router.push('/')">
        <AppIcon
          name="arrow-left"
          :size="16"
        />
        На главную
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="router.back()"
      >
        Назад
      </BaseButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-3;
  min-height: 60vh;
  text-align: center;

  &__code {
    font-size: 5rem;
    font-weight: $font-weight-bold;
    line-height: 1;
    color: $color-primary-600;
    letter-spacing: -0.04em;
  }

  &__title {
    font-size: $font-size-2xl;
    font-weight: $font-weight-semibold;
  }

  &__text {
    max-width: 420px;
    color: $color-text-muted;
  }

  &__actions {
    display: flex;
    gap: $space-3;
    margin-top: $space-3;
  }
}
</style>
