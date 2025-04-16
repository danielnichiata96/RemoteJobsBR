import pino from 'pino';

// Basic logger for utility functions
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Checks if a text snippet contains any of the provided negative keywords/phrases.
 *
 * Examples:
 * - "Remote (US Only)" -> Keyword match (if 'us only' is in negativeKeywords)
 * - "Remote, based in Europe" -> Keyword match (if 'based in europe' is in negativeKeywords)
 * - "Eligible to work in Canada" -> Keyword match (if 'eligible to work in canada' is in negativeKeywords)
 * - "Location: Romania" -> Keyword match (if 'romania' is in negativeKeywords)
 *
 * @param text The text snippet to check (e.g., part of title, location, or content).
 * @param negativeKeywords An array of strings representing disallowed keywords/countries/phrases.
 * @param contextLogger Optional logger for detailed tracing.
 * @returns True if any negative keyword is found, false otherwise.
 */
export function detectRestrictivePattern(
    text: string | null | undefined,
    negativeKeywords: string[],
    contextLogger?: pino.Logger
): boolean {
    const log = contextLogger || logger;
    if (!text || !negativeKeywords || negativeKeywords.length === 0) {
        return false;
    }

    const lowerText = text.toLowerCase();

    // --- Simplified Check for Any Negative Keyword ---
    try {
        // Escape keywords for regex FIRST, then join with |
        const escapedKeywords = negativeKeywords.map(kw =>
            // Escape common regex special characters
            kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );

        // Build the final pattern with improved word boundaries
        // Using lookarounds `(?<!\w)` and `(?!\w)` for more robust word matching
        // This handles cases like 'us' vs 'russia' or 'resident' vs 'residents'
        // Reverting to simpler \b word boundary check as lookarounds caused issues
        const patternString = `\b(${escapedKeywords.join('|')})\b`;
        const negativeKeywordPattern = new RegExp(patternString, 'i');

        if (negativeKeywordPattern.test(lowerText)) {
            const match = lowerText.match(negativeKeywordPattern);
            const matchedKeyword = match ? match[1] : 'unknown';
            log.trace({ keyword: matchedKeyword, textSnippet: lowerText.substring(0, 100) }, 'Detected negative keyword/phrase');
            return true; // Found a negative keyword
        }
    } catch (e) {
        log.error({ error: e, keywordCount: negativeKeywords.length }, "Error constructing/testing negative keyword regex in detectRestrictivePattern");
        return false; // Fail safe
    }

    return false; // No negative keywords found
}