<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';
import { ApiError } from '@/api';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

/**
 * Страница входа.
 *
 * Логика простая: собираем e-mail и пароль, отправляем в store, при успехе
 * возвращаем пользователя туда, откуда его выкинуло (query.redirect), иначе —
 * показываем понятную ошибку. Ошибки показываем и у полей (подсветкой), и
 * тостом — так пользователю сразу понятно, что не так.
 */

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const toast = useToastStore();

const form = reactive({
  email: '',
  password: '',
});

const fieldErrors = reactive<{ email: string | null; password: string | null }>({
  email: null,
  password: null,
});

const submitting = ref(false);

function validate(): boolean {
  fieldErrors.email = null;
  fieldErrors.password = null;

  if (!form.email.trim()) {
    fieldErrors.email = 'Укажите e-mail';
  }
  if (!form.password) {
    fieldErrors.password = 'Укажите пароль';
  }

  return !fieldErrors.email && !fieldErrors.password;
}

/**
 * Приводим техническую ошибку API к человеческому сообщению.
 * Если backend прислал детали по полям — раскладываем их по полям формы.
 */
function applyApiError(err: unknown): void {
  if (err instanceof ApiError) {
    if (err.details && typeof err.details === 'object') {
      const details = err.details as Record<string, string[]>;
      if (details.email?.[0]) fieldErrors.email = details.email[0];
      if (details.password?.[0]) fieldErrors.password = details.password[0];
    }
    toast.error('Не удалось войти', err.message);
    return;
  }
  toast.error('Не удалось войти', 'Проверьте соединение и попробуйте ещё раз');
}

async function onSubmit(): Promise<void> {
  if (submitting.value || !validate()) return;

  submitting.value = true;
  try {
    await auth.login({ email: form.email.trim(), password: form.password });
    toast.success('Добро пожаловать!', `Вы вошли как ${auth.user?.fullName ?? ''}`);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.push(redirect);
  } catch (err) {
    applyApiError(err);
  } finally {
    submitting.value = false;
  }
}

/** Заполнить демо-данными для быстрого входа (удобно при показе проекта). */
function fillDemo(email: string): void {
  form.email = email;
  form.password = 'demo12345';
}
</script>

<template>
  <div class="auth-form">
    <header class="auth-form__head">
      <h1 class="auth-form__title">
        Вход в систему
      </h1>
      <p class="auth-form__subtitle">
        Введите данные своей учётной записи
      </p>
    </header>

    <form
      class="auth-form__body"
      novalidate
      @submit.prevent="onSubmit"
    >
      <BaseInput
        v-model="form.email"
        label="E-mail"
        type="email"
        placeholder="you@company.ru"
        autocomplete="email"
        :error="fieldErrors.email"
        required
      />
      <BaseInput
        v-model="form.password"
        label="Пароль"
        type="password"
        placeholder="••••••••"
        autocomplete="current-password"
        :error="fieldErrors.password"
        required
      />

      <BaseButton
        type="submit"
        block
        :loading="submitting"
      >
        {{ submitting ? 'Входим…' : 'Войти' }}
      </BaseButton>
    </form>

    <div class="auth-form__demo">
      <p class="auth-form__demo-title">
        Демо-доступы (нажмите, чтобы подставить):
      </p>
      <div class="auth-form__demo-buttons">
        <button
          type="button"
          class="auth-form__demo-btn"
          @click="fillDemo('admin@voxdesk.local')"
        >
          Администратор
        </button>
        <button
          type="button"
          class="auth-form__demo-btn"
          @click="fillDemo('supervisor@voxdesk.local')"
        >
          Супервайзер
        </button>
        <button
          type="button"
          class="auth-form__demo-btn"
          @click="fillDemo('agent1@voxdesk.local')"
        >
          Оператор
        </button>
      </div>
    </div>

    <p class="auth-form__footer">
      Нет аккаунта?
      <RouterLink to="/register">
        Зарегистрироваться
      </RouterLink>
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.auth-form {
  &__head {
    margin-bottom: $space-6;
  }

  &__title {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    color: $color-text;
  }

  &__subtitle {
    margin-top: $space-2;
    color: $color-text-muted;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__demo {
    margin-top: $space-6;
    padding: $space-4;
    background: $color-neutral-50;
    border: 1px dashed $color-border-strong;
    border-radius: $radius-md;
  }

  &__demo-title {
    font-size: $font-size-xs;
    color: $color-text-muted;
    margin-bottom: $space-3;
  }

  &__demo-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__demo-btn {
    padding: $space-1 $space-3;
    font-size: $font-size-xs;
    color: $color-primary-700;
    background: $color-primary-50;
    border-radius: $radius-sm;
    transition: background-color $transition-fast;
    @include focus-ring;

    &:hover {
      background: $color-primary-100;
    }
  }

  &__footer {
    margin-top: $space-6;
    text-align: center;
    font-size: $font-size-sm;
    color: $color-text-muted;

    a {
      color: $color-primary-600;
      font-weight: $font-weight-medium;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
