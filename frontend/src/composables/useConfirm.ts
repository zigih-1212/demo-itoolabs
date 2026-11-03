import { ref } from 'vue';

/**
 * Глобальный механизм подтверждения опасных действий.
 *
 * Удаление записи — необратимая операция, поэтому перед ней всегда показываем
 * диалог. Чтобы не тащить модалку с «Да/Нет» в каждую страницу, сделали единый
 * сервис: любой код вызывает `if (await confirm({...})) { ...удаляем... }`,
 * а диалог рисует один компонент ConfirmDialog, подключённый в App.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Опасное действие — кнопка подтверждения будет красной. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Текущий запрос подтверждения (один за раз — это ожидаемо для UI). */
export const confirmState = ref<ConfirmState | null>(null);

/** Запросить подтверждение. Возвращает промис с ответом пользователя. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState.value = { ...options, resolve };
  });
}

/** Вызывается компонентом диалога по кнопке или закрытию. */
export function resolveConfirm(value: boolean): void {
  confirmState.value?.resolve(value);
  confirmState.value = null;
}
