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

    // --- Simplified Check using includes() ---
    for (const keyword of negativeKeywords) {
        const lowerKeyword = keyword.toLowerCase();
        // --- Remove DEBUG LOG --- 
        // log.info({ checkingText: lowerText, againstKeyword: lowerKeyword }, "detectRestrictivePattern: Checking keyword");
        if (lowerText.includes(lowerKeyword)) {
            // Add specific checks for ambiguous keywords like 'us' vs 'usa' if needed
            if (lowerKeyword === 'us' && !lowerText.includes(' us ') && !lowerText.endsWith(' us') && !lowerText.includes(' u.s')) {
                // Avoid matching 'us' within words like 'status' or 'previous' unless it stands alone
                // or is followed by punctuation like 'us.' which includes might catch.
                // This check might need refinement based on false positives.
                log.trace({ keyword, textSnippet: lowerText.substring(0,100) }, `Keyword 'us' found, but potentially part of another word. Skipping.`);
                continue; 
            }
            
            log.trace({ keyword: lowerKeyword, textSnippet: lowerText.substring(0, 100) }, 'Detected negative keyword/phrase via includes()');
            // --- Remove DEBUG LOG --- 
            // log.info({ matchedKeyword: lowerKeyword, text: lowerText }, "detectRestrictivePattern: Match found!");
            return true; // Found a negative keyword
        }
    }
    // --- Remove DEBUG LOG --- 
    // log.info({ text: lowerText }, "detectRestrictivePattern: No match found.");
    return false; // No negative keywords found
}