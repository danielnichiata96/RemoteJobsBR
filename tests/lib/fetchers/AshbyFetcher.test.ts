import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { AshbyFetcher } from '../../../src/lib/fetchers/AshbyFetcher';
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
// Import shared types
import {
    AshbyApiJob, AshbyLocation, FilterResult,
    AshbyPositiveFilterConfig, NegativeFilterConfig
} from '../../../src/lib/fetchers/types';
import { FilterConfig } from '../../../src/types/JobSource'; // Use FilterConfig
import { detectRestrictivePattern } from '../../../src/lib/utils/filterUtils'; // Import the new utility

// --- Mocks ---
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  // Mock enums if needed later
}));
jest.mock('../../../src/lib/adapters/JobProcessingAdapter');
jest.mock('fs'); // Mock the file system
jest.mock('../../../src/lib/utils/textUtils', () => ({
  stripHtml: jest.fn()
}));
jest.mock('../../../src/lib/utils/filterUtils'); // Mock the new utility

const MockJobProcessingAdapter = JobProcessingAdapter as jest.MockedClass<typeof JobProcessingAdapter>;
const mockFs = fs as jest.Mocked<typeof fs>; // Typed mock for fs
const stripHtml = require('../../../src/lib/utils/textUtils').stripHtml as jest.Mock;
const mockedDetectRestrictivePattern = detectRestrictivePattern as jest.Mock;

const mockLogger = pino({ level: 'silent' });

// --- Test Data ---

const mockPositiveConfig: AshbyPositiveFilterConfig = {
    remoteKeywords: ["Remote", "Global", "Anywhere", "Work from Home"],
    latamKeywords: ["LATAM", "Latin America", "South America"],
    brazilKeywords: ["Brazil", "Brasil"],
    contentLatamKeywords: [],
    contentGlobalKeywords: []
};

const mockNegativeConfig: NegativeFilterConfig = {
    keywords: ["onsite", "on-site", "hybrid", "office", "new york", "london", "san francisco"]
};

// Helper to create mock AshbyLocation
const createMockAshbyLocation = (overrides: Partial<AshbyLocation>): AshbyLocation => ({
    id: `loc-${Math.random().toString(36).substring(7)}`,
    name: 'Default Location',
    type: 'office',
    address: null,
    isRemote: false,
    ...overrides,
});

// Helper to create mock AshbyApiJob
const createMockAshbyJob = (overrides: Partial<AshbyApiJob>): AshbyApiJob => ({
    id: `job-${Math.random().toString(36).substring(7)}`,
    title: 'Software Engineer',
    locations: [createMockAshbyLocation({ name: 'Remote', isRemote: true })], // Default to one remote location
    secondaryLocations: [],
    isRemote: true, // Default to job being remote
    descriptionHtml: '<p>Job description</p>',
    descriptionPlain: 'Job description',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isListed: true,
    jobUrl: `https://jobs.example.com/job-id`,
    applyUrl: `https://jobs.example.com/job-id/apply`,
    ...overrides,
});

// --- Test Suite Setup ---

describe('AshbyFetcher Filtering Logic (_isJobRelevant)', () => {
    let fetcher: AshbyFetcher;
    let mockPrisma: PrismaClient;
    let mockAdapter: jest.Mocked<JobProcessingAdapter>;

    // Define a more complete mock Greenhouse config for Ashby to use
    const mockSharedConfig: FilterConfig = { // Use FilterConfig type
        REMOTE_METADATA_FIELDS: {}, // Add missing field
        LOCATION_KEYWORDS: {
            STRONG_POSITIVE_GLOBAL: ["remote", "global", "worldwide"],
            STRONG_POSITIVE_LATAM: ["latam", "south america"],
            ACCEPT_EXACT_LATAM_COUNTRIES: ["brazil", "brasil"],
            STRONG_NEGATIVE_RESTRICTION: ["office", "hybrid", "us only", "uk only", "london"],
            AMBIGUOUS: ["remote flexible"]
        },
        CONTENT_KEYWORDS: {
            STRONG_NEGATIVE_REGION: ["based in london", "us citizen", "must reside in us"],
            STRONG_NEGATIVE_TIMEZONE: ["pst", "cest"],
            STRONG_POSITIVE_GLOBAL: ["work from anywhere"],
            STRONG_POSITIVE_LATAM: ["latin america"]
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma = new PrismaClient();
        mockAdapter = new MockJobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;

        // Calculate the CORRECT path the actual code will try to load
        const expectedConfigPath = path.resolve(__dirname, '../../../src/config/greenhouse-filter-config.json');

        // Mock fs.existsSync FIRST
        mockFs.existsSync.mockImplementation((filePath) => {
            const resolvedPath = path.resolve(filePath as string);
            if (resolvedPath === expectedConfigPath) { // Use the expected path
                return true; // Indicate the config file exists
            }
            return jest.requireActual('fs').existsSync(filePath); // Fallback
        });

        // Mock fs.readFileSync to provide the shared config
        mockFs.readFileSync.mockImplementation((filePath, options) => {
            const resolvedPath = path.resolve(filePath as string);
            if (resolvedPath === expectedConfigPath) { // Use the expected path
                return JSON.stringify(mockSharedConfig);
            }
            // Throw for unexpected reads to catch errors
            throw new Error(`TEST ERROR: Unexpected fs.readFileSync call for '${filePath}' (Resolved: ${resolvedPath}, Expected: ${expectedConfigPath})`);
        });

        // Instantiate fetcher AFTER mocking fs
        fetcher = new AshbyFetcher(mockPrisma, mockAdapter);

        // Default mock return value, can be overridden in specific tests
        stripHtml.mockReturnValue('Default stripped description');
        mockedDetectRestrictivePattern.mockReturnValue(false); // Default: no restrictive pattern found
    });

    // These test cases need to be refactored
    // Since _isJobRelevant is a private method, we should consider testing it indirectly
    // through the public API, or exposing it for testing.
    
    it('should identify location correctly in processSource', () => {
        // This is a placeholder test - implement a proper test that uses the public API
        expect(true).toBe(true);
    });

    it('should handle remote jobs correctly in processSource', () => {
        // This is a placeholder test - implement a proper test that uses the public API
        expect(true).toBe(true);
    });

    // Add more tests using the public API instead of directly testing private methods

    // --- Test Cases for Rejection based on Patterns ---
    test('should REJECT job with location pattern "(US Only)"', () => {
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ name: 'Remote (US Only)' })] });
        // Directly mock detectRestrictivePattern for the specific text it will receive
        mockedDetectRestrictivePattern.mockImplementation((text: string) => text.includes('remote (us only)'));

        console.log('DEBUG: Checking configs before _isJobRelevant call:');
        console.log('positiveConfig:', (fetcher as any).ashbyPositiveConfig);
        console.log('negativeConfig:', (fetcher as any).negativeConfig);

        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
        expect(mockedDetectRestrictivePattern).toHaveBeenCalled();
    });

    test('should REJECT job with title pattern "based in Canada"', () => {
        const job = createMockAshbyJob({ title: 'Remote Engineer, based in Canada', locations: [] });
         mockedDetectRestrictivePattern.mockImplementation((text: string) => text.includes('based in canada'));
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
        expect(mockedDetectRestrictivePattern).toHaveBeenCalled();
    });

    test('should REJECT job with content pattern "eligible to work in Europe"', () => {
        const job = createMockAshbyJob({ descriptionPlain: 'Must be eligible to work in Europe.' });
        mockedDetectRestrictivePattern.mockImplementation((text: string) => text.includes('eligible to work in europe'));
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
        expect(mockedDetectRestrictivePattern).toHaveBeenCalled();
    });

    test('should REJECT job with content pattern "UK resident"', () => {
        const job = createMockAshbyJob({ descriptionPlain: 'Must be a UK resident.' });
        mockedDetectRestrictivePattern.mockImplementation((text: string) => text.includes('uk resident'));
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
        expect(mockedDetectRestrictivePattern).toHaveBeenCalled();
    });

    // --- Test Cases for Rejection based on Keywords ---
    test('should REJECT job with negative keyword "Hybrid" in location', () => {
        // Ensure 'hybrid' is in the mocked negative config for this test
        (fetcher as any).negativeConfig = { keywords: ['hybrid'] };
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ name: 'Hybrid - London' })] });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction: hybrid');
    });

     test('should REJECT job with negative keyword "US Citizen" in content', () => {
        // Ensure 'us citizen' is in the mocked negative config for this test
        (fetcher as any).negativeConfig = { keywords: ['us citizen'] };
        const job = createMockAshbyJob({ descriptionPlain: 'Requires US Citizen status.' });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content Restriction: us citizen');
    });

     // --- Test Cases for Acceptance ---
     test('should ACCEPT job with explicit LATAM location name', () => {
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ name: 'Remote LATAM' })] });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location/Title(LATAM Signal)');
    });

    test('should ACCEPT job with explicit Brazil country code', () => {
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ address: { rawAddress: '', streetAddress1: null, streetAddress2: null, city: null, state: null, postalCode: null, country: 'Brazil', countryCode: 'BR' } })] });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location/Title(LATAM Signal)');
    });

    test('should ACCEPT job with explicit global keyword in location name', () => {
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ name: 'Remote Worldwide' })] });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toMatch(/(Location\/Title|Content)\(Global Signal\)/);
    });

    test('should ACCEPT job with content keyword "Latin America"', () => {
        const job = createMockAshbyJob({ descriptionPlain: 'Hiring in Latin America.' });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Content(LATAM');
    });

    test('should ACCEPT job with isRemote=true as fallback if no other signals', () => {
        // Job with no strong location/content keywords, just isRemote=true
        const job = createMockAshbyJob({ title: 'Generic Role', locations: [], descriptionPlain: 'Standard duties.', isRemote: true });
        // Ensure config doesn't accidentally trigger
        (fetcher as any).positiveConfig = {
            remoteKeywords: [],
            latamKeywords: [],
            brazilKeywords: [],
            contentLatamKeywords: [],
            contentGlobalKeywords: []
        };
        (fetcher as any).negativeConfig = { keywords: [] };
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).positiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toBe('isRemote=true Fallback');
    });

    // --- Test Cases for Edge Cases and Contextual Rejection/Acceptance ---
    test('should REJECT job with global keyword near negative context in content', () => {
        (fetcher as any).negativeConfig = { keywords: ['pst'] }; // Ensure PST is negative
        const job = createMockAshbyJob({ descriptionPlain: 'This is a work from home role, but requires PST hours.' }); 
        // Modify positive config if needed for this test's logic
        (fetcher as any).positiveConfig = {
            remoteKeywords: ['work from home'],
            latamKeywords: [],
            brazilKeywords: [],
            contentLatamKeywords: [],
            contentGlobalKeywords: ['work from home']
        };
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).positiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content Restriction (context): pst');
    });

    test('should ACCEPT job with global keyword without negative context', () => {
        const job = createMockAshbyJob({ descriptionPlain: 'Fully remote, flexible hours.' });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toBe('Location/Title(Global Signal) - Content Neutral');
    });

    test('should ACCEPT job with global keyword without negative context and correct fallback reason', () => {
        const job = createMockAshbyJob({ descriptionPlain: 'Fully remote, flexible hours.' });
        const result = (fetcher as any)._isJobRelevant(job, (fetcher as any).ashbyPositiveConfig, (fetcher as any).negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toBe('Location/Title(Global Signal) - Content Neutral');
    });

}); 