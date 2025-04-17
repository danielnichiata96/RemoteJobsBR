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
    durationMs: number;          // Duration of the processSource execution
    errorMessage?: string;       // Optional error message if the process failed significantly
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


export interface LeverApiPosting {
    id: string;
    text: string; // Job posting name (Title)
    categories?: {
        commitment?: string; // e.g., "Full-time"
        department?: string;
        level?: string;
        location?: string; // Primary location category
        team?: string;
        allLocations?: string[]; // Added based on docs note
    };
    // --- Fields based on Official Docs ---
    description?: string; // Combined job description opening and body (as styled HTML)
    descriptionPlain?: string; // Combined job description opening and body (as plaintext)
    lists?: Array<{ // Extra lists (such as requirements, benefits, etc.)
        text: string; // NAME
        content: string; // unstyled HTML of list elements
    }>;
    opening?: string; // Job description opening (as styled HTML)
    openingPlain?: string; // Job description opening (as plaintext)
    descriptionBody?: string; // Job description body without opening (as styled HTML)
    descriptionBodyPlain?: string; // Job description body without opening (as plaintext)
    additional?: string; // Optional closing content (as styled HTML)
    additionalPlain?: string; // Optional closing content (as plaintext)
    // --- End Official Docs Fields ---

    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
    hostedUrl: string; // URL to the Lever-hosted job page
    applyUrl: string; // URL to the Lever-hosted application page
    country?: string;
    company?: string; // Name of the company (often inferred from the source)
    salaryRange?: { // Note: Salary info might not always be present
        min: number;
        max: number;
        currency: string; // e.g., "USD"
        interval: string; // e.g., "year"
    };
    workplaceType?: 'on-site' | 'remote' | 'hybrid'; // Lever standard field
    // Internal field added by fetcher after filtering:
    _determinedHiringRegionType?: 'global' | 'latam';
}

export interface NegativeFilterConfig {
    keywords: string[];
} 