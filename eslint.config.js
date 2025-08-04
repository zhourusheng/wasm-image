import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: ['./tsconfig.json', './tsconfig.node.json'],
      },
      globals: {
        // 浏览器环境
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Image: 'readonly',
        ImageData: 'readonly',
        createImageBitmap: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Node.js 环境
        NodeJS: 'readonly',
        // 其他
        React: 'readonly',
        browser: true,
        es2020: true,
        node: true,
        worker: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      sonarjs: sonarjs,
      prettier: prettier,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      ...prettierConfig.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // 放宽复杂度限制
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      complexity: ['warn', { max: 15 }],
      'max-lines-per-function': ['warn', { max: 100 }],
      'max-depth': ['warn', 6],
      // 放宽其他规则
      'sonarjs/todo-tag': 'warn',
      'sonarjs/pseudo-random': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/function-return-type': 'warn',
      'no-case-declarations': 'warn',
      'no-undef': 'error',
      'prettier/prettier': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['dist/**', 'node_modules/**'],
  },
];
