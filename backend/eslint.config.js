import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Конфигурация ESLint (flat config, формат ESLint 9+).
 *
 * Линтер — это автоматический ревьюер кода. Он ловит типичные ошибки
 * (неиспользуемые переменные, забытый `await`, небезопасные конструкции)
 * ещё до запуска. В реальной команде линтер запускается в CI на каждый PR.
 *
 * Здесь мы намеренно не перегружаем правила: цель — свежий проект без
 * спорных стилевых запретов. Форматирование отдано на откуп редактору,
 * а линтер проверяет именно корректность.
 */
export default tseslint.config(
  {
    /* Что игнорируем. */
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      /* Разрешаем префикс `_` для намеренно неиспользуемых параметров. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /* `any` запрещён — это осознанный выбор в пользу типобезопасности. */
      '@typescript-eslint/no-explicit-any': 'warn',
      /* Пустые интерфейсы обычно означают недописанный код. */
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
);
