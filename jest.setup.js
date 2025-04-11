// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'; 

// Mock NextAuth useSession hook
jest.mock('next-auth/react', () => {
  const originalModule = jest.requireActual('next-auth/react');
  const mockSession = {
    data: null, // Default to no session (unauthenticated)
    status: 'unauthenticated',
  };
  return {
    __esModule: true,
    ...originalModule,
    useSession: jest.fn(() => mockSession), // Mock useSession to return the default
    signIn: jest.fn(), // Mock signIn function if needed
    signOut: jest.fn(), // Mock signOut function if needed
  };
}); 