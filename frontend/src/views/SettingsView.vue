<script setup lang="ts">
import { onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatRatePercent } from '@/utils/format';
import { userRoleLabels, userStatusLabels, statusInfo } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import BaseAvatar from '@/components/ui/BaseAvatar.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Настройки — здесь показаны профиль текущего пользователя и справочная
 * информация о системе. Настоящее редактирование профиля и смена пароля
 * вынесены в отдельную логику (backend поддерживает POST /users/me/password),
 * но для демо достаточно наглядного отображения и сводки.
 */
const auth = useAuthStore();
const analytics = useAnalyticsStore();

onMounted(() => {
  // Сводку по системе подтягиваем, если её ещё нет.
  if (!analytics.dashboard) {
    void analytics.fetchDashboard();
  }
});
</script>

<template>
  <div class="settings-view">
    <PageHeader
      title="Настройки"
      description="Профиль и информация о системе"
    />

    <!-- Профиль пользователя -->
    <section class="settings-card">
      <h2 class="settings-card__title">
        Ваш профиль
      </h2>

      <div
        v-if="auth.user"
        class="profile"
      >
        <BaseAvatar
          :name="auth.user.fullName"
          :color="auth.user.avatarColor"
          size="lg"
        />
        <div class="profile__info">
          <div class="profile__name">
            {{ auth.user.fullName }}
          </div>
          <div class="profile__email">
            {{ auth.user.email }}
          </div>
          <div class="profile__badges">
            <BaseBadge tone="info">
              {{ userRoleLabels[auth.user.role] }}
            </BaseBadge>
            <BaseBadge
              :tone="statusInfo(userStatusLabels, auth.user.status).tone"
              dot
            >
              {{ statusInfo(userStatusLabels, auth.user.status).label }}
            </BaseBadge>
          </div>
        </div>
      </div>

      <dl class="meta-list">
        <div class="meta-list__row">
          <dt>Идентификатор</dt>
          <dd>#{{ auth.user?.id }}</dd>
        </div>
        <div class="meta-list__row">
          <dt>Роль</dt>
          <dd>{{ auth.user ? userRoleLabels[auth.user.role] : '—' }}</dd>
        </div>
        <div class="meta-list__row">
          <dt>Права управления</dt>
          <dd>{{ auth.canManage ? 'Есть' : 'Только просмотр' }}</dd>
        </div>
      </dl>
    </section>

    <!-- Сводка по системе -->
    <section
      v-if="analytics.dashboard"
      class="settings-section"
    >
      <h2 class="settings-card__title">
        Система в цифрах
      </h2>
      <div class="stats">
        <StatCard
          label="Операторов в команде"
          :value="formatNumber(analytics.agents.length)"
          icon="users"
          tone="primary"
        />
        <StatCard
          label="Активных очередей"
          :value="formatNumber(analytics.queues.filter((q) => q.isActive).length)"
          icon="layers"
          tone="info"
        />
        <StatCard
          label="Звонков за период"
          :value="formatNumber(analytics.agents.reduce((sum, a) => sum + a.totalCalls, 0))"
          icon="phone"
          tone="success"
        />
        <StatCard
          label="Средний дозвон"
          :value="
            formatRatePercent(
              analytics.agents.length
                ? analytics.agents.reduce((s, a) => s + a.answerRate, 0) / analytics.agents.length
                : 0,
            )
          "
          icon="target"
          tone="warning"
        />
      </div>
    </section>

    <!-- О платформе -->
    <section class="settings-card">
      <h2 class="settings-card__title">
        О платформе
      </h2>
      <div class="about">
        <div class="about__brand">
          <span class="about__logo"><AppIcon
            name="headset"
            :size="22"
          /></span>
          <div>
            <div class="about__name">
              VoxDesk
            </div>
            <div class="about__version">
              Облачная АТС и колл-центр · демо-версия
            </div>
          </div>
        </div>
        <p class="about__text">
          Учебный fullstack-проект: Vue 3 + TypeScript на фронтенде и
          Node.js + Express + SQLite на бэкенде. Реализованы аутентификация по JWT,
          управление очередями, журнал звонков, контакты и аналитика. Проект
          спроектирован так, чтобы его можно было расширять без переписывания.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.settings-view {
  display: flex;
  flex-direction: column;
  gap: $space-5;
  max-width: 900px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.settings-card {
  @include card;
  padding: $space-5;

  &__title {
    margin-bottom: $space-4;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
  }
}

.profile {
  display: flex;
  align-items: center;
  gap: $space-4;
  padding-bottom: $space-4;
  margin-bottom: $space-4;
  border-bottom: 1px solid $color-border;

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &__email {
    margin-bottom: $space-2;
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__badges {
    display: flex;
    gap: $space-2;
  }
}

.meta-list {
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-3 0;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    dt {
      font-size: $font-size-sm;
      color: $color-text-muted;
    }

    dd {
      font-weight: $font-weight-medium;
    }
  }
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $space-4;

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}

.about {
  &__brand {
    display: flex;
    align-items: center;
    gap: $space-3;
    margin-bottom: $space-4;
  }

  &__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    color: $color-text-inverse;
    background: $color-primary-600;
    border-radius: $radius-lg;
  }

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &__version {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__text {
    font-size: $font-size-sm;
    line-height: $line-height-relaxed;
    color: $color-text-muted;
  }
}
</style>
