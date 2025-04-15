import pino from 'pino';

// Basic logger for utility functions
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// List of common region/country names used in restrictions
const RESTRICTIVE_REGIONS = [
    'us', 'usa', 'u.s', 'u.s.a', 'united states', 'america', // Added america
    'canada', 'canadian',
    'uk', 'united kingdom', 'british',
    'eu', 'europe', 'european union', 'european',
    'emea',
    'apac',
    'asia', 'asian',
    'australia', 'australian', 'new zealand',
    'noram', 'north america', // Added north america
    // Add specific countries if needed, e.g., 'germany', 'france'
];

/**
 * Checks if a text snippet contains common restrictive location patterns.
 * 
 * Examples:
 * - "Remote (US Only)"
 * - "Remote, based in Europe"
 * - "Eligible to work in Canada"
 * - "Applicants must be US residents"
 * 
 * @param text The text snippet to check (e.g., part of title, location, or content).
 * @param contextLogger Optional logger for detailed tracing.
 * @returns True if a restrictive pattern is found, false otherwise.
 */
export function detectRestrictivePattern(text: string | null | undefined, contextLogger?: pino.Logger): boolean {
    const log = contextLogger || logger;
    if (!text) {
        return false;
    }

    const lowerText = text.toLowerCase();

    // Combine regions into a regex group
    const regionPattern = RESTRICTIVE_REGIONS.join('|').replace(/\./g, '\\.'); // Escape dots

    // Define regex patterns for common restrictions
    const patterns: RegExp[] = [
        // Pattern: (Region Only), [Region Only], Region Only
        new RegExp(`[(\[\s](${regionPattern})\s+only[)\]\s]`, 'i'),
        // Pattern: based in Region, located in Region, must be in Region, reside in Region
        new RegExp(`(based|located|must\s+be|reside)\s+in\s+(${regionPattern})`, 'i'),
        // Pattern: Region resident(s)
        new RegExp(`(${regionPattern})\s+resident(s)?`, 'i'),
        // Pattern: eligible to work in Region, authorized to work in Region
        new RegExp(`(eligible|authorized)\s+to\s+work\s+in\s+(${regionPattern})`, 'i'),
        // Pattern: Region based, Region-based
        new RegExp(`(${regionPattern})[- ]based`, 'i'),
        // Pattern: must be Region citizen/citizenship (more specific)
        // new RegExp(`must\s+be\s+(${regionPattern})\s+citizen(ship)?`, 'i'), 
    ];

    for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
            log.trace({ pattern: pattern.source, textSnippet: lowerText.substring(0, 100) }, 'Detected restrictive pattern');
            return true; // Found a restrictive pattern
        }
    }

    return false; // No restrictive patterns found
} 