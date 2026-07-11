import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  globalSetup: '<rootDir>/tests/helpers/global-setup.ts',
  setupFiles: ['<rootDir>/tests/helpers/setup-env.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/database/migrations/**'],
};

export default config;
