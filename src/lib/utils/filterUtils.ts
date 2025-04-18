import pino from 'pino';

// Basic logger for utility functions
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Function to escape regex special characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper to create the regex pattern, always using word boundaries
export function createKeywordPattern(keyword: string): RegExp {
  const escapedKeyword = escapeRegex(keyword);
  
  // If the keyword contains special characters like (, ), +, etc.,
  // we need a different approach as \b doesn't work well with them
  if (/[.*+?^${}()|[\]\\]/.test(keyword)) {
    // For patterns with special chars, use lookahead/lookbehind for word boundaries
    // or a more relaxed pattern matching with potential spaces/punctuation
    return new RegExp(`(^|\\s|[.,;:!?])${escapedKeyword}($|\\s|[.,;:!?])`, 'i');
  }
  
  // For normal words, use the standard word boundary approach
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i');
}

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
 * @returns An object indicating if restrictive and the matched keyword, if found.
 */
export function detectRestrictivePattern(
    text: string | null | undefined,
    negativeKeywords: string[],
    contextLogger?: pino.Logger
): {
    isRestrictive: boolean;
    matchedKeyword?: string;
} {
    const log = contextLogger || logger;
    if (!text || !negativeKeywords || negativeKeywords.length === 0) {
        return { isRestrictive: false };
    }

    const lowerText = text.toLowerCase();

    // Sort keywords by length descending to match longer phrases first
    const sortedKeywords = [...negativeKeywords].sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (!lowerKeyword) continue;

        const pattern = createKeywordPattern(lowerKeyword);
        try {
            if (pattern.test(lowerText)) {
                log.trace({ 
                    keyword: keyword, 
                    textSnippet: lowerText.substring(0, 100), 
                    regex: pattern.toString() 
                }, 'Detected restrictive keyword/phrase via iterative regex');
                return { isRestrictive: true, matchedKeyword: keyword };
            }
        } catch (e) {
            log.error({ error: e, pattern: pattern.toString(), keyword: keyword }, "Error creating or testing regex in detectRestrictivePattern");
        }
    }
    return { isRestrictive: false };
}

/**
 * Checks if a text snippet contains any of the provided positive/inclusive keywords/phrases.
 * Uses a similar regex approach to detectRestrictivePattern for robust matching.
 *
 * @param text The text snippet to check.
 * @param inclusiveKeywords An array of strings representing allowed/positive keywords/regions/phrases.
 * @param contextLogger Optional logger for detailed tracing.
 * @returns An object indicating if an inclusive signal was found and the matched keyword.
 */
export function containsInclusiveSignal(
    text: string | null | undefined,
    inclusiveKeywords: string[],
    contextLogger?: pino.Logger
): {
    isInclusive: boolean;
    matchedKeyword?: string;
} {
    const log = contextLogger || logger;
    if (!text || !inclusiveKeywords || inclusiveKeywords.length === 0) {
        return { isInclusive: false };
    }

    const lowerText = text.toLowerCase();

    // Sort keywords by length descending
    const sortedKeywords = [...inclusiveKeywords].sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (!lowerKeyword) continue;

        const pattern = createKeywordPattern(lowerKeyword);
        try {
            if (pattern.test(lowerText)) {
                 log.trace({ 
                    keyword: keyword, 
                    textSnippet: lowerText.substring(0, 100), 
                    regex: pattern.toString() 
                }, 'Detected inclusive keyword/phrase via iterative regex');
                return { isInclusive: true, matchedKeyword: keyword };
            }
        } catch (e) {
             log.error({ error: e, pattern: pattern.toString(), keyword: keyword }, "Error creating or testing regex in containsInclusiveSignal");
        }
    }
    return { isInclusive: false };
}