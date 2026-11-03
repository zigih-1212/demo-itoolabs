<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { userRoleLabels } from '@/utils/labels';
import BaseAvatar from '@/components/ui/BaseAvatar.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Верхняя панель: заголовок текущего раздела, меню пользователя, выход.
 *
 * Заголовок берётся из meta маршрута — не нужно дублировать его на каждой
 * странице. Меню пользователя закрывается по клику вне и по Esc — обычное
 * ожидаемое поведение, которое легко забыть реализовать.
 */

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'VoxDesk');

const isMenuOpen = ref(false);

const roleLabel = computed(() => (auth.role ? userRoleLabels[auth.role] : ''));

function toggleMenu(): void {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu(): void {
  isMenuOpen.value = false;
}

async function handleLogout(): Promise<void> {
  closeMenu();
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <h1 class="topbar__title">
        {{ pageTitle }}
      </h1>
    </div>

    <div class="topbar__right">
      <div class="dropdown">
        <button
          type="button"
          class="topbar__user"
          :aria-expanded="isMenuOpen"
          aria-haspopup="menu"
          @click="toggleMenu"
        >
          <BaseAvatar
            :name="auth.user?.fullName ?? ''"
            :color="auth.user?.avatarColor"
            size="sm"
          />
          <span class="topbar__user-info">
            <span class="topbar__user-name">{{ auth.user?.fullName }}</span>
            <span class="topbar__user-role">{{ roleLabel }}</span>
          </span>
          <AppIcon
            name="chevron-down"
            :size="14"
          />
        </button>

        <!-- Ловушка клика-вне: прозрачный слой на весь экран под меню. -->
        <div
          v-if="isMenuOpen"
          class="dropdown__backdrop"
          @click="closeMenu"
        />

        <Transition name="fade">
          <div
            v-if="isMenuOpen"
            class="dropdown__menu"
            role="menu"
          >
            <RouterLink
              to="/settings"
              class="dropdown__item"
              role="menuitem"
              @click="closeMenu"
            >
              <AppIcon
                name="settings"
                :size="16"
              />
              <span>Настройки</span>
            </RouterLink>
            <button
              type="button"
              class="dropdown__item"
              role="menuitem"
              @click="handleLogout"
            >
              <AppIcon
                name="log-out"
                :size="16"
              />
              <span>Выйти</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $topbar-height;
  padding: 0 $space-6;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  position: sticky;
  top: 0;
  z-index: $z-sticky;

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-1 $space-2;
    border-radius: $radius-md;
    transition: background-color $transition-fast;
    @include focus-ring;

    &:hover {
      background: $color-neutral-100;
    }
  }

  &__user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.25;
  }

  &__user-name {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text;
  }

  &__user-role {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }
}

.dropdown {
  position: relative;

  &__backdrop {
    position: fixed;
    inset: 0;
    z-index: $z-dropdown;
  }

  &__menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: $z-dropdown;
    min-width: 180px;
    padding: $space-1;
    background: $color-surface;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    box-shadow: $shadow-lg;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    padding: $space-2 $space-3;
    font-size: $font-size-sm;
    color: $color-text;
    text-align: left;
    border-radius: $radius-sm;
    transition: background-color $transition-fast;

    &:hover {
      background: $color-neutral-100;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity $transition-fast;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
