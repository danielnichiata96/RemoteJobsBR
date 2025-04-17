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
): {
    isRestrictive: boolean;
    matchedKeyword?: string;
    reason?: string;
} {
    const log = contextLogger || logger;
    if (!text || !negativeKeywords || negativeKeywords.length === 0) {
        return { isRestrictive: false };
    }

    const lowerText = text.toLowerCase();

    for (const keyword of negativeKeywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (!lowerKeyword) continue; // Skip empty keywords

        // Use regex with word boundaries for all keywords
        const escapedKeyword = lowerKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Create regex: \b(keyword)\b - handles beginning/end of string or non-word chars
        // Use \b for word boundaries
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i'); // Case-insensitive

        if (regex.test(lowerText)) {
            const reason = `Found restrictive keyword: "${keyword}" using regex \b${escapedKeyword}\b`;
            log.trace({ keyword: lowerKeyword, textSnippet: lowerText.substring(0, 100), reason }, 'Detected negative keyword/phrase via regex');
            return { isRestrictive: true, matchedKeyword: keyword, reason }; // Found a negative keyword
        }
    }
    // Explicitly return false if loop completes without finding a match
    return { isRestrictive: false }; 
}