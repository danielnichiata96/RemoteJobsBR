const nextJest = require('next/jest');

// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if using JavaScript
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // if using TypeScript

  testEnvironment: 'jest-environment-jsdom',

  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    // Add other aliases here if you have them in tsconfig.json
  },
  
  // Use ts-jest for TypeScript files
  preset: 'ts-jest',
  
  // Test spec file matching patterns
  testMatch: [
    '**/tests/**/*.test.(ts|tsx)',
    '**/__tests__/**/*.test.(ts|tsx)'
  ],
  
  // Exclude node_modules and .next from test coverage
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
  ],
  
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig); 