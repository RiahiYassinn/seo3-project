const createJestConfig = require('../jest.preset');

module.exports = createJestConfig({
  coveragePathIgnorePatterns: ['/strategies/', '/guards/', '/decorators/'],
});
