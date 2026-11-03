<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppTopbar from '@/components/layout/AppTopbar.vue';

/**
 * Основной макет приложения: постоянное боковое меню + верхняя панель,
 * а в центре — контент текущего раздела через <slot />.
 *
 * Почему макет отдельным компонентом: у нас есть ещё «auth»-макет для
 * страниц входа/регистрации (без меню). Оболочка выбирается в App.vue по
 * meta.layout маршрута — страницы остаются «чистыми», без верстки каркаса.
 */
</script>

<template>
  <div class="app-layout">
    <AppSidebar class="app-layout__sidebar" />

    <div class="app-layout__main">
      <AppTopbar />

      <main
        id="main-content"
        class="app-layout__content"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.app-layout {
  display: flex;
  min-height: 100vh;
  background: $color-bg;

  &__sidebar {
    flex-shrink: 0;
    position: sticky;
    top: 0;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__content {
    flex: 1;
    padding: $space-6;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;

    @include down(md) {
      padding: $space-4;
    }
  }
}
</style>
