# Contributing to Seltriva Connect

We appreciate your interest in contributing to Seltriva Connect. This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, professional, and constructive in all interactions. We're building enterprise software and expect high standards.

## Getting Started

1. **Fork and clone** the repository
2. **Create a branch** following the pattern: `feature/short-description` or `fix/short-description`
3. **Make your changes** following the guidelines below
4. **Test thoroughly** before submitting
5. **Submit a pull request** with a clear description

## Development Workflow

### Branch Naming

```
feature/add-user-authentication
fix/resolve-memory-leak
docs/update-installation-guide
refactor/simplify-api-handlers
test/add-unit-tests-for-logger
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add OAuth2 integration
fix(api): resolve race condition in database queries
docs(readme): update installation steps
refactor(logger): simplify log formatting
test(sdk): add comprehensive test suite
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Run `pnpm format` before committing
- **Linting**: Fix issues with `pnpm lint:fix`
- **Type Safety**: No `any` types without justification

### File Structure

Place new code in appropriate packages:
- UI components → `packages/ui/src`
- Database logic → `packages/database/src`
- Shared utilities → `packages/shared/src`
- API endpoints → `apps/api/src`
- Frontend pages → `apps/cloud/src`

## Pull Request Process

1. **Before submitting**: Run `pnpm validate`
2. **Update README** if adding new features or commands
3. **Add comments** for complex logic
4. **Link issues** if applicable: "Closes #123"
5. **Wait for review** - be responsive to feedback

## Quality Standards

### Code Review Checklist

- [ ] Code follows project style guide
- [ ] All tests pass
- [ ] No unnecessary dependencies added
- [ ] Documentation updated
- [ ] TypeScript strict mode passes
- [ ] No console.log in production code
- [ ] Commit messages are clear and conventional

### Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

## Common Tasks

### Adding a New Dependency

```bash
# Add to specific workspace
pnpm add --filter @seltriva/package-name package-name

# Add dev dependency
pnpm add -D --filter @seltriva/package-name package-name
```

### Creating a New Package

```bash
# Create directory and files
mkdir packages/new-package
# Then add package.json, tsconfig.json, and src/index.ts
```

### Running Specific Commands

```bash
# Build specific package
pnpm build --filter @seltriva/package-name

# Lint specific app
pnpm lint --filter ./apps/cloud

# Type check entire workspace
pnpm type-check
```

## Documentation

- Write clear, concise comments for complex logic
- Update docs when changing features
- Follow Markdown conventions
- Include examples where helpful

## Performance Considerations

- Minimize bundle size impacts
- Avoid unnecessary re-renders in React
- Use proper TypeScript types to catch issues early
- Profile before optimizing

## Security

- Never commit secrets or credentials
- Use environment variables for sensitive data
- Follow OWASP guidelines
- Report security issues privately

## Questions?

- Check existing documentation in `docs/` folder
- Review similar implementations in codebase
- Ask in pull request comments
- Refer to architecture guide

## Thank You

Your contributions help make Seltriva Connect better for everyone!
