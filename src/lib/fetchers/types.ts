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