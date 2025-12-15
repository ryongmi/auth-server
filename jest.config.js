/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@modules/(.*)\\.js$': '<rootDir>/modules/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@common/(.*)\\.js$': '<rootDir>/common/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)\\.js$': '<rootDir>/config/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@database/(.*)\\.js$': '<rootDir>/database/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
    '^@/utils/(.*)\\.js$': '<rootDir>/utils/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@krgeobuk/([^/]+)/(.*)$': '<rootDir>/../node_modules/@krgeobuk/$1/dist/$2',
    '^@krgeobuk/([^/]+)$': '<rootDir>/../node_modules/@krgeobuk/$1/dist',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@krgeobuk|lodash-es)/).*'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};
