import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

/**
 * Flat-конфиг ESLint 9 для Vue 3 + TypeScript.
 *
 * Разделяем правила для .ts и .vue: базовые JS-правила + рекомендации
 * typescript-eslint + рекомендации eslint-plugin-vue. Так линтер понимает
 * и `<script setup lang="ts">`, и шаблоны компонентов.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    // Чтобы eslint-plugin-vue умел разбирать <script lang="ts"> внутри .vue.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      // Префикс '_' помечает намеренно неиспользуемые переменные/аргументы.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Пути иконок берутся из локального словаря (не из пользовательского
      // ввода), поэтому инъекция исключена — отключаем правило осознанно.
      'vue/no-v-html': 'off',
      // any допустим как осознанное исключение, но с предупреждением.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Vue-правило о многословных именах компонентов избыточно для SPA.
      'vue/multi-word-component-names': 'off',
      // В TS опциональность prop уже выражена через `?`, а не через default —
      // правило рассчитано на JS и даёт шум из ложных срабатываний.
      'vue/require-default-prop': 'off',
      // Форматирование атрибутов в шаблонах — забота форматтера, не линтера.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
);
