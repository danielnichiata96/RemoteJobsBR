import { detectRestrictivePattern } from '../../../src/lib/utils/filterUtils';
import pino from 'pino';

// Mock logger to prevent console output during tests
const mockLogger = pino({ level: 'silent' });

describe('detectRestrictivePattern', () => {
    const commonNegativeKeywords = [
        'us', 'usa', 'canada', 'uk', 'eu', 'europe', 'emea', 'apac', 'asia', 'australia',
        'romania', 'switzerland', 'poland', 'germany', 'france', 'on-site', 'hybrid',
        // Add specific phrases potentially missed by simple keywords
        'us resident', 'canadian resident', 'uk resident', 'eu resident',
        'based in us', 'based in canada', 'based in uk', 'based in eu',
        'us only', 'canada only', 'uk only', 'eu only'
    ];

    // --- Test Cases for Structural Patterns ---
    test('should detect pattern: (Region Only)', () => {
        expect(detectRestrictivePattern('Remote (US Only)', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Remote [EU Only]', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Remote, UK Only job', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect pattern: based in Region', () => {
        expect(detectRestrictivePattern('Must be based in Canada', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Role located in Europe', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('You must reside in the UK', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect pattern: Region resident(s)', () => {
        expect(detectRestrictivePattern('Requires US resident status', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Open to Canadian residents only', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect pattern: eligible/authorized to work in Region', () => {
        expect(detectRestrictivePattern('Must be eligible to work in the EU', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Authorized to work in Australia required', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect pattern: Region based/Region-based', () => {
        expect(detectRestrictivePattern('UK based candidates preferred', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('APAC-based role', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    // --- Test Cases for Standalone Negative Keywords ---
    test('should detect standalone negative keyword: Romania', () => {
        expect(detectRestrictivePattern('Location: Bucharest, Romania', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Open to candidates in Romania.', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Hiring in ROMANIA and Poland', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect standalone negative keyword: Switzerland', () => {
        expect(detectRestrictivePattern('Remote - Switzerland', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Preference for Switzerland based devs', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('switzerland', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should detect other standalone negative keywords', () => {
        expect(detectRestrictivePattern('On-site role in Berlin', commonNegativeKeywords, mockLogger)).toBe(true); // on-site
        expect(detectRestrictivePattern('Hybrid work model', commonNegativeKeywords, mockLogger)).toBe(true); // hybrid
        expect(detectRestrictivePattern('Job located in Poland', commonNegativeKeywords, mockLogger)).toBe(true); // poland
    });

    test('should correctly handle case variations for standalone keywords', () => {
        expect(detectRestrictivePattern('Hiring in ROMANIA', commonNegativeKeywords, mockLogger)).toBe(true);
        expect(detectRestrictivePattern('Must be located in Poland', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should ONLY match whole words for standalone keywords', () => {
        expect(detectRestrictivePattern('European team', commonNegativeKeywords, mockLogger)).toBe(true); // Matches 'europe'
        expect(detectRestrictivePattern('Muscovite', commonNegativeKeywords, mockLogger)).toBe(false); // Shouldn't match 'us'
        expect(detectRestrictivePattern('Must be a Roman citizen', commonNegativeKeywords, mockLogger)).toBe(false); // 'Roman' vs 'Romania'
        expect(detectRestrictivePattern('This is a USa role', commonNegativeKeywords, mockLogger)).toBe(false); // Missing word boundary before usa
        expect(detectRestrictivePattern('This role is for usa citizens', commonNegativeKeywords, mockLogger)).toBe(true); // Correctly matches 'usa'
    });

    // --- Test Cases for No Restriction Detected ---
    test('should return false for text with no restrictive patterns or keywords', () => {
        expect(detectRestrictivePattern('Fully Remote Software Engineer', commonNegativeKeywords, mockLogger)).toBe(false);
        expect(detectRestrictivePattern('Remote - LATAM', commonNegativeKeywords, mockLogger)).toBe(false);
        expect(detectRestrictivePattern('Work from anywhere', commonNegativeKeywords, mockLogger)).toBe(false);
        expect(detectRestrictivePattern('Global team, remote friendly', commonNegativeKeywords, mockLogger)).toBe(false);
    });

    test('should return false if negativeKeywords list is empty or null', () => {
        expect(detectRestrictivePattern('Remote (US Only)', [], mockLogger)).toBe(false); // Structural pattern needs RESTRICTIVE_REGIONS, not keywords list
        expect(detectRestrictivePattern('Location: Romania', [], mockLogger)).toBe(false);
        // expect(detectRestrictivePattern('Location: Romania', null, mockLogger)).toBe(false); // null case if needed
    });

    test('should return false for null or empty text', () => {
        expect(detectRestrictivePattern(null, commonNegativeKeywords, mockLogger)).toBe(false);
        expect(detectRestrictivePattern(undefined, commonNegativeKeywords, mockLogger)).toBe(false);
        expect(detectRestrictivePattern('', commonNegativeKeywords, mockLogger)).toBe(false);
    });

    // --- Specific Edge Cases from Bug Report ---
    test('should correctly detect pattern "based in Romania" if phrase in keywords', () => {
        // This now relies on 'based in romania' (or similar) being in the list if needed
        // For this test, we rely on 'romania' being detected
        expect(detectRestrictivePattern('Remote role based in Romania', commonNegativeKeywords, mockLogger)).toBe(true);
    });

    test('should correctly detect standalone "Switzerland" even if not in a structural pattern', () => {
        expect(detectRestrictivePattern('Remote | Switzerland | Europe', commonNegativeKeywords, mockLogger)).toBe(true);
    });
}); 