#!/bin/bash

# Fix cycle.service.ts
sed -i '' "s|import { TRPCError } from '@trpc/server';|import { TRPCError } from '@trpc/server';\nimport type { Prisma } from '@prisma/client';|" src/services/cycle.service.ts
sed -i '' 's|async (tx) =>|async (tx: Prisma.TransactionClient) =>|g' src/services/cycle.service.ts
sed -i '' 's|\.map((cycle) =>|.map((cycle: any) =>|g' src/services/cycle.service.ts

# Fix dashboard.service.ts
sed -i '' 's|\.map((f) =>|.map((f: any) =>|g' src/services/dashboard.service.ts
sed -i '' 's|\.map((g) =>|.map((g: any) =>|g' src/services/dashboard.service.ts
sed -i '' 's|\.map((cycle) =>|.map((cycle: any) =>|g' src/services/dashboard.service.ts

echo "Import fixes applied!"
