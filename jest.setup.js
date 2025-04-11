// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'; 

// Polyfill for TextEncoder/TextDecoder which might be missing in JSDOM
// Needed for libraries like undici (used by axios/cheerio)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for ReadableStream (needed for undici/fetch emulation)
const { ReadableStream } = require('web-streams-polyfill/dist/ponyfill.js');
global.ReadableStream = ReadableStream;

// Mock window.matchMedia - Required for some UI libraries or responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

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

// Mock Next Router
jest.mock('next/router', () => require('next-router-mock')); 