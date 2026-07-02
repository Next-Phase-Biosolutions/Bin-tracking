import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

const apiRoot = path.dirname(fileURLToPath(new URL('.', import.meta.url)));

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            'no-console': ['error', { allow: ['warn', 'error'] }],
            '@typescript-eslint/ban-ts-comment': 'error',
        },
    },
];
