<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Боковое меню приложения.
 *
 * Пункты меню описаны данными ({ path, label, icon, roles }), а не разметкой —
 * чтобы добавить раздел, достаточно дописать строчку. Пункты с ограничением по
 * ролям скрываются у тех, кому не положены: супервайзерские разделы оператор
 * просто не видит, а не получает 403.
 */

const auth = useAuthStore();
const route = useRoute();

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  /** Если задано — пункт виден только перечисленным ролям. */
  roles?: Array<'admin' | 'supervisor' | 'agent'>;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

const groups: MenuGroup[] = [
  {
    items: [
      { path: '/', label: 'Дашборд', icon: 'grid' },
      { path: '/calls', label: 'Звонки', icon: 'phone' },
      { path: '/contacts', label: 'Контакты', icon: 'users' },
    ],
  },
  {
    title: 'Управление',
    items: [
      { path: '/queues', label: 'Очереди', icon: 'layers', roles: ['admin', 'supervisor'] },
      { path: '/team', label: 'Команда', icon: 'user-cog', roles: ['admin', 'supervisor'] },
      { path: '/analytics', label: 'Аналитика', icon: 'chart', roles: ['admin', 'supervisor'] },
    ],
  },
  {
    title: 'Аккаунт',
    items: [{ path: '/settings', label: 'Настройки', icon: 'settings' }],
  },
];

/** Оставляем только группы, где есть хотя бы один доступный пункт. */
const visibleGroups = computed(() =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (auth.role && item.roles.includes(auth.role))),
    }))
    .filter((group) => group.items.length > 0),
);

function isActive(path: string): boolean {
  // «/» активен только при точном совпадении, остальные — по префиксу.
  return path === '/' ? route.path === '/' : route.path.startsWith(path);
}
</script>

<template>
  <aside class="sidebar">
    <RouterLink
      to="/"
      class="sidebar__brand"
    >
      <span class="sidebar__logo">
        <AppIcon
          name="headset"
          :size="20"
        />
      </span>
      <span class="sidebar__brand-text">
        <strong>VoxDesk</strong>
        <small>облачная АТС</small>
      </span>
    </RouterLink>

    <nav
      class="sidebar__nav"
      aria-label="Основная навигация"
    >
      <div
        v-for="(group, index) in visibleGroups"
        :key="index"
        class="sidebar__group"
      >
        <p
          v-if="group.title"
          class="sidebar__group-title"
        >
          {{ group.title }}
        </p>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': isActive(item.path) }"
        >
          <AppIcon
            :name="item.icon"
            :size="18"
          />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="sidebar__footer">
      <p class="sidebar__version">
        Демо-версия · v1.0
      </p>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.sidebar {
  display: flex;
  flex-direction: column;
  width: $sidebar-width;
  height: 100vh;
  padding: $space-4 $space-3;
  background: $color-neutral-900;
  color: $color-neutral-300;

  &__brand {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-2 $space-3;
    margin-bottom: $space-5;
    color: $color-neutral-0;
  }

  &__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: $color-primary-600;
    border-radius: $radius-md;
    color: $color-neutral-0;
  }

  &__brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;

    strong {
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
    }

    small {
      font-size: $font-size-xs;
      color: $color-neutral-400;
    }
  }

  &__nav {
    flex: 1;
    overflow-y: auto;
    @include custom-scrollbar;
  }

  &__group {
    margin-bottom: $space-4;
  }

  &__group-title {
    padding: 0 $space-3;
    margin-bottom: $space-2;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $color-neutral-500;
  }

  &__link {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-2 $space-3;
    margin-bottom: 2px;
    font-size: $font-size-base;
    color: $color-neutral-300;
    border-radius: $radius-md;
    transition:
      background-color $transition-fast,
      color $transition-fast;

    &:hover {
      background: $color-neutral-800;
      color: $color-neutral-0;
    }

    &--active {
      background: $color-primary-600;
      color: $color-neutral-0;
      font-weight: $font-weight-medium;

      &:hover {
        background: $color-primary-600;
      }
    }
  }

  &__footer {
    padding: $space-3;
    border-top: 1px solid $color-neutral-800;
  }

  &__version {
    font-size: $font-size-xs;
    color: $color-neutral-500;
  }
}
</style>
