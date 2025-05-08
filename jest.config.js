module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.mjs$': 'ts-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@google/genai|@anthropic-ai|@anthropic-ai/sdk|openai)/)'
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^obsidian$': '<rootDir>/tests/mocks/obsidian.ts',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  // Temporarily disable coverage thresholds for debugging
  // coverageThreshold: {
  //   global: {
  //     statements: 80,
  //     branches: 80,
  //     functions: 80,
  //     lines: 80
  //   }
  // },
};
