<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';
import { ApiError } from '@/api';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

/**
 * Страница регистрации.
 *
 * Регистрация в этом демо создаёт оператора (роль `agent`) — так задумано на
 * бэкенде в целях безопасности: повышать права до администратора должен только
 * существующий администратор через раздел «Команда». Здесь это объясняем
 * пользователю, чтобы не было вопросов «почему я не админ».
 */

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const form = reactive({
  fullName: '',
  email: '',
  password: '',
});

const fieldErrors = reactive<{
  fullName: string | null;
  email: string | null;
  password: string | null;
}>({
  fullName: null,
  email: null,
  password: null,
});

const submitting = ref(false);

function validate(): boolean {
  fieldErrors.fullName = null;
  fieldErrors.email = null;
  fieldErrors.password = null;

  if (form.fullName.trim().length < 2) {
    fieldErrors.fullName = 'Имя должно быть не короче 2 символов';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    fieldErrors.email = 'Введите корректный e-mail';
  }
  if (form.password.length < 8) {
    fieldErrors.password = 'Пароль должен быть не короче 8 символов';
  }

  return !fieldErrors.fullName && !fieldErrors.email && !fieldErrors.password;
}

function applyApiError(err: unknown): void {
  if (err instanceof ApiError) {
    if (err.details && typeof err.details === 'object') {
      const details = err.details as Record<string, string[]>;
      if (details.fullName?.[0]) fieldErrors.fullName = details.fullName[0];
      if (details.email?.[0]) fieldErrors.email = details.email[0];
      if (details.password?.[0]) fieldErrors.password = details.password[0];
    }
    toast.error('Не удалось зарегистрироваться', err.message);
    return;
  }
  toast.error('Не удалось зарегистрироваться', 'Попробуйте ещё раз чуть позже');
}

async function onSubmit(): Promise<void> {
  if (submitting.value || !validate()) return;

  submitting.value = true;
  try {
    await auth.register({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    toast.success('Аккаунт создан', 'Добро пожаловать в VoxDesk!');
    await router.push('/');
  } catch (err) {
    applyApiError(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-form">
    <header class="auth-form__head">
      <h1 class="auth-form__title">
        Создание аккаунта
      </h1>
      <p class="auth-form__subtitle">
        Новые пользователи получают роль «Оператор». Повысить права может администратор.
      </p>
    </header>

    <form
      class="auth-form__body"
      novalidate
      @submit.prevent="onSubmit"
    >
      <BaseInput
        v-model="form.fullName"
        label="Имя и фамилия"
        placeholder="Иван Петров"
        autocomplete="name"
        :error="fieldErrors.fullName"
        required
      />
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
        placeholder="Минимум 8 символов"
        autocomplete="new-password"
        :error="fieldErrors.password"
        hint="Используйте буквы разного регистра и цифры"
        required
      />

      <BaseButton
        type="submit"
        block
        :loading="submitting"
      >
        {{ submitting ? 'Создаём аккаунт…' : 'Зарегистрироваться' }}
      </BaseButton>
    </form>

    <p class="auth-form__footer">
      Уже есть аккаунт?
      <RouterLink to="/login">
        Войти
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
    font-size: $font-size-sm;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $space-4;
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
