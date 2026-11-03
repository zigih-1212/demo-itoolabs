<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

/**
 * Корневой компонент.
 *
 * Его единственная задача — выбрать оболочку (макет) под текущий маршрут и
 * отрисовать контейнер уведомлений поверх всего. Какой макет использовать,
 * решает meta.layout в настройках маршрута: 'auth' → форма входа, иначе —
 * основной каркас с меню.
 */

const route = useRoute();

const layout = computed(() => (route.meta.layout === 'auth' ? AuthLayout : DefaultLayout));
</script>

<template>
  <component :is="layout">
    <!-- Ссылка для клавиатурных пользователей: пропустить меню и перейти к сути. -->
    <a
      href="#main-content"
      class="skip-link"
    >Перейти к содержимому</a>

    <RouterView v-slot="{ Component }">
      <Transition
        name="page"
        mode="out-in"
      >
        <component :is="Component" />
      </Transition>
    </RouterView>
  </component>

  <ToastHost />
  <!-- Диалог подтверждения рисуется поверх всего и управляется сервисом useConfirm. -->
  <ConfirmDialog />
</template>

<style scoped lang="scss">
// Плавная смена страниц: короткое затухание, без «дёрганья».
.page-enter-active,
.page-leave-active {
  transition: opacity 140ms ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
