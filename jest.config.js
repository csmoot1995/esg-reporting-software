module.exports = {
  testEnvironment: 'node',
  passWithNoTests: true,
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js'
  }
};
