# Contributing to Chatsidian

Thank you for considering contributing to Chatsidian! This document outlines the process for contributing to the project.

## Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure they pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

1. Clone your fork of the repository
2. Install dependencies with `npm install`
3. Make your changes
4. Test your changes with `npm test`
5. Build the plugin with `npm run build`

## Testing

All new features and bug fixes should include tests. Run the test suite with:

```bash
npm test
```

## Code Style

This project uses ESLint for code style enforcement. Please ensure your code follows the established style by running:

```bash
npm run lint
```

## Pull Request Process

1. Update the README.md and documentation with details of changes if appropriate
2. Update the CHANGELOG.md with details of changes
3. The PR should work on the main development branch
4. Once approved, your PR will be merged

## Release Process

1. Update version in package.json and manifest.json
2. Update CHANGELOG.md with the new version and release date
3. Create a new GitHub release with the version number
4. Tag the release in git

## Questions?

If you have any questions, please feel free to open an issue for discussion.
