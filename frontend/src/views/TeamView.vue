<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useUsersStore } from '@/stores/users.store';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';
import { confirm } from '@/composables/useConfirm';
import type { User, UserRole, CreateUserPayload, UpdateUserPayload } from '@/api';
import { ApiError } from '@/api';
import { formatDate } from '@/utils/format';
import { userRoleLabels, userStatusLabels, statusInfo } from '@/utils/labels';
import PageHeader from '@/components/common/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import BasePagination from '@/components/ui/BasePagination.vue';
import BaseEmpty from '@/components/ui/BaseEmpty.vue';
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue';
import BaseAvatar from '@/components/ui/BaseAvatar.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * Управление командой операторов.
 *
 * Доступно администратору и супервайзеру. Здесь можно завести нового
 * сотрудника, сменить ему роль/статус и удалить (только админ).
 */
const users = useUsersStore();
const auth = useAuthStore();
const toast = useToastStore();

const isAdmin = computed(() => auth.isAdmin);

/* --------------------------------- Поиск --------------------------------- */

const searchInput = ref(users.filters.search);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    users.setFilter({ search: value });
    void users.fetchList();
  }, 350);
});

const roleOptions = [
  { value: '', label: 'Все роли' },
  { value: 'admin', label: 'Администратор' },
  { value: 'supervisor', label: 'Супервайзер' },
  { value: 'agent', label: 'Оператор' },
];

onMounted(() => {
  void users.fetchList();
});

function changePage(page: number): void {
  users.setPage(page);
  void users.fetchList();
}

/* --------------------------- Модалка: создание --------------------------- */

const isCreateOpen = ref(false);
const createSubmitting = ref(false);
const createForm = reactive<CreateUserPayload>({
  fullName: '',
  email: '',
  password: '',
  role: 'agent',
});

function openCreate(): void {
  createForm.fullName = '';
  createForm.email = '';
  createForm.password = '';
  createForm.role = 'agent';
  isCreateOpen.value = true;
}

async function submitCreate(): Promise<void> {
  if (!createForm.fullName.trim() || !createForm.email.trim() || createForm.password.length < 8) {
    toast.error('Проверьте форму', 'Все поля обязательны, пароль — минимум 8 символов');
    return;
  }

  createSubmitting.value = true;
  try {
    await users.create({
      fullName: createForm.fullName.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      role: createForm.role,
    });
    toast.success('Сотрудник добавлен');
    isCreateOpen.value = false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error('Конфликт', 'Пользователь с таким e-mail уже существует');
    } else {
      toast.error('Не удалось добавить', err instanceof Error ? err.message : 'Ошибка');
    }
  } finally {
    createSubmitting.value = false;
  }
}

/* --------------------------- Модалка: редактирование --------------------------- */

const isEditOpen = ref(false);
const editSubmitting = ref(false);
const editingUser = ref<User | null>(null);
const editForm = reactive<UpdateUserPayload>({
  fullName: '',
  role: 'agent',
  status: 'online',
});

function openEdit(user: User): void {
  editingUser.value = user;
  editForm.fullName = user.fullName;
  editForm.role = user.role;
  editForm.status = user.status;
  isEditOpen.value = true;
}

async function submitEdit(): Promise<void> {
  if (!editingUser.value) return;

  editSubmitting.value = true;
  try {
    await users.update(editingUser.value.id, {
      fullName: (editForm.fullName ?? '').trim(),
      role: editForm.role,
      status: editForm.status,
    });
    toast.success('Данные обновлены');
    isEditOpen.value = false;
  } catch (err) {
    toast.error('Не удалось сохранить', err instanceof Error ? err.message : 'Ошибка');
  } finally {
    editSubmitting.value = false;
  }
}

async function removeUser(user: User): Promise<void> {
  const confirmed = await confirm({
    title: 'Удалить сотрудника?',
    message: `Пользователь «${user.fullName}» потеряет доступ к системе.`,
    confirmLabel: 'Удалить',
    danger: true,
  });

  if (!confirmed) return;

  try {
    await users.remove(user.id);
    toast.success('Сотрудник удалён');
  } catch (err) {
    // 403 приходит, если админ пытается удалить сам себя — объясняем почему.
    if (err instanceof ApiError && err.status === 403) {
      toast.error('Нельзя удалить', 'Вы не можете удалить собственную учётную запись');
    } else {
      toast.error('Не удалось удалить', err instanceof Error ? err.message : 'Ошибка');
    }
  }
}

/** Роль, которую нельзя менять у самого себя (чтобы не «разжаловать» себя). */
function isSelf(user: User): boolean {
  return user.id === auth.user?.id;
}
</script>

<template>
  <div class="team-view">
    <PageHeader
      title="Команда"
      description="Операторы, супервайзеры и администраторы"
    >
      <template #actions>
        <BaseButton @click="openCreate">
          <AppIcon
            name="plus"
            :size="16"
          />
          Добавить сотрудника
        </BaseButton>
      </template>
    </PageHeader>

    <section class="filters">
      <div class="filters__search">
        <BaseInput
          v-model="searchInput"
          type="search"
          placeholder="Поиск по имени или e-mail"
          icon="🔍"
        />
      </div>
      <BaseSelect
        :model-value="users.filters.role ?? ''"
        :options="roleOptions"
        @update:model-value="
          (v) => {
            users.setFilter({ role: (v || null) as UserRole | null });
            void users.fetchList();
          }
        "
      />
    </section>

    <section class="table-wrap">
      <BaseSkeleton
        v-if="users.isLoading && !users.items.length"
        :rows="6"
      />

      <BaseEmpty
        v-else-if="!users.isLoading && users.items.length === 0"
        title="Пользователи не найдены"
        description="Измените фильтры или добавьте сотрудника"
        icon="🧑‍💼"
      />

      <table
        v-else
        class="data-table"
      >
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Роль</th>
            <th>Статус</th>
            <th>В системе с</th>
            <th class="data-table__actions" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users.items"
            :key="user.id"
            class="data-table__row"
          >
            <td>
              <div class="cell-person">
                <BaseAvatar
                  :name="user.fullName"
                  :color="user.avatarColor"
                  size="sm"
                />
                <div>
                  <div class="cell-main">
                    {{ user.fullName }}
                    <span
                      v-if="isSelf(user)"
                      class="cell-you"
                    >Это вы</span>
                  </div>
                  <div class="cell-sub">
                    {{ user.email }}
                  </div>
                </div>
              </div>
            </td>
            <td>{{ userRoleLabels[user.role] }}</td>
            <td>
              <BaseBadge
                :tone="statusInfo(userStatusLabels, user.status).tone"
                dot
              >
                {{ statusInfo(userStatusLabels, user.status).label }}
              </BaseBadge>
            </td>
            <td class="cell-sub">
              {{ formatDate(user.createdAt) }}
            </td>
            <td class="data-table__actions">
              <button
                class="icon-btn"
                title="Редактировать"
                @click="openEdit(user)"
              >
                <AppIcon
                  name="edit"
                  :size="16"
                />
              </button>
              <button
                v-if="isAdmin && !isSelf(user)"
                class="icon-btn icon-btn--danger"
                title="Удалить"
                @click="removeUser(user)"
              >
                <AppIcon
                  name="trash"
                  :size="16"
                />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <footer
        v-if="users.items.length"
        class="table-footer"
      >
        <span class="table-footer__count">Всего: <strong>{{ users.total }}</strong></span>
        <BasePagination
          :page="users.filters.page"
          :pages="users.meta?.pages ?? 1"
          @change="changePage"
        />
      </footer>
    </section>

    <!-- Создание сотрудника -->
    <BaseModal
      v-model="isCreateOpen"
      title="Новый сотрудник"
      size="md"
    >
      <div class="form-grid">
        <BaseInput
          v-model="createForm.fullName"
          label="Имя и фамилия"
          required
        />
        <BaseInput
          v-model="createForm.email"
          type="email"
          label="E-mail"
          required
        />
        <BaseInput
          v-model="createForm.password"
          type="password"
          label="Пароль"
          hint="Минимум 8 символов"
          required
        />
        <BaseSelect
          v-model="createForm.role"
          label="Роль"
          :options="[
            { value: 'agent', label: 'Оператор' },
            { value: 'supervisor', label: 'Супервайзер' },
            { value: 'admin', label: 'Администратор' },
          ]"
        />
      </div>
      <template #footer>
        <BaseButton
          variant="secondary"
          @click="isCreateOpen = false"
        >
          Отмена
        </BaseButton>
        <BaseButton
          :loading="createSubmitting"
          @click="submitCreate"
        >
          Добавить
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Редактирование сотрудника -->
    <BaseModal
      v-model="isEditOpen"
      title="Редактировать сотрудника"
      size="md"
    >
      <div class="form-grid">
        <BaseInput
          v-model="editForm.fullName"
          label="Имя и фамилия"
        />
        <BaseSelect
          v-model="editForm.role"
          label="Роль"
          :disabled="!isAdmin || (editingUser ? isSelf(editingUser) : false)"
          hint="Менять роль может только администратор"
          :options="[
            { value: 'agent', label: 'Оператор' },
            { value: 'supervisor', label: 'Супервайзер' },
            { value: 'admin', label: 'Администратор' },
          ]"
        />
        <BaseSelect
          v-model="editForm.status"
          label="Статус"
          :options="[
            { value: 'online', label: 'На линии' },
            { value: 'busy', label: 'Занят' },
            { value: 'offline', label: 'Не на линии' },
          ]"
        />
      </div>
      <template #footer>
        <BaseButton
          variant="secondary"
          @click="isEditOpen = false"
        >
          Отмена
        </BaseButton>
        <BaseButton
          :loading="editSubmitting"
          @click="submitEdit"
        >
          Сохранить
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: $space-3;
  align-items: start;

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}

.table-wrap {
  @include card;
  padding: 0;
  overflow: hidden;

  .data-table {
    padding: 0 $space-5;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: $space-3 $space-2;
    text-align: left;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $color-text-subtle;
    border-bottom: 1px solid $color-border;
  }

  td {
    padding: $space-3 $space-2;
    border-bottom: 1px solid $color-border;
    font-size: $font-size-base;
    vertical-align: middle;
  }

  &__row {
    transition: background-color $transition-fast;

    &:hover {
      background: $color-neutral-50;
    }

    &:last-child td {
      border-bottom: none;
    }
  }

  &__actions {
    width: 1%;
    white-space: nowrap;
    text-align: right;
  }
}

.cell-person {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.cell-main {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-weight: $font-weight-medium;
}

.cell-you {
  padding: 1px $space-2;
  font-size: 10px;
  font-weight: $font-weight-medium;
  color: $color-primary-700;
  background: $color-primary-50;
  border-radius: $radius-full;
}

.cell-sub {
  font-size: $font-size-xs;
  color: $color-text-muted;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: $color-text-muted;
  border-radius: $radius-md;
  transition:
    background-color $transition-fast,
    color $transition-fast;
  @include focus-ring;

  &:hover {
    background: $color-neutral-100;
    color: $color-text;
  }

  &--danger:hover {
    background: $color-danger-50;
    color: $color-danger-600;
  }
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4 $space-5;
  border-top: 1px solid $color-border;

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-4;

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}
</style>
