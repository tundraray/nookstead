export default {
  displayName: '@nookstead/map-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.lib.json',
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/packages/map-lib',
  testPathIgnorePatterns: ['\\.performance\\.spec\\.ts$'],
  testEnvironment: 'node',
};
