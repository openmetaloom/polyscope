# Contributing to PolyScope

Thank you for your interest in contributing to PolyScope! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/polyscope.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Submit a pull request

## Development Setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

Quick start:
```bash
npm install
npm run dev
```

## Code Standards

### JavaScript/TypeScript
- Use ESLint configuration provided in the project
- Follow existing code style and patterns
- Write meaningful variable and function names
- Add JSDoc comments for public APIs

### Git Commit Messages
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and PRs where appropriate

Example:
```
Add market search endpoint with filters

- Implement fuzzy search for market names
- Add category and liquidity filters
- Include pagination support

Fixes #123
```

## Pull Request Process

1. Update documentation for any changed functionality
2. Add tests for new features
3. Ensure all tests pass: `npm test`
4. Update the CHANGELOG.md with your changes
5. Request review from maintainers

## Testing

- Run unit tests: `npm test`
- Run stress tests: `npm run test:stress`
- Run linter: `npm run lint`

## Reporting Bugs

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Any relevant logs or error messages

## Feature Requests

Feature requests are welcome! Please:
- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be useful
- Consider implementation approach

## Code Review

All submissions require review before merging. Reviewers will check for:
- Code quality and style
- Test coverage
- Documentation updates
- Security considerations
- Performance impact

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for responsible disclosure procedures.

## Questions?

Feel free to open an issue for questions or join our discussions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.