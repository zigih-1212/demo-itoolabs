<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useContactsStore } from '@/stores/contacts.store';
import { useToastStore } from '@/stores/toast.store';
import { useAuthStore } from '@/stores/auth.store';
import { confirm } from '@/composables/useConfirm';
import type { Contact, ContactPayload, ContactSort } from '@/api';
import { ApiError } from '@/api';
import { formatPhone, formatDate } from '@/utils/format';
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
 * Справочник контактов (клиентов).
 *
 * CRUD-экран: список с поиском, фильтром по тегу и сортировкой; форма создания
 * и редактирования в модалке; удаление с подтверждением.
 *
 * Права: менять контакты (создавать/редактировать/удалять) могут только
 * администратор и супервайзер — оператору кнопки не показываем (сервер,
 * разумеется, тоже проверяет — UI лишь честно отражает возможности роли).
 */

const contacts = useContactsStore();
const toast = useToastStore();
const auth = useAuthStore();

const canManage = computed(() => auth.canManage);

/* --------------------------------- Поиск --------------------------------- */

const searchInput = ref(contacts.filters.search);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    contacts.setFilter({ search: value });
    void contacts.fetchList();
  }, 350);
});

const sortOptions = [
  { value: 'created', label: 'Сначала новые' },
  { value: 'name', label: 'По имени' },
  { value: 'company', label: 'По компании' },
];

/** Собираем все уникальные теги из загруженных контактов — для фильтра. */
const tagOptions = computed(() => {
  const set = new Set<string>();
  contacts.items.forEach((c) => c.tags.forEach((t) => set.add(t)));
  return [
    { value: '', label: 'Все теги' },
    ...[...set].sort().map((tag) => ({ value: tag, label: tag })),
  ];
});

onMounted(() => {
  void contacts.fetchList();
});

function changePage(page: number): void {
  contacts.setPage(page);
  void contacts.fetchList();
}

/* ------------------------------ Модалка CRUD ------------------------------ */

const isModalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number | null>(null);
const tagsInput = ref('');

const form = reactive<ContactPayload>({
  fullName: '',
  phone: '',
  email: '',
  company: '',
  tags: [],
  notes: '',
});

const isEditing = computed(() => editingId.value !== null);

function openCreate(): void {
  resetForm();
  isModalOpen.value = true;
}

function openEdit(contact: Contact): void {
  editingId.value = contact.id;
  form.fullName = contact.fullName;
  form.phone = contact.phone;
  form.email = contact.email ?? '';
  form.company = contact.company ?? '';
  form.tags = [...contact.tags];
  form.notes = contact.notes ?? '';
  tagsInput.value = contact.tags.join(', ');
  isModalOpen.value = true;
}

function resetForm(): void {
  editingId.value = null;
  form.fullName = '';
  form.phone = '';
  form.email = '';
  form.company = '';
  form.tags = [];
  form.notes = '';
  tagsInput.value = '';
}

/**
 * Теги вводим одной строкой через запятую — проще для пользователя, чем
 * отдельный «конструктор тегов». Разбиваем, чистим пробелы и пустые значения.
 */
function parseTagsInput(): void {
  form.tags = tagsInput.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function submit(): Promise<void> {
  parseTagsInput();

  if (!form.fullName.trim() || !form.phone.trim()) {
    toast.error('Проверьте форму', 'Имя и телефон обязательны');
    return;
  }

  const payload: ContactPayload = {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    email: form.email?.trim() || undefined,
    company: form.company?.trim() || undefined,
    tags: form.tags,
    notes: form.notes?.trim() || undefined,
  };

  submitting.value = true;
  try {
    if (isEditing.value && editingId.value !== null) {
      await contacts.update(editingId.value, payload);
      toast.success('Контакт обновлён');
    } else {
      await contacts.create(payload);
      toast.success('Контакт добавлен');
    }
    isModalOpen.value = false;
  } catch (err) {
    // Конфликт по номеру телефона — самая частая ошибка, подсказываем явно.
    if (err instanceof ApiError && err.status === 409) {
      toast.error('Дубликат', 'Контакт с таким номером уже существует');
    } else {
      toast.error('Не удалось сохранить', err instanceof Error ? err.message : 'Ошибка');
    }
  } finally {
    submitting.value = false;
  }
}

async function removeContact(contact: Contact): Promise<void> {
  const confirmed = await confirm({
    title: 'Удалить контакт?',
    message: `Контакт «${contact.fullName}» будет удалён безвозвратно.`,
    confirmLabel: 'Удалить',
    danger: true,
  });

  if (!confirmed) return;

  try {
    await contacts.remove(contact.id);
    toast.success('Контакт удалён');
  } catch (err) {
    toast.error('Не удалось удалить', err instanceof Error ? err.message : 'Ошибка');
  }
}
</script>

<template>
  <div class="contacts-view">
    <PageHeader
      title="Контакты"
      description="Клиенты и их контактные данные"
    >
      <template #actions>
        <BaseButton
          v-if="canManage"
          @click="openCreate"
        >
          <AppIcon
            name="plus"
            :size="16"
          />
          Добавить контакт
        </BaseButton>
      </template>
    </PageHeader>

    <section class="filters">
      <div class="filters__search">
        <BaseInput
          v-model="searchInput"
          type="search"
          placeholder="Поиск по имени, телефону, компании"
          icon="🔍"
        />
      </div>
      <BaseSelect
        :model-value="contacts.filters.tag"
        :options="tagOptions"
        @update:model-value="
          (v) => {
            contacts.setFilter({ tag: String(v) });
            void contacts.fetchList();
          }
        "
      />
      <BaseSelect
        :model-value="contacts.filters.sort"
        :options="sortOptions"
        @update:model-value="
          (v) => {
            contacts.setFilter({ sort: String(v) as ContactSort });
            void contacts.fetchList();
          }
        "
      />
    </section>

    <section class="table-wrap">
      <BaseSkeleton
        v-if="contacts.isLoading && !contacts.items.length"
        :rows="6"
      />

      <BaseEmpty
        v-else-if="!contacts.isLoading && contacts.items.length === 0"
        title="Контактов нет"
        description="Добавьте первый контакт, чтобы он появился здесь"
        icon="👥"
      >
        <BaseButton
          v-if="canManage"
          variant="secondary"
          @click="openCreate"
        >
          Добавить контакт
        </BaseButton>
      </BaseEmpty>

      <table
        v-else
        class="data-table"
      >
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Телефон</th>
            <th>Компания</th>
            <th>Теги</th>
            <th>Добавлен</th>
            <th
              v-if="canManage"
              class="data-table__actions"
            />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="contact in contacts.items"
            :key="contact.id"
            class="data-table__row"
          >
            <td>
              <div class="cell-person">
                <BaseAvatar
                  :name="contact.fullName"
                  size="sm"
                />
                <div>
                  <div class="cell-main">
                    {{ contact.fullName }}
                  </div>
                  <div
                    v-if="contact.email"
                    class="cell-sub"
                  >
                    {{ contact.email }}
                  </div>
                </div>
              </div>
            </td>
            <td class="cell-phone">
              {{ formatPhone(contact.phone) }}
            </td>
            <td>{{ contact.company ?? '—' }}</td>
            <td>
              <div class="tags">
                <BaseBadge
                  v-for="tag in contact.tags"
                  :key="tag"
                  tone="info"
                  size="sm"
                >
                  {{ tag }}
                </BaseBadge>
                <span
                  v-if="!contact.tags.length"
                  class="cell-sub"
                >—</span>
              </div>
            </td>
            <td class="cell-sub">
              {{ formatDate(contact.createdAt) }}
            </td>
            <td
              v-if="canManage"
              class="data-table__actions"
            >
              <button
                class="icon-btn"
                title="Редактировать"
                @click="openEdit(contact)"
              >
                <AppIcon
                  name="edit"
                  :size="16"
                />
              </button>
              <button
                class="icon-btn icon-btn--danger"
                title="Удалить"
                @click="removeContact(contact)"
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
        v-if="contacts.items.length"
        class="table-footer"
      >
        <span class="table-footer__count">Всего: <strong>{{ contacts.total }}</strong></span>
        <BasePagination
          :page="contacts.filters.page"
          :pages="contacts.meta?.pages ?? 1"
          @change="changePage"
        />
      </footer>
    </section>

    <BaseModal
      v-model="isModalOpen"
      :title="isEditing ? 'Редактировать контакт' : 'Новый контакт'"
      size="md"
    >
      <div class="form-grid">
        <BaseInput
          v-model="form.fullName"
          label="Имя и фамилия"
          required
          placeholder="Иван Петров"
        />
        <BaseInput
          v-model="form.phone"
          label="Телефон"
          required
          placeholder="+7 (999) 123-45-67"
        />
        <BaseInput
          v-model="form.email"
          type="email"
          label="E-mail"
          placeholder="client@example.com"
        />
        <BaseInput
          v-model="form.company"
          label="Компания"
          placeholder="ООО «Ромашка»"
        />
        <BaseInput
          v-model="tagsInput"
          label="Теги"
          hint="Через запятую: vip, поставщик, должник"
          placeholder="vip, поставщик"
        />
        <BaseInput
          v-model="form.notes"
          label="Заметка"
          placeholder="Дополнительная информация"
        />
      </div>
      <template #footer>
        <BaseButton
          variant="secondary"
          @click="isModalOpen = false"
        >
          Отмена
        </BaseButton>
        <BaseButton
          :loading="submitting"
          @click="submit"
        >
          {{ isEditing ? 'Сохранить' : 'Добавить' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: $space-3;
  align-items: start;

  @include down('lg') {
    grid-template-columns: 1fr 1fr;

    .filters__search {
      grid-column: 1 / -1;
    }
  }

  @include down('sm') {
    grid-template-columns: 1fr;

    .filters__search {
      grid-column: auto;
    }
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
  font-weight: $font-weight-medium;
}

.cell-sub {
  font-size: $font-size-xs;
  color: $color-text-muted;
}

.cell-phone {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
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
