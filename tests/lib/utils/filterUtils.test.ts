import { detectRestrictivePattern, containsInclusiveSignal } from '@/lib/utils/filterUtils';
import pino from 'pino';

// Mock logger to prevent console output during tests
const mockLogger = pino({ level: 'silent' });

describe('detectRestrictivePattern', () => {
    const commonNegativeKeywords = [
        'us', 'usa', 'canada', 'uk', 'eu', 'europe', 'european',
        'emea', 'apac', 'asia', 'australia',
        'romania', 'switzerland', 'poland', 'germany', 'france', 'on-site', 'hybrid',
        // Add specific phrases potentially missed by simple keywords
        'us resident', 'canadian resident', 'canadian residents',
        'uk resident', 'eu resident',
        'based in us', 'based in canada', 'based in uk', 'based in eu',
        'us only', 'canada only', 'uk only', 'eu only'
    ];

    // --- Test Cases for Structural Patterns ---
    test('should detect pattern: (Region Only)', () => {
        expect(detectRestrictivePattern('Remote (US Only)', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Remote [EU Only]', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Remote, UK Only job', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect pattern: based in Region', () => {
        expect(detectRestrictivePattern('Must be based in Canada', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Role located in Europe', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('You must reside in the UK', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect pattern: Region resident(s)', () => {
        expect(detectRestrictivePattern('Requires US resident status', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Open to Canadian residents only', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect pattern: eligible/authorized to work in Region', () => {
        expect(detectRestrictivePattern('Must be eligible to work in the EU', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Authorized to work in Australia required', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect pattern: Region based/Region-based', () => {
        expect(detectRestrictivePattern('UK based candidates preferred', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('APAC-based role', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    // --- Test Cases for Standalone Negative Keywords ---
    test('should detect standalone negative keyword: Romania', () => {
        expect(detectRestrictivePattern('Location: Bucharest, Romania', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Open to candidates in Romania.', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Hiring in ROMANIA and Poland', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect standalone negative keyword: Switzerland', () => {
        expect(detectRestrictivePattern('Remote - Switzerland', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Preference for Switzerland based devs', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('switzerland', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should detect other standalone negative keywords', () => {
        expect(detectRestrictivePattern('On-site role in Berlin', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // on-site
        expect(detectRestrictivePattern('Hybrid work model', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // hybrid
        expect(detectRestrictivePattern('Job located in Poland', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // poland
    });

    test('should correctly handle case variations for standalone keywords', () => {
        expect(detectRestrictivePattern('Hiring in ROMANIA', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
        expect(detectRestrictivePattern('Must be located in Poland', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should ONLY match whole words for standalone keywords', () => {
        expect(detectRestrictivePattern('European team', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // Matches 'europe' or 'european'
        expect(detectRestrictivePattern('Muscovite', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false); // Shouldn't match 'us'
        expect(detectRestrictivePattern('Must be a Roman citizen', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false); // 'Roman' vs 'Romania'
        expect(detectRestrictivePattern('This is a USa role', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // Should match 'usa' (case-insensitive, whole word)
        expect(detectRestrictivePattern('This role is for usa citizens', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true); // Correctly matches 'usa'
    });

    // --- Test Cases for No Restriction Detected ---
    test('should return false for text with no restrictive patterns or keywords', () => {
        expect(detectRestrictivePattern('Fully Remote Software Engineer', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
        expect(detectRestrictivePattern('Remote - LATAM', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
        expect(detectRestrictivePattern('Work from anywhere', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
        expect(detectRestrictivePattern('Global team, remote friendly', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
    });

    test('should return false if negativeKeywords list is empty or null', () => {
        expect(detectRestrictivePattern('Remote (US Only)', [], mockLogger).isRestrictive).toBe(false); // Structural pattern needs RESTRICTIVE_REGIONS, not keywords list
        expect(detectRestrictivePattern('Location: Romania', [], mockLogger).isRestrictive).toBe(false);
        // expect(detectRestrictivePattern('Location: Romania', null, mockLogger)).toBe(false); // null case if needed
    });

    test('should return false for null or empty text', () => {
        expect(detectRestrictivePattern(null, commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
        expect(detectRestrictivePattern(undefined, commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
        expect(detectRestrictivePattern('', commonNegativeKeywords, mockLogger).isRestrictive).toBe(false);
    });

    // --- Specific Edge Cases from Bug Report ---
    test('should correctly detect pattern "based in Romania" if phrase in keywords', () => {
        // This now relies on 'based in romania' (or similar) being in the list if needed
        // For this test, we rely on 'romania' being detected
        expect(detectRestrictivePattern('Remote role based in Romania', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });

    test('should correctly detect standalone "Switzerland" even if not in a structural pattern', () => {
        expect(detectRestrictivePattern('Remote | Switzerland | Europe', commonNegativeKeywords, mockLogger).isRestrictive).toBe(true);
    });
});

describe('containsInclusiveSignal', () => {
    const positiveKeywords = [
        'Global', 
        'Worldwide', 
        'LATAM', 
        'Latin America', 
        'Brazil',
        'remote brazil'
    ];

    it('should return true and the keyword for a basic match', () => {
        const text = 'This job is open Worldwide';
        const result = containsInclusiveSignal(text, positiveKeywords, mockLogger);
        expect(result.isInclusive).toBe(true);
        expect(result.matchedKeyword).toBe('Worldwide');
    });

    it('should be case-insensitive', () => {
        const text = 'Location: latam region';
        const result = containsInclusiveSignal(text, positiveKeywords, mockLogger);
        expect(result.isInclusive).toBe(true);
        expect(result.matchedKeyword).toBe('LATAM'); // Returns original casing
    });

    it('should handle keywords with punctuation or at end/start', () => {
        expect(containsInclusiveSignal('Remote (Global).', positiveKeywords, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'Global' });
        expect(containsInclusiveSignal('Global is the scope.', positiveKeywords, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'Global' });
        expect(containsInclusiveSignal('Hiring: Brazil!', positiveKeywords, mockLogger))
             .toEqual({ isInclusive: true, matchedKeyword: 'Brazil' });
    });

     it('should handle multi-word keywords', () => {
        expect(containsInclusiveSignal('Open to Latin America', positiveKeywords, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'Latin America' });
         expect(containsInclusiveSignal('We offer remote brazil roles.', positiveKeywords, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'remote brazil' });
    });

    it('should return false if no keywords match', () => {
        const text = 'Based in Europe';
        const result = containsInclusiveSignal(text, positiveKeywords, mockLogger);
        expect(result.isInclusive).toBe(false);
        expect(result.matchedKeyword).toBeUndefined();
    });

    it('should return false for partial word matches', () => {
        const text = 'This job is globalized';
        const result = containsInclusiveSignal(text, positiveKeywords, mockLogger);
        expect(result.isInclusive).toBe(false);
        expect(result.matchedKeyword).toBeUndefined();
    });

    it('should return false for empty text or keywords', () => {
        expect(containsInclusiveSignal('', positiveKeywords, mockLogger))
            .toEqual({ isInclusive: false });
        expect(containsInclusiveSignal(null, positiveKeywords, mockLogger))
            .toEqual({ isInclusive: false });
        expect(containsInclusiveSignal(undefined, positiveKeywords, mockLogger))
            .toEqual({ isInclusive: false });
        expect(containsInclusiveSignal('Some text', [], mockLogger))
             .toEqual({ isInclusive: false });
         expect(containsInclusiveSignal('Some text', ['', '  '], mockLogger))
             .toEqual({ isInclusive: false });
    });

    it('should handle special regex characters in keywords', () => {
        const keywordsWithRegexChars = ['Remote (Americas)', 'Global+Plus'];
        
        // Test using `createKeywordPattern` directly from filterUtils
        const { createKeywordPattern } = require('@/lib/utils/filterUtils');
        
        // Using modified test approach that accounts for how the regex patterns are created
        expect(containsInclusiveSignal('Location: Remote (Americas)', keywordsWithRegexChars, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'Remote (Americas)' });
            
        expect(containsInclusiveSignal('Scope: Global+Plus.', keywordsWithRegexChars, mockLogger))
            .toEqual({ isInclusive: true, matchedKeyword: 'Global+Plus' });
            
        // Test character escaping directly
        const regexWithParens = createKeywordPattern('Remote (Americas)');
        expect(regexWithParens.test('Location: Remote (Americas)')).toBe(true);
        
        const regexWithPlus = createKeywordPattern('Global+Plus');
        expect(regexWithPlus.test('Scope: Global+Plus.')).toBe(true);
    });
}); 