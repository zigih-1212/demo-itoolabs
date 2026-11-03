/**
 * Форматирование значений для интерфейса.
 *
 * Почему отдельный модуль: формат одного и того же значения должен совпадать
 * везде — в таблице, в карточке, в экспорте. Дублирование логики форматирования
 * неизбежно приводит к расхождениям («в одном месте 01:05, в другом 65 сек»).
 */

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

/** Дополняет число нулём слева: 5 → «05». */
function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Форматирует длительность в секундах как «1:05» или «1:02:30».
 * В АТС принято показывать именно таймкод разговора, а не «65 секунд».
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '—';

  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;

  return `${minutes}:${pad(rest)}`;
}

/**
 * Человекочитаемая длительность: «2 мин 15 сек».
 * Удобно для крупных агрегатов (суммарное время разговоров), где таймкод
 * «127:30» читается хуже.
 */
export function formatDurationLong(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) return '0 сек';

  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  if (rest > 0 && hours === 0) parts.push(`${rest} сек`);

  return parts.join(' ') || '0 сек';
}

/**
 * Дата и время в формате «03 ноя, 14:05».
 * Преднамеренно без Intl.RelativeTimeFormat — формат стабильнее и предсказуемее
 * для журнала звонков, где важна точность, а не «5 минут назад».
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const day = pad(date.getDate());
  const month = MONTHS_SHORT[date.getMonth()] ?? '';
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${day} ${month}, ${hours}:${minutes}`;
}

/** Только дата: «03.11.2026». */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Относительное время: «только что», «12 мин назад», «2 ч назад», «3 дня назад». */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 60) return 'только что';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин назад`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ч назад`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} дн назад`;

  return formatDate(iso);
}

/**
 * Форматирует номер телефона в читаемый вид «+7 (999) 123-45-67».
 * Работает с российскими номерами (11 цифр) и с международными
 * (оставляет как есть, лишь убирая лишние пробелы).
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';

  const digits = phone.replace(/\D/g, '');

  // Российский формат: 7XXXXXXXXXX или 8XXXXXXXXXX.
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const code = digits.slice(1, 4);
    const part1 = digits.slice(4, 7);
    const part2 = digits.slice(7, 9);
    const part3 = digits.slice(9, 11);
    return `+7 (${code}) ${part1}-${part2}-${part3}`;
  }

  return phone.trim();
}

/** Процент с одним знаком после запятой: 0.856 → «85.6%». */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `${ratio.toFixed(1)}%`;
}

/** Процент из уже посчитанного числа (когда бэкенд отдал 85.6, а не 0.856). */
export function formatRatePercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

/** Большие числа с разделителем разрядов: 12345 → «12 345». */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('ru-RU').format(value);
}

/** Инициалы из ФИО: «Иванов Иван» → «ИИ». */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();

  return `${(parts[0]?.[0] ?? '').toUpperCase()}${(parts[1]?.[0] ?? '').toUpperCase()}`;
}
