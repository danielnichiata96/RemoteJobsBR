import pino from 'pino';
import { JobSource } from '@prisma/client';

/**
 * Statistics for a single job source fetch run.
 */
export interface SourceStats {
    found: number;      // Total jobs found in the source API/page
    relevant: number;   // Jobs considered relevant by the filter
    processed: number;  // Jobs successfully saved/updated in the DB
    deactivated: number;// Jobs marked as closed/inactive (This will be set by the orchestrator)
    errors: number;     // Errors encountered during processing
}

/**
 * Result object returned by a JobFetcher's processSource method.
 */
export interface FetcherResult {
    stats: SourceStats;
    foundSourceIds: Set<string>; // Set of job sourceIds found during this fetch
}

/**
 * Interface for job fetcher implementations.
 * Each source (Greenhouse, LinkedIn, etc.) will have a class implementing this interface.
 */
export interface JobFetcher {
    /**
     * Processes a single job source defined in the database.
     * Fetches jobs, filters them, and processes relevant ones.
     * Deactivation logic is typically handled by the orchestrator using the returned foundSourceIds.
     * 
     * @param source The JobSource object from the database.
     * @param parentLogger A pino logger instance.
     * @returns A promise resolving to a FetcherResult containing stats and the set of found job sourceIds.
     */
    processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult>;

    // Potentially add other common methods later if needed, e.g.:
    // loadFilterConfig?(config: any): Promise<FilterConfig>;
    // validateSourceConfig?(config: any): boolean;
}

// --- Greenhouse Specific Interfaces ---
export interface GreenhouseOffice {
    id: number;
    name: string;
    location: string; // Sometimes contains useful detail
}
export interface GreenhouseMetadata {
    id: number;
    name: string;
    value: string | string[] | null;
}
export interface GreenhouseJob {
    id: number;
    title: string;
    updated_at: string;
    location: { name: string };
    content: string;
    absolute_url: string;
    metadata: GreenhouseMetadata[];
    offices: GreenhouseOffice[];
    departments: Array<{ name: string }>;
    company?: { name: string }; // Optional company info
    _determinedHiringRegionType?: 'global' | 'latam'; // Internal field added during processing
}

/**
 * Result object for the internal _isJobRelevant check.
 */
export interface FilterResult {
    relevant: boolean;
    reason: string;
    type?: 'global' | 'latam';
}

// --- Ashby Specific Interfaces ---
// Based on: https://api.ashbyhq.com/posting-api-schema#Location
export interface AshbyLocation {
  id: string;
  name: string;
  type: string; // Using string for flexibility as exact enum might vary
  address?: {
    rawAddress: string | null;
    streetAddress1: string | null;
    streetAddress2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null; // Example: "US", "BR"
  } | null;
  isRemote: boolean; // Location specific remote flag
}

// Updated AshbyApiJob interface based on official schema + internal field
export interface AshbyApiJob {
    id: string;
    title: string;
    locations: AshbyLocation[]; // Primary locations array
    secondaryLocations?: AshbyLocation[]; // Optional secondary locations array
    department?: { id: string; name: string; } | null;
    team?: { id: string; name: string; } | null;
    isRemote: boolean | null;
    descriptionHtml?: string | null;
    descriptionPlain?: string | null;
    publishedAt: string; // ISO DateTime string
    updatedAt: string; // ISO DateTime string
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary" | null;
    compensationTier?: { id: string; name: string; } | null;
    compensationRange?: string | null;
    isListed: boolean;
    jobUrl: string;
    applyUrl: string;
    // Internal field added by fetcher after filtering:
    _determinedHiringRegionType?: 'global' | 'latam';
}

// --- Ashby Specific Config Interfaces ---
export interface AshbyPositiveFilterConfig {
    remoteKeywords: string[];     // From LOCATION_KEYWORDS.STRONG_POSITIVE_GLOBAL
    latamKeywords: string[];      // From LOCATION_KEYWORDS.STRONG_POSITIVE_LATAM
    brazilKeywords: string[];     // From LOCATION_KEYWORDS.ACCEPT_EXACT_LATAM_COUNTRIES
    contentLatamKeywords: string[]; // From CONTENT_KEYWORDS.STRONG_POSITIVE_LATAM
    contentGlobalKeywords: string[]; // From CONTENT_KEYWORDS.STRONG_POSITIVE_GLOBAL
}

export interface NegativeFilterConfig {
    keywords: string[];
} 