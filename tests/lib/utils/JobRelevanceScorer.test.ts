import { calculateRelevanceScore } from '../../../src/lib/utils/JobRelevanceScorer';
import { FilterConfig } from '../../../src/lib/types/FilterConfig';
import * as textUtils from '../../../src/lib/utils/textUtils';

// Mock textUtils normalizeText
jest.mock('../../../src/lib/utils/textUtils', () => ({
    normalizeText: jest.fn((text) => text.toLowerCase().replace(/\s+/g, ' ').trim()),
}));

const mockedTextUtils = textUtils as jest.Mocked<typeof textUtils>;

// Mock JobDataForScoring interface (or import if exported from scorer file)
interface JobDataForScoring {
  title: string;
  description?: string | null;
  location?: string | null;
}

// Mock basic FilterConfig structure for tests
const mockBaseConfig: Partial<FilterConfig> = {
  SCORING_SIGNALS: {
    positive_location: {
      keywords: [{ term: 'brasil', weight: 10 }],
      patterns: [{ pattern: 'hiring in latam', weight: 12 }],
    },
    negative_location: {
      keywords: [{ term: 'us only', weight: -20 }],
      patterns: [{ pattern: 'must reside in usa', weight: -25 }],
    },
    positive_content: {
      keywords: [{ term: 'pj', weight: 5 }],
      patterns: [],
    },
    negative_content: {
      keywords: [{ term: 'no sponsorship', weight: -10 }],
      patterns: [{ pattern: 'must work pst hours', weight: -8 }],
    },
  },
};

describe('JobRelevanceScorer', () => {
    beforeEach(() => {
        // Reset mocks before each test
        mockedTextUtils.normalizeText.mockClear();
        // Re-apply the default mock implementation if needed after clearing
        mockedTextUtils.normalizeText.mockImplementation((text) => text.toLowerCase().replace(/\s+/g, ' ').trim());
    });

    const createMockConfig = (overrides: Partial<FilterConfig['SCORING_SIGNALS']> = {}): FilterConfig => ({
        // Provide default structure, assuming FilterConfig has SCORING_SIGNALS
        SCORING_SIGNALS: {
            positive_content: {
                keywords: [{ term: 'brasil', weight: 10 }, { term: 'latam', weight: 5 }],
                patterns: [{ pattern: 'engenheiro', weight: 8 }],
            },
            negative_content: {
                keywords: [{ term: 'on-site', weight: -20 }, { term: 'híbrido', weight: -15 }],
                patterns: [{ pattern: 'us only', weight: -50 }],
            },
            positive_location: {
                keywords: [{ term: 'remote', weight: 5 }],
            },
            negative_location: {
                keywords: [{ term: 'são paulo', weight: -10 }],
                patterns: [{ pattern: 'usa', weight: -30 }],
            },
            ...overrides,
        },
        // Add other required FilterConfig properties if they exist
        jobBoardName: 'test-board', // Example placeholder
    });

    it('should return 0 if SCORING_SIGNALS are missing', () => {
        const jobData = { title: 'Dev', description: 'Develop stuff', location: 'Remote' };
        // Force config to not have SCORING_SIGNALS
        const config = { jobBoardName: 'test-board' } as FilterConfig; 
        const score = calculateRelevanceScore(jobData, config);
        expect(score).toBe(0);
    });

    it('should return 0 if job data is empty', () => {
        const jobData = { title: '', description: null, location: undefined };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        expect(score).toBe(0);
        // Verify normalization was called with empty strings
        expect(mockedTextUtils.normalizeText).toHaveBeenCalledWith('  '); // title + desc + loc
        expect(mockedTextUtils.normalizeText).toHaveBeenCalledWith(''); // location
        expect(mockedTextUtils.normalizeText).toHaveBeenCalledWith(''); // description
        expect(mockedTextUtils.normalizeText).toHaveBeenCalledWith(''); // title
    });

    it('should calculate score based on positive keywords (case-insensitive)', () => {
        const jobData = { title: 'Engenheiro de Software (BRASIL)', description: 'Work with LATAM team', location: 'Remote' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        // Expected: brasil(10) + latam(5) + remote(5) + engenheiro(8) = 28
        expect(score).toBe(28);
    });

    it('should calculate score based on negative keywords (case-insensitive)', () => {
        const jobData = { title: 'Analyst', description: 'Must be on-site sometimes', location: 'São Paulo' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        // Expected: on-site(-20) + são paulo(-10) = -30
        expect(score).toBe(-30);
    });

    it('should calculate score based on positive regex patterns', () => {
        const jobData = { title: 'Software ENGENHEIRO', description: 'Backend dev', location: 'Remote' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        // Expected: engenheiro(8) + remote(5) = 13
        expect(score).toBe(13);
    });

     it('should calculate score based on negative regex patterns', () => {
        const jobData = { title: 'Manager', description: 'Open to US Only candidates', location: 'USA' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        // Expected: us only(-50) + usa(-30) = -80
        expect(score).toBe(-80);
    });

    it('should combine positive and negative signals correctly', () => {
        const jobData = { title: 'Engenheiro Brasil', description: 'Remote role, but requires travel to São Paulo sometimes (Híbrido)', location: 'Remote BR' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
        // Expected: engenheiro(8) + brasil(10) + remote(5) + são paulo(-10) + híbrido(-15) = -2
        expect(score).toBe(-2);
    });

    it('should handle keywords/patterns not found', () => {
        const jobData = { title: 'Product Manager', description: 'Fully remote', location: 'Anywhere' };
        const config = createMockConfig();
        const score = calculateRelevanceScore(jobData, config);
         // Expected: remote(5) only
        expect(score).toBe(5);
    });

    it('should handle only keywords being present', () => {
        const jobData = { title: 'LATAM role', description: 'For Brasil', location: 'Remote' };
        const config = createMockConfig({
             positive_content: { keywords: [{ term: 'brasil', weight: 10 }, { term: 'latam', weight: 5 }] },
             negative_content: undefined, // No negative content signals
             positive_location: { keywords: [{ term: 'remote', weight: 5 }] },
             negative_location: undefined, // No negative location signals
        });
        const score = calculateRelevanceScore(jobData, config);
         // Expected: latam(5) + brasil(10) + remote(5) = 20
        expect(score).toBe(20);
    });

    it('should handle only patterns being present', () => {
        const jobData = { title: 'Engenheiro', description: 'Must be in USA', location: 'USA' };
         const config = createMockConfig({
             positive_content: { patterns: [{ pattern: 'engenheiro', weight: 8 }] },
             negative_content: undefined,
             positive_location: undefined,
             negative_location: { patterns: [{ pattern: 'usa', weight: -30 }] },
         });
        const score = calculateRelevanceScore(jobData, config);
         // Expected: engenheiro(8) + usa(-30) = -22
         // TODO: Investigate why the 'usa' pattern (weight -30) is not matching.
         expect(score).toBe(-22); // Asserting current behavior
    });
    
    it('should handle invalid regex pattern gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error
        const jobData = { title: 'Test', description: 'This has a *bad regex trigger*', location: 'Remote' };
        const config = createMockConfig({
             negative_content: { patterns: [{ pattern: '*badregex', weight: -100 }] } // Invalid regex
        });

        // Expect score calculation to proceed without the bad regex, applying other rules
        const score = calculateRelevanceScore(jobData, config);

        // Expected: remote(5) + (maybe others depending on defaults)
        // Check against a baseline score without the bad regex contribution
        const baselineConfig = createMockConfig(); // Use default config
        const baselineScore = calculateRelevanceScore({ title: 'Test', description: 'Desc', location: 'Remote' }, baselineConfig);
        expect(score).toBe(baselineScore); // Should be the same as if the bad regex wasn't there

        // Check if console.error was called due to the invalid regex
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid regex pattern'), expect.any(Error));
        
        consoleErrorSpy.mockRestore(); // Restore original console.error
    });

}); 