import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { AshbyFetcher } from '../../../src/lib/fetchers/ashbyFetcher';
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
// Import shared types
import { 
    AshbyApiJob, AshbyLocation, FilterResult, 
    AshbyPositiveFilterConfig, NegativeFilterConfig 
} from '../../../src/lib/fetchers/types';
import { AshbyJob, AshbyPositiveSignalConfig, AshbyNegativeSignalConfig, RelevanceResult } from '@/lib/fetchers/AshbyFetcher';
import { mockDeep } from 'jest-mock-extended';
import { Logger } from 'pino';
import { cleanHtml, stripHtml } from '@/lib/utils/textUtils';

// --- Mocks ---
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  // Mock enums if needed later
}));
jest.mock('../../../src/lib/adapters/JobProcessingAdapter');
jest.mock('fs'); // Mock the file system

const MockJobProcessingAdapter = JobProcessingAdapter as jest.MockedClass<typeof JobProcessingAdapter>;
const mockFs = fs as jest.Mocked<typeof fs>; // Typed mock for fs

const mockLogger = pino({ level: 'silent' });

// Mock utilities
jest.mock('@/lib/utils/textUtils', () => ({
  ...jest.requireActual('@/lib/utils/textUtils'), // Keep actual implementation for other functions if needed
  stripHtml: jest.fn(), // Mock stripHtml specifically
  cleanHtml: jest.fn((html) => jest.requireActual('@/lib/utils/textUtils').cleanHtml(html)), // Keep actual cleanHtml
}));

// --- Test Data ---

const mockPositiveConfig: AshbyPositiveFilterConfig = {
    remoteKeywords: ["Remote", "Global", "Anywhere", "Work from Home"],
    latamKeywords: ["LATAM", "Latin America", "South America"],
    brazilKeywords: ["Brazil", "Brasil"]
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
    isRemote: true, // Default to job being remote
    descriptionHtml: '<p>Job description</p>',
    descriptionPlain: 'Job description',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isListed: true,
    jobUrl: `https://jobs.example.com/${overrides.id ?? 'test-job'}`,
    applyUrl: `https://jobs.example.com/${overrides.id ?? 'test-job'}/apply`,
    ...overrides,
});

// --- Test Suite Setup ---

describe('AshbyFetcher Filtering Logic (_isJobRelevant)', () => {
    let fetcher: AshbyFetcher;
    let mockPrisma: PrismaClient;
    let mockAdapter: jest.Mocked<JobProcessingAdapter>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma = new PrismaClient();
        mockAdapter = new MockJobProcessingAdapter(mockPrisma) as jest.Mocked<JobProcessingAdapter>;

        // Mock fs.readFileSync before instantiating Fetcher
        mockFs.readFileSync.mockImplementation((filePath) => {
            const filename = path.basename(filePath as string);
            if (filename === 'ashby-filter-config.json') {
                return JSON.stringify(mockPositiveConfig);
            }
            if (filename === 'greenhouse-filter-config.json') {
                // Provide a minimal structure for greenhouse negative keywords
                return JSON.stringify({
                    LOCATION_KEYWORDS: { STRONG_NEGATIVE_RESTRICTION: mockNegativeConfig.keywords },
                    CONTENT_KEYWORDS: { STRONG_NEGATIVE_REGION: [] } // Example: add content negatives if needed
                });
            }
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        });

        // Instantiate fetcher AFTER mocking fs
        fetcher = new AshbyFetcher(mockPrisma, mockAdapter);

        // Mock stripHtml for each test where it's needed
        (stripHtml as jest.Mock).mockClear();
        // Default mock return value, can be overridden in specific tests
        (stripHtml as jest.Mock).mockReturnValue('Default stripped description'); 
    });

    // --- Test Cases for _isJobRelevant ---

    it('should return relevant=false if positive/negative configs are not loaded', () => {
        // Override the internal configs to simulate loading failure
        // @ts-ignore
        fetcher.ashbyPositiveConfig = null;
        // @ts-ignore
        fetcher.negativeConfig = null;
        const job = createMockAshbyJob({});
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, null, null, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Missing filter configurations');
    });

    it('should return relevant=false if job.isRemote is explicitly false', () => {
        const job = createMockAshbyJob({ isRemote: false });
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Marked as non-remote in ATS (isRemote: false)');
    });

    // --- Negative Keyword Checks (Highest Priority) ---
    it('should return relevant=false if title contains negative keyword (e.g., onsite)', () => {
        const job = { ...createMockAshbyJob, title: 'Software Engineer (Onsite)' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Location/Title Restriction: (?:new york|onsite)$'));
    });

    it('should return relevant=false if department contains negative keyword', () => {
        const job = { ...createMockAshbyJob, departments: [{ name: 'Engineering (US Only)' }] };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Department Restriction: us only$', 'i'));
    });

    it('should return relevant=false if location contains negative keyword', () => {
        const job = { ...createMockAshbyJob, location: 'New York, USA' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Location/Title Restriction: new york'));
    });

    it('should return relevant=false if description contains negative keyword', () => {
        (stripHtml as jest.Mock).mockReturnValue('This position requires you to work from our office in London.');
        const job = { ...createMockAshbyJob, descriptionHtml: '<p>This position requires you to work from our office in London.</p>' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Content Restriction: london$', 'i'));
    });

    // --- Positive Keyword Checks --- 
    
    // LATAM Checks (Priority over Global)
    it('should return relevant=true (latam) if title contains LATAM keyword', () => {
        const job = { ...createMockAshbyJob, title: 'Engineer, Brazil Remote' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toBe('Location/Title(LATAM Signal)');
    });

    it('should return relevant=true (latam) if location contains LATAM keyword', () => {
        const job = { ...createMockAshbyJob, location: 'Sao Paulo, Brazil' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toBe('Location/Title(LATAM Signal)');
    });

    it('should return relevant=true (latam) if location country code is BR', () => {
        const job = createMockAshbyJob({ locations: [createMockAshbyLocation({ address: { countryCode: 'BR'} })], isRemote: true });
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('LATAM signal found in location/title');
    });

    it('should return relevant=true (latam) if description contains a LATAM keyword', () => {
        (stripHtml as jest.Mock).mockReturnValue('Hiring across Latin America.');
        const job = { ...createMockAshbyJob, descriptionHtml: '<p>Hiring across Latin America.</p>' };
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('LATAM signal found in description');
    });

  // Global Checks (If no LATAM signal and no Negative signal)
   it('should return relevant=true (global) if title contains Global keyword', () => {
       const job = { ...createMockAshbyJob, title: 'Remote Software Engineer (Global)' };
       const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
       expect(result.relevant).toBe(true);
       expect(result.type).toBe('global');
       expect(result.reason).toMatch(new RegExp('^(?:Content\\(Global Signal\\)|Fallback\\(isRemote\\))$'));
   });

    it('should return relevant=true (global) if description contains Global keyword', () => {
        (stripHtml as jest.Mock).mockReturnValue('Work from anywhere.');
        const job = { ...createMockAshbyJob, descriptionHtml: '<p>Work from anywhere.</p>' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toBe('Content(Global Signal)');
    });

    it('should return relevant=true (global) if isRemote is true and no other signals apply', () => {
        const job = { ...createMockAshbyJob, isRemote: true, title: 'Software Engineer', location: null, departments: [] };
        (stripHtml as jest.Mock).mockReturnValue('Standard job description.');
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toBe('Fallback(isRemote)');
    });

    it('should return relevant=false if no positive or negative signals and not explicitly remote', () => {
        const job = { ...createMockAshbyJob, isRemote: false, title: 'Software Engineer', location: null, departments: [] };
        (stripHtml as jest.Mock).mockReturnValue('Standard job description.');
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toBe('Ambiguous or No Remote Signal');
    });

    // --- Interaction Checks
    it('should prioritize negative location signal over positive description signal', () => {
        const job = { ...createMockAshbyJob, location: 'New York', descriptionHtml: '<p>Work from anywhere</p>' };
        (stripHtml as jest.Mock).mockReturnValue('Work from anywhere.');
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Location/Title Restriction: (?:new york|onsite)$'));
    });

    it('should prioritize negative description signal over positive location signal', () => {
        const job = { ...createMockAshbyJob, location: 'Remote', descriptionHtml: '<p>Must be based in the US.</p>' };
        (stripHtml as jest.Mock).mockReturnValue('Must be based in the US.');
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Content Restriction: us$'));
    });

    it('should prioritize LATAM signal over conflicting global/remote signals', () => {
        const job = { ...createMockAshbyJob, location: 'Remote, Brazil', title: 'Software Engineer (Global)' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toBe('Location/Title(LATAM Signal)');
    });

    it('should return relevant=true for job with explicit LATAM location (BR)', () => {
        const job = createMockAshbyJob({
            locations: [createMockAshbyLocation({ address: { countryCode: 'BR' } })],
            isRemote: true
        });
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toBe('Location/Title(LATAM Signal)');
    });

    it('should return relevant=false for job with explicit negative location (London)', () => {
        const job = createMockAshbyJob({
            locations: [createMockAshbyLocation({ name: 'London Office' })],
            isRemote: true
        });
        // @ts-ignore
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location/Title Restriction: london');
    });

    // --- Proximity Check Tests --- 

    it('should REJECT location "Remote (USA)" due to proximity', () => {
        const job = { ...createMockAshbyJob, location: 'Remote (USA)' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Location/Title Restriction: usa$'));
    });

    it('should REJECT location "Remote" if address rawAddress contains "USA"', () => {
        const job = { ...createMockAshbyJob, location: 'Remote', secondaryLocations: [{ location: 'Anywhere in the USA' }] };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Secondary Location Restriction: usa$', 'i'));
    });

    it('should REJECT based on content proximity: "Work from anywhere in the United States"', () => {
        (stripHtml as jest.Mock).mockReturnValue('Work from anywhere in the United States');
        const job = { ...createMockAshbyJob, descriptionHtml: '<p>Work from anywhere in the United States</p>' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Content Restriction: united states$'));
    });
    
    it('should prioritize LATAM signal over conflicting negative context (proximity)', () => {
        const job = { ...createMockAshbyJob, location: 'Remote - Brazil (No US Candidates)' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toBe('Location/Title(LATAM Signal)');
    });

    it('should return relevant=false if title contains negative location (non-geo)', () => {
        const job = { ...createMockAshbyJob, title: 'Software Engineer (Onsite)' };
        const result = fetcher._isJobRelevant(job, fetcher.ashbyPositiveConfig, fetcher.negativeConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(new RegExp('^Location/Title Restriction: (?:new york|onsite)$'));
    });

}); 