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
3. Set up your environment — see [Local Development Setup](./README.md#local-development-setup)
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

## Pull Request Process

1. Ensure all tests pass and CI is green
2. Write a clear PR description — what changed, why, and how to test it
3. PRs to `main` will be rejected — always target `dev`
4. At least one maintainer must approve before merge

## Getting Help

- Open an issue for questions or bug reports
- Tag a maintainer for urgent matters
- Check the `plans/` directory for architecture docs before starting a large change
