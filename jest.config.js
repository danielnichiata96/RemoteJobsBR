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
    // Mock problematic ESM modules
    '^jose$': '<rootDir>/mocks/jose.js',
    '^@panva/hkdf$': '<rootDir>/mocks/hkdf.js', 
    '^uuid$': '<rootDir>/mocks/uuid.js',
    // Mock preact-render-to-string to avoid ESM issues in API tests
    '^preact-render-to-string$': '<rootDir>/mocks/preact-render-to-string.js',
    // Force resolution of preact to its CJS build to avoid ESM issues
    '^preact$': '<rootDir>/node_modules/preact/dist/preact.js',
    '^preact/hooks$': '<rootDir>/node_modules/preact/hooks/dist/hooks.js', // Also map hooks if used
    // Map cheerio to its default CJS entry point via standard resolution
    '^cheerio$': 'cheerio', 
  },
  
  // Test spec file matching patterns
  testMatch: [
    '**/tests/**/*.test.(ts|tsx)',
    '**/__tests__/**/*.test.(ts|tsx)'
  ],
  
  // *** Update transformIgnorePatterns for better ESM compatibility ***
  // This pattern prevents Jest from transforming node_modules, *except* for the listed ones.
  // Adjusted pattern to better target modules and remove trailing slash in lookahead.
  transformIgnorePatterns: [
    '/node_modules/(?!(next-auth|@babel|@panva/hkdf|jose|openid-client|preact|preact-render-to-string)/)',
    '^.+\\.module\\.(css|sass|scss)$', // Keep existing CSS module ignore if needed
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