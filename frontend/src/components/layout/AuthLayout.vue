<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Макет для страниц входа и регистрации.
 *
 * Делим экран на две части: слева — «витрина» продукта (на десктопе), справа —
 * форма. Так страница входа сразу рассказывает, что это за сервис, а не
 * выглядит пустым полем посреди экрана.
 */
</script>

<template>
  <div class="auth-layout">
    <!-- Левая половина: рассказ о продукте. На мобильных скрывается. -->
    <aside class="auth-layout__aside">
      <div class="auth-layout__brand">
        <span class="auth-layout__logo">
          <AppIcon
            name="headset"
            :size="24"
          />
        </span>
        <span>VoxDesk</span>
      </div>

      <div class="auth-layout__pitch">
        <h2>Облачная АТС и колл-центр для бизнеса</h2>
        <p>
          Принимайте звонки, распределяйте их по очередям и следите за нагрузкой
          операторов — всё в одном окне.
        </p>

        <ul class="auth-layout__features">
          <li>
            <AppIcon
              name="check-circle"
              :size="18"
            />
            <span>Умное распределение звонков по очередям</span>
          </li>
          <li>
            <AppIcon
              name="check-circle"
              :size="18"
            />
            <span>Журнал звонков и запись разговоров</span>
          </li>
          <li>
            <AppIcon
              name="check-circle"
              :size="18"
            />
            <span>Аналитика нагрузки и эффективности</span>
          </li>
        </ul>
      </div>

      <p class="auth-layout__footnote">
        Демонстрационный проект · © 2026 VoxDesk
      </p>
    </aside>

    <!-- Правая половина: форма. -->
    <main class="auth-layout__main">
      <div class="auth-layout__panel">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.auth-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;

  @include down(lg) {
    grid-template-columns: 1fr;
  }

  &__aside {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: $space-10;
    background: linear-gradient(160deg, $color-neutral-900, $color-primary-900);
    color: $color-neutral-0;

    @include down(lg) {
      display: none;
    }
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: $space-3;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: $color-primary-600;
    border-radius: $radius-md;
  }

  &__pitch {
    max-width: 440px;

    h2 {
      font-size: $font-size-2xl;
      line-height: 1.25;
      margin-bottom: $space-4;
    }

    p {
      color: $color-neutral-300;
      line-height: $line-height-relaxed;
      margin-bottom: $space-6;
    }
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: $space-3;

    li {
      display: flex;
      align-items: center;
      gap: $space-3;
      font-size: $font-size-base;
      color: $color-neutral-200;

      svg {
        color: $color-success-500;
      }
    }
  }

  &__footnote {
    font-size: $font-size-xs;
    color: $color-neutral-500;
  }

  &__main {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $space-6;
    background: $color-bg;
  }

  &__panel {
    width: 100%;
    max-width: 400px;
  }
}
</style>
