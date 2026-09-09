/**
 * Shared Jest setup for every TypeScript workspace.
 *
 * Jest and ts-jest are hoisted to the repo root, so a workspace only needs a
 * three-line `jest.config.js` that calls this factory. Keeping the knobs here
 * means coverage is emitted the same way everywhere, which is what the
 * SonarQube scanner relies on (`<workspace>/coverage/lcov.info`).
 */

// Pin the timezone before any worker is forked, so date formatting assertions
// behave identically on a developer laptop and on the CI runner.
process.env.TZ = 'UTC';

/**
 * @param {object} [options]
 * @param {string} [options.rootDir] Directory Jest treats as the workspace root.
 * @param {string[]} [options.coveragePathIgnorePatterns] Extra regexes kept out of coverage.
 * @param {string[]} [options.collectCoverageFrom] Overrides which files are instrumented.
 * @param {string} [options.coverageDirectory] Where lcov.info is written.
 * @param {Record<string, string>} [options.moduleNameMapper] Extra path aliases.
 * @param {string} [options.tsconfig] tsconfig used by ts-jest.
 */
module.exports = function createJestConfig(options = {}) {
  const {
    rootDir = 'src',
    coveragePathIgnorePatterns = [],
    collectCoverageFrom = ['**/*.ts', '!**/*.spec.ts', '!**/*.d.ts'],
    coverageDirectory = '<rootDir>/../coverage',
    moduleNameMapper,
    tsconfig,
    ...rest
  } = options;

  return {
    rootDir,
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.next/'],
    transform: {
      '^.+\\.(t|j)s$': ['ts-jest', tsconfig ? { tsconfig } : {}],
    },
    ...(moduleNameMapper ? { moduleNameMapper } : {}),

    collectCoverageFrom,
    // Wiring, schemas and bootstrap files have no branches worth measuring;
    // leaving them in only dilutes the ratio Sonar reports.
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '\\.module\\.ts$',
      '\\.entity\\.ts$',
      '\\.schema\\.ts$',
      '\\.dto\\.ts$',
      '\\.event\\.ts$',
      '\\.types\\.ts$',
      '/main\\.ts$',
      ...coveragePathIgnorePatterns,
    ],
    coverageDirectory,
    // `lcov` is what sonar.javascript.lcov.reportPaths consumes; `text-summary`
    // keeps local runs readable without dumping a per-file table.
    //
    // `projectRoot` makes the SF: entries repo-root relative instead of
    // workspace relative. The SonarQube scanner runs from the repo root, so
    // without this it would look for `src/foo.ts` at the top level, find
    // nothing, and silently report 0% coverage for every workspace.
    coverageReporters: [
      'text-summary',
      ['lcov', { projectRoot: __dirname }],
    ],

    ...rest,
  };
};