# TypeScript Configuration Templates

## Root `tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Type Checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    
    // Module Resolution
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    
    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "importHelpers": true,
    "importsNotUsedAsValues": "error",
    
    // JavaScript Support
    "allowJs": false,
    "checkJs": false,
    
    // Interop Constraints
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    
    // Language and Environment
    "target": "ES2022",
    "lib": ["ES2022"],
    "jsx": "preserve",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    
    // Projects
    "incremental": true,
    "composite": true,
    
    // Completeness
    "skipLibCheck": true,
    
    // Path Mapping
    "baseUrl": ".",
    "paths": {
      "@bin-tracker/types": ["./packages/types/src"],
      "@bin-tracker/types/*": ["./packages/types/src/*"],
      "@bin-tracker/db": ["./packages/db/src"],
      "@bin-tracker/db/*": ["./packages/db/src/*"],
      "@bin-tracker/ui": ["./packages/ui/src"],
      "@bin-tracker/ui/*": ["./packages/ui/src/*"],
      "@bin-tracker/validators": ["./packages/validators/src"],
      "@bin-tracker/validators/*": ["./packages/validators/src/*"]
    }
  },
  "exclude": [
    "node_modules",
    "dist",
    ".next",
    ".turbo",
    "coverage"
  ]
}
```

---

## Frontend `tsconfig.json` (`apps/web/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    
    // Next.js specific
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "incremental": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    
    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/trpc/*": ["./src/trpc/*"],
      "@bin-tracker/types": ["../../packages/types/src"],
      "@bin-tracker/ui": ["../../packages/ui/src"],
      "@bin-tracker/validators": ["../../packages/validators/src"]
    },
    
    // Next.js plugins
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "out"
  ]
}
```

---

## Backend `tsconfig.json` (`apps/api/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    
    // Node.js specific
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    // Output
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/trpc/*": ["./src/trpc/*"],
      "@/services/*": ["./src/services/*"],
      "@/middleware/*": ["./src/middleware/*"],
      "@bin-tracker/types": ["../../packages/types/src"],
      "@bin-tracker/db": ["../../packages/db/src"],
      "@bin-tracker/validators": ["../../packages/validators/src"]
    }
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

---

## Shared Package `tsconfig.json` (`packages/types/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    
    // Package specific
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    
    // Strict
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    // No path aliases in packages (use relative imports)
    "baseUrl": ".",
    "paths": {}
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

---

## TypeScript Rules Enforcement

### `.eslintrc.js` (Root)

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
    'import'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  rules: {
    // TypeScript Strict Rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // Import Rules
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true
      }
    }],
    
    // General Rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error'
  }
}
```

---

## Prettier Configuration

### `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "jsxSingleQuote": false,
  "quoteProps": "as-needed"
}
```

---

## Husky Pre-commit Hooks

### `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged
npx lint-staged
```

### `package.json` (lint-staged config)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "bash -c 'tsc --noEmit'"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

---

## Type Safety Checklist

### ✅ Enforced Rules

1. **No `any` types** — `@typescript-eslint/no-explicit-any: error`
2. **No unsafe operations** — All `no-unsafe-*` rules enabled
3. **Strict null checks** — `strict: true` in tsconfig
4. **No unused variables** — `noUnusedLocals: true`
5. **No implicit returns** — `noImplicitReturns: true`
6. **Index signature checks** — `noUncheckedIndexedAccess: true`

### ❌ Forbidden Patterns

```typescript
// ❌ FORBIDDEN
const data: any = fetchData()
const result = data.something

// ❌ FORBIDDEN
function process(input) {  // No type annotation
  return input.value
}

// ❌ FORBIDDEN
const items = [1, 2, 3]
const first = items[0]  // Could be undefined!

// ❌ FORBIDDEN
// @ts-ignore
const broken = somethingWrong()
```

### ✅ Correct Patterns

```typescript
// ✅ CORRECT
const data: unknown = fetchData()
if (isBin(data)) {
  const result = data.id  // Type-safe
}

// ✅ CORRECT
function process(input: ProcessInput): ProcessOutput {
  return { value: input.value }
}

// ✅ CORRECT
const items = [1, 2, 3]
const first = items[0]  // number | undefined
if (first !== undefined) {
  console.log(first)  // number
}

// ✅ CORRECT
const result = somethingThatMightFail()
if (!result.success) {
  throw new Error(result.error)
}
```

---

## Type Generation from Database

### Prisma Type Generation

```bash
# Generate Prisma Client with types
npx prisma generate

# This creates:
# - node_modules/@prisma/client
# - Fully typed database models
# - Type-safe query builder
```

### Usage Example

```typescript
import { PrismaClient, Bin, BinStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Fully typed!
const bin: Bin = await prisma.bin.findUnique({
  where: { id: 'bin-123' }
})

// TypeScript knows all fields
console.log(bin.qrCode)      // string
console.log(bin.status)      // BinStatus enum
console.log(bin.createdAt)   // Date

// TypeScript prevents errors
await prisma.bin.update({
  where: { id: 'bin-123' },
  data: {
    status: 'INVALID'  // ❌ Error: Type '"INVALID"' is not assignable to type 'BinStatus'
  }
})
```

---

## Zod Schema to TypeScript Types

### Schema Definition

```typescript
import { z } from 'zod'

export const binStartSchema = z.object({
  binId: z.string().min(1),
  facilityId: z.string().min(1)
})

// Infer TypeScript type from Zod schema
export type BinStartInput = z.infer<typeof binStartSchema>
```

### Usage

```typescript
import { binStartSchema, type BinStartInput } from '@bin-tracker/validators'

// Runtime validation
function startBin(input: unknown) {
  const validated = binStartSchema.parse(input)
  //    ^ Type: { binId: string; facilityId: string }
  
  return processStart(validated)
}

// Type-safe function
function processStart(input: BinStartInput) {
  console.log(input.binId)      // ✅ TypeScript knows this exists
  console.log(input.invalidKey) // ❌ TypeScript error
}
```

---

## tRPC Type Inference

### Router Definition

```typescript
import { router, publicProcedure } from './trpc'
import { binStartSchema } from '@bin-tracker/validators'

export const binRouter = router({
  start: publicProcedure
    .input(binStartSchema)
    .mutation(async ({ input }) => {
      // input is automatically typed as BinStartInput!
      return { success: true, binId: input.binId }
    })
})

export type BinRouter = typeof binRouter
```

### Frontend Usage

```typescript
import { trpc } from '@/trpc/client'

// Fully typed!
const { mutate } = trpc.bin.start.useMutation()

mutate({
  binId: 'BIN-001',      // ✅ TypeScript knows this is required
  facilityId: 'chicago'  // ✅ TypeScript knows this is required
})

mutate({
  binId: 'BIN-001'
  // ❌ TypeScript error: Property 'facilityId' is missing
})

mutate({
  binId: 123  // ❌ TypeScript error: Type 'number' is not assignable to type 'string'
})
```

---

## Summary

This TypeScript configuration ensures:

1. ✅ **Zero `any` types** — Compile-time error if used
2. ✅ **Strict null checks** — Must handle undefined/null explicitly
3. ✅ **End-to-end type safety** — DB → API → Frontend
4. ✅ **Auto-generated types** — From Prisma schema
5. ✅ **Runtime validation** — Zod schemas match TypeScript types
6. ✅ **Pre-commit checks** — Can't commit code with type errors
7. ✅ **CI/CD enforcement** — Can't deploy code with type errors

**Result:** Catch bugs at compile-time, not in production! 🚀
