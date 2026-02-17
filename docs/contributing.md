# Contributing to SEO3 Developer Platform

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup

See [Deployment Guide](./deployment.md) for detailed setup instructions.

## Code Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write meaningful variable and function names
- Add JSDoc comments for public APIs

### Python

- Follow PEP 8 style guide
- Use type hints
- Write docstrings for all functions
- Use meaningful variable names

### Git Commits

- Use conventional commit messages
- Format: `type(scope): message`
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat(api-gateway): add rate limiting middleware`

## Project Structure

Each microservice follows this structure:

```
service-name/
├── src/
│   ├── modules/
│   │   └── feature/
│   │       ├── feature.module.ts
│   │       ├── feature.controller.ts
│   │       ├── feature.service.ts
│   │       └── dto/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── Dockerfile
└── package.json
```

## Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

### Coverage

```bash
npm run test:cov
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Code Review Guidelines

- Be respectful and constructive
- Focus on code quality and maintainability
- Suggest improvements, don't demand them
- Approve when satisfied with changes

## Questions?

Open an issue or contact the maintainers.
