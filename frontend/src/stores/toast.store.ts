import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

/**
 * Store «всплывающих» уведомлений (toasts).
 *
 * Глобальное состояние: любой компонент может сообщить о результате операции,
 * а отрисовывается всё в одном месте (ToastHost в App.vue). Это правильная
 * альтернатива alert()/console.log — не блокирует интерфейс и выглядит уместно.
 */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  let counter = 0;

  function push(tone: ToastTone, title: string, message?: string, ttl = 4500): number {
    const id = ++counter;
    toasts.value.push({ id, tone, title, message });

    // Автоматически убираем уведомление, чтобы не копились.
    setTimeout(() => dismiss(id), ttl);

    return id;
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  const success = (title: string, message?: string) => push('success', title, message);
  const error = (title: string, message?: string) => push('error', title, message, 6000);
  const info = (title: string, message?: string) => push('info', title, message);
  const warning = (title: string, message?: string) => push('warning', title, message);

  return { toasts, push, dismiss, success, error, info, warning };
});
