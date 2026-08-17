const createJestConfig = require('../../jest.preset');

/**
 * Only the framework-free modules under `lib/` are unit tested. Rendering React
 * pages would drag in jsdom, Testing Library and a Next.js transform pipeline
 * for very little signal, so that surface is left to the build and typecheck.
 */
module.exports = createJestConfig({
  rootDir: '.',
  tsconfig: '<rootDir>/tsconfig.test.json',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  collectCoverageFrom: ['lib/**/*.ts', '!lib/**/*.spec.ts', '!**/*.d.ts'],
  coverageDirectory: '<rootDir>/coverage',
});
