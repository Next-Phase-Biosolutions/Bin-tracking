/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'prettier',
    ],
    rules: {
        // No any — ZERO TOLERANCE
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',

        // No unused vars (allow underscore prefix)
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],

        // No floating promises
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',

        // No console.log in production
        'no-console': ['error', { allow: ['warn', 'error'] }],

        // No ts-ignore or ts-expect-error
        '@typescript-eslint/ban-ts-comment': 'error',

        // Require return types on exported functions
        '@typescript-eslint/explicit-function-return-type': [
            'warn',
            { allowExpressions: true, allowTypedFunctionExpressions: true },
        ],
    },
    ignorePatterns: ['dist', 'build', 'node_modules', '*.js', '*.cjs'],
};
