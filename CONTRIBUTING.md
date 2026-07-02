# Contributing to Bin Tracker

We're happy you're interested in contributing! Please follow these guidelines.

## Code of Conduct

- Be respectful and constructive
- Provide clear, actionable feedback
- Focus on the best outcome for the project

## Getting Started

1. Fork the repository
2. Create a branch from `dev` NEVER from `main`:
   ```bash
   git checkout dev && git pull origin dev
   git checkout -b feat/your-feature-name
   ```
3. Set up your environment — see [Local Development Setup](./README.md#local-development-setup) and [Database Setup Guide](./docs/database-setup.md)
4. Make your changes and write tests
5. Open a Pull Request to the `dev` branch only

## Making Changes

### Security

- Never commit secrets, credentials, or `.env` files
- Run `pnpm run lint` before committing
- Run `pnpm run format` to format all code
- The `canonicalize()` function in `blockchain.service.ts` must never change after mainnet go-live — raise an issue before touching it

### Code Style

```bash
pnpm run lint        # check for lint errors
pnpm run format      # format all files
pnpm run typecheck   # TypeScript check
pnpm run test        # run all tests
```

Prettier settings: 2-space indent, single quotes, trailing commas, 100-char line width.

### Testing

- Add tests for new features and bug fixes
- Cover happy paths and error/edge cases
- Ensure `pnpm run test` passes before opening a PR

### Database Migrations

We use a workflow: each developer has their own local Postgres; production runs on Supabase. See [docs/database-setup.md](./docs/database-setup.md) for the full guide.

**Rules:**

- Use `pnpm db:migrate:dev` **only on your local database** to create new migrations
- Use `pnpm db:migrate` (`migrate deploy`) in CI and production — never `migrate dev`
- Commit both `packages/db/prisma/schema.prisma` and the new folder under `packages/db/prisma/migrations/`
- Never connect to production Supabase from your laptop
- Never commit `.env` files

**Workflow for schema changes:**

```bash
# 1. Edit packages/db/prisma/schema.prisma
pnpm db:migrate:dev --name describe_your_change

# 2. Test locally
pnpm test
pnpm dev

# 3. Commit and open PR to dev
git add packages/db/prisma/
git commit -m "feat(db): describe_your_change"
```

CI (`.github/workflows/database-ci.yml`) applies your migrations on a fresh Postgres before merge.

## Pull Request Process

1. Ensure all tests pass and CI is green
2. Write a clear PR description — what changed, why, and how to test it
3. PRs to `main` will be rejected — always target `dev`
4. At least one maintainer must approve before merge

## Getting Help

- Open an issue for questions or bug reports
- Tag a maintainer for urgent matters
- Check the `plans/` directory for architecture docs before starting a large change
- Read [docs/database-setup.md](./docs/database-setup.md) before making schema changes
